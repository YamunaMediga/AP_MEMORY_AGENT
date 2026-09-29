import React from 'react';
import { AuditEvent } from '../types.js';
import { Activity, Clock, ShieldCheck, FilePlus, Brain } from 'lucide-react';

interface ActivityTimelineProps {
  events: AuditEvent[];
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ events }) => {
  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-5">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-600" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
            Real-Time System Activity Feed
          </h2>
        </div>
        <span className="text-[11px] text-slate-400 font-medium">Live SSE Stream</span>
      </div>

      {events.length === 0 ? (
        <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <p className="text-xs text-slate-500 font-medium">No activity recorded yet.</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Your real-time events will appear here immediately as actions occur.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((evt, idx) => {
            const isDecision = evt.eventType === 'agent_decision';
            const isPolicy = evt.eventType === 'policy_retained';

            return (
              <div key={evt.id || idx} className="flex items-start gap-3 text-xs">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    isPolicy
                      ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                      : isDecision
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {isPolicy ? (
                    <Brain className="w-3.5 h-3.5" />
                  ) : isDecision ? (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  ) : (
                    <FilePlus className="w-3.5 h-3.5" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-slate-800 font-medium leading-tight">{evt.description}</p>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
                    <Clock className="w-3 h-3" />
                    <span>
                      {new Date(evt.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
