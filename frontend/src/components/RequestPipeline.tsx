import React, { useState } from 'react';
import { RequestItem, PolicyItem } from '../types.js';
import {
  PlusCircle,
  Brain,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCw,
  ExternalLink,
  Building,
  Check,
  Flag,
  FileText,
  ShieldAlert,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from 'lucide-react';

interface RequestPipelineProps {
  requests: RequestItem[];
  policies: PolicyItem[];
  onOpenNewRequest: () => void;
  onOpenTeachPolicy: () => void;
  onViewMemoryContext: (req: RequestItem) => void;
  onOpenHumanFeedback: (req: RequestItem) => void;
  onReEvaluate: (id: string) => void;
  onManualAction: (id: string, action: 'approved' | 'rejected' | 'flagged') => void;
  onViewInvoiceRecord?: (invoiceId: string) => void;
}

export const RequestPipeline: React.FC<RequestPipelineProps> = ({
  requests,
  policies,
  onOpenNewRequest,
  onOpenTeachPolicy,
  onViewMemoryContext,
  onOpenHumanFeedback,
  onReEvaluate,
  onManualAction,
  onViewInvoiceRecord,
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'flagged'>('all');
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);

  const filtered = requests.filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return r.status === 'pending' || r.status === 'analyzing';
    if (filter === 'approved') return r.status === 'approved';
    if (filter === 'flagged') return r.status === 'flagged' || r.status === 'changes_requested';
    return true;
  });

  const totalCount = requests.length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;
  const flaggedCount = requests.filter((r) => r.status === 'flagged' || r.status === 'changes_requested').length;

  return (
    <div className="space-y-5">
      {/* Top Action & Controls Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight">Active Request Pipeline</h1>
          <p className="text-xs text-slate-500">
            Real-time accounts payable invoice processing with persistent Hindsight precedents
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Secondary Action: Teach Agent Policy */}
          <button
            type="button"
            onClick={onOpenTeachPolicy}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors shadow-2xs"
          >
            <Brain className="w-3.5 h-3.5 text-indigo-600" />
            <span>Teach Policy Rule</span>
            {policies.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-semibold">
                {policies.length}
              </span>
            )}
          </button>

          {/* Primary Action Button */}
          <button
            type="button"
            onClick={onOpenNewRequest}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Ingest Invoice PDF</span>
          </button>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3.5 bg-white border border-slate-200/90 rounded-xl shadow-2xs">
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Invoices</p>
          <p className="text-lg font-bold text-slate-900 mt-0.5">{totalCount}</p>
        </div>

        <div className="p-3.5 bg-white border border-slate-200/90 rounded-xl shadow-2xs">
          <p className="text-[11px] font-medium text-emerald-600 uppercase tracking-wider">Approved</p>
          <p className="text-lg font-bold text-slate-900 mt-0.5">{approvedCount}</p>
        </div>

        <div className="p-3.5 bg-white border border-slate-200/90 rounded-xl shadow-2xs">
          <p className="text-[11px] font-medium text-amber-600 uppercase tracking-wider">Flagged for Review</p>
          <p className="text-lg font-bold text-slate-900 mt-0.5">{flaggedCount}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200/80 pb-2">
        {(['all', 'pending', 'approved', 'flagged'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors capitalize ${
              filter === tab
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Requests List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <PlusCircle className="w-6 h-6" />
          </div>
          <h2 className="text-sm font-semibold text-slate-900">No invoices found</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Upload an invoice PDF to watch AP Memory Agent extract amounts, check discrepancies, and recall Hindsight precedents in real time.
          </p>
          <button
            type="button"
            onClick={onOpenNewRequest}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>+ Ingest First Invoice PDF</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((req) => {
            const isApproved = req.status === 'approved';
            const isFlagged = req.status === 'flagged' || req.status === 'changes_requested';
            const hasDiscrepancy = req.discrepancy_detected === 1 || (req.discrepancy_type && req.discrepancy_type !== 'none');
            const hasMemories = req.recalled_memories && req.recalled_memories.length > 0;
            const isAuditExpanded = expandedAuditId === req.id;

            return (
              <div
                key={req.id}
                className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-5 hover:border-slate-300 transition-all space-y-3.5"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onViewInvoiceRecord?.(req.id)}
                      className="font-mono text-xs font-bold text-slate-700 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-colors cursor-pointer"
                      title="Inspect isolated invoice record"
                    >
                      {req.ref_code}
                    </button>
                    <button
                      type="button"
                      onClick={() => onViewInvoiceRecord?.(req.id)}
                      className="text-sm font-bold text-slate-900 text-left hover:text-indigo-600 transition-colors cursor-pointer"
                      title="Inspect isolated invoice record"
                    >
                      {req.title}
                    </button>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200">
                      {req.category}
                    </span>
                  </div>

                  {/* Status Badge & Amount */}
                  <div className="flex items-center gap-2">
                    {req.is_duplicate === 1 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                        <span>Duplicate Blocked {req.duplicate_of_ref ? `(${req.duplicate_of_ref})` : ''}</span>
                      </span>
                    )}

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
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
                      <span>{req.status}</span>
                    </span>

                    <span className="text-sm font-bold text-slate-900 font-mono">
                      ${req.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {req.currency}
                    </span>
                  </div>
                </div>

                {/* Sub details: Invoice #, PO, Date, Vendor */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  {req.invoice_number && (
                    <div className="flex items-center gap-1 text-slate-700 font-mono font-medium">
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Invoice: {req.invoice_number}</span>
                    </div>
                  )}

                  {req.po_number && (
                    <div className="flex items-center gap-1 text-slate-700 font-mono font-medium">
                      <span className="px-1.5 py-0.2 bg-slate-100 rounded text-[10px] border border-slate-200">PO</span>
                      <span>{req.po_number} {req.po_amount ? `($${req.po_amount.toLocaleString()})` : ''}</span>
                    </div>
                  )}

                  {req.invoice_date && (
                    <div className="flex items-center gap-1 text-slate-600">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Transmission: {req.invoice_date}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    <span>Vendor: <strong className="text-slate-700">{req.applicant_name}</strong></span>
                  </div>

                  {req.external_url && (
                    <a
                      href={req.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-indigo-600 hover:underline"
                    >
                      <span>{req.external_url.replace(/^https?:\/\//, '')}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}

                  <div className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {req.amount_label && (
                    <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded font-mono">
                      Hierarchy: {req.amount_label}
                    </span>
                  )}
                </div>

                {/* Discrepancy Banner */}
                {hasDiscrepancy && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Discrepancy Detected: {req.discrepancy_type?.replace('_', ' ').toUpperCase()}
                      </span>
                      {req.discrepancy_amount ? (
                        <span className="font-mono text-amber-800">
                          Variance: +${req.discrepancy_amount.toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      {req.discrepancy_details || 'Unmatched charges detected against authorized Purchase Order.'}
                    </p>
                  </div>
                )}

                {/* Agent Evaluation Rationale */}
                {req.agent_rationale && (
                  <div
                    className={`p-3 rounded-xl text-xs space-y-1 ${
                      isApproved
                        ? 'bg-emerald-50/60 border border-emerald-200 text-emerald-950'
                        : isFlagged
                        ? 'bg-amber-50/60 border border-amber-200/80 text-amber-950'
                        : 'bg-slate-50 border border-slate-200 text-slate-700'
                    }`}
                  >
                    <span className="font-bold text-[11px] block uppercase tracking-wider text-slate-700">
                      🤖 Agent Reasoning & Compliance Assessment:
                    </span>
                    <p className="font-medium text-xs leading-relaxed">{req.agent_rationale}</p>
                  </div>
                )}

                {/* Human Decision / Exception Record (If Reviewer already acted) */}
                {req.human_decision && (
                  <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-purple-900 flex items-center gap-1.5">
                        <span>👨‍💼</span> Human Reviewer Decision: {req.human_decision.toUpperCase()}
                      </span>
                      {req.exception_granted && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          Exception Granted ✓
                        </span>
                      )}
                    </div>
                    {req.human_comment && (
                      <p className="text-[11px] text-purple-800 italic">
                        "{req.human_comment}"
                      </p>
                    )}
                  </div>
                )}

                {/* Relevant Memories Section */}
                {hasMemories && (
                  <div className="border border-indigo-100 bg-indigo-50/40 rounded-xl p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-950 flex items-center gap-1.5 text-xs">
                        <Brain className="w-3.5 h-3.5 text-indigo-600" />
                        Found {req.recalled_memories!.length} Relevant Previous Experiences in Hindsight:
                      </span>
                      <button
                        type="button"
                        onClick={() => onViewMemoryContext(req)}
                        className="text-[11px] text-indigo-700 font-semibold hover:underline"
                      >
                        Inspect Memory Bank
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {req.recalled_memories!.slice(0, 3).map((m, idx) => (
                        <div
                          key={m.id || idx}
                          className="bg-white border border-indigo-100 rounded-lg p-2.5 text-[11px] space-y-1"
                        >
                          <div className="flex items-center justify-between text-slate-500 text-[10px]">
                            <span className="font-semibold text-slate-700">{m.context}</span>
                            {m.previousDecision && (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold uppercase">
                                Precedent: {m.previousDecision}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-800 font-medium">{m.content}</p>
                          {m.whyRelevant && (
                            <p className="text-indigo-700 text-[10px]">
                              <strong>Why relevant:</strong> {m.whyRelevant}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Continuous Learning / Insights Acquired */}
                {req.learned_insights && req.learned_insights.length > 0 && (
                  <div className="p-2.5 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="text-[11px] text-emerald-950 font-medium">
                        Retained {req.learned_insights.length} vendor benchmarks into Hindsight
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onViewMemoryContext(req)}
                      className="text-[11px] font-semibold text-emerald-800 hover:underline"
                    >
                      View details
                    </button>
                  </div>
                )}

                {/* 8-Step Visual Audit Trail Accordion */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setExpandedAuditId(isAuditExpanded ? null : req.id)}
                      className="text-xs font-semibold text-slate-600 hover:text-indigo-600 flex items-center gap-1 transition-colors"
                    >
                      {isAuditExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      <span>8-Step Audit Trail {req.audit_trail ? `(${req.audit_trail.length} checkpoints)` : ''}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      {/* View Invoice Record Details */}
                      {onViewInvoiceRecord && (
                        <button
                          type="button"
                          onClick={() => onViewInvoiceRecord(req.id)}
                          className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-indigo-600" />
                          <span>View Invoice</span>
                        </button>
                      )}

                      {/* Human Review & Feedback Button */}
                      <button
                        type="button"
                        onClick={() => onOpenHumanFeedback(req)}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg border border-indigo-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Review & Retain Decision</span>
                      </button>

                      {/* Quick Manual Actions */}
                      <button
                        type="button"
                        onClick={() => onManualAction(req.id, 'approved')}
                        title="Quick Approve"
                        className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors text-xs font-medium flex items-center"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onManualAction(req.id, 'flagged')}
                        title="Quick Flag"
                        className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors text-xs font-medium flex items-center"
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>

                      {/* Re-evaluate button */}
                      <button
                        type="button"
                        onClick={() => onReEvaluate(req.id)}
                        title="Re-evaluate with Memory"
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded 8-Step Trail */}
                  {isAuditExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 animate-in fade-in">
                      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                        Lifecycle Audit Trail & Execution Checkpoints
                      </span>

                      {(!req.audit_trail || req.audit_trail.length === 0) ? (
                        <p className="text-xs text-slate-400 italic">No audit trail checkpoints recorded yet.</p>
                      ) : (
                        <div className="relative pl-6 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                          {req.audit_trail.map((step, idx) => (
                            <div key={idx} className="relative">
                              <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-indigo-600 border-2 border-white shadow-xs" />
                              <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2 text-xs space-y-1">
                                <div className="flex items-center justify-between text-[10px] text-slate-500">
                                  <span className="font-bold text-slate-800 uppercase tracking-wider">
                                    Step {idx + 1}: {step.step.replace('_', ' ')}
                                  </span>
                                  <span>{new Date(step.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <p className="text-slate-700 font-medium text-[11px]">{step.label}</p>
                                {step.details && (
                                  <pre className="text-[10px] text-slate-600 bg-white p-1.5 rounded border border-slate-200 font-mono overflow-x-auto">
                                    {JSON.stringify(step.details, null, 2)}
                                  </pre>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
