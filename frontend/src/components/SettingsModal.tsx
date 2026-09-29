import React, { useState } from 'react';
import { api } from '../api.js';
import { SystemStatus } from '../types.js';
import { Settings, X, Brain, Cpu, Database, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  status: SystemStatus | null;
  onClose: () => void;
  onRefreshStatus: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, status, onClose, onRefreshStatus }) => {
  if (!isOpen) return null;

  const [groqKey, setGroqKey] = useState('');
  const [hindsightKey, setHindsightKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await api.updateApiKeys({
        groqApiKey: groqKey.trim() || undefined,
        hindsightApiKey: hindsightKey.trim() || undefined,
      });
      setMessage({ type: 'success', text: 'API settings updated and services re-initialized!' });
      onRefreshStatus();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update keys' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">System & Engine Settings</h2>
              <p className="text-xs text-slate-500">Inspect live connections or enter optional API keys</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Status Diagnostics Card */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Engine Diagnostics</span>
              <button
                type="button"
                onClick={onRefreshStatus}
                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            </div>

            {/* Hindsight Status */}
            <div className="flex items-center justify-between py-1.5 border-b border-slate-200/60 text-xs">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-indigo-600" />
                <span className="font-medium text-slate-700">Hindsight Memory</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full font-medium ${
                  status?.hindsight?.mode === 'cloud'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {status?.hindsight?.mode === 'cloud' ? 'Cloud Connected' : 'Local Bank Active'}
              </span>
            </div>

            {/* Groq LLM */}
            <div className="flex items-center justify-between py-1.5 border-b border-slate-200/60 text-xs">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-600" />
                <span className="font-medium text-slate-700">Groq LLM Engine</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full font-medium ${
                  status?.groq?.configured ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {status?.groq?.configured ? 'Groq Active' : 'Deterministic Reasoner'}
              </span>
            </div>

            {/* SQLite DB */}
            <div className="flex items-center justify-between py-1.5 text-xs">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-slate-500" />
                <span className="font-medium text-slate-700">Database Storage</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                SQLite ACID (Persistent)
              </span>
            </div>
          </div>

          {/* Feedback message */}
          {message && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                message.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{message.text}</span>
            </div>
          )}

          {/* Key Form */}
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Hindsight Cloud API Key (Optional)
              </label>
              <input
                type="password"
                placeholder="hsk_..."
                value={hindsightKey}
                onChange={(e) => setHindsightKey(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                If omitted, the agent uses its embedded local Hindsight TEMPR memory engine.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Groq API Key (Optional)
              </label>
              <input
                type="password"
                placeholder="gsk_..."
                value={groqKey}
                onChange={(e) => setGroqKey(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                If omitted, the agent uses its deterministic policy evaluation engine.
              </p>
            </div>

            <div className="pt-2 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save & Reconnect'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
