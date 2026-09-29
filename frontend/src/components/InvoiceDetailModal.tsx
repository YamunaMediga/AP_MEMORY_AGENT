import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { RequestItem, InvoiceLineItem, AuditStepRecord, MemoryItem } from '../types.js';
import {
  FileText,
  X,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Building,
  Calendar,
  DollarSign,
  ShieldCheck,
  Brain,
  Sparkles,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Hash,
  Layers,
  FileCheck,
  Package,
} from 'lucide-react';

interface InvoiceDetailModalProps {
  invoiceId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenHumanFeedback?: (req: RequestItem) => void;
  onReEvaluate?: (id: string) => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  invoiceId,
  isOpen,
  onClose,
  onOpenHumanFeedback,
  onReEvaluate,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<any | null>(null);
  const [showRawText, setShowRawText] = useState(false);
  const [reEvaluating, setReEvaluating] = useState(false);

  useEffect(() => {
    if (!isOpen || !invoiceId) {
      setRecord(null);
      setError(null);
      return;
    }

    async function loadInvoice() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.getInvoice(invoiceId!);
        setRecord(res.data || res.request || res);
      } catch (err: any) {
        console.error('Failed to load invoice record:', err);
        setError(err.message || 'Invoice record could not be found.');
      } finally {
        setLoading(false);
      }
    }

