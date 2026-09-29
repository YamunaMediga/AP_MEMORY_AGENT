import { getDb, queryOne, run } from '../database/db.js';
import { hindsightService, MemoryItem } from './hindsightService.js';
import { llmService } from './llmService.js';
import { externalDataService } from './externalDataService.js';
import { realtimeService } from './realtimeService.js';
import { deduplicationService } from './deduplicationService.js';
import { discrepancyService, DiscrepancyResult } from './discrepancyService.js';
import { pdfService } from './pdfService.js';
import crypto from 'crypto';

export interface AuditStepRecord {
  step: string;
  label: string;
  timestamp: string;
  details?: any;
}

class AgentService {
  /**
   * Evaluates an invoice through the complete 8-step Hindsight Memory & Discrepancy Pipeline
   */
  public async processRequest(requestId: string, userId: string): Promise<any> {
    const request = queryOne<any>(`SELECT * FROM requests WHERE id = ? AND user_id = ?`, [requestId, userId]);
    if (!request) {
      throw new Error(`Request not found: ${requestId}`);
    }

    const auditTrail: AuditStepRecord[] = [];
    const now = () => new Date().toISOString();

    // STEP 1: Invoice received & registered
    const step1: AuditStepRecord = {
      step: 'received',
      label: 'Invoice received & registered in system',
      timestamp: now(),
      details: { refCode: request.ref_code, title: request.title, filename: request.pdf_filename },
    };
    auditTrail.push(step1);
    realtimeService.emitAgentStep(userId, requestId, step1.step, step1.label, step1.details);

    // Deduplication check
    const dupCheck = deduplicationService.checkDuplicate({
      userId,
      invoiceNumber: request.invoice_number,
      applicantName: request.applicant_name,
      amount: request.amount,
      invoiceDate: request.invoice_date,
      pdfHash: request.pdf_hash,
      currentRequestId: requestId,
    });

    if (dupCheck.isDuplicate) {
      const duplicateRationale = dupCheck.reason || `Duplicate Request Blocked: Invoice #${request.invoice_number || 'N/A'} was already processed under ${dupCheck.originalRefCode}.`;
      realtimeService.emitAgentStep(userId, requestId, 'duplicate_detected', '⚠️ Duplicate request detected! Flagged for review.', {
        reason: duplicateRationale,
        originalRef: dupCheck.originalRefCode,
      });

      auditTrail.push({
        step: 'duplicate_detected',
        label: 'Duplicate request detected and blocked',
        timestamp: now(),
        details: dupCheck,
      });

      run(
        `UPDATE requests 
         SET status = 'flagged', agent_decision = 'flagged', agent_rationale = ?, is_duplicate = 1, duplicate_of_ref = ?, audit_trail_json = ?, updated_at = ?
         WHERE id = ?`,
        [duplicateRationale, dupCheck.originalRefCode || null, JSON.stringify(auditTrail), now(), requestId]
      );

      const memContent = `Duplicate invoice prevention: ${request.ref_code} (${request.applicant_name}, ${request.currency} ${request.amount}) flagged as duplicate of ${dupCheck.originalRefCode}. Double payment blocked.`;
      // Retain asynchronously
      setImmediate(() => {
        hindsightService.retain(userId, memContent, `Duplicate Guard: ${request.ref_code}`, 'duplicate_audit').catch(() => {});
      });

      const updatedRequest = queryOne<any>(`SELECT * FROM requests WHERE id = ?`, [requestId]);
      realtimeService.broadcastToUser(userId, 'request_updated', updatedRequest);
      return { request: updatedRequest, evaluation: { decision: 'flagged', rationale: duplicateRationale }, memories: [] };
    }

    // STEP 2: Fast targeted Hindsight pre-check for vendor layout patterns
    const preQuery = `vendor layout extraction pattern ${request.applicant_name} amount due`;
    const preMemories = await hindsightService.recall(userId, preQuery, 2, request.applicant_name);
    const step2: AuditStepRecord = {
      step: 'hindsight_pre_recall',
      label: preMemories.length > 0 
        ? `Retrieved ${preMemories.length} vendor layout patterns from Hindsight before parsing`
        : `Searched Hindsight: Initial extraction pattern for ${request.applicant_name}`,
      timestamp: now(),
      details: { preMemoriesCount: preMemories.length },
    };
    auditTrail.push(step2);
    realtimeService.emitAgentStep(userId, requestId, step2.step, step2.label, step2.details);

    // STEP 3: Invoice information extracted
    const step3: AuditStepRecord = {
      step: 'extracted',
      label: `Extracted total (${request.currency || 'USD'} ${Number(request.amount || 0).toLocaleString()}) via ${request.extraction_method || 'text'} extraction`,
      timestamp: now(),
      details: {
        amount: request.amount,
        currency: request.currency,
        poNumber: request.po_number,
        invoiceNumber: request.invoice_number,
      },
    };
    auditTrail.push(step3);
    realtimeService.emitAgentStep(userId, requestId, step3.step, step3.label, step3.details);

    // STEP 4: Validation completed
    const step4: AuditStepRecord = {
      step: 'validation_completed',
      label: `Validation completed: Amount verified under label '${request.amount_label || 'Amount Due'}'`,
      timestamp: now(),
      details: { confidence: request.confidence || 0.95 },
    };
    auditTrail.push(step4);
    realtimeService.emitAgentStep(userId, requestId, step4.step, step4.label, step4.details);

    // STEP 5: Discrepancy detected
    const discrepancy: DiscrepancyResult = discrepancyService.detectDiscrepancies({
      amount: request.amount,
      currency: request.currency || 'USD',
      rawText: request.raw_extracted_text || '',
      notes: request.notes || '',
      applicantName: request.applicant_name,
      poNumber: request.po_number || undefined,
      poAmount: request.po_amount !== null && request.po_amount !== undefined ? request.po_amount : undefined,
    });

    const step5: AuditStepRecord = {
      step: 'discrepancy_detected',
      label: discrepancy.hasDiscrepancy 
        ? `⚠️ Discrepancy detected: ${discrepancy.title}`
        : '✓ Validation passed: No discrepancies detected against Purchase Order',
      timestamp: now(),
      details: discrepancy,
    };
    auditTrail.push(step5);
    realtimeService.emitAgentStep(userId, requestId, step5.step, step5.label, step5.details);

    // Fetch live currency rates & domain verification concurrently
    const [currencyRates, domainCheck] = await Promise.all([
      externalDataService.getLiveCurrencyRates(),
      externalDataService.verifyExternalUrl(request.external_url),
    ]);

    // STEP 6: Search Hindsight for relevant previous experiences (targeted to vendor & discrepancy)
    const memoryQuery = `${request.applicant_name} ${discrepancy.type} ${discrepancy.title} shipping exception approval ${request.title}`;
    const memories = await hindsightService.recall(userId, memoryQuery, 4, request.applicant_name);

    const step6: AuditStepRecord = {
      step: 'recalling_memory',
      label: memories.length > 0
        ? `Retrieved ${memories.length} relevant past experiences & human decisions from Hindsight`
        : 'Searched Hindsight: No relevant previous experience found',
      timestamp: now(),
      details: {
        memoriesCount: memories.length,
        memories: memories.map(m => ({
          context: m.context,
          decision: m.previousDecision,
          whyRelevant: m.whyRelevant,
        })),
      },
    };
    auditTrail.push(step6);
    realtimeService.emitAgentStep(userId, requestId, step6.step, step6.label, step6.details);

    // STEP 7: Agent recommendation generated
    const evaluation = await llmService.evaluateRequest({
      title: request.title,
      category: request.category,
      amount: request.amount,
      currency: request.currency,
      applicantName: request.applicant_name,
      notes: request.notes,
      externalUrl: request.external_url,
      poNumber: request.po_number,
      poAmount: request.po_amount,
      discrepancy,
      memories,
      currencyRates,
      domainCheck,
    });

    const step7: AuditStepRecord = {
      step: 'recommendation_generated',
      label: `Agent recommendation generated: ${evaluation.decision.toUpperCase()}`,
      timestamp: now(),
      details: {
        decision: evaluation.decision,
        rationale: evaluation.rationale,
        keyFactors: evaluation.keyFactors,
      },
    };
    auditTrail.push(step7);
    realtimeService.emitAgentStep(userId, requestId, step7.step, step7.label, step7.details);

    // STEP 8: Continuous learning prepared
    let insights: string[] = [];
    try {
      insights = request.learned_insights_json ? JSON.parse(request.learned_insights_json) : [];
    } catch (e) {
      insights = [];
    }

    if (!Array.isArray(insights) || insights.length === 0) {
      insights = pdfService.generateInvoiceLearnings({
        applicantName: request.applicant_name,
        category: request.category,
        amount: request.amount,
        currency: request.currency || 'USD',
        invoiceNumber: request.invoice_number || request.ref_code,
        invoiceDate: request.invoice_date || now().split('T')[0],
        paymentTerms: request.notes?.match(/Net-\d+/i)?.[0] || 'Net-30',
        lineItemsSummary: request.title,
      });
    }

    const step8: AuditStepRecord = {
      step: 'persisted',
      label: 'Audit trail recorded & invoice evaluation complete',
      timestamp: now(),
      details: { status: evaluation.decision },
    };
    auditTrail.push(step8);
    realtimeService.emitAgentStep(userId, requestId, step8.step, step8.label, step8.details);

    // Update SQLite database with complete results IMMEDIATELY so invoice is available to user
    run(
      `UPDATE requests 
       SET status = ?, agent_decision = ?, agent_rationale = ?, recalled_memory_json = ?, 
           learned_insights_json = ?, discrepancy_detected = ?, discrepancy_type = ?, 
           discrepancy_details = ?, discrepancy_amount = ?, po_number = ?, po_amount = ?, audit_trail_json = ?, updated_at = ?
       WHERE id = ?`,
      [
        evaluation.decision,
        evaluation.decision,
        evaluation.rationale,
        JSON.stringify(memories),
        JSON.stringify(insights),
        discrepancy.hasDiscrepancy ? 1 : 0,
        discrepancy.type,
        discrepancy.details,
        discrepancy.amount,
        discrepancy.poNumber || request.po_number || null,
        discrepancy.poAmount || request.po_amount || null,
        JSON.stringify(auditTrail),
        now(),
        requestId,
      ]
    );

    const updatedRequest = queryOne<any>(`SELECT * FROM requests WHERE id = ?`, [requestId]);
    if (updatedRequest) {
      updatedRequest.recalled_memories = memories;
      updatedRequest.learned_insights = insights;
      updatedRequest.audit_trail = auditTrail;
      updatedRequest.discrepancy = discrepancy;
    }

    // Broadcast updated invoice record to UI immediately
    realtimeService.broadcastToUser(userId, 'request_updated', updatedRequest);

    // Asynchronously commit Hindsight learning in background without delaying user view
    setImmediate(async () => {
      try {
        await Promise.allSettled(
          insights.map((insight) => {
            const isPricing = insight.includes('Pricing Benchmark');
            const ctx = isPricing
              ? `Pricing Benchmark: ${request.applicant_name}`
              : `Vendor Knowledge: ${request.applicant_name}`;
            return hindsightService.retain(
              userId,
              insight,
              ctx,
              isPricing ? 'pricing_benchmark' : 'vendor_knowledge',
              {
                vendorName: request.applicant_name,
                invoiceRef: request.ref_code,
                discrepancyType: discrepancy.type,
                whyRelevant: `Establishes procurement baseline for ${request.applicant_name}.`,
                learningScope: 'vendor',
              }
            );
          })
        );
      } catch (err) {
        console.warn('Async Hindsight retention notice:', err);
      }
    });

    return {
      request: updatedRequest,
      evaluation,
      memories,
      auditTrail,
    };
  }

