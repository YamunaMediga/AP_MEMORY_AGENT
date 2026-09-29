import { Router, Response } from 'express';
import { queryAll, queryOne, run } from '../database/db.js';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware.js';
import { agentService } from '../services/agentService.js';
import { realtimeService } from '../services/realtimeService.js';
import crypto from 'crypto';

const router = Router();
router.use(authMiddleware);

export function formatInvoiceRecord(r: any) {
  const lineItems = r.line_items_json ? JSON.parse(r.line_items_json) : [];
  const learnedInsights = r.learned_insights_json ? JSON.parse(r.learned_insights_json) : [];
  const recalledMemories = r.recalled_memory_json ? JSON.parse(r.recalled_memory_json) : [];
  const auditTrail = r.audit_trail_json ? JSON.parse(r.audit_trail_json) : [];

  return {
    ...r,
    invoice_record_id: r.id,
    file_name: r.pdf_filename,
    file_hash: r.pdf_hash,
    invoice_number: r.invoice_number,
    vendor: r.applicant_name,
    invoice_date: r.invoice_date,
    currency: r.currency || 'USD',
    invoice_total: r.amount,
    formatted_amount: r.formatted_amount || `$${Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    amount_label: r.amount_label || 'Amount Due',
    extraction_method: r.extraction_method || 'text',
    confidence: r.confidence || 0.98,
    validation_status: r.validation_status || 'validated',
    line_items: lineItems,
    tax: r.tax_amount || 0,
    taxes: r.tax_amount || 0,
    discount: r.discount_amount || 0,
    discounts: r.discount_amount || 0,
    shipping: r.shipping_amount || r.discrepancy_amount || 0,
    new_learning: learnedInsights,
    learning_generated: learnedInsights,
    learned_insights: learnedInsights,
    recalled_memories: recalledMemories,
    audit_trail: auditTrail,
  };
}

// GET /api/requests
router.get('/', (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const requests = queryAll<any>(
      `SELECT * FROM requests WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );

    const formatted = requests.map(r => formatInvoiceRecord(r));

    return res.json({ requests: formatted });
  } catch (err: any) {
    console.error('List requests error:', err);
    return res.status(500).json({ error: 'Failed to retrieve requests' });
  }
});

import { pdfService } from '../services/pdfService.js';
import { deduplicationService } from '../services/deduplicationService.js';
import { sampleInvoices } from '../services/sampleInvoiceService.js';
import { hindsightService } from '../services/hindsightService.js';

// GET /api/requests/vendors - Vendor Memory Profiles
router.get('/vendors', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const profiles = await hindsightService.getVendorMemoryProfiles(userId);
    return res.json({ profiles });
  } catch (err: any) {
    console.error('Get vendor profiles error:', err);
    return res.status(500).json({ error: 'Failed to retrieve vendor memory profiles' });
  }
});

// GET /api/requests/memory-activity - Chronological Agent Learning Activity Log
router.get('/memory-activity', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const activities = await hindsightService.getMemoryActivity(userId);
    return res.json({ activities });
  } catch (err: any) {
    console.error('Get memory activity error:', err);
    return res.status(500).json({ error: 'Failed to retrieve memory activity' });
  }
});

// GET /api/requests/learning-metrics - Real AP Overview and Learning Metrics
router.get('/learning-metrics', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const metrics = await hindsightService.getLearningMetrics(userId);
    return res.json(metrics);
  } catch (err: any) {
    console.error('Get learning metrics error:', err);
    return res.status(500).json({ error: 'Failed to retrieve learning metrics' });
  }
});

// POST /api/requests/demo-reset - Reset demo state for ABC Suppliers
router.post('/demo-reset', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    run(
      `DELETE FROM requests WHERE user_id = ? AND (applicant_name LIKE '%ABC Suppliers%' OR title LIKE '%ABC Suppliers%' OR ref_code LIKE '%ABC%')`,
      [userId]
    );
    run(
      `DELETE FROM memory_records WHERE user_id = ? AND (vendor_name LIKE '%ABC Suppliers%' OR content LIKE '%ABC Suppliers%')`,
      [userId]
    );
    realtimeService.broadcastToUser(userId, 'pipeline_reset', { vendor: 'ABC Suppliers' });
    return res.json({ success: true, message: 'Demo state reset successfully for ABC Suppliers' });
  } catch (err: any) {
    console.error('Demo reset error:', err);
    return res.status(500).json({ error: 'Failed to reset demo state' });
  }
});