    loadInvoice();
  }, [isOpen, invoiceId]);

  if (!isOpen) return null;

  const handleTriggerReEvaluate = async () => {
    if (!invoiceId) return;
    setReEvaluating(true);
    try {
      if (onReEvaluate) {
        await onReEvaluate(invoiceId);
      } else {
        await api.reEvaluateRequest(invoiceId);
      }
      // Re-fetch record after small delay
      setTimeout(async () => {
        try {
          const res = await api.getInvoice(invoiceId);
          setRecord(res.data || res.request || res);
        } finally {
          setReEvaluating(false);
        }
      }, 1200);
    } catch (err: any) {
      alert(`Re-evaluation failed: ${err.message}`);
      setReEvaluating(false);
    }
  };

  const isApproved = record?.status === 'approved';
  const isFlagged = record?.status === 'flagged' || record?.status === 'changes_requested';
  const isAnalyzing = record?.status === 'analyzing' || record?.status === 'pending';

  const lineItems: InvoiceLineItem[] = record?.line_items || [];
  const learnedInsights: string[] = record?.new_learning || record?.learned_insights || [];
  const recalledMemories: MemoryItem[] = record?.recalled_memories || [];
  const auditTrail: AuditStepRecord[] = record?.audit_trail || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  {record?.title || 'Invoice Record Detail'}
                </h2>
                {record?.ref_code && (
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-200/80 text-slate-700">
                    {record.ref_code}
                  </span>
                )}
                {record?.status && (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                      isApproved
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : isFlagged
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse'
                    }`}
                  >
                    {isApproved ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    ) : isFlagged ? (
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                    ) : (
                      <RotateCw className="w-3 h-3 animate-spin text-indigo-600" />
                    )}
                    <span>{record.status}</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                <Hash className="w-3 h-3 text-slate-400" />
                <span>ID: {record?.id || record?.invoice_record_id || invoiceId}</span>
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {loading && (
            <div className="py-16 text-center space-y-3">
              <RotateCw className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
              <p className="text-xs font-medium text-slate-600">Retrieving isolated invoice record data...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Unable to load invoice record</p>
                <p className="text-[11px] mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {!loading && record && (
            <>
              {/* Primary Invoice Metadata Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                    <Building className="w-3 h-3 text-slate-400" />
                    <span>Vendor / Payee</span>
                  </span>
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {record.applicant_name || record.vendor || 'N/A'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                    <FileText className="w-3 h-3 text-slate-400" />
                    <span>Invoice Number</span>
                  </span>
                  <p className="text-xs font-bold font-mono text-slate-900">
                    {record.invoice_number || 'N/A'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>Transmission Date</span>
                  </span>
                  <p className="text-xs font-bold text-slate-900">
                    {record.invoice_date || new Date(record.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 space-y-1">
                  <span className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wider block flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-indigo-500" />
                    <span>Total Amount</span>
                  </span>
                  <p className="text-sm font-extrabold font-mono text-indigo-950">
                    ${Number(record.amount || record.invoice_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                    <span className="text-xs font-normal text-indigo-700">{record.currency || 'USD'}</span>
                  </p>
                </div>
              </div>

              {/* Extraction Specs & Verification Strip */}
              <div className="flex flex-wrap items-center justify-between p-3 rounded-xl bg-slate-50/60 border border-slate-200/80 text-xs text-slate-600 gap-2">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Status: <strong className="text-slate-800 capitalize">{record.validation_status || 'Validated'}</strong></span>
                  </div>
                  <div>
                    <span>Method: <strong className="text-slate-800 font-mono text-[11px]">{record.extraction_method || 'PDF text extraction'}</strong></span>
                  </div>
                  <div>
                    <span>Confidence: <strong className="text-slate-800 font-mono text-[11px]">{Math.round((record.confidence || 0.98) * 100)}%</strong></span>
                  </div>
                </div>

                {record.pdf_hash && (
                  <span className="font-mono text-[10px] text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">
                    SHA-256: {record.pdf_hash.slice(0, 14)}...
                  </span>
                )}
              </div>

              {/* Line Items Table (Extracted from real PDF layout) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Extracted Line Items ({lineItems.length})</span>
                  </h3>
                  {record.amount_label && (
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      Hierarchy Label: {record.amount_label}
                    </span>
                  )}
                </div>

                {lineItems.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-xs text-slate-500">
                    Single aggregate item: {record.notes || record.title || 'Standard Invoice Service Charges'}
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Description</th>
                          <th className="py-2.5 px-3 text-right">Qty</th>
                          <th className="py-2.5 px-3 text-right">Unit Price</th>
                          <th className="py-2.5 px-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {lineItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{item.itemNumber || idx + 1}</td>
                            <td className="py-2.5 px-3 text-slate-900 font-medium">{item.description}</td>
                            <td className="py-2.5 px-3 text-right text-slate-600 font-mono">{item.quantity || 1}</td>
                            <td className="py-2.5 px-3 text-right text-slate-600 font-mono">
                              ${Number(item.unitPrice || item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              ${Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Financial Breakdown Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Taxes</span>
                  <span className="font-mono font-bold text-slate-800">
                    ${Number(record.tax || record.tax_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Shipping / Freight</span>
                  <span className="font-mono font-bold text-slate-800">
                    ${Number(record.shipping || record.shipping_amount || record.discrepancy_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Discounts</span>
                  <span className="font-mono font-bold text-slate-800">
                    ${Number(record.discount || record.discount_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-indigo-700 uppercase tracking-wider font-bold block">Total Payable</span>
                  <span className="font-mono font-extrabold text-indigo-950">
                    ${Number(record.amount || record.invoice_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Agent Rationale & Assessment */}
              {record.agent_rationale && (
                <div
                  className={`p-4 rounded-xl text-xs space-y-1.5 ${
                    isApproved
                      ? 'bg-emerald-50/70 border border-emerald-200 text-emerald-950'
                      : isFlagged
                      ? 'bg-amber-50/70 border border-amber-200 text-amber-950'
                      : 'bg-slate-50 border border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <span>🤖</span> Agent Compliance Decision: {record.agent_decision || record.status}
                    </span>
                  </div>
                  <p className="leading-relaxed font-medium">{record.agent_rationale}</p>
                </div>
              )}

              {/* Continuous Learning: Knowledge Retained in Hindsight */}
              {learnedInsights.length > 0 && (
                <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Continuous Learning: Retained Hindsight Memories ({learnedInsights.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {learnedInsights.map((insight, idx) => (
                      <div
                        key={idx}
                        className="bg-white/95 p-2 rounded-lg border border-indigo-100/70 text-[11px] text-slate-800 flex items-start gap-2 shadow-2xs"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                        <span>{insight}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recalled Hindsight Memories */}
              {recalledMemories.length > 0 && (
                <div className="p-3.5 bg-purple-50/50 border border-purple-100 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-950">
                    <Brain className="w-3.5 h-3.5 text-purple-600" />
                    <span>Precedents Recalled from Hindsight ({recalledMemories.length})</span>
                  </div>
                  <div className="space-y-2">
                    {recalledMemories.map((m, idx) => (
                      <div
                        key={m.id || idx}
                        className="bg-white p-2.5 rounded-lg border border-purple-100 text-xs space-y-1 shadow-2xs"
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span className="font-bold text-purple-900">{m.context}</span>
                          {m.previousDecision && (
                            <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 font-bold uppercase text-[9px]">
                              Decision: {m.previousDecision}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-800 text-[11px] font-medium">{m.content}</p>
                        {m.whyRelevant && (
                          <p className="text-purple-700 text-[10px]">
                            <strong>Why relevant:</strong> {m.whyRelevant}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lifecycle 8-Step Audit Trail */}
              {auditTrail.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Lifecycle Execution Audit Trail ({auditTrail.length} checkpoints)</span>
                  </h3>
                  <div className="relative pl-6 space-y-2.5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {auditTrail.map((step, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-indigo-600 border-2 border-white shadow-xs" />
                        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 text-xs space-y-0.5">
                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span className="font-bold text-slate-800 uppercase tracking-wider">
                              Step {idx + 1}: {step.step.replace('_', ' ')}
                            </span>
                            <span>{new Date(step.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-slate-700 font-medium text-[11px]">{step.label}</p>
                          {step.details && (
                            <pre className="text-[10px] text-slate-600 bg-white p-1.5 rounded border border-slate-200 font-mono overflow-x-auto mt-1">
                              {JSON.stringify(step.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw Extracted Text Accordion */}
              {record.raw_extracted_text && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowRawText(!showRawText)}
                    className="w-full px-3 py-2 text-[11px] font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <FileCheck className="w-3.5 h-3.5 text-slate-400" />
                      <span>Extracted PDF Raw Text ({record.raw_extracted_text.length} characters)</span>
                    </span>
                    {showRawText ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  {showRawText && (
                    <div className="p-3 bg-slate-950 text-slate-300 font-mono text-[10px] max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                      {record.raw_extracted_text}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {record && onOpenHumanFeedback && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenHumanFeedback(record);
                }}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition-colors flex items-center gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Review & Retain Decision</span>
              </button>
            )}

            {record && (
              <button
                type="button"
                onClick={handleTriggerReEvaluate}
                disabled={reEvaluating || isAnalyzing}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <RotateCw className={`w-3.5 h-3.5 ${reEvaluating ? 'animate-spin text-indigo-600' : ''}`} />
                <span>{reEvaluating ? 'Re-evaluating...' : 'Re-evaluate with Memory'}</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