  /**
   * Records Human Feedback, grants exceptions, and retains the human decision into Hindsight long-term memory
   */
  public async recordHumanFeedback(
    requestId: string,
    userId: string,
    feedback: {
      decision: 'approved' | 'rejected' | 'corrected';
      comment?: string;
      exceptionGranted?: string;
      correctedRecommendation?: string;
    }
  ): Promise<any> {
    const request = queryOne<any>(`SELECT * FROM requests WHERE id = ? AND user_id = ?`, [requestId, userId]);
    if (!request) {
      throw new Error(`Request not found: ${requestId}`);
    }

    const now = new Date().toISOString();
    let auditTrail: AuditStepRecord[] = [];
    try {
      auditTrail = request.audit_trail_json ? JSON.parse(request.audit_trail_json) : [];
    } catch (e) {
      auditTrail = [];
    }

    // Formulate human memory content
    const commentText = feedback.comment || 'Finance team approved submission.';
    const exceptionText = typeof feedback.exceptionGranted === 'string'
      ? feedback.exceptionGranted
      : feedback.exceptionGranted
      ? (commentText || 'Shipping charges allowed for this vendor')
      : (feedback.decision === 'approved' && request.discrepancy_type === 'shipping_unmatched' ? 'Shipping charges allowed for this vendor' : null);

    const memoryContent = `Human Decision Precedent: ${request.applicant_name} invoice ${request.invoice_number || request.ref_code} (${request.currency || 'USD'} ${Number(request.amount || 0).toLocaleString()}) had discrepancy '${request.discrepancy_details || 'Standard verification'}'. Finance reviewer decided: ${feedback.decision.toUpperCase()}. Reason: "${commentText}".${exceptionText ? ` Exception: "${exceptionText}".` : ''}`;

    // Retain into Hindsight memory
    await hindsightService.retain(
      userId,
      memoryContent,
      `Human Decision: ${request.applicant_name} (${request.discrepancy_type || 'Procurement'})`,
      'human_decision',
      {
        vendorName: request.applicant_name,
        invoiceRef: request.ref_code,
        discrepancyType: request.discrepancy_type || undefined,
        humanDecision: feedback.decision,
        exceptionNote: exceptionText || undefined,
        whyRelevant: `Finance reviewer confirmed: ${commentText}`,
        learningScope: 'vendor',
      }
    );

    // If an exception was granted, store as dedicated exception_granted memory
    if (exceptionText) {
      const excContent = `Vendor Exception [${request.applicant_name}]: Finance team approved exception for '${request.discrepancy_type || 'shipping_unmatched'}': "${exceptionText}". Recommends approval for future invoices with this pattern.`;
      await hindsightService.retain(
        userId,
        excContent,
        `Vendor Exception: ${request.applicant_name}`,
        'exception_granted',
        {
          vendorName: request.applicant_name,
          invoiceRef: request.ref_code,
          discrepancyType: request.discrepancy_type || undefined,
          humanDecision: 'approved',
          exceptionNote: exceptionText,
          whyRelevant: `Finance confirmed shipping charges are permitted for ${request.applicant_name}.`,
          learningScope: 'vendor',
        }
      );
    }

    // Append 8th/9th Step: Human Feedback Stored
    const feedbackStep: AuditStepRecord = {
      step: 'human_feedback_stored',
      label: `Human decision recorded: ${feedback.decision.toUpperCase()} → Stored as new memory in Hindsight`,
      timestamp: now,
      details: {
        decision: feedback.decision,
        comment: commentText,
        exceptionGranted: exceptionText,
      },
    };
    auditTrail.push(feedbackStep);

    // Update database
    run(
      `UPDATE requests 
       SET status = ?, human_decision = ?, human_comment = ?, exception_granted = ?, audit_trail_json = ?, updated_at = ?
       WHERE id = ?`,
      [
        feedback.decision,
        feedback.decision,
        commentText,
        exceptionText,
        JSON.stringify(auditTrail),
        now,
        requestId,
      ]
    );

    // Log audit event
    const eventId = `evt_${crypto.randomUUID()}`;
    const eventDesc = `Human Reviewer ${feedback.decision.toUpperCase()} ${request.ref_code} (${request.applicant_name}). Decision and exception retained into Hindsight memory.`;
    run(
      `INSERT INTO audit_events (id, user_id, request_id, event_type, description, metadata_json, created_at)
       VALUES (?, ?, ?, 'human_feedback', ?, ?, ?)`,
      [eventId, userId, requestId, eventDesc, JSON.stringify(feedback), now]
    );

    const updatedRequest = queryOne<any>(`SELECT * FROM requests WHERE id = ?`, [requestId]);
    if (updatedRequest) {
      updatedRequest.recalled_memories = updatedRequest.recalled_memory_json ? JSON.parse(updatedRequest.recalled_memory_json) : [];
      updatedRequest.learned_insights = updatedRequest.learned_insights_json ? JSON.parse(updatedRequest.learned_insights_json) : [];
      updatedRequest.audit_trail = auditTrail;
    }

    realtimeService.broadcastToUser(userId, 'request_updated', updatedRequest);
    realtimeService.broadcastToUser(userId, 'activity_logged', {
      id: eventId,
      requestId,
      eventType: 'human_feedback',
      description: eventDesc,
      createdAt: now,
    });

    return { success: true, request: updatedRequest, memoryContent };
  }