// GET /api/requests/sample-invoices
router.get('/sample-invoices', (req: AuthRequest, res: Response) => {
  const items = Object.values(sampleInvoices).map((inv) => ({
    id: inv.id,
    name: inv.name,
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate,
    applicantName: inv.applicantName,
    amount: inv.amount,
    currency: inv.currency,
    category: inv.category,
    description: inv.description,
    pdf_base64: inv.getPdfBuffer().toString('base64'),
  }));
  return res.json({ samples: items });
});

// POST /api/requests/parse-pdf
router.post('/parse-pdf', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { pdf_base64, filename, text_content } = req.body;

    // STEP 1: Compute hash immediately BEFORE parsing and check duplicate
    let rawHash = '';
    let buffer: Buffer | null = null;

    if (pdf_base64) {
      const cleanBase64 = String(pdf_base64).replace(/^data:[^;]+;base64,/, '').trim();
      buffer = Buffer.from(cleanBase64, 'base64');
      const uint8 = new Uint8Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
      rawHash = crypto.createHash('sha256').update(uint8).digest('hex');
    } else if (text_content) {
      rawHash = crypto.createHash('sha256').update(text_content).digest('hex');
    } else {
      return res.status(400).json({ error: 'Missing PDF file data (pdf_base64 or text_content)' });
    }

    // FAST FILE HASH DUPLICATE CHECK: If exact file exists, return immediately without parsing!
    const fileDup = deduplicationService.checkDuplicate({
      userId,
      pdfHash: rawHash,
    });

    if (fileDup.isDuplicate && fileDup.originalRequestId) {
      const existing = queryOne<any>(`SELECT * FROM requests WHERE id = ?`, [fileDup.originalRequestId]);
      if (existing) {
        const formattedExisting = formatInvoiceRecord(existing);
        return res.json({
          status: 'duplicate',
          duplicateCheck: {
            ...fileDup,
            existingRecord: formattedExisting,
          },
          parsed: {
            invoiceNumber: formattedExisting.invoice_number,
            invoiceDate: formattedExisting.invoice_date,
            amount: formattedExisting.invoice_total,
            currency: formattedExisting.currency,
            formattedAmount: formattedExisting.formatted_amount,
            amountLabel: formattedExisting.amount_label,
            extractionMethod: formattedExisting.extraction_method,
            confidence: formattedExisting.confidence,
            validationStatus: formattedExisting.validation_status,
            applicantName: formattedExisting.vendor || formattedExisting.applicant_name,
            category: formattedExisting.category,
            title: formattedExisting.title,
            notes: formattedExisting.notes,
            lineItems: formattedExisting.line_items,
            taxAmount: formattedExisting.tax,
            discountAmount: formattedExisting.discount,
            shippingAmount: formattedExisting.shipping,
            learnedInsights: formattedExisting.learned_insights,
            pdfHash: rawHash,
            rawText: formattedExisting.raw_extracted_text || '',
          },
        });
      }
    }

    // STEP 2: Only parse if new file
    let parsedInvoice;
    if (buffer) {
      parsedInvoice = await pdfService.parsePdfBuffer(buffer, filename || 'invoice.pdf');
    } else {
      parsedInvoice = pdfService.extractInvoiceFields(text_content, rawHash, filename);
    }

    // Check for duplicate requests on extracted fields
    const dupCheck = deduplicationService.checkDuplicate({
      userId,
      invoiceNumber: parsedInvoice.invoiceNumber,
      applicantName: parsedInvoice.applicantName,
      amount: parsedInvoice.amount,
      invoiceDate: parsedInvoice.invoiceDate,
      pdfHash: parsedInvoice.pdfHash,
    });

    let existingRecord = null;
    if (dupCheck.isDuplicate && dupCheck.originalRequestId) {
      const existing = queryOne<any>(`SELECT * FROM requests WHERE id = ?`, [dupCheck.originalRequestId]);
      if (existing) {
        existingRecord = formatInvoiceRecord(existing);
      }
    }

    return res.json({
      parsed: parsedInvoice,
      duplicateCheck: {
        ...dupCheck,
        existingRecord,
      },
    });
  } catch (err: any) {
    console.error('Parse PDF error:', err);
    return res.status(500).json({ error: 'Failed to extract text from PDF invoice: ' + (err?.message || err) });
  }
});

