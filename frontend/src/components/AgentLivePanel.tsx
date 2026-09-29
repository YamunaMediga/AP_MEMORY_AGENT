import React, { useState } from 'react';
import { AgentStep, MemoryItem } from '../types.js';
import { api } from '../api.js';
import { Bot, CheckCircle2, Loader2, Send, Brain } from 'lucide-react';

interface AgentLivePanelProps {
  currentStep: AgentStep | null;
  historySteps: AgentStep[];
  onViewMemoryContext?: (memory: MemoryItem) => void;
}

export const AgentLivePanel: React.FC<AgentLivePanelProps> = ({ currentStep, historySteps }) => {
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<
    Array<{ sender: 'user' | 'agent'; text: string; memories?: MemoryItem[] }>
  >([]);
  const [isAsking, setIsAsking] = useState(false);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isAsking) return;

    const userText = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setIsAsking(true);

    try {
      const res = await api.chatWithAgent(userText);
      setChatMessages((prev) => [
        ...prev,
        { sender: 'agent', text: res.message, memories: res.recalledMemories },
      ]);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'agent',
          text: `We couldn't process this right now: ${err.message || 'Please try again.'}`,
        },
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
              Agent Real-Time Status & Assistant
            </h2>
            <p className="text-[11px] text-slate-500">Live decision pipeline & memory integration</p>
          </div>
        </div>

        {currentStep && (
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Active</span>
          </span>
        )}
      </div>

      {/* Real-Time Status Steps Section */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/20">
        <h3 className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2.5">
          Real-Time Execution Steps
        </h3>

        {historySteps.length === 0 ? (
          <div className="p-3 bg-white border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
            Awaiting request execution. Create a request to see live steps.
          </div>
        ) : (
          <div className="space-y-1.5">
            {historySteps.slice(-5).map((step, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200/80 text-xs shadow-2xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="font-medium text-slate-800">{step.label}</span>
                <span className="ml-auto text-[10px] text-slate-400 font-mono">
                  {new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Interactive Agent Chat / Assistant */}
      <div className="p-4 flex-1 flex flex-col justify-between overflow-hidden">
        <div className="overflow-y-auto space-y-3 mb-3 pr-1 max-h-[320px]">
          {chatMessages.length === 0 ? (
            <div className="p-4 bg-slate-50/60 rounded-xl border border-slate-100 text-xs text-slate-600">
              <p className="font-medium text-slate-800 mb-1">“How can I help?”</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Ask about stored memory policies, application statuses, or precedent reasons.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setChatInput('What have you learned from our recent invoices?')}
                  className="px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-md text-slate-700 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
                >
                  “What did you learn from invoices?”
                </button>
                <button
                  type="button"
                  onClick={() => setChatInput('What do you know about NeuralCode Systems?')}
                  className="px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-md text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                >
                  “NeuralCode profile?”
                </button>
                <button
                  type="button"
                  onClick={() => setChatInput('What policies are currently remembered in Hindsight?')}
                  className="px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-md text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                >
                  “Remembered policies?”
                </button>
                <button
                  type="button"
                  onClick={() => setChatInput('What is our current review pipeline status?')}
                  className="px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-md text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                >
                  “Pipeline status?”
                </button>
              </div>
            </div>
          ) : (
            chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`text-xs p-3 rounded-xl ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white ml-8 shadow-xs'
                    : 'bg-slate-50 border border-slate-200 text-slate-800 mr-4'
                }`}
              >
                <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>
                {msg.memories && msg.memories.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-200/80 text-[11px] text-indigo-700 flex items-center gap-1 font-medium">
                    <Brain className="w-3.5 h-3.5" />
                    <span>Informed by {msg.memories.length} recalled Hindsight memory</span>
                  </div>
                )}
              </div>
            ))
          )}

          {isAsking && (
            <div className="flex items-center gap-2 text-xs text-slate-500 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              <span>Agent reasoning over Hindsight memory...</span>
            </div>
          )}
        </div>

        {/* Chat Input */}
        <form onSubmit={handleSendMessage} className="relative mt-auto">
          <input
            type="text"
            placeholder="Ask the agent anything..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            disabled={isAsking}
            className="w-full pl-3.5 pr-10 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors bg-white shadow-2xs"
          />
          <button
            type="submit"
            disabled={!chatInput.trim() || isAsking}
            className="absolute right-1.5 top-1.5 p-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
