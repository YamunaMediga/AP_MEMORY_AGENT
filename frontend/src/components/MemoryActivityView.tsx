import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { MemoryActivityItem } from '../types.js';

export const MemoryActivityView: React.FC = () => {
  const [activities, setActivities] = useState<MemoryActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const fetchActivity = async () => {
    setLoading(true);
    try {
      const res = await api.getMemoryActivity();
      setActivities(res.activities || []);
    } catch (err) {
      console.error('Failed to load memory activity:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivity();
  }, []);

  const filtered = activities.filter((act) => {
    const matchesFilter = filterType === 'all' || act.memoryType === filterType;
    const matchesSearch =
      act.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      act.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (act.whyRelevant && act.whyRelevant.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (act.exceptionNote && act.exceptionNote.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-purple-50 text-purple-600 rounded-lg text-lg">🧠</span>
            <h2 className="text-xl font-bold text-slate-900">Hindsight Memory Activity Log</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Chronological record of everything the AP agent has retained, including human decisions, policy exceptions, and pricing benchmarks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Memory Types</option>
            <option value="human_decision">Human Decisions</option>
            <option value="exception_granted">Exceptions Granted</option>
            <option value="pricing_benchmark">Pricing Benchmarks</option>
            <option value="policy">Policy Rules</option>
          </select>
          <input
            type="text"
            placeholder="Search activity..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-2 w-48 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={fetchActivity}
            className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 flex items-center justify-center text-slate-500 gap-3">
          <span className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading memory activity...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <span className="text-3xl">💾</span>
          <h3 className="text-sm font-bold text-slate-800">No memory records found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            As you review invoices and grant exceptions, all learned precedents will be logged here for auditability.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Date / Time</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Learned Precedent / Content</th>
                  <th className="py-3 px-4">Why Relevant (Finance Context)</th>
                  <th className="py-3 px-4">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => {
                  const dateStr = new Date(item.date).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                        {dateStr}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-bold text-slate-800">
                        {item.vendor}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.memoryType === 'human_decision'
                              ? 'bg-purple-100 text-purple-800'
                              : item.memoryType === 'exception_granted'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.memoryType === 'pricing_benchmark'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {item.memoryType?.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-800 font-medium max-w-sm">
                        <div>{item.content}</div>
                        {item.sourceInvoice && (
                          <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                            Source: {item.sourceInvoice}
                          </span>
                        )}
                        {item.exceptionNote && (
                          <div className="text-[11px] text-emerald-700 bg-emerald-50 p-1.5 rounded mt-1">
                            <strong>Exception:</strong> {item.exceptionNote}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-indigo-700 max-w-xs">
                        <div className="bg-indigo-50/60 p-2 rounded text-[11px] leading-relaxed">
                          {item.whyRelevant || 'Context for future invoice matching'}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.humanDecision ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              item.humanDecision === 'approved'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : item.humanDecision === 'rejected'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            }`}
                          >
                            {item.humanDecision}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