// POST /api/requests
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      title,
      category,
      amount,
      currency,
      applicant_name,
      notes,
      external_url,
      invoice_number,
      invoice_date,
      pdf_hash,
      pdf_filename,
      raw_extracted_text,
      learned_insights,
      line_items,
      amount_label,
      extraction_method,
      formatted_amount,
      confidence,
      tax_amount,
      discount_amount,
      shipping_amount,
      validation_status,
    } = req.body;

    if (!title || !applicant_name || amount === undefined) {
      return res.status(400).json({ error: 'Title, applicant name, and amount are required' });
    }

    const numAmount = isNaN(parseFloat(amount)) ? 0 : parseFloat(amount);
    const numTax = tax_amount !== undefined && !isNaN(parseFloat(tax_amount)) ? parseFloat(tax_amount) : 0;
    const numDiscount = discount_amount !== undefined && !isNaN(parseFloat(discount_amount)) ? parseFloat(discount_amount) : 0;
    const numShipping = shipping_amount !== undefined && !isNaN(parseFloat(shipping_amount)) ? parseFloat(shipping_amount) : 0;

    // MANDATORY DUPLICATE CHECK: file hash or content (vendor + invoice_number or vendor + date + amount)
    const dupCheck = deduplicationService.checkDuplicate({
      userId,
      invoiceNumber: invoice_number,
      applicantName: applicant_name,
      amount: numAmount,
      invoiceDate: invoice_date,
      pdfHash: pdf_hash,
    });

    // If duplicate detected: DO NOT insert a new record, DO NOT learn again. Return existing record.
    if (dupCheck.isDuplicate && dupCheck.originalRequestId) {
      const existing = queryOne<any>(`SELECT * FROM requests WHERE id = ?`, [dupCheck.originalRequestId]);
      if (existing) {
        const formattedExisting = formatInvoiceRecord(existing);
        return res.json({
          status: 'duplicate',
          duplicate: true,
          duplicate_type: dupCheck.matchType === 'file_hash' ? 'exact_file' : 'same_invoice_different_file',
          invoice_record_id: existing.id,
          existing_invoice_record_id: existing.id,
          message: dupCheck.matchType === 'file_hash'
            ? 'This invoice file has already been processed.'
            : 'This invoice has already been processed under another file.',
          data: formattedExisting,
          request: formattedExisting,
        });
      }
    }

    // New unique invoice record
    const id = `req_${crypto.randomUUID()}`;
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const refCode = `REQ-${randomCode}`;
    const now = new Date().toISOString();

    const lineItemsJson = Array.isArray(line_items) ? JSON.stringify(line_items) : null;
    const learnedInsightsJson = Array.isArray(learned_insights) ? JSON.stringify(learned_insights) : null;

    run(
      `INSERT INTO requests (
        id, user_id, ref_code, title, category, amount, currency, applicant_name, 
        notes, external_url, status, invoice_number, invoice_date, pdf_hash, 
        pdf_filename, raw_extracted_text, is_duplicate, duplicate_of_ref, learned_insights_json,
        amount_label, extraction_method, formatted_amount, confidence, line_items_json,
        tax_amount, discount_amount, shipping_amount, validation_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'analyzing', ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        refCode,
        title.trim(),
        category || 'Software',
        numAmount,
        currency || 'USD',
        applicant_name.trim(),
        notes?.trim() || null,
        external_url?.trim() || null,
        invoice_number?.trim() || null,
        invoice_date?.trim() || null,
        pdf_hash?.trim() || null,
        pdf_filename?.trim() || null,
        raw_extracted_text?.slice(0, 4000) || null,
        learnedInsightsJson,
        amount_label || 'Amount Due',
        extraction_method || 'text',
        formatted_amount || `$${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        confidence || 0.98,
        lineItemsJson,
        numTax,
        numDiscount,
        numShipping,
        validation_status || 'validated',
        now,
        now,
      ]
    );

    const created = queryOne<any>(`SELECT * FROM requests WHERE id = ?`, [id]);
    const formatted = formatInvoiceRecord(created);

    // Broadcast creation event immediately
    realtimeService.broadcastToUser(userId, 'request_created', formatted);

    // Process agent evaluation asynchronously so client gets instant HTTP response
    setTimeout(async () => {
      try {
        await agentService.processRequest(id, userId);
      } catch (err) {
        console.error('Background processing error:', err);
      }
    }, 100);

    return res.status(201).json({
      status: 'processed',
      duplicate: false,
      invoice_record_id: created.id,
      invoice_number: created.invoice_number,
      vendor: created.applicant_name,
      invoice_date: created.invoice_date,
      currency: created.currency,
      invoice_total: created.amount,
      formatted_amount: formatted.formatted_amount,
      amount_label: formatted.amount_label,
      extraction_method: formatted.extraction_method,
      confidence: formatted.confidence,
      validation_status: formatted.validation_status,
      line_items: formatted.line_items,
      new_learning: formatted.new_learning,
      data: formatted,
      request: formatted,
    });
  } catch (err: any) {
    console.error('Create request error:', err);
    return res.status(500).json({ error: 'Failed to create request: ' + (err?.message || err) });
  }
});