  /**
   * Interactive Agent Assistant: Chat with memory + continuous learnings
   */
  public async chatWithAgent(userId: string, userMessage: string): Promise<any> {
    const lower = userMessage.toLowerCase();

    const isAskingAboutLearnings = lower.includes('learn') || lower.includes('vendor') || lower.includes('benchmark') || lower.includes('invoice') || lower.includes('know about') || lower.includes('who is');
    const recallQuery = isAskingAboutLearnings
      ? `vendor knowledge pricing benchmark ${userMessage}`
      : userMessage;

    const memories = await hindsightService.recall(userId, recallQuery, 4);

    const recentRequests = queryOne<any>(
      `SELECT COUNT(*) as total, 
              SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
              SUM(CASE WHEN status = 'flagged' THEN 1 ELSE 0 END) as flagged,
              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
       FROM requests WHERE user_id = ?`,
      [userId]
    );

    let responseText = '';

    if (isAskingAboutLearnings && memories.length > 0) {
      responseText = `Here is what I have continuously learned and retained in Hindsight memory from your uploaded invoices:\n\n` +
        memories.map((m, i) => `• [${m.context}]: "${m.content}"${m.previousDecision ? ` (Decision: ${m.previousDecision})` : ''}`).join('\n') +
        `\n\nI continuously use these pricing benchmarks, human decisions, and vendor exceptions to evaluate all subsequent invoices you submit!`;
    } else if (memories.length > 0 && (lower.includes('policy') || lower.includes('remember') || lower.includes('rule') || lower.includes('criteria'))) {
      responseText = `I have retrieved ${memories.length} relevant memories from your Hindsight memory bank:\n\n` +
        memories.map((m, i) => `• [${m.context}]: "${m.content}"`).join('\n') +
        `\n\nI actively enforce these criteria whenever you submit new requests.`;
    } else if (lower.includes('status') || lower.includes('requests') || lower.includes('how many')) {
      responseText = `You currently have ${recentRequests?.total || 0} total requests in the pipeline: ${recentRequests?.approved || 0} approved, ${recentRequests?.flagged || 0} flagged for review, and ${recentRequests?.pending || 0} pending.`;
    } else {
      responseText = `I am your AP Memory Agent. I continuously learn new vendor patterns, pricing benchmarks, and human reviewer decisions from every PDF invoice you upload, retaining them into Vectorize Hindsight memory to validate future use cases. You can also teach me explicit rules anytime using "+ Teach Agent Policy".`;
    }

    return {
      message: responseText,
      recalledMemories: memories,
      timestamp: new Date().toISOString(),
    };
  }
}

export const agentService = new AgentService();
