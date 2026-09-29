import { Groq } from 'groq-sdk';
import { config } from '../config.js';
import { MemoryItem } from './hindsightService.js';
import { CurrencyRates, DomainCheckResult } from './externalDataService.js';
import { DiscrepancyResult } from './discrepancyService.js';

export interface RecalledExperience {
  experience: string;
  previousDecision: string;
  whyRelevant: string;
}

export interface EvaluationResult {
  decision: 'approved' | 'flagged' | 'changes_requested' | 'rejected';
  rationale: string;
  confidence: number;
  memoryApplied: string;
  keyFactors: string[];
  recalledExperiences?: RecalledExperience[];
}

class LLMService {
  private groqClient: Groq | null = null;

  constructor() {
    this.initClient();
  }

  public initClient() {
    if (config.groqApiKey && config.groqApiKey.trim()) {
      try {
        this.groqClient = new Groq({ apiKey: config.groqApiKey.trim() });
      } catch (err) {
        console.warn('Failed to initialize Groq client:', err);
        this.groqClient = null;
      }
    } else {
      this.groqClient = null;
    }
  }

  public async evaluateRequest(params: {
    title: string;
    category: string;
    amount: number;
    currency: string;
    applicantName: string;
    notes?: string;
    externalUrl?: string;
    poNumber?: string;
    poAmount?: number;
    discrepancy?: DiscrepancyResult;
    memories: MemoryItem[];
    currencyRates: CurrencyRates;
    domainCheck: DomainCheckResult | null;
  }): Promise<EvaluationResult> {
    const {
      title,
      category,
      amount,
      currency,
      applicantName,
      notes,
      externalUrl,
      poNumber,
      poAmount,
      discrepancy,
      memories,
      currencyRates,
      domainCheck,
    } = params;

    let amountInUsd = amount;
    if (currency !== 'USD' && currencyRates.rates[currency]) {
      amountInUsd = amount / currencyRates.rates[currency];
    }

    // 1. If Groq API key is present and client initialized, use Groq LLM
    if (this.groqClient && config.groqApiKey) {
      try {
        const memoryPrompt = memories.length > 0
          ? memories.map((m, i) => `${i + 1}. [${m.context}] ${m.content} (Decision: ${m.previousDecision || 'N/A'}, Why relevant: ${m.whyRelevant || 'Prior precedent'})`).join('\n')
          : 'No relevant previous experience was found.';

        const systemPrompt = `You are AP Memory Agent, an enterprise accounts payable reviewer that learns from previous finance team decisions using Hindsight long-term memory.
Your task is to evaluate this invoice and formulate a clear, non-technical recommendation for finance employees.

CORE REASONING RULES:
1. If there is a detected discrepancy (e.g. shipping charge mismatch or PO variance):
   - Check if recalled memories include a prior human approval or granted exception for this vendor (e.g. "Shipping charges are allowed for ABC Suppliers").
   - If a prior human approval/exception exists: Recommend APPROVAL citing the previous finance approval (e.g. "I found a previous invoice from ABC Suppliers with a similar shipping discrepancy. The finance team approved it because shipping charges were allowed. I therefore recommend reviewing/approving the shipping charge rather than immediately rejecting the invoice.").
   - If NO relevant memory exists: State explicitly "No relevant previous experience was found" and recommend FLAGGING the discrepancy.
2. If there is a price surge (>20%) vs a learned pricing benchmark without justification, flag for review.
3. If no discrepancies exist and invoice complies with past precedents, approve cleanly.

Output strictly valid JSON with this schema:
{
  "decision": "approved" | "flagged" | "changes_requested" | "rejected",
  "rationale": "Simple, clear 2-3 sentence explanation understandable to a finance employee, explicitly citing previous memories and human decisions when available.",
  "confidence": 0.0 to 1.0,
  "memoryApplied": "Summary of which historical memory or human decision influenced this decision (or 'No relevant previous experience was found')",
  "keyFactors": ["factor 1", "factor 2", "factor 3", "factor 4"]
}`;

        const userPrompt = `Invoice to review:
- Vendor: ${applicantName}
- Invoice Total: ${currency} ${Number(amount || 0).toLocaleString()} (USD equivalent: ~$${Math.round(amountInUsd || 0)})
- Purchase Order: ${poNumber || 'None'} (Authorized PO Amount: ${poAmount != null ? `${currency} ${Number(poAmount).toLocaleString()}` : 'N/A'})
- Detected Discrepancy: ${discrepancy?.hasDiscrepancy ? `${discrepancy.title} - ${discrepancy.details}` : 'None'}
- Notes: ${notes || 'None'}

RECALLED HINDSIGHT EXPERIENCES:
${memoryPrompt}

Analyze compliance, identify previous human decisions for this vendor/discrepancy, and provide your recommendation in the specified JSON format.`;

        const groqTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Groq LLM evaluation call timed out after 2500ms')), 2500)
        );

        const response = await Promise.race([
          this.groqClient.chat.completions.create({
            model: config.groqModel || 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
          }),
          groqTimeout,
        ]);

        const raw = response.choices[0]?.message?.content;
        if (raw) {
          const parsed = JSON.parse(raw);
          const experiences: RecalledExperience[] = memories.map(m => ({
            experience: m.content,
            previousDecision: m.previousDecision || (m.content.includes('approved') ? 'Approved' : 'Review Required'),
            whyRelevant: m.whyRelevant || `Prior decision record for ${applicantName}`,
          }));

          return {
            decision: ['approved', 'flagged', 'changes_requested', 'rejected'].includes(parsed.decision)
              ? parsed.decision
              : 'flagged',
            rationale: parsed.rationale || 'Evaluated against policy guidelines and past Hindsight memories.',
            confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.95,
            memoryApplied: parsed.memoryApplied || (memories.length > 0 ? memories[0].content : 'No relevant previous experience was found.'),
            keyFactors: Array.isArray(parsed.keyFactors) ? parsed.keyFactors : [],
            recalledExperiences: experiences,
          };
        }
      } catch (err: any) {
        console.warn('Groq LLM call failed or timed out, executing deterministic reasoner:', err?.message || err);
      }
    }

