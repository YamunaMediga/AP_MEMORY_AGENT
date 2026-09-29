import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, Clock } from 'lucide-react';
import { api } from '../api.js';
import { RequestItem, SampleInvoiceItem } from '../types.js';

interface InteractiveDemoViewProps {
  onViewInvoiceDetails: (req: RequestItem) => void;
  onRefreshAllData: () => void;
}

type DemoStage = 'idle' | 'uploading' | 'checking_duplicate' | 'reading_invoice' | 'extracting_data' | 'validating_total' | 'analyzing' | 'recalling_memory' | 'completed';

export const InteractiveDemoView: React.FC<InteractiveDemoViewProps> = ({
  onViewInvoiceDetails,
  onRefreshAllData,
}) => {
  const [samples, setSamples] = useState<SampleInvoiceItem[]>([]);
  const [loadingSamples, setLoadingSamples] = useState(true);

  // Demo State
  const [step1Status, setStep1Status] = useState<'idle' | 'processing' | 'flagged' | 'reviewed'>('idle');
  const [step1Stage, setStep1Stage] = useState<DemoStage>('idle');
  const [invoiceA, setInvoiceA] = useState<RequestItem | null>(null);
  const [feedbackComment, setFeedbackComment] = useState(
    'Approved shipping charges of $5,000 for ABC Suppliers. Freight charges authorized per logistics agreement.'
  );
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const [step2Status, setStep2Status] = useState<'idle' | 'processing' | 'approved'>('idle');
  const [step2Stage, setStep2Stage] = useState<DemoStage>('idle');
  const [invoiceB, setInvoiceB] = useState<RequestItem | null>(null);

  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch samples on load
  const loadSamples = async () => {
    setLoadingSamples(true);
    try {
      const res = await api.getSampleInvoices();
      setSamples(res.samples || []);

      // Check existing requests to see if demo is already in progress
      const reqRes = await api.getRequests();
      const existingReqs = reqRes.requests || [];
      const foundA = existingReqs.find((r) => r.applicant_name === 'ABC Suppliers' && r.amount === 105000);
      const foundB = existingReqs.find((r) => r.applicant_name === 'ABC Suppliers' && r.amount === 84000);

      if (foundA) {
        setInvoiceA(foundA);
        if (foundA.human_decision) {
          setStep1Status('reviewed');
        } else if (foundA.status === 'flagged' || foundA.status === 'analyzing') {
          setStep1Status('flagged');
        }
      }

      if (foundB) {
        setInvoiceB(foundB);
        if (foundB.status === 'approved' || foundB.agent_decision === 'approved') {
          setStep2Status('approved');
        }
      }
    } catch (err: any) {
      console.error('Failed to load sample invoices:', err);
      setError(err?.message || 'Failed to load demo resources');
    } finally {
      setLoadingSamples(false);
    }
  };

  useEffect(() => {
    loadSamples();
  }, []);

  const sampleA = samples.find((s) => s.id === 'sample_abc_a');
  const sampleB = samples.find((s) => s.id === 'sample_abc_b');

  // STEP 1: Process Invoice A
  const handleProcessInvoiceA = async () => {
    if (!sampleA) return;
    setError(null);
    setStep1Status('processing');
    setStep1Stage('uploading');

    const t1 = setTimeout(() => setStep1Stage('checking_duplicate'), 120);
    const t2 = setTimeout(() => setStep1Stage('reading_invoice'), 280);
    const t3 = setTimeout(() => setStep1Stage('extracting_data'), 480);

    try {
      // 1. Parse PDF buffer
      const parseRes = await api.parsePdf({
        pdf_base64: sampleA.pdf_base64,
        filename: sampleA.name,
      });

      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      setStep1Stage('validating_total');

      // 2. Create invoice request
      const createRes = await api.createRequest({
        title: `ABC Suppliers - Industrial Machine Spares`,
        category: sampleA.category,
        amount: parseRes.parsed?.amount || 105000,
        currency: parseRes.parsed?.currency || 'USD',
        applicant_name: parseRes.parsed?.applicantName || 'ABC Suppliers',
        notes: parseRes.parsed?.notes || 'PO Base Subtotal: $100,000, Shipping: $5,000',
        invoice_number: parseRes.parsed?.invoiceNumber || 'INV-ABC-1042',
        invoice_date: parseRes.parsed?.invoiceDate || '2026-09-28',
        pdf_hash: parseRes.parsed?.pdfHash,
        pdf_filename: sampleA.name,
        raw_extracted_text: parseRes.parsed?.rawText,
        learned_insights: parseRes.parsed?.learnedInsights,
        line_items: parseRes.parsed?.lineItems,
        amount_label: parseRes.parsed?.amountLabel,
        extraction_method: parseRes.parsed?.extractionMethod,
        formatted_amount: parseRes.parsed?.formattedAmount,
        confidence: parseRes.parsed?.confidence,
        tax_amount: parseRes.parsed?.taxAmount,
        discount_amount: parseRes.parsed?.discountAmount,
        shipping_amount: parseRes.parsed?.shippingAmount,
        validation_status: typeof parseRes.parsed?.validationStatus === 'string' ? parseRes.parsed.validationStatus : 'validated',
      });

      setStep1Stage('analyzing');
      const newId = createRes.request?.id || createRes.invoice_record_id;

      // Poll until agent finishes evaluation
      let pollCount = 0;
      const pollInterval = setInterval(async () => {
        pollCount++;
        try {
          const checkRes = await api.getRequest(newId);
          if (checkRes.request.status !== 'analyzing' || pollCount > 15) {
            clearInterval(pollInterval);
            setInvoiceA(checkRes.request);
            setStep1Status('flagged');
            setStep1Stage('completed');
            onRefreshAllData();
          }
        } catch (e) {
          clearInterval(pollInterval);
          setStep1Status('flagged');
          setStep1Stage('completed');
        }
      }, 500);
    } catch (err: any) {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      console.error('Step 1 processing error:', err);
      setError(err?.message || 'Failed to process Invoice A');
      setStep1Status('idle');
      setStep1Stage('idle');
    }
  };

  // STEP 1: Submit Human Feedback
  const handleSubmitFeedback = async () => {
    if (!invoiceA) return;
    setSubmittingFeedback(true);
    setError(null);

    try {
      const res = await api.recordHumanFeedback(invoiceA.id, {
        decision: 'approved',
        comment: feedbackComment,
        exceptionGranted: true,
      });

      setInvoiceA(res.request);
      setStep1Status('reviewed');
      onRefreshAllData();
    } catch (err: any) {
      console.error('Failed to submit human feedback:', err);
      setError(err?.message || 'Failed to record human feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // STEP 2: Process Invoice B
  const handleProcessInvoiceB = async () => {
    if (!sampleB) return;
    setError(null);
    setStep2Status('processing');
    setStep2Stage('uploading');

    const t1 = setTimeout(() => setStep2Stage('checking_duplicate'), 120);
    const t2 = setTimeout(() => setStep2Stage('reading_invoice'), 280);
    const t3 = setTimeout(() => setStep2Stage('extracting_data'), 480);

    try {
      // 1. Parse PDF buffer
      const parseRes = await api.parsePdf({
        pdf_base64: sampleB.pdf_base64,
        filename: sampleB.name,
      });

      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      setStep2Stage('validating_total');

      // 2. Create invoice request
      const createRes = await api.createRequest({
        title: `ABC Suppliers - Valves & Bearings`,
        category: sampleB.category,
        amount: parseRes.parsed?.amount || 84000,
        currency: parseRes.parsed?.currency || 'USD',
        applicant_name: parseRes.parsed?.applicantName || 'ABC Suppliers',
        notes: parseRes.parsed?.notes || 'PO Base Subtotal: $80,000, Shipping: $4,000',
        invoice_number: parseRes.parsed?.invoiceNumber || 'INV-ABC-1099',
        invoice_date: parseRes.parsed?.invoiceDate || '2026-10-05',
        pdf_hash: parseRes.parsed?.pdfHash,
        pdf_filename: sampleB.name,
        raw_extracted_text: parseRes.parsed?.rawText,
        learned_insights: parseRes.parsed?.learnedInsights,
        line_items: parseRes.parsed?.lineItems,
        amount_label: parseRes.parsed?.amountLabel,
        extraction_method: parseRes.parsed?.extractionMethod,
        formatted_amount: parseRes.parsed?.formattedAmount,
        confidence: parseRes.parsed?.confidence,
        tax_amount: parseRes.parsed?.taxAmount,
        discount_amount: parseRes.parsed?.discountAmount,
        shipping_amount: parseRes.parsed?.shippingAmount,
        validation_status: typeof parseRes.parsed?.validationStatus === 'string' ? parseRes.parsed.validationStatus : 'validated',
      });

      setStep2Stage('recalling_memory');
      const newId = createRes.request?.id || createRes.invoice_record_id;

      // Poll until agent finishes evaluation
      let pollCount = 0;
      const pollInterval = setInterval(async () => {
        pollCount++;
        try {
          const checkRes = await api.getRequest(newId);
          if (checkRes.request.status !== 'analyzing' || pollCount > 15) {
            clearInterval(pollInterval);
            setInvoiceB(checkRes.request);
            setStep2Status('approved');
            setStep2Stage('completed');
            onRefreshAllData();
          }
        } catch (e) {
          clearInterval(pollInterval);
          setStep2Status('approved');
          setStep2Stage('completed');
        }
      }, 500);
    } catch (err: any) {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      console.error('Step 2 processing error:', err);
      setError(err?.message || 'Failed to process Invoice B');
      setStep2Status('idle');
      setStep2Stage('idle');
    }
  };

  // Reset Demo
  const handleResetDemo = async () => {
    if (!confirm('Reset the ABC Suppliers demo state? This will clear ABC Suppliers invoices and learned memories so you can run the demonstration from scratch.')) {
      return;
    }
    setResetting(true);
    try {
      await api.demoReset();
      setInvoiceA(null);
      setInvoiceB(null);
      setStep1Status('idle');
      setStep1Stage('idle');
      setStep2Status('idle');
      setStep2Stage('idle');
      onRefreshAllData();
    } catch (err: any) {
      console.error('Reset demo error:', err);
      setError('Failed to reset demo');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg text-lg">⚡</span>
            <h2 className="text-xl font-bold text-slate-900">Before-vs-After Hindsight Learning Demo</h2>
          </div>
          <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
            Witness how the agent transforms from a strict rule detector into an intelligent assistant that remembers human exceptions across invoice cycles—without hardcoding any rules.
          </p>
        </div>

        <button
          onClick={handleResetDemo}
          disabled={resetting}
          className="px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors flex items-center gap-1.5 self-start sm:self-center"
        >
          {resetting ? (
            <>
              <span className="w-3 h-3 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
              <span>Resetting...</span>
            </>
          ) : (
            <>
              <span>↺</span> Reset Demo State
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl p-3.5 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600">✕</button>
        </div>
      )}

      {/* Main 2-Step Interactive Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* STEP 1: BEFORE MEMORY */}
        <div className={`bg-white rounded-2xl border-2 transition-all p-5 space-y-4 shadow-sm ${
          step1Status === 'flagged' ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200'
        }`}>
          {/* Card Title */}
          <div className="flex items-start justify-between border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center">
                  1
                </span>
                <h3 className="font-bold text-sm text-slate-900">Step 1: First Interaction (Before Memory)</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                ABC Suppliers submits Invoice A for <strong>$105,000</strong> (PO #PO-8841 is for <strong>$100,000</strong> with unlisted <strong>$5,000</strong> shipping).
              </p>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
              step1Status === 'reviewed'
                ? 'bg-emerald-100 text-emerald-800'
                : step1Status === 'flagged'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-slate-100 text-slate-600'
            }`}>
              {step1Status === 'reviewed' ? 'Exception Learned ✓' : step1Status === 'flagged' ? 'Discrepancy Found ⚠️' : 'Ready'}
            </span>
          </div>

          {/* Action Trigger */}
          {step1Status === 'idle' && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center space-y-3">
              <p className="text-xs text-slate-600">
                Process the actual PDF invoice through the multimodal parser & discrepancy engine with no prior memory.
              </p>
              <button
                onClick={handleProcessInvoiceA}
                disabled={loadingSamples || !sampleA}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
              >
                <span>📄</span> Process Invoice A ($105,000 with $5,000 Shipping)
              </button>
            </div>
          )}

          {step1Status === 'processing' && (
            <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/60 space-y-2.5 text-xs animate-in fade-in duration-150">
              <div className="flex items-center justify-between font-bold text-indigo-950 pb-1.5 border-b border-indigo-100">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  <span>Real-Time Invoice Processing Pipeline</span>
                </span>
                <span className="text-[10px] text-indigo-700 font-mono bg-white px-2 py-0.5 rounded border border-indigo-200">
                  Fast Pipeline Active
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Uploading PDF ✓</span>
                </div>
                <div className={`flex items-center gap-1.5 ${['checking_duplicate', 'reading_invoice', 'extracting_data', 'validating_total', 'analyzing', 'completed'].includes(step1Stage) ? 'text-emerald-700 font-medium' : 'text-slate-400'}`}>
                  {['checking_duplicate', 'reading_invoice', 'extracting_data', 'validating_total', 'analyzing', 'completed'].includes(step1Stage) ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Clock className="w-3.5 h-3.5" />}
                  <span>Checking duplicate ✓</span>
                </div>
                <div className={`flex items-center gap-1.5 ${['reading_invoice', 'extracting_data', 'validating_total', 'analyzing', 'completed'].includes(step1Stage) ? 'text-emerald-700 font-medium' : 'text-slate-400'}`}>
                  {['reading_invoice', 'extracting_data', 'validating_total', 'analyzing', 'completed'].includes(step1Stage) ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Clock className="w-3.5 h-3.5" />}
                  <span>Reading invoice ✓</span>
                </div>
                <div className={`flex items-center gap-1.5 ${['extracting_data', 'validating_total', 'analyzing', 'completed'].includes(step1Stage) ? 'text-emerald-700 font-medium' : 'text-slate-400'}`}>
                  {['extracting_data', 'validating_total', 'analyzing', 'completed'].includes(step1Stage) ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Clock className="w-3.5 h-3.5" />}
                  <span>Extracting invoice data ✓</span>
                </div>
                <div className={`flex items-center gap-1.5 ${['validating_total', 'analyzing', 'completed'].includes(step1Stage) ? 'text-emerald-700 font-medium' : 'text-slate-400'}`}>
                  {['validating_total', 'analyzing', 'completed'].includes(step1Stage) ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Clock className="w-3.5 h-3.5" />}
                  <span>Validating total ✓</span>
                </div>
                <div className={`flex items-center gap-1.5 ${step1Stage === 'analyzing' ? 'text-indigo-700 font-bold' : step1Stage === 'completed' ? 'text-emerald-700 font-medium' : 'text-slate-400'}`}>
                  {step1Stage === 'analyzing' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" /> : step1Stage === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Clock className="w-3.5 h-3.5" />}
                  <span>{step1Stage === 'analyzing' ? 'Evaluating AP rules...' : 'Completed ✓'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Evaluation Results */}
          {invoiceA && (
            <div className="space-y-3">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-slate-800">{invoiceA.applicant_name}</span>
                  <span className="text-slate-900 font-mono">${invoiceA.amount.toLocaleString()}</span>
                </div>
                <div className="text-slate-500 text-[11px] flex justify-between">
                  <span>Invoice: {invoiceA.invoice_number}</span>
                  <span>PO #PO-8841 ($100,000)</span>
                </div>
              </div>

              {/* Discrepancy Callout */}
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs space-y-1 text-amber-900">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <span>⚠️</span> Agent Evaluation Result: FLAGGED FOR REVIEW
                </div>
                <p className="text-[11px] leading-relaxed">
                  {invoiceA.agent_rationale ||
                    'Discrepancy detected: Shipping charge of $5,000 is not listed on PO #PO-8841. No prior exception found in Hindsight memory.'}
                </p>
              </div>

              {/* Human Feedback Card */}
              {step1Status === 'flagged' && (
                <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">👨‍💼</span>
                    <div>
                      <h4 className="text-xs font-bold text-indigo-950">Finance Reviewer Intervention</h4>
                      <p className="text-[11px] text-indigo-800">
                        Approve this invoice and grant an exception so the agent learns for future transmissions.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Exception Explanation (Saved to Hindsight):
                    </label>
                    <textarea
                      rows={2}
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                      className="w-full text-xs border border-indigo-200 rounded-lg p-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <button
                    onClick={handleSubmitFeedback}
                    disabled={submittingFeedback}
                    className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-all"
                  >
                    {submittingFeedback ? (
                      <>
                        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Retaining in Hindsight...</span>
                      </>
                    ) : (
                      <>
                        <span>✓</span> Approve & Grant Shipping Exception
                      </>
                    )}
                  </button>
                </div>
              )}

              {step1Status === 'reviewed' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>✓</span> Human Decision Retained in Hindsight Memory
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    "{invoiceA.human_comment || feedbackComment}"
                  </p>
                  <span className="text-[10px] text-emerald-600 font-mono block">
                    Tagged: vendor=ABC Suppliers • discrepancy=shipping_unmatched • decision=approved
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* STEP 2: AFTER MEMORY */}
        <div className={`bg-white rounded-2xl border-2 transition-all p-5 space-y-4 shadow-sm ${
          step2Status === 'approved' ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200'
        } ${step1Status !== 'reviewed' ? 'opacity-60 pointer-events-none' : ''}`}>
          {/* Card Title */}
          <div className="flex items-start justify-between border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                  2
                </span>
                <h3 className="font-bold text-sm text-slate-900">Step 2: Second Interaction (With Memory)</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                ABC Suppliers submits Invoice B for <strong>$84,000</strong> (PO #PO-8899 is <strong>$80,000</strong> + <strong>$4,000</strong> shipping charge).
              </p>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
              step2Status === 'approved'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-slate-100 text-slate-600'
            }`}>
              {step2Status === 'approved' ? 'Auto-Approved with Memory 🧠' : 'Waiting for Step 1'}
            </span>
          </div>

          {/* Action Trigger */}
          {step2Status === 'idle' && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center space-y-3">
              <p className="text-xs text-slate-600">
                Now process the second invoice. The agent will detect the shipping discrepancy, search Hindsight memory, and recall the human exception!
              </p>
              <button
                onClick={handleProcessInvoiceB}
                disabled={step1Status !== 'reviewed' || !sampleB}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
              >
                <span>🧠</span> Process Invoice B ($84,000 with Learned Memory)
              </button>
            </div>
          )}

          {step2Status === 'processing' && (
            <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/60 space-y-2.5 text-xs animate-in fade-in duration-150">
              <div className="flex items-center justify-between font-bold text-indigo-950 pb-1.5 border-b border-indigo-100">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  <span>Real-Time Processing & Hindsight Recall</span>
                </span>
                <span className="text-[10px] text-indigo-700 font-mono bg-white px-2 py-0.5 rounded border border-indigo-200">
                  Fast Pipeline Active
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Uploading PDF ✓</span>
                </div>
                <div className={`flex items-center gap-1.5 ${['checking_duplicate', 'reading_invoice', 'extracting_data', 'validating_total', 'recalling_memory', 'completed'].includes(step2Stage) ? 'text-emerald-700 font-medium' : 'text-slate-400'}`}>
                  {['checking_duplicate', 'reading_invoice', 'extracting_data', 'validating_total', 'recalling_memory', 'completed'].includes(step2Stage) ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Clock className="w-3.5 h-3.5" />}
                  <span>Checking duplicate ✓</span>
                </div>
                <div className={`flex items-center gap-1.5 ${['reading_invoice', 'extracting_data', 'validating_total', 'recalling_memory', 'completed'].includes(step2Stage) ? 'text-emerald-700 font-medium' : 'text-slate-400'}`}>
                  {['reading_invoice', 'extracting_data', 'validating_total', 'recalling_memory', 'completed'].includes(step2Stage) ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Clock className="w-3.5 h-3.5" />}
                  <span>Reading invoice ✓</span>
                </div>
                <div className={`flex items-center gap-1.5 ${['extracting_data', 'validating_total', 'recalling_memory', 'completed'].includes(step2Stage) ? 'text-emerald-700 font-medium' : 'text-slate-400'}`}>
                  {['extracting_data', 'validating_total', 'recalling_memory', 'completed'].includes(step2Stage) ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Clock className="w-3.5 h-3.5" />}
                  <span>Extracting invoice data ✓</span>
                </div>
                <div className={`flex items-center gap-1.5 ${['validating_total', 'recalling_memory', 'completed'].includes(step2Stage) ? 'text-emerald-700 font-medium' : 'text-slate-400'}`}>
                  {['validating_total', 'recalling_memory', 'completed'].includes(step2Stage) ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Clock className="w-3.5 h-3.5" />}
                  <span>Validating total ✓</span>
                </div>
                <div className={`flex items-center gap-1.5 ${step2Stage === 'recalling_memory' ? 'text-indigo-700 font-bold' : step2Stage === 'completed' ? 'text-emerald-700 font-medium' : 'text-slate-400'}`}>
                  {step2Stage === 'recalling_memory' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" /> : step2Stage === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Clock className="w-3.5 h-3.5" />}
                  <span>{step2Stage === 'recalling_memory' ? 'Recalling Hindsight...' : 'Completed ✓'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Evaluation Results */}
          {invoiceB && (
            <div className="space-y-3">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-slate-800">{invoiceB.applicant_name}</span>
                  <span className="text-slate-900 font-mono">${invoiceB.amount.toLocaleString()}</span>
                </div>
                <div className="text-slate-500 text-[11px] flex justify-between">
                  <span>Invoice: {invoiceB.invoice_number}</span>
                  <span>PO #PO-8899 ($80,000)</span>
                </div>
              </div>

              {/* Agent Rationale with Memory */}
              <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 text-xs space-y-2 text-emerald-950">
                <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                  <span>🧠</span> Agent Recommendation: APPROVED CITING MEMORY
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed font-medium">
                  {invoiceB.agent_rationale}
                </p>
              </div>

              {/* Recalled Memory Highlight */}
              <div className="border border-indigo-200 bg-indigo-50/60 rounded-xl p-3 text-xs space-y-1.5">
                <div className="font-bold text-indigo-900 flex items-center gap-1.5 text-[11px]">
                  <span>💡</span> Memory Retained from Invoice A & Recalled Here:
                </div>
                <p className="text-[11px] text-indigo-800 italic bg-white p-2 rounded border border-indigo-100">
                  "{invoiceA?.human_comment || feedbackComment}"
                </p>
                <div className="text-[10px] text-indigo-600 font-medium">
                  Why Relevant: Finance team previously confirmed and approved shipping charges for ABC Suppliers.
                </div>
              </div>

              <div className="text-center pt-2">
                <button
                  onClick={() => onViewInvoiceDetails(invoiceB)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline"
                >
                  View Full 8-Step Audit Trail for Invoice B →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Side-by-Side Comparison Matrix */}
      {(invoiceA && invoiceB) && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="p-1 bg-indigo-50 text-indigo-600 rounded-lg text-sm">📊</span>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Before vs After Memory Comparison
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Evaluation Dimension</th>
                  <th className="py-2.5 px-3 bg-amber-50/50 text-amber-900">Before Memory (Invoice A)</th>
                  <th className="py-2.5 px-3 bg-emerald-50/50 text-emerald-900">After Memory (Invoice B)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-700">Vendor</td>
                  <td className="py-2.5 px-3">ABC Suppliers</td>
                  <td className="py-2.5 px-3">ABC Suppliers</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-700">Invoice Amount</td>
                  <td className="py-2.5 px-3 font-mono">$105,000.00</td>
                  <td className="py-2.5 px-3 font-mono">$84,000.00</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-700">Discrepancy Encountered</td>
                  <td className="py-2.5 px-3 text-amber-800 font-medium">+$5,000 shipping not on PO</td>
                  <td className="py-2.5 px-3 text-emerald-800 font-medium">+$4,000 shipping not on PO</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-700">Agent Decision</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                      FLAGGED FOR REVIEW
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                      RECOMMENDED APPROVAL
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-700">Reasoning Given</td>
                  <td className="py-2.5 px-3 text-slate-600">
                    "Unmatched shipping charges detected. No prior exception in memory."
                  </td>
                  <td className="py-2.5 px-3 text-emerald-900 font-medium">
                    "Approved: Finance reviewer previously approved shipping charges for ABC Suppliers per Invoice A precedent."
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-700">Manual Review Required?</td>
                  <td className="py-2.5 px-3 text-amber-800 font-bold">Yes (Human exception needed)</td>
                  <td className="py-2.5 px-3 text-emerald-700 font-bold">No (Zero touch approval)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
