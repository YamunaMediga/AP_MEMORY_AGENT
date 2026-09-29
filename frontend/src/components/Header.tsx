import React from 'react';
import { User, SystemStatus } from '../types.js';
import { Brain, Cpu, Database, Settings, LogOut } from 'lucide-react';

interface HeaderProps {
  user: User | null;
  status: SystemStatus | null;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, status, onOpenSettings, onLogout }) => {
  const isCloud = status?.hindsight?.mode === 'cloud';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Product Identity */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900 tracking-tight text-base">AP Memory Agent</span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                Production Real-Time
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">Autonomous processing powered by Hindsight Long-Term Memory</p>
          </div>
        </div>

        {/* Live System Indicators */}
        <div className="flex items-center gap-3">
          {/* Hindsight Status Pill */}
          <div
            title={`Hindsight Memory Engine: ${isCloud ? 'Cloud API' : 'Local SQLite Bank Active'}`}
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              isCloud
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isCloud ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <Brain className="w-3.5 h-3.5" />
            <span>{isCloud ? 'Hindsight Cloud' : 'Hindsight Local Bank'}</span>
          </div>

          {/* Groq LLM Status Pill */}
          <div
            title="Groq High-Speed LLM Inference"
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200"
          >
            <Cpu className="w-3.5 h-3.5 text-indigo-600" />
            <span>{status?.groq?.configured ? 'Groq Active' : 'Deterministic Reasoner'}</span>
          </div>

          {/* Database Status */}
          <div
            title="Persistent SQLite ACID Database"
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200"
          >
            <Database className="w-3.5 h-3.5 text-slate-500" />
            <span>SQLite Active</span>
          </div>

          {/* User Profile & Actions */}
          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="hidden sm:block text-right">
                <p className="text-xs font-medium text-slate-900 leading-tight">{user.name}</p>
                <p className="text-[11px] text-slate-500 capitalize">{user.role}</p>
              </div>

              <button
                onClick={onOpenSettings}
                title="Integration Settings & API Keys"
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>

              <button
                onClick={onLogout}
                title="Log Out"
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