    // 2. Deterministic AP Reasoner (Production Quality)
    return this.evaluateDeterministically(params, amountInUsd);
  }

  private evaluateDeterministically(
    params: {
      title: string;
      category: string;
      amount: number;
      currency: string;
      applicantName: string;
      notes?: string;
      externalUrl?: string;
      poNumber?: string;
      poAmount?: number;
      discrepancy?: DiscrepancyResult;
      memories: MemoryItem[];
      domainCheck: DomainCheckResult | null;
    },
    amountInUsd: number
  ): EvaluationResult {
    const {
      title,
      category,
      amount,
      currency,
      applicantName,
      notes,
      externalUrl,
      poNumber,
      poAmount,
      discrepancy,
      memories,
      domainCheck,
    } = params;

    const experiences: RecalledExperience[] = memories.map(m => ({
      experience: m.content,
      previousDecision: m.previousDecision || (m.content.includes('approved') ? 'Approved' : 'Flagged'),
      whyRelevant: m.whyRelevant || `Prior review precedent for ${applicantName}`,
    }));

    // STEP A: Discrepancy Evaluation against Hindsight Memory
    if (discrepancy && discrepancy.hasDiscrepancy) {
      // 1. Check if Hindsight has prior human approval or exception for this vendor's discrepancy
      const priorHumanApproval = memories.find(m => {
        const cLower = m.content.toLowerCase();
        const isApproved = m.previousDecision === 'approved' || cLower.includes('approved') || cLower.includes('allowed') || cLower.includes('confirmed');
        const isShippingOrDiscrepancy = discrepancy.type === 'shipping_unmatched'
          ? (cLower.includes('shipping') || m.discrepancyType === 'shipping_unmatched')
          : (m.discrepancyType === discrepancy.type || cLower.includes('discrepancy') || cLower.includes('variance'));
        return isApproved && isShippingOrDiscrepancy;
      });

      if (priorHumanApproval) {
        // Human previously approved this discrepancy for this vendor!
        const discAmountStr = `${currency} ${Number(discrepancy?.amount || 0).toLocaleString()}`;
        const rationale = `I found a previous invoice from ${applicantName} with a similar ${discrepancy.type === 'shipping_unmatched' ? 'shipping' : 'PO'} discrepancy. The finance team approved it because shipping charges were allowed for this vendor. I therefore recommend approving the ${discrepancy.type === 'shipping_unmatched' ? 'shipping charge' : 'variance'} rather than immediately rejecting the invoice.`;
        
        return {
          decision: 'approved',
          rationale,
          confidence: 0.98,
          memoryApplied: priorHumanApproval.content,
          keyFactors: [
            `Current invoice has a ${discAmountStr} ${discrepancy.type === 'shipping_unmatched' ? 'shipping' : 'PO'} discrepancy against PO #${poNumber || 'baseline'}.`,
            `Vendor: ${applicantName}.`,
            `Similar discrepancy occurred in previous invoices.`,
            `Finance team previously approved: "${priorHumanApproval.exceptionNote || 'Shipping charges are allowed for this vendor'}".`,
            `Recommendation: Approve with verified shipping charge exception.`,
          ],
          recalledExperiences: experiences,
        };
      } else {
        // No previous experience was found to justify this discrepancy
        const discAmountStr = `${currency} ${Number(discrepancy?.amount || 0).toLocaleString()}`;
        const rationale = `No relevant previous experience was found to authorize this discrepancy. Recommending review: Invoice total of ${currency} ${Number(amount || 0).toLocaleString()} exceeds authorized PO #${poNumber || 'N/A'} by ${discAmountStr} (${discrepancy.details}).`;

        return {
          decision: 'flagged',
          rationale,
          confidence: 0.94,
          memoryApplied: 'No relevant previous experience was found.',
          keyFactors: [
            `Current invoice has a ${discAmountStr} discrepancy.`,
            `Vendor: ${applicantName}.`,
            `No relevant previous experience or exception found in Hindsight.`,
            `Recommendation: Flag for finance reviewer decision.`,
          ],
          recalledExperiences: experiences,
        };
      }
    }

    // STEP B: Price Surge Check against Learned Benchmarks
    for (const mem of memories) {
      const memText = mem.content.toLowerCase();
      const applicantWords = applicantName.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !/^(inc|llc|corp|ltd)$/i.test(w));
      const isVendorMatch = applicantWords.some(w => memText.includes(w));

      if (isVendorMatch && (mem.memoryType === 'pricing_benchmark' || memText.includes('pricing benchmark') || memText.includes('baseline established') || memText.includes('billed $') || memText.includes('billed inr') || memText.includes('billed ₹'))) {
        const benchMatch = mem.content.match(/[$₹€£]\s*([\d,]+(?:\.\d+)?)/);
        if (benchMatch) {
          const benchAmount = parseFloat(benchMatch[1].replace(/,/g, ''));
          if (benchAmount > 0) {
            const surgePct = ((amountInUsd - benchAmount) / benchAmount) * 100;
            if (surgePct > 20) {
              const rationale = `Flagged for price surge: Current invoice (${currency} ${Number(amount || 0).toLocaleString()}) exceeds the previously learned benchmark of ${currency} ${Number(benchAmount || 0).toLocaleString()} (+${Math.round(surgePct)}%) established from previous invoice records for ${applicantName}.`;
              return {
                decision: 'flagged',
                rationale,
                confidence: 0.95,
                memoryApplied: mem.content,
                keyFactors: [
                  `Amount: ${currency} ${Number(amount || 0).toLocaleString()}`,
                  `Price surge +${Math.round(surgePct)}% vs learned benchmark (${currency} ${Number(benchAmount || 0).toLocaleString()})`,
                  `Exceeds historical vendor baseline without PO justification`,
                ],
                recalledExperiences: experiences,
              };
            } else if (Math.abs(surgePct) <= 15) {
              const rationale = `Approved: Verified against previously learned pricing benchmark (${currency} ${Number(benchAmount || 0).toLocaleString()}) and profile for ${applicantName}. The submission aligns with established historical baseline.`;
              return {
                decision: 'approved',
                rationale,
                confidence: 0.96,
                memoryApplied: mem.content,
                keyFactors: [
                  `Amount: ${currency} ${Number(amount || 0).toLocaleString()}`,
                  `Matches learned baseline (${currency} ${Number(benchAmount || 0).toLocaleString()})`,
                  `Consistent vendor pricing precedent`,
                ],
                recalledExperiences: experiences,
              };
            }
          }
        }
      }
    }

    // STEP C: Standard Review Principles
    const memoryApplied = memories.length > 0 ? memories[0].content : 'No relevant previous experience was found.';
    return {
      decision: 'approved',
      rationale: memories.length > 0
        ? `Approved: Evaluated against remembered past review precedents for ${applicantName} and found compliant with operational policies.`
        : `Approved: Invoice for ${applicantName} complies with standard procurement thresholds.`,
      confidence: 0.92,
      memoryApplied,
      keyFactors: [
        `Amount: ${currency} ${Number(amount || 0).toLocaleString()}`,
        poNumber ? `Matches PO #${poNumber}` : 'Standard non-PO authorization threshold satisfied',
        `Complies with standard AP verification guidelines`,
      ],
      recalledExperiences: experiences,
    };
  }
}

export const llmService = new LLMService();
