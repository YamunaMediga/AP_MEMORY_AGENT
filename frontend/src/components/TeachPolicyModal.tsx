import React, { useState } from 'react';
import { api } from '../api.js';
import { PolicyItem } from '../types.js';
import { Brain, X, Lightbulb } from 'lucide-react';

interface TeachPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPolicyCreated: (policy: PolicyItem) => void;
}

export const TeachPolicyModal: React.FC<TeachPolicyModalProps> = ({ isOpen, onClose, onPolicyCreated }) => {
  if (!isOpen) return null;

  const [instruction, setInstruction] = useState('');
  const [category, setCategory] = useState('Software');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testExamples = [
    {
      category: 'Software',
      text: 'Always flag software license requests over $5,000 for SOC2 Type II compliance verification.',
    },
    {
      category: 'Hardware',
      text: 'Expedite hardware requests under $2,500 for immediate approval without manual delay.',
    },
    {
      category: 'General',
      text: 'Flag any vendor request lacking an active HTTPS website.',
    },
    {
      category: 'Services',
      text: 'For consulting contracts exceeding $10,000, require a signed Statement of Work (SOW).',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instruction.trim()) {
      setError('Please provide a policy rule or preference.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await api.createPolicy(instruction.trim(), category);
      onPolicyCreated(res.policy);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to retain policy in Hindsight');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Teach Policy to Hindsight</h2>
              <p className="text-xs text-slate-500">The agent retains this memory and applies it to future requests</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Clickable Quick Examples */}
        <div className="px-6 pt-4 pb-2 border-b border-slate-100 bg-slate-50/30">
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            <span>Click an example rule to test</span>
          </p>
          <div className="space-y-1.5">
            {testExamples.map((ex, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setInstruction(ex.text);
                  setCategory(ex.category);
                }}
                className="w-full text-left p-2 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors text-xs text-slate-700 font-medium"
              >
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 mr-2">
                  {ex.category}
                </span>
                "{ex.text}"
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Target Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors bg-white"
            >
              <option value="Software">Software</option>
              <option value="Hardware">Hardware</option>
              <option value="Services">Services</option>
              <option value="Grant">Grant</option>
              <option value="General">General / All Categories</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Policy Instruction / Rule</label>
            <textarea
              rows={3}
              required
              placeholder="e.g. For software purchases above $5,000, require SOC2 compliance."
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors disabled:opacity-60"
            >
              {loading ? 'Retaining in Hindsight...' : 'Retain Memory Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