// Single isolated invoice handler - Strictly returns data belonging to ONE particular invoice
const getIsolatedInvoice = (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const request = queryOne<any>(
      `SELECT * FROM requests WHERE id = ? AND user_id = ?`,
      [req.params.id, userId]
    );

    if (!request) {
      return res.status(404).json({ error: 'Invoice record not found' });
    }

    const formatted = formatInvoiceRecord(request);
    return res.json({
      invoice_record_id: formatted.id,
      invoice_number: formatted.invoice_number,
      vendor: formatted.vendor,
      invoice_date: formatted.invoice_date,
      currency: formatted.currency,
      invoice_total: formatted.invoice_total,
      formatted_amount: formatted.formatted_amount,
      amount_label: formatted.amount_label,
      line_items: formatted.line_items,
      tax: formatted.tax,
      discount: formatted.discount,
      shipping: formatted.shipping,
      status: formatted.status,
      extraction_method: formatted.extraction_method,
      confidence: formatted.confidence,
      validation_status: formatted.validation_status,
      new_learning: formatted.new_learning,
      audit_trail: formatted.audit_trail,
      recalled_memories: formatted.recalled_memories,
      invoice: formatted,
      request: formatted,
      data: formatted,
    });
  } catch (err: any) {
    console.error('Get invoice error:', err);
    return res.status(500).json({ error: 'Failed to get invoice record' });
  }
};

// GET /api/requests/:id AND /api/requests/invoice/:id
router.get('/:id', getIsolatedInvoice);
router.get('/invoice/:id', getIsolatedInvoice);

// POST /api/requests/:id/human-feedback
router.post('/:id/human-feedback', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { decision, comment, exceptionGranted, correctedRecommendation } = req.body;

    if (!decision || !['approved', 'rejected', 'corrected', 'flagged'].includes(decision)) {
      return res.status(400).json({ error: 'Valid decision is required (approved, rejected, corrected, flagged)' });
    }

    const result = await agentService.recordHumanFeedback(req.params.id, userId, {
      decision: decision === 'flagged' ? 'flagged' : decision,
      comment,
      exceptionGranted,
      correctedRecommendation,
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Human feedback error:', err);
    return res.status(500).json({ error: 'Failed to record human feedback: ' + (err?.message || err) });
  }
});

// POST /api/requests/:id/re-evaluate
router.post('/:id/re-evaluate', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const requestId = req.params.id;

    // Reset status to analyzing
    run(`UPDATE requests SET status = 'analyzing' WHERE id = ? AND user_id = ?`, [requestId, userId]);

    // Trigger processing
    setTimeout(async () => {
      try {
        await agentService.processRequest(requestId, userId);
      } catch (err) {
        console.error('Re-evaluation error:', err);
      }
    }, 100);

    return res.json({ message: 'Re-evaluation triggered' });
  } catch (err: any) {
    console.error('Re-evaluate error:', err);
    return res.status(500).json({ error: 'Failed to re-evaluate request' });
  }
});

// POST /api/requests/:id/manual-action
router.post('/:id/manual-action', (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { action } = req.body; // 'approved' | 'rejected' | 'flagged'

    if (!['approved', 'rejected', 'flagged'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be approved, rejected, or flagged' });
    }

    const now = new Date().toISOString();
    run(
      `UPDATE requests SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
      [action, now, req.params.id, userId]
    );

    const updated = queryOne<any>(`SELECT * FROM requests WHERE id = ?`, [req.params.id]);
    realtimeService.broadcastToUser(userId, 'request_updated', updated);

    return res.json({ request: updated });
  } catch (err: any) {
    console.error('Manual action error:', err);
    return res.status(500).json({ error: 'Failed to update request' });
  }
});

// DELETE /api/requests/:id
router.delete('/:id', (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    run(`DELETE FROM requests WHERE id = ? AND user_id = ?`, [req.params.id, userId]);
    realtimeService.broadcastToUser(userId, 'request_deleted', { id: req.params.id });
    return res.json({ success: true });
  } catch (err: any) {
    console.error('Delete request error:', err);
    return res.status(500).json({ error: 'Failed to delete request' });
  }
});

export default router;
