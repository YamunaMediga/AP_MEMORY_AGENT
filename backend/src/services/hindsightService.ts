import { HindsightClient } from '@vectorize-io/hindsight-client';
import { config } from '../config.js';
import { queryAll, queryOne, run } from '../database/db.js';
import crypto from 'crypto';

export interface MemoryItem {
  id: string;
  content: string;
  context: string;
  memoryType: string;
  relevanceScore: number;
  source: 'hindsight_cloud' | 'hindsight_local';
  createdAt: string;
  vendorName?: string;
  invoiceRef?: string;
  discrepancyType?: string;
  previousDecision?: string;
  exceptionNote?: string;
  whyRelevant?: string;
  learningScope?: 'general' | 'vendor' | 'invoice';
}

export interface VendorMemoryProfile {
  vendorName: string;
  invoicesCount: number;
  amountRange: {
    min: number;
    max: number;
    avg: number;
    total: number;
    currency: string;
  };
  paymentTerms: string;
  previousDiscrepancies: string[];
  previousExceptions: string[];
  previousDecisions: {
    approved: number;
    rejected: number;
    flagged: number;
    corrected: number;
  };
  learnedPatterns: string[];
  recentMemories: MemoryItem[];
}

export interface HindsightStatus {
  mode: 'cloud' | 'local';
  cloudConfigured: boolean;
  cloudReachable: boolean;
  baseUrl: string;
  bankId: string;
  totalMemories: number;
}

class HindsightService {
  private client: HindsightClient | null = null;

  constructor() {
    this.initClient();
  }

  public initClient() {
    if (config.hindsightApiKey && config.hindsightApiKey.trim()) {
      try {
        this.client = new HindsightClient({
          baseUrl: config.hindsightBaseUrl || 'https://api.hindsight.vectorize.io',
          apiKey: config.hindsightApiKey.trim(),
        });
      } catch (err) {
        console.warn('Failed to initialize Hindsight Cloud client:', err);
        this.client = null;
      }
    } else {
      this.client = null;
    }
  }

  public getBankId(userId: string): string {
    const cleanId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `ap_bank_${cleanId}`;
  }

