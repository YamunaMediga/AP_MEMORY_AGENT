import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { LearningMetrics, SystemStatus } from '../types.js';

interface DashboardViewProps {
  onNavigateToDemo: () => void;
  onNavigateToInvoices: () => void;
  onNavigateToVendors: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToDemo,
  onNavigateToInvoices,
  onNavigateToVendors,
}) => {
  const [metrics, setMetrics] = useState<LearningMetrics | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const [metricData, statusData] = await Promise.all([
          api.getLearningMetrics(),
          api.getSystemStatus(),
        ]);
        setMetrics(metricData);
        setSystemStatus(statusData);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="p-12 flex items-center justify-center text-slate-500 gap-3">
        <span className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Aggregating AP & Hindsight metrics...</span>
      </div>
    );
  }

  const ap = metrics?.apOverview || {
    totalInvoices: 0,
    approvedInvoices: 0,
    rejectedInvoices: 0,
    flaggedInvoices: 0,
    totalDiscrepancies: 0,
    humanCorrections: 0,
    memoriesCreated: 0,
    memoriesRecalled: 0,
  };

  const lm = metrics?.learningMetrics || {
    experiencesRemembered: 0,
    influencedRecommendations: 0,
    humanCorrectionsRetained: 0,
    memoryInfluenceRate: 0,
  };

  return (
    <div className="space-y-6">
      {/* Hero Interactive Demo Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-2xl shadow-xl text-white p-6 sm:p-8">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/40 text-xs font-semibold text-indigo-200">
            <span>✨</span> Core Feature: Continuous Learning with Hindsight
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Accounts Payable AI Agent That Learns From Human Precedents
          </h2>
          <p className="text-indigo-200 text-sm leading-relaxed">
            Unlike static rule engines, this AP agent remembers every human review, approved discrepancy, and vendor exception. When similar invoices arrive, the agent recalls past decisions and automatically recommends the right action.
          </p>
          <div className="pt-3 flex flex-wrap gap-3">
            <button
              onClick={onNavigateToDemo}
              className="bg-white text-indigo-900 hover:bg-indigo-50 font-bold px-5 py-2.5 rounded-xl shadow-md text-xs flex items-center gap-2 transition-all transform hover:-translate-y-0.5"
            >
              <span>⚡</span> Run Before-vs-After Memory Demo
            </button>
            <button
              onClick={onNavigateToInvoices}
              className="bg-indigo-700/60 hover:bg-indigo-700 border border-indigo-400/40 text-white font-semibold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all"
            >
              <span>📄</span> View Active Invoices
            </button>
            <button
              onClick={onNavigateToVendors}
              className="bg-indigo-700/60 hover:bg-indigo-700 border border-indigo-400/40 text-white font-semibold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all"
            >
              <span>🏢</span> Vendor Profiles
            </button>
          </div>
        </div>
      </div>

      {/* Metric Section 1: Hindsight Continuous Learning Performance */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="p-1 bg-purple-100 text-purple-700 rounded-lg text-sm">🧠</span>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Hindsight Learning Metrics (Real Persistent Data)
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Memory Engine: {systemStatus?.hindsight.mode === 'cloud' ? 'Hindsight Cloud API' : 'Persistent SQLite Bank'}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Experiences Remembered */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Experiences Remembered</span>
              <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-sm">💾</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">{lm.experiencesRemembered}</span>
              <span className="text-xs font-medium text-slate-500">memories stored</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Persistent vendor patterns, pricing benchmarks & human exceptions.
            </p>
          </div>

          {/* Card 2: Influenced Recommendations */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Influenced Recommendations</span>
              <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-sm">🎯</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-600">{lm.influencedRecommendations}</span>
              <span className="text-xs font-medium text-slate-500">invoices guided</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Decisions directly shaped or approved by citing prior memory precedents.
            </p>
          </div>

          {/* Card 3: Human Corrections Retained */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Human Decisions Retained</span>
              <span className="p-1.5 bg-purple-50 text-purple-600 rounded-lg text-sm">👨‍💼</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-purple-700">{lm.humanCorrectionsRetained}</span>
              <span className="text-xs font-medium text-slate-500">reviews learned</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Finance reviewer overrides and policy exceptions retained forever.
            </p>
          </div>

          {/* Card 4: Memory Influence Rate */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Memory Influence Rate</span>
              <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg text-sm">📈</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-amber-600">{lm.memoryInfluenceRate}%</span>
              <span className="text-xs font-medium text-slate-500">of workflow</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Percentage of invoices utilizing historical Hindsight context.
            </p>
          </div>
        </div>
      </div>

      {/* Metric Section 2: AP Operational Overview */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="p-1 bg-slate-100 text-slate-700 rounded-lg text-sm">📊</span>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Accounts Payable Pipeline Overview
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <span className="text-xs font-medium text-slate-500 block">Total Invoices</span>
            <span className="text-2xl font-bold text-slate-900 block mt-1">{ap.totalInvoices}</span>
            <span className="text-[11px] text-slate-500 mt-1 block">In processing pipeline</span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <span className="text-xs font-medium text-slate-500 block">Approved</span>
            <span className="text-2xl font-bold text-emerald-600 block mt-1">{ap.approvedInvoices}</span>
            <span className="text-[11px] text-emerald-700 mt-1 block">Paid or queued for payment</span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <span className="text-xs font-medium text-slate-500 block">Flagged for Review</span>
            <span className="text-2xl font-bold text-amber-600 block mt-1">{ap.flaggedInvoices}</span>
            <span className="text-[11px] text-amber-700 mt-1 block">Discrepancies requiring eye</span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <span className="text-xs font-medium text-slate-500 block">Discrepancies Caught</span>
            <span className="text-2xl font-bold text-rose-600 block mt-1">{ap.totalDiscrepancies}</span>
            <span className="text-[11px] text-rose-700 mt-1 block">PO variance & shipping gaps</span>
          </div>
        </div>
      </div>

      {/* How It Learns Walkthrough Infographic Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <span>🔄</span> Closed-Loop Learning: How Hindsight Improves AP Accuracy
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 space-y-1.5">
            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
              1
            </div>
            <h5 className="font-bold text-xs text-slate-900">Multi-Model Extraction</h5>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              PDF visual hierarchy prioritizes Total Due / Amount Due over subtotals with high precision confidence.
            </p>
          </div>

          <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 space-y-1.5">
            <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs">
              2
            </div>
            <h5 className="font-bold text-xs text-slate-900">Discrepancy Engine</h5>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Detects unlisted shipping fees, PO amount variances, and tax mismatches against enterprise ERP records.
            </p>
          </div>

          <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 space-y-1.5">
            <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
              3
            </div>
            <h5 className="font-bold text-xs text-slate-900">Hindsight Recall</h5>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Recalls prior human exceptions and decisions. Matches vendor, discrepancy type, and historical approvals.
            </p>
          </div>

          <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 space-y-1.5">
            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
              4
            </div>
            <h5 className="font-bold text-xs text-slate-900">Adaptive Decision</h5>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Recommends approval citing the exact past precedent, eliminating repeated manual exceptions forever.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
