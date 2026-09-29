import React, { useState, useEffect, useCallback } from 'react';
import { User, RequestItem, PolicyItem, SystemStatus, AuditEvent, AgentStep } from './types.js';
import { api } from './api.js';
import { useRealtime } from './hooks/useRealtime.js';
import { Header } from './components/Header.js';
import { AuthView } from './components/AuthView.js';
import { RequestPipeline } from './components/RequestPipeline.js';
import { AgentLivePanel } from './components/AgentLivePanel.js';
import { ActivityTimeline } from './components/ActivityTimeline.js';
import { NewRequestModal } from './components/NewRequestModal.js';
import { TeachPolicyModal } from './components/TeachPolicyModal.js';
import { MemoryContextModal } from './components/MemoryContextModal.js';
import { SettingsModal } from './components/SettingsModal.js';
import { HumanFeedbackModal } from './components/HumanFeedbackModal.js';
import { DashboardView } from './components/DashboardView.js';
import { VendorProfilesView } from './components/VendorProfilesView.js';
import { MemoryActivityView } from './components/MemoryActivityView.js';
import { InteractiveDemoView } from './components/InteractiveDemoView.js';
import { InvoiceDetailModal } from './components/InvoiceDetailModal.js';

export const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('ap_token'));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'demo' | 'invoices' | 'vendors' | 'memory-activity'>('dashboard');

  // Core Data State
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [activity, setActivity] = useState<AuditEvent[]>([]);

  // Agent Execution Steps
  const [currentStep, setCurrentStep] = useState<AgentStep | null>(null);
  const [stepHistory, setStepHistory] = useState<AgentStep[]>([]);

  // Modals
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [isTeachPolicyOpen, setIsTeachPolicyOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedMemoryRequest, setSelectedMemoryRequest] = useState<RequestItem | null>(null);
  const [selectedFeedbackRequest, setSelectedFeedbackRequest] = useState<RequestItem | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      const [reqRes, polRes, statRes, actRes] = await Promise.all([
        api.getRequests(),
        api.getPolicies(),
        api.getSystemStatus(),
        api.getRecentActivity(),
      ]);
      setRequests(reqRes.requests || []);
      setPolicies(polRes.policies || []);
      setStatus(statRes || null);
      setActivity(
        (actRes.events || []).map((e: any) => ({
          id: e.id,
          eventType: e.event_type,
          description: e.description,
          createdAt: e.created_at,
        }))
      );
    } catch (err) {
      console.error('Failed to load application data:', err);
    }
  }, []);

  // Check auth session
  useEffect(() => {
    async function verifyAuth() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.getMe();
        setUser(res.user);
        await loadData();
      } catch (err) {
        console.warn('Session expired or invalid, logging out');
        api.logout();
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    verifyAuth();
  }, [token, loadData]);

  // Real-Time SSE Event Handlers
  const handleAgentStep = useCallback((step: AgentStep) => {
    setCurrentStep(step);
    setStepHistory((prev) => [...prev, step]);
    if (step.step === 'updated') {
      setTimeout(() => setCurrentStep(null), 3000);
    }
  }, []);

  const handleRequestCreated = useCallback((newReq: RequestItem) => {
    setRequests((prev) => {
      const exists = prev.some((r) => r.id === newReq.id);
      return exists ? prev : [newReq, ...prev];
    });
  }, []);

  const handleRequestUpdated = useCallback((updatedReq: RequestItem) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === updatedReq.id
          ? {
              ...updatedReq,
              recalled_memories:
                updatedReq.recalled_memories ||
                (updatedReq.recalled_memory_json ? JSON.parse(updatedReq.recalled_memory_json) : []),
              learned_insights:
                updatedReq.learned_insights ||
                (updatedReq.learned_insights_json ? JSON.parse(updatedReq.learned_insights_json) : []),
              audit_trail:
                updatedReq.audit_trail ||
                (updatedReq.audit_trail_json ? JSON.parse(updatedReq.audit_trail_json) : []),
            }
          : r
      )
    );
  }, []);

  const handleRequestDeleted = useCallback(({ id }: { id: string }) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const handlePolicyCreated = useCallback((newPol: PolicyItem) => {
    setPolicies((prev) => {
      const exists = prev.some((p) => p.id === newPol.id);
      return exists ? prev : [newPol, ...prev];
    });
  }, []);

  const handleActivityLogged = useCallback((event: AuditEvent) => {
    setActivity((prev) => [event, ...prev.slice(0, 24)]);
  }, []);

  // Subscribe to real-time events
  useRealtime({
    token,
    onAgentStep: handleAgentStep,
    onRequestCreated: handleRequestCreated,
    onRequestUpdated: handleRequestUpdated,
    onRequestDeleted: handleRequestDeleted,
    onPolicyCreated: handlePolicyCreated,
    onActivityLogged: handleActivityLogged,
  });

  const handleLogout = () => {
    api.logout();
    setToken(null);
    setUser(null);
    setRequests([]);
    setPolicies([]);
    setActivity([]);
    setStepHistory([]);
  };

  const handleAuthenticated = (authedUser: User) => {
    setUser(authedUser);
    setToken(localStorage.getItem('ap_token'));
    loadData();
  };

  const handleReEvaluate = async (id: string) => {
    try {
      await api.reEvaluateRequest(id);
    } catch (err: any) {
      alert(`Re-evaluation failed: ${err.message}`);
    }
  };

  const handleManualAction = async (id: string, action: 'approved' | 'rejected' | 'flagged') => {
    try {
      await api.manualAction(id, action);
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    }
  };

  const handleOpenHumanFeedback = (req: RequestItem) => {
    setSelectedFeedbackRequest(req);
    setIsFeedbackOpen(true);
  };

  const handleFeedbackSubmitted = (updatedReq: RequestItem) => {
    handleRequestUpdated(updatedReq);
    loadData();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="flex items-center gap-3 text-sm text-slate-600 font-medium">
          <span className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span>Initializing AP Memory Agent Workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* Top Header */}
      <Header
        user={user}
        status={status}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLogout={handleLogout}
      />

      {/* Navigation Sub-Header Bar (Only when logged in) */}
      {user && (
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-1 sm:space-x-4 overflow-x-auto py-2">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'dashboard'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>📊</span>
                <span>AP Dashboard</span>
              </button>

              <button
                onClick={() => setActiveTab('demo')}
                className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'demo'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                <span>⚡</span>
                <span>Before/After Demo</span>
                <span className="px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 text-[10px] font-extrabold uppercase animate-pulse">
                  Live
                </span>
              </button>

              <button
                onClick={() => setActiveTab('invoices')}
                className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'invoices'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>📄</span>
                <span>Invoices & Pipeline</span>
                {requests.length > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    activeTab === 'invoices' ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {requests.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('vendors')}
                className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'vendors'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>🏢</span>
                <span>Vendor Profiles</span>
              </button>

              <button
                onClick={() => setActiveTab('memory-activity')}
                className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'memory-activity'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>🧠</span>
                <span>Memory Activity Log</span>
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!user ? (
          <AuthView onAuthenticated={handleAuthenticated} />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardView
                onNavigateToDemo={() => setActiveTab('demo')}
                onNavigateToInvoices={() => setActiveTab('invoices')}
                onNavigateToVendors={() => setActiveTab('vendors')}
              />
            )}

            {activeTab === 'demo' && (
              <InteractiveDemoView
                onViewInvoiceDetails={(req) => {
                  setSelectedInvoiceId(req.id);
                }}
                onRefreshAllData={loadData}
              />
            )}

            {activeTab === 'invoices' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Active Request Pipeline (7 cols on lg) */}
                <div className="lg:col-span-7 xl:col-span-8">
                  <RequestPipeline
                    requests={requests}
                    policies={policies}
                    onOpenNewRequest={() => setIsNewRequestOpen(true)}
                    onOpenTeachPolicy={() => setIsTeachPolicyOpen(true)}
                    onViewMemoryContext={(req) => setSelectedMemoryRequest(req)}
                    onOpenHumanFeedback={handleOpenHumanFeedback}
                    onReEvaluate={handleReEvaluate}
                    onManualAction={handleManualAction}
                    onViewInvoiceRecord={(id) => setSelectedInvoiceId(id)}
                  />
                </div>

                {/* Right: Live Agent Panel + Activity Timeline (5 cols on lg) */}
                <div className="lg:col-span-5 xl:col-span-4 space-y-6">
                  <AgentLivePanel
                    currentStep={currentStep}
                    historySteps={stepHistory}
                  />

                  <ActivityTimeline events={activity} />
                </div>
              </div>
            )}

            {activeTab === 'vendors' && <VendorProfilesView />}

            {activeTab === 'memory-activity' && <MemoryActivityView />}
          </>
        )}
      </main>

      {/* Modals */}
      <NewRequestModal
        isOpen={isNewRequestOpen}
        onClose={() => setIsNewRequestOpen(false)}
        onRequestCreated={handleRequestCreated}
        onViewExistingInvoice={(id) => setSelectedInvoiceId(id)}
      />

      <InvoiceDetailModal
        isOpen={!!selectedInvoiceId}
        invoiceId={selectedInvoiceId}
        onClose={() => setSelectedInvoiceId(null)}
        onOpenHumanFeedback={handleOpenHumanFeedback}
        onReEvaluate={handleReEvaluate}
      />

      <TeachPolicyModal
        isOpen={isTeachPolicyOpen}
        onClose={() => setIsTeachPolicyOpen(false)}
        onPolicyCreated={handlePolicyCreated}
      />

      <MemoryContextModal
        request={selectedMemoryRequest}
        onClose={() => setSelectedMemoryRequest(null)}
      />

      <HumanFeedbackModal
        request={selectedFeedbackRequest}
        isOpen={isFeedbackOpen}
        onClose={() => {
          setIsFeedbackOpen(false);
          setSelectedFeedbackRequest(null);
        }}
        onFeedbackSubmitted={handleFeedbackSubmitted}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        status={status}
        onClose={() => setIsSettingsOpen(false)}
        onRefreshStatus={loadData}
      />
    </div>
  );
};