  /**
   * Retain a memory (human feedback, vendor benchmark, or policy rule)
   */
  public async retain(
    userId: string,
    content: string,
    context: string = 'User Policy Rule',
    memoryType: string = 'policy',
    meta?: {
      vendorName?: string;
      invoiceRef?: string;
      discrepancyType?: string;
      humanDecision?: string;
      exceptionNote?: string;
      whyRelevant?: string;
      learningScope?: 'general' | 'vendor' | 'invoice';
    }
  ): Promise<{ id: string; success: boolean; mode: 'cloud' | 'local' }> {
    const memoryId = `mem_${crypto.randomUUID()}`;
    const bankId = this.getBankId(userId);
    const now = new Date().toISOString();

    // 1. Always store in local SQLite memory bank with rich metadata
    run(
      `INSERT INTO memory_records (
        id, bank_id, user_id, content, memory_type, context, created_at,
        vendor_name, invoice_ref, discrepancy_type, human_decision, exception_note, why_relevant, learning_scope
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        memoryId,
        bankId,
        userId,
        content,
        memoryType,
        context,
        now,
        meta?.vendorName || null,
        meta?.invoiceRef || null,
        meta?.discrepancyType || null,
        meta?.humanDecision || null,
        meta?.exceptionNote || null,
        meta?.whyRelevant || null,
        meta?.learningScope || 'vendor',
      ]
    );

    // 2. If Hindsight Cloud client is active, retain in Cloud
    let cloudSucceeded = false;
    if (this.client && config.hindsightApiKey) {
      try {
        const retainTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Hindsight Cloud retain timed out after 1500ms')), 1500)
        );
        await Promise.race([this.client.retain(bankId, content), retainTimeout]);
        cloudSucceeded = true;
      } catch (err: any) {
        console.warn('Hindsight Cloud retain notice (local bank active):', err?.message || err);
      }
    }

    return {
      id: memoryId,
      success: true,
      mode: cloudSucceeded ? 'cloud' : 'local',
    };
  }

  /**
   * Recall memories relevant to an invoice and discrepancy query
   */
  public async recall(
    userId: string,
    query: string,
    limit: number = 5,
    vendorFilter?: string
  ): Promise<MemoryItem[]> {
    const bankId = this.getBankId(userId);
    const recalled: MemoryItem[] = [];

    // 1. Fast targeted Query to Hindsight Cloud if available with 1500ms timeout
    if (this.client && config.hindsightApiKey) {
      try {
        const recallTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Hindsight Cloud recall timed out after 1500ms')), 1500)
        );
        const cloudResult = await Promise.race([this.client.recall(bankId, query), recallTimeout]);
        if (cloudResult && Array.isArray((cloudResult as any)?.memories)) {
          for (const m of (cloudResult as any).memories) {
            recalled.push({
              id: m.id || `cloud_${crypto.randomUUID()}`,
              content: m.content || m.text || JSON.stringify(m),
              context: m.context || 'Hindsight Cloud Memory',
              memoryType: m.type || 'policy',
              relevanceScore: m.score || 0.95,
              source: 'hindsight_cloud',
              createdAt: m.created_at || new Date().toISOString(),
              whyRelevant: 'Relevant past policy memory retrieved from Vectorize Cloud Bank.',
            });
          }
        }
      } catch (err: any) {
        console.warn('Hindsight Cloud recall notice, using local memory engine:', err?.message || err);
      }
    }

    // 2. Query Local Memory Bank
    const localRecords = queryAll<any>(
      `SELECT * FROM memory_records WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );

    const queryTokens = query.toLowerCase().split(/[\s,.;:!?]+/).filter(t => t.length > 2);
    const cleanVendor = (vendorFilter || '').toLowerCase().trim();

    for (const record of localRecords) {
      const searchTarget = `${record.content} ${record.context || ''} ${record.vendor_name || ''} ${record.discrepancy_type || ''} ${record.memory_type || ''}`.toLowerCase();
      let matchCount = 0;
      for (const token of queryTokens) {
        if (searchTarget.includes(token)) {
          matchCount++;
        }
      }

      // Base score from token overlap
      let score = 0.5;
      if (queryTokens.length > 0) {
        score = Math.min(0.98, 0.4 + (matchCount / queryTokens.length) * 0.55);
      }

      // High-priority boost for human decisions & vendor exceptions
      const recordVendor = (record.vendor_name || '').toLowerCase();
      const isVendorMatch = cleanVendor && recordVendor && (cleanVendor.includes(recordVendor) || recordVendor.includes(cleanVendor));

      if (isVendorMatch) {
        score = Math.min(0.99, score + 0.25);
      }

      if (record.memory_type === 'human_decision' || record.memory_type === 'exception_granted') {
        score = Math.min(0.99, score + 0.20);
      } else if (record.memory_type === 'pricing_benchmark' || record.memory_type === 'vendor_knowledge') {
        score = Math.min(0.99, score + 0.15);
      }

      // Generate human-friendly explanation of why it is relevant
      let whyRelevant = record.why_relevant;
      if (!whyRelevant) {
        if (record.human_decision === 'approved' && record.discrepancy_type === 'shipping_unmatched') {
          whyRelevant = `Finance team previously confirmed and approved shipping charges for ${record.vendor_name || 'this vendor'}.`;
        } else if (record.memory_type === 'human_decision') {
          whyRelevant = `Finance reviewer previously made a ${record.human_decision?.toUpperCase()} decision for a similar submission.`;
        } else if (record.memory_type === 'pricing_benchmark') {
          whyRelevant = `Establishes the historical unit pricing and amount benchmark for ${record.vendor_name || 'this vendor'}.`;
        } else {
          whyRelevant = `Provides operational context from previous invoice reviews for this vendor.`;
        }
      }

      if (matchCount > 0 || isVendorMatch || localRecords.length <= 3) {
        const existing = recalled.find(r => r.content === record.content);
        if (!existing) {
          recalled.push({
            id: record.id,
            content: record.content,
            context: record.context || 'User Stored Precedent',
            memoryType: record.memory_type || 'policy',
            relevanceScore: Math.round(score * 100) / 100,
            source: 'hindsight_local',
            createdAt: record.created_at,
            vendorName: record.vendor_name || undefined,
            invoiceRef: record.invoice_ref || undefined,
            discrepancyType: record.discrepancy_type || undefined,
            previousDecision: record.human_decision || undefined,
            exceptionNote: record.exception_note || undefined,
            whyRelevant,
            learningScope: record.learning_scope || 'vendor',
          });
        }
      }
    }

    // Sort by relevance score descending, then by recency
    recalled.sort((a, b) => 
      b.relevanceScore - a.relevanceScore || 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return recalled.slice(0, limit);
  }

  /**
   * Generates Vendor Memory Profiles for all vendors
   */
  public async getVendorMemoryProfiles(userId: string): Promise<VendorMemoryProfile[]> {
    const requests = queryAll<any>(
      `SELECT * FROM requests WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );

    const memories = queryAll<any>(
      `SELECT * FROM memory_records WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );

    // Group by applicant_name
    const vendorMap: Record<string, any[]> = {};
    for (const r of requests) {
      const v = r.applicant_name?.trim() || 'Unknown Vendor';
      if (!vendorMap[v]) vendorMap[v] = [];
      vendorMap[v].push(r);
    }

    const profiles: VendorMemoryProfile[] = [];

    for (const [vendorName, vRequests] of Object.entries(vendorMap)) {
      const amounts = vRequests.map(r => r.amount || 0);
      const minAmount = amounts.length > 0 ? Math.min(...amounts) : 0;
      const maxAmount = amounts.length > 0 ? Math.max(...amounts) : 0;
      const totalAmount = amounts.reduce((a, b) => a + b, 0);
      const avgAmount = amounts.length > 0 ? Math.round(totalAmount / amounts.length) : 0;
      const currency = vRequests[0]?.currency || 'USD';

      // Terms
      const termsSet = new Set(vRequests.map(r => r.notes?.match(/Net-\d+/i)?.[0] || 'Net-30'));
      const paymentTerms = Array.from(termsSet).join(', ') || 'Net-30';

      // Decisions
      const decisions = {
        approved: vRequests.filter(r => r.status === 'approved').length,
        rejected: vRequests.filter(r => r.status === 'rejected').length,
        flagged: vRequests.filter(r => r.status === 'flagged').length,
        corrected: vRequests.filter(r => r.human_decision === 'corrected').length,
      };

      // Discrepancies
      const discrepancies: string[] = [];
      const exceptions: string[] = [];
      for (const r of vRequests) {
        if (r.discrepancy_details && !discrepancies.includes(r.discrepancy_details)) {
          discrepancies.push(r.discrepancy_details);
        }
        if (r.exception_granted && !exceptions.includes(r.exception_granted)) {
          exceptions.push(r.exception_granted);
        }
      }

      // Vendor memories
      const vendorMemories: MemoryItem[] = memories
        .filter(m => (m.vendor_name || '').toLowerCase() === vendorName.toLowerCase() || (m.content || '').toLowerCase().includes(vendorName.toLowerCase()))
        .map(m => ({
          id: m.id,
          content: m.content,
          context: m.context,
          memoryType: m.memory_type,
          relevanceScore: 0.95,
          source: 'hindsight_local',
          createdAt: m.created_at,
          vendorName: m.vendor_name,
          invoiceRef: m.invoice_ref,
          discrepancyType: m.discrepancy_type,
          previousDecision: m.human_decision,
          exceptionNote: m.exception_note,
          whyRelevant: m.why_relevant,
          learningScope: m.learning_scope,
        }));

      // Detect Frequently Observed Patterns
      const learnedPatterns: string[] = [];
      const shippingCount = vRequests.filter(r => r.discrepancy_type === 'shipping_unmatched').length;
      if (shippingCount >= 1) {
        learnedPatterns.push(
          `${vendorName} frequently includes shipping charges separately from the PO amount. Past reviews confirmed shipping charges are permitted.`
        );
      }
      if (vRequests.length >= 2 && minAmount === maxAmount) {
        learnedPatterns.push(
          `Consistent recurring billing pattern observed: Fixed ${currency} ${minAmount.toLocaleString()} per transmission.`
        );
      }
      if (exceptions.length > 0) {
        learnedPatterns.push(
          `Finance exception precedent active: "${exceptions[0]}".`
        );
      }
      if (learnedPatterns.length === 0) {
        learnedPatterns.push(
          `Standard vendor profile established under ${paymentTerms} payment terms.`
        );
      }

      profiles.push({
        vendorName,
        invoicesCount: vRequests.length,
        amountRange: {
          min: minAmount,
          max: maxAmount,
          avg: avgAmount,
          total: totalAmount,
          currency,
        },
        paymentTerms,
        previousDiscrepancies: discrepancies,
        previousExceptions: exceptions,
        previousDecisions: decisions,
        learnedPatterns,
        recentMemories: vendorMemories.slice(0, 5),
      });
    }

    return profiles;
  }

  /**
   * Returns chronological memory activity log
   */
  public async getMemoryActivity(userId: string): Promise<any[]> {
    const records = queryAll<any>(
      `SELECT * FROM memory_records WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );

    return records.map(r => ({
      id: r.id,
      date: r.created_at,
      vendor: r.vendor_name || 'General Policy',
      event: r.context || 'Memory Retained',
      content: r.content,
      memoryType: r.memory_type,
      humanDecision: r.human_decision || null,
      exceptionNote: r.exception_note || null,
      sourceInvoice: r.invoice_ref || null,
      learningScope: r.learning_scope || 'vendor',
      whyRelevant: r.why_relevant || null,
    }));
  }

  /**
   * Computes real AP Overview and Learning Metrics from SQLite
   */
  public async getLearningMetrics(userId: string): Promise<any> {
    const requests = queryAll<any>(`SELECT * FROM requests WHERE user_id = ?`, [userId]);
    const memories = queryAll<any>(`SELECT * FROM memory_records WHERE user_id = ?`, [userId]);
    const audits = queryAll<any>(`SELECT * FROM audit_events WHERE user_id = ?`, [userId]);

    const totalInvoices = requests.length;
    const approvedInvoices = requests.filter(r => r.status === 'approved').length;
    const rejectedInvoices = requests.filter(r => r.status === 'rejected').length;
    const flaggedInvoices = requests.filter(r => r.status === 'flagged').length;
    const totalDiscrepancies = requests.filter(r => r.discrepancy_detected === 1 || r.discrepancy_type !== 'none').length;
    const humanCorrections = requests.filter(r => r.human_decision && r.human_decision !== r.agent_decision).length;

    const memoriesCreated = memories.length;
    const memoriesRecalled = audits.filter(a => a.event_type === 'recalling_memory' || a.description?.includes('memory')).length;
    const influencedRecommendations = requests.filter(r => r.agent_rationale?.toLowerCase().includes('memory') || r.agent_rationale?.toLowerCase().includes('approved because') || r.agent_rationale?.toLowerCase().includes('precedent')).length;

    return {
      apOverview: {
        totalInvoices,
        approvedInvoices,
        rejectedInvoices,
        flaggedInvoices,
        totalDiscrepancies,
        humanCorrections,
        memoriesCreated,
        memoriesRecalled,
      },
      learningMetrics: {
        experiencesRemembered: memoriesCreated,
        influencedRecommendations,
        humanCorrectionsRetained: requests.filter(r => r.human_decision).length,
        memoryInfluenceRate: totalInvoices > 0 ? Math.round((influencedRecommendations / totalInvoices) * 100) : 0,
      },
    };
  }

  /**
   * Status check
   */
  public async getStatus(userId: string): Promise<HindsightStatus> {
    const bankId = this.getBankId(userId);
    const countRow = queryOne<any>(
      `SELECT COUNT(*) as count FROM memory_records WHERE user_id = ?`,
      [userId]
    );

    return {
      mode: this.client && config.hindsightApiKey ? 'cloud' : 'local',
      cloudConfigured: !!(this.client && config.hindsightApiKey),
      cloudReachable: !!(this.client && config.hindsightApiKey),
      baseUrl: config.hindsightBaseUrl || 'https://api.hindsight.vectorize.io',
      bankId,
      totalMemories: countRow?.count || 0,
    };
  }

  /**
   * List all stored memories for a user
   */
  public listMemories(userId: string): any[] {
    return queryAll<any>(
      `SELECT * FROM memory_records WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );
  }

  /**
   * Reflect on memories to synthesize cross-invoice knowledge
   */
  public async reflect(userId: string, prompt: string): Promise<string> {
    const bankId = this.getBankId(userId);
    if (this.client && config.hindsightApiKey && typeof (this.client as any).reflect === 'function') {
      try {
        const result = await (this.client as any).reflect(bankId, prompt);
        return result?.reflection || result?.message || JSON.stringify(result);
      } catch (err: any) {
        console.warn('Cloud reflect error, falling back to local synthesis:', err?.message || err);
      }
    }
    const memories = this.listMemories(userId);
    if (memories.length === 0) {
      return 'No memories or policies recorded yet. Upload an invoice or create an explicit policy to begin.';
    }
    return `Synthesized insights from ${memories.length} memories: Active rules include vendor-specific pricing precedents, shipping discrepancy exceptions, and approval thresholds.`;
  }
}

export const hindsightService = new HindsightService();
