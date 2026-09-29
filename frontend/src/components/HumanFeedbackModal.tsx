import React, { useState, useEffect } from 'react';
import { RequestItem, HumanFeedbackPayload } from '../types.js';
import { api } from '../api.js';

interface HumanFeedbackModalProps {
  request: RequestItem | null;
  isOpen: boolean;
  onClose: () => void;
  onFeedbackSubmitted: (updatedRequest: RequestItem) => void;
}

export const HumanFeedbackModal: React.FC<HumanFeedbackModalProps> = ({
  request,
  isOpen,
  onClose,
  onFeedbackSubmitted,
}) => {
  const [decision, setDecision] = useState<'approved' | 'rejected' | 'corrected' | 'flagged'>('approved');
  const [comment, setComment] = useState('');
  const [exceptionGranted, setExceptionGranted] = useState(true);
  const [correctedRecommendation, setCorrectedRecommendation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (request) {
      if (request.discrepancy_detected || request.discrepancy_type === 'shipping_unmatched') {
        setDecision('approved');
        setExceptionGranted(true);
        setComment(`Approved shipping charges of $${request.discrepancy_amount?.toLocaleString() || '5,000'} for ${request.applicant_name}. Shipping fees authorized per logistics agreement.`);
      } else {
        setDecision('approved');
        setExceptionGranted(false);
        setComment(`Invoice verified and approved under standard payment terms.`);
      }
      setCorrectedRecommendation('');
      setError(null);
    }
  }, [request]);

  if (!isOpen || !request) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload: HumanFeedbackPayload = {
        decision,
        comment: comment.trim(),
        exceptionGranted,
        correctedRecommendation: decision === 'corrected' ? correctedRecommendation.trim() : undefined,
      };

      const res = await api.recordHumanFeedback(request.id, payload);
      onFeedbackSubmitted(res.request);
      onClose();
    } catch (err: any) {
      console.error('Failed to submit human feedback:', err);
      setError(err?.message || 'Failed to record feedback');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-lg">🧠</span>
              <h3 className="text-lg font-bold text-slate-900">Review & Retain Human Decision</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Your decision and reasoning will be retained into Hindsight memory so the agent learns for future invoices.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Invoice Summary Banner */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-800 text-sm">{request.applicant_name}</span>
            <span className="font-mono font-bold text-slate-900 text-sm">
              {request.currency} {request.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Ref: {request.ref_code} • Invoice #{request.invoice_number || 'N/A'}</span>
            <span>Date: {request.invoice_date || 'N/A'}</span>
          </div>
          {request.discrepancy_detected ? (
            <div className="mt-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-2.5">
              <div className="font-semibold flex items-center gap-1.5">
                <span>⚠️</span>
                <span>Detected Discrepancy: {request.discrepancy_type?.replace('_', ' ').toUpperCase()}</span>
              </div>
              <p className="text-xs text-amber-800 mt-1">{request.discrepancy_details}</p>
            </div>
          ) : null}
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg p-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Decision Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Human Reviewer Decision
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDecision('approved')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                  decision === 'approved'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span>✓</span> Approve
              </button>
              <button
                type="button"
                onClick={() => setDecision('rejected')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                  decision === 'rejected'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span>✕</span> Reject
              </button>
              <button
                type="button"
                onClick={() => setDecision('corrected')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                  decision === 'corrected'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span>✎</span> Correct
              </button>
            </div>
          </div>

          {/* Corrected Recommendation (if corrected) */}
          {decision === 'corrected' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Corrected Agent Recommendation:
              </label>
              <input
                type="text"
                value={correctedRecommendation}
                onChange={(e) => setCorrectedRecommendation(e.target.value)}
                placeholder="e.g. Approved with condition of receipt confirmation"
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                required
              />
            </div>
          )}

          {/* Exception Checkbox */}
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={exceptionGranted}
                onChange={(e) => setExceptionGranted(e.target.checked)}
                className="mt-0.5 h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <div>
                <span className="text-xs font-bold text-indigo-950 block">
                  Grant Persistent Policy Exception for {request.applicant_name}
                </span>
                <span className="text-[11px] text-indigo-800 block mt-0.5 leading-relaxed">
                  The agent will remember this precedent in Hindsight. If {request.applicant_name} submits another invoice with this discrepancy pattern, the agent will cite this human approval instead of flagging it.
                </span>
              </div>
            </label>
          </div>

          {/* Comment / Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason / Precedent Explanation (Written to Hindsight Memory):
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g., Shipping charges allowed for ABC Suppliers per logistics agreement..."
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none leading-relaxed"
              required
            />
          </div>

          {/* Live Preview of what Hindsight retains */}
          <div className="border border-slate-200 bg-slate-50/70 rounded-xl p-3 text-[11px] space-y-1 text-slate-600">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <span>⚡</span> Hindsight Memory Preview:
            </span>
            <p className="font-mono text-slate-700 bg-white p-2 rounded border border-slate-200">
              [Vendor: {request.applicant_name}] Human Decision: {decision.toUpperCase()}{exceptionGranted ? ' (Exception Granted)' : ''}. Reason: "{comment.slice(0, 100)}{comment.length > 100 ? '...' : ''}"
            </p>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Retaining in Hindsight...</span>
                </>
              ) : (
                <>
                  <span>🧠</span>
                  <span>Confirm Decision & Teach Agent</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
