import React from 'react';
import { MemoryItem, RequestItem } from '../types.js';
import { Brain, X, Sparkles, Clock, ShieldCheck, Database } from 'lucide-react';

interface MemoryContextModalProps {
  request: RequestItem | null;
  onClose: () => void;
}

export const MemoryContextModal: React.FC<MemoryContextModalProps> = ({ request, onClose }) => {
  if (!request) return null;

  const memories: MemoryItem[] = request.recalled_memories || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Agent Memory Context</h2>
              <p className="text-xs text-slate-500">
                Retrieved from Hindsight long-term memory for <span className="font-mono font-medium">{request.ref_code}</span>
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
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Agent Decision Rationale Box */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Evaluation Outcome</span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${
                  request.status === 'approved'
                    ? 'bg-emerald-100 text-emerald-800'
                    : request.status === 'flagged'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-indigo-100 text-indigo-800'
                }`}
              >
                {request.status}
              </span>
            </div>
            <p className="text-xs text-slate-800 leading-relaxed">
              {request.agent_rationale || 'Decision pending agent evaluation.'}
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Recalled Precedents & Rules ({memories.length})</span>
            </h3>

            {memories.length === 0 ? (
              <div className="p-4 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-xs text-slate-500">
                No specific prior memory was triggered for this request. The agent applied standard operational review principles.
              </div>
            ) : (
              <div className="space-y-2.5">
                {memories.map((m, idx) => (
                  <div
                    key={m.id || idx}
                    className="p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/40 relative"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-indigo-900 px-2 py-0.5 rounded bg-indigo-100/70 border border-indigo-200/60">
                        {m.context || 'Stored Policy Rule'}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Database className="w-3 h-3 text-indigo-500" />
                          {m.source === 'hindsight_cloud' ? 'Cloud Bank' : 'Local Bank'}
                        </span>
                        <span className="font-mono text-indigo-700 font-medium">
                          {(m.relevanceScore * 100).toFixed(0)}% match
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-800 font-medium leading-relaxed mt-1">
                      "{m.content}"
                    </p>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-2">
                      <Clock className="w-3 h-3" />
                      <span>Retained on {new Date(m.createdAt).toLocaleDateString()} at {new Date(m.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Continuous Learning: Knowledge Retained From This Document */}
          {request.learned_insights && request.learned_insights.length > 0 && (
            <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-2.5">
              <h3 className="text-xs font-semibold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Knowledge Learned From This Document ({request.learned_insights.length})</span>
              </h3>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                The agent extracted these discrete vendor benchmarks from the PDF and retained them in Hindsight to validate all future submissions:
              </p>
              <div className="space-y-2">
                {request.learned_insights.map((insight, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-white border border-emerald-100/90 text-xs text-slate-800 shadow-2xs flex items-start gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <span className="font-medium leading-relaxed">{insight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Why Hindsight Matters Note */}
          <div className="p-3 bg-amber-50/70 border border-amber-200/70 rounded-xl flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong>Why Hindsight was necessary:</strong> Unlike stateless LLMs that reset each session, Hindsight preserved your historical policy instructions and continuously learned vendor pricing benchmarks across independent application requests.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
