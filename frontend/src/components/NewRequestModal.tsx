import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api.js';
import { RequestItem, ParsedInvoice, DuplicateCheckResult } from '../types.js';
import {
  FileText,
  Upload,
  X,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Building,
  DollarSign,
  ChevronDown,
  ChevronUp,
  FileCheck,
  ShieldAlert,
  Loader2,
  Package,
  Clock,
  RefreshCw,
} from 'lucide-react';

interface NewRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestCreated: (req: RequestItem) => void;
  onViewExistingInvoice?: (invoiceId: string) => void;
}

export type ExtractionStage =
  | 'idle'
  | 'uploading'
  | 'checking_duplicate'
  | 'reading_invoice'
  | 'extracting_data'
  | 'validating_total'
  | 'visual_verification'
  | 'completed'
  | 'saving';

export const NewRequestModal: React.FC<NewRequestModalProps> = ({
  isOpen,
  onClose,
  onRequestCreated,
  onViewExistingInvoice,
}) => {
  if (!isOpen) return null;

  const [file, setFile] = useState<{ name: string; base64: string } | null>(null);
  const [parsing, setParsing] = useState(false);
  const [stage, setStage] = useState<ExtractionStage>('idle');
  const [parsedData, setParsedData] = useState<ParsedInvoice | null>(null);
  const [duplicateCheck, setDuplicateCheck] = useState<DuplicateCheckResult | null>(null);
  const [showRawText, setShowRawText] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sampleInvoices, setSampleInvoices] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch sample invoices for 1-click test
  useEffect(() => {
    async function loadSamples() {
      try {
        const res = await api.getSampleInvoices();
        setSampleInvoices(res.samples || []);
      } catch (err) {
        console.warn('Could not load sample invoices:', err);
      }
    }
    loadSamples();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a valid PDF document (.pdf)');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || result;
      processPdf(base64, selectedFile.name);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;

    if (!droppedFile.name.toLowerCase().endsWith('.pdf')) {
      setError('Please drop a valid PDF document (.pdf)');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || result;
      processPdf(base64, droppedFile.name);
    };
    reader.readAsDataURL(droppedFile);
  };

  const processPdf = async (base64: string, filename: string) => {
    setError(null);
    setParsing(true);
    setStage('uploading');
    setFile({ name: filename, base64 });

    // Client-side 8-second timeout guard to prevent UI from freezing indefinitely
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('PDF extraction timed out after 8 seconds. Please retry.')), 8000)
    );

    try {
      setStage('checking_duplicate');

      const parsePromise = api.parsePdf({
        pdf_base64: base64,
        filename,
      });

      const res = await Promise.race([parsePromise, timeoutPromise]);

      setStage('reading_invoice');
      await new Promise(r => setTimeout(r, 60)); // Fast micro-tick for visual stage progress
      setStage('extracting_data');
      await new Promise(r => setTimeout(r, 60));

      if (res.parsed?.extractionMethod === 'visual') {
        setStage('visual_verification');
        await new Promise(r => setTimeout(r, 80));
      }

      setStage('validating_total');
      await new Promise(r => setTimeout(r, 60));
      setStage('completed');

      setParsedData(res.parsed);
      setDuplicateCheck(res.duplicateCheck);
    } catch (err: any) {
      setError(err.message || 'Failed to extract text from PDF');
      setParsedData(null);
      setDuplicateCheck(null);
      setStage('idle');
    } finally {
      setParsing(false);
    }
  };

  const loadSample = (sample: any) => {
    processPdf(sample.pdf_base64, sample.name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedData) {
      setError('Please upload a PDF invoice first');
      return;
    }

    // If exact duplicate, clicking should view the existing record instead of re-inserting
    if (duplicateCheck?.isDuplicate && duplicateCheck.duplicateType === 'exact_file' && duplicateCheck.originalRequestId) {
      if (onViewExistingInvoice) {
        onClose();
        onViewExistingInvoice(duplicateCheck.originalRequestId);
        return;
      }
    }

    setSubmitting(true);
    setStage('saving');
    setError(null);

    try {
      const res = await api.createRequest({
        title: parsedData.title,
        category: parsedData.category,
        amount: parsedData.amount,
        currency: parsedData.currency,
        applicant_name: parsedData.applicantName,
        notes: parsedData.notes,
        invoice_number: parsedData.invoiceNumber,
        invoice_date: parsedData.invoiceDate,
        pdf_hash: parsedData.pdfHash,
        pdf_filename: file?.name || 'invoice.pdf',
        raw_extracted_text: parsedData.rawText,
        learned_insights: parsedData.learnedInsights,
        line_items: parsedData.lineItems,
        amount_label: parsedData.amountLabel,
        extraction_method: parsedData.extractionMethod,
        formatted_amount: parsedData.formattedAmount,
        confidence: parsedData.confidence,
        tax_amount: parsedData.taxAmount,
        discount_amount: parsedData.discountAmount,
        shipping_amount: parsedData.shippingAmount,
        validation_status: typeof parsedData.validationStatus === 'string' ? parsedData.validationStatus : 'validated',
      });

      if (res.status === 'duplicate' && res.invoice_record_id) {
        if (onViewExistingInvoice) {
          onClose();
          onViewExistingInvoice(res.invoice_record_id);
          return;
        }
      }

      onRequestCreated(res.request || res.data);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create request from invoice');
      setStage('completed');
    } finally {
      setSubmitting(false);
    }
  };

  const isExactFileDup = duplicateCheck?.isDuplicate && duplicateCheck.duplicateType === 'exact_file';
  const isContentDup = duplicateCheck?.isDuplicate && duplicateCheck.duplicateType !== 'exact_file';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">PDF Invoice Ingestion & Duplicate Check</h2>
              <p className="text-xs text-slate-500">
                Direct runtime PDF parsing, monetary extraction & SHA-256 deduplication
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1-Click Sample PDF Invoices for Hackathon Testing */}
        <div className="px-6 pt-3 pb-2.5 border-b border-slate-100 bg-slate-50/40">
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-500" />
            <span>Test with Sample Invoice PDFs</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {sampleInvoices.map((sample) => {
              const isDup = sample.id === 'sample_duplicate';
              return (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => loadSample(sample)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium border transition-colors ${
                    isDup
                      ? 'bg-amber-50/70 border-amber-200 text-amber-900 hover:bg-amber-100'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200'
                  }`}
                >
                  {isDup ? '⚠️ ' : '📄 '}
                  <span>{sample.name.replace('.pdf', '')}</span>
                  <span className="ml-1 text-[10px] text-slate-400 font-mono">(${sample.amount})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Processing Notice</p>
                  <p className="text-[11px] mt-0.5">{error}</p>
                </div>
              </div>
              {file && (
                <button
                  type="button"
                  onClick={() => processPdf(file.base64, file.name)}
                  className="px-2.5 py-1 bg-white hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-lg font-semibold text-[11px] shrink-0 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              )}
            </div>
          )}

          {/* PDF Drag-and-Drop Area */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20 rounded-2xl p-6 text-center cursor-pointer transition-all bg-slate-50/30"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-2">
              <Upload className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-800">
              {file ? file.name : 'Upload or Drag & Drop Invoice PDF'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Direct PDF extraction extracts transmission date, amount, vendor, line items & checks duplicates
            </p>
          </div>

          {/* Real-Time Fast Multi-Stage Pipeline Progress */}
          {(parsing || stage === 'saving') && (
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
                <div className={`flex items-center gap-1.5 ${['checking_duplicate', 'reading_invoice', 'extracting_data', 'validating_total', 'completed', 'saving'].includes(stage) ? 'text-emerald-700 font-medium' : 'text-slate-400'}`}>
                  {['checking_duplicate', 'reading_invoice', 'extracting_data', 'validating_total', 'completed', 'saving'].includes(stage) ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Clock className="w-3.5 h-3.5" />}
                  <span>Checking duplicate ✓</span>
                </div>
                <div className={`flex items-center gap-1.5 ${['reading_invoice', 'extracting_data', 'validating_total', 'completed', 'saving'].includes(stage) ? 'text-emerald-700 font-medium' : 'text-slate-400'}`}>
                  {['reading_invoice', 'extracting_data', 'validating_total', 'completed', 'saving'].includes(stage) ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Clock className="w-3.5 h-3.5" />}
                  <span>Reading invoice ✓</span>
                </div>
                <div className={`flex items-center gap-1.5 ${['extracting_data', 'validating_total', 'completed', 'saving'].includes(stage) ? 'text-emerald-700 font-medium' : 'text-slate-400'}`}>
                  {['extracting_data', 'validating_total', 'completed', 'saving'].includes(stage) ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Clock className="w-3.5 h-3.5" />}
                  <span>Extracting invoice data ✓</span>
                </div>
                <div className={`flex items-center gap-1.5 ${['validating_total', 'completed', 'saving'].includes(stage) ? 'text-emerald-700 font-medium' : 'text-slate-400'}`}>
                  {['validating_total', 'completed', 'saving'].includes(stage) ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Clock className="w-3.5 h-3.5" />}
                  <span>Validating total ✓</span>
                </div>
                <div className={`flex items-center gap-1.5 ${stage === 'saving' ? 'text-indigo-700 font-bold' : stage === 'completed' ? 'text-emerald-700 font-medium' : 'text-slate-400'}`}>
                  {stage === 'saving' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" /> : stage === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Clock className="w-3.5 h-3.5" />}
                  <span>{stage === 'saving' ? 'Saving invoice...' : 'Completed ✓'}</span>
                </div>
              </div>
              {stage === 'visual_verification' && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[10px] mt-1">
                  Text extraction completed ✓ Amount requires visual verification. Checking invoice summary...
                </div>
              )}
            </div>
          )}

          {/* Extracted Invoice Card */}
          {parsedData && !parsing && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-900">Extracted Invoice Data</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-500">
                  SHA-256: {parsedData.pdfHash.slice(0, 10)}...
                </span>
              </div>

              {/* Duplicate Detection Alert Banners */}
              {isExactFileDup ? (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-bold text-rose-950">Exact File Duplicate Detected (SHA-256 Match)</p>
                      <p className="text-[11px] text-rose-800 mt-0.5">{duplicateCheck.reason}</p>
                      <p className="text-[10px] text-rose-700 mt-1 font-medium">
                        This identical PDF was already processed. Duplicate insertion and duplicate Hindsight learning are blocked.
                      </p>
                    </div>
                  </div>
                  {duplicateCheck.originalRequestId && onViewExistingInvoice && (
                    <div className="pt-2 border-t border-rose-200/60 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onViewExistingInvoice(duplicateCheck.originalRequestId!);
                        }}
                        className="px-3 py-1.5 bg-white text-rose-700 hover:bg-rose-100 border border-rose-300 font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-2xs"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>View Existing Record ({duplicateCheck.originalRefCode || 'Open'})</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : isContentDup ? (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-bold text-amber-950">Potential Double-Billing Warning (Cross-File Match)</p>
                      <p className="text-[11px] text-amber-800 mt-0.5">{duplicateCheck.reason}</p>
                      <p className="text-[10px] text-amber-700 mt-1 font-medium">
                        Matching invoice details were already recorded. Submitting will flag this invoice without duplicate Hindsight learning.
                      </p>
                    </div>
                  </div>
                  {duplicateCheck.originalRequestId && onViewExistingInvoice && (
                    <div className="pt-2 border-t border-amber-200/60 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onViewExistingInvoice(duplicateCheck.originalRequestId!);
                        }}
                        className="px-3 py-1.5 bg-white text-amber-800 hover:bg-amber-100 border border-amber-300 font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-2xs"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>View Existing Record ({duplicateCheck.originalRefCode || 'Open'})</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200/80 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium text-[11px]">Unique Invoice Verified: No duplicate billing detected in database</span>
                </div>
              )}

              {/* Extracted Fields Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-0.5">
                    Invoice Number
                  </span>
                  <span className="font-mono font-bold text-slate-900">{parsedData.invoiceNumber}</span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>Date of Transmission</span>
                  </span>
                  <span className="font-bold text-slate-900">{parsedData.invoiceDate}</span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-slate-400" />
                    <span>Total Amount</span>
                  </span>
                  <span className="font-bold text-slate-900 font-mono text-sm">
                    ${parsedData.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {parsedData.currency}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                    <Building className="w-3 h-3 text-slate-400" />
                    <span>Applicant / Vendor</span>
                  </span>
                  <span className="font-bold text-slate-900 truncate block">{parsedData.applicantName}</span>
                </div>
              </div>

              {/* Line Items Preview if available */}
              {parsedData.lineItems && parsedData.lineItems.length > 0 && (
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-700 font-semibold text-[11px]">
                    <span className="flex items-center gap-1">
                      <Package className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Extracted Line Items ({parsedData.lineItems.length})</span>
                    </span>
                    {parsedData.amountLabel && (
                      <span className="text-[10px] text-slate-400 font-mono">Matched: {parsedData.amountLabel}</span>
                    )}
                  </div>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {parsedData.lineItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white p-1.5 rounded border border-slate-200/60 text-[11px]">
                        <span className="truncate flex-1 text-slate-800">{item.description}</span>
                        <span className="font-mono text-slate-500 mx-2 text-[10px]">x{item.quantity || 1}</span>
                        <span className="font-mono font-bold text-slate-900">${item.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Continuous Learning Preview: Knowledge Agent Will Retain */}
              {parsedData.learnedInsights && parsedData.learnedInsights.length > 0 && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-950">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Continuous Learning: Facts Agent Will Retain in Memory</span>
                  </div>
                  <div className="space-y-1">
                    {parsedData.learnedInsights.map((insight, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-[11px] text-slate-700 bg-white/90 p-2 rounded-lg border border-indigo-100/60 leading-relaxed shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                        <span>{insight}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw Extracted Text Accordion */}
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowRawText(!showRawText)}
                  className="w-full px-3 py-2 text-[11px] font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-colors"
                >
                  <span>Raw Extracted PDF Content ({parsedData.rawText.length} characters)</span>
                  {showRawText ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {showRawText && (
                  <div className="p-3 bg-slate-950 text-slate-300 font-mono text-[10px] max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {parsedData.rawText}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!parsedData || submitting}
            className={`px-5 py-2 text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 ${
              isExactFileDup
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : isContentDup
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            } disabled:opacity-50`}
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Processing with Agent...</span>
              </>
            ) : isExactFileDup ? (
              <span>View Existing Invoice Record</span>
            ) : isContentDup ? (
              <span>Submit & Flag Duplicate</span>
            ) : (
              <span>Submit Invoice for Agent Evaluation</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
