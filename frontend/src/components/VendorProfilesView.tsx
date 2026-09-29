import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { VendorMemoryProfile } from '../types.js';

export const VendorProfilesView: React.FC = () => {
  const [profiles, setProfiles] = useState<VendorMemoryProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const res = await api.getVendorProfiles();
      setProfiles(res.profiles || []);
    } catch (err) {
      console.error('Failed to load vendor profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const filtered = profiles.filter((p) =>
    p.vendorName.toLowerCase().includes(search.toLowerCase()) ||
    p.learnedPatterns?.some((pt) => pt.toLowerCase().includes(search.toLowerCase())) ||
    p.previousDiscrepancies?.some((d) => d.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-lg">🏢</span>
            <h2 className="text-xl font-bold text-slate-900">Vendor Memory Profiles</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Synthesized vendor knowledge, learned invoice patterns, payment terms, and past human exception precedents.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search vendor or pattern..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-2 w-56 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={fetchProfiles}
            className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 flex items-center justify-center text-slate-500 gap-3">
          <span className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading vendor memory profiles...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <span className="text-3xl">🏢</span>
          <h3 className="text-sm font-bold text-slate-800">No vendor profiles found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Upload or submit invoices to automatically build vendor memory profiles, track discrepancy patterns, and record human exception precedents.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {filtered.map((profile) => {
            const isExpanded = expandedVendor === profile.vendorName;

            return (
              <div
                key={profile.vendorName}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                {/* Profile Card Header */}
                <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{profile.vendorName}</h3>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {profile.invoicesCount} {profile.invoicesCount === 1 ? 'Invoice' : 'Invoices'}
                      </span>
                      {profile.previousExceptions.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <span>✓</span> Exception Precedent Active
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                      <span>Payment Terms: <strong className="text-slate-700">{profile.paymentTerms}</strong></span>
                      <span>
                        Historical Range:{' '}
                        <strong className="text-slate-700">
                          {profile.amountRange.currency} {profile.amountRange.min.toLocaleString()} – {profile.amountRange.currency} {profile.amountRange.max.toLocaleString()}
                        </strong>
                      </span>
                      <span>
                        Avg Invoice:{' '}
                        <strong className="text-slate-700">
                          {profile.amountRange.currency} {profile.amountRange.avg.toLocaleString()}
                        </strong>
                      </span>
                      <span>
                        Total Paid:{' '}
                        <strong className="text-slate-700">
                          {profile.amountRange.currency} {profile.amountRange.total.toLocaleString()}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Decision Stats */}
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold">
                      {profile.previousDecisions.approved} Approved
                    </span>
                    <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-semibold">
                      {profile.previousDecisions.flagged} Flagged
                    </span>
                    {profile.previousDecisions.rejected > 0 && (
                      <span className="px-2 py-1 bg-rose-50 text-rose-700 rounded-lg text-xs font-semibold">
                        {profile.previousDecisions.rejected} Rejected
                      </span>
                    )}
                    <button
                      onClick={() => setExpandedVendor(isExpanded ? null : profile.vendorName)}
                      className="ml-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 p-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                    >
                      {isExpanded ? 'Hide Details ▲' : 'View Memories ▼'}
                    </button>
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-5 space-y-4 bg-slate-50/40">
                  {/* Learned Patterns */}
                  <div>
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                      <span>🧠</span> Agent Learned Patterns & Insights
                    </span>
                    <div className="space-y-1.5">
                      {profile.learnedPatterns.map((pattern, idx) => (
                        <div
                          key={idx}
                          className="bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-800 flex items-start gap-2 shadow-2xs"
                        >
                          <span className="text-indigo-600 font-bold mt-0.5">•</span>
                          <span className="leading-relaxed">{pattern}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Past Discrepancies & Exceptions */}
                  {(profile.previousDiscrepancies.length > 0 || profile.previousExceptions.length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {profile.previousDiscrepancies.length > 0 && (
                        <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3">
                          <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block mb-1.5">
                            ⚠️ Historical Discrepancies Encountered
                          </span>
                          <ul className="list-disc list-inside space-y-1 text-xs text-amber-900">
                            {profile.previousDiscrepancies.map((d, i) => (
                              <li key={i} className="leading-tight">{d}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {profile.previousExceptions.length > 0 && (
                        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3">
                          <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider block mb-1.5">
                            ✓ Human Exception Precedents Retained
                          </span>
                          <ul className="list-disc list-inside space-y-1 text-xs text-emerald-900">
                            {profile.previousExceptions.map((ex, i) => (
                              <li key={i} className="leading-tight">{ex}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expandable Memory Items */}
                  {isExpanded && (
                    <div className="pt-3 border-t border-slate-200 space-y-2 animate-in fade-in">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                        Stored Hindsight Memories for {profile.vendorName}
                      </span>
                      {profile.recentMemories.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">No direct memory records linked yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {profile.recentMemories.map((m) => (
                            <div
                              key={m.id}
                              className="bg-white border border-slate-200 rounded-xl p-3 text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between text-[11px] text-slate-500">
                                <span className="font-semibold text-slate-700">
                                  {m.context} • Type: {m.memoryType || 'precedent'}
                                </span>
                                <span>{new Date(m.createdAt).toLocaleDateString()}</span>
                              </div>
                              <p className="text-slate-800 font-medium">{m.content}</p>
                              {m.whyRelevant && (
                                <p className="text-[11px] text-indigo-700 bg-indigo-50/60 p-1.5 rounded">
                                  <strong>Why relevant:</strong> {m.whyRelevant}
                                </p>
                              )}
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
