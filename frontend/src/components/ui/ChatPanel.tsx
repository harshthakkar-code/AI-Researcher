'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send,
  Bot,
  User,
  Sparkles,
  X,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { SessionMessage } from '@/types';
import QuickActions from '@/components/ui/QuickActions';

interface ChatPanelProps {
  researchId: string;
  topic?: string;
  isOpen: boolean;
  onClose: () => void;
  messages: SessionMessage[];
  isSending: boolean;
  error: string | null;
  activeIntents?: string[];
  onSendMessage: (text: string) => Promise<void>;
}


const QUICK_PROMPTS = [
  'Summarize the core findings in 3 key bullet points',
  'What are the primary verified sources and dates?',
  'Are there any conflicting or unverified claims?',
  'Explain the practical implications or next steps',
];

export default function ChatPanel({
  researchId,
  topic,
  isOpen,
  onClose,
  messages,
  isSending,
  error,
  activeIntents,
  onSendMessage,
}: ChatPanelProps) {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isSending, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isSending) return;
    const text = inputText;
    setInputText('');
    await onSendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <aside
      className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] lg:w-[540px] bg-slate-950/95 backdrop-blur-2xl border-l border-white/10 shadow-2xl flex flex-col transition-all duration-300 ease-in-out"
      aria-label="Chat with Research"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Research Orchestrator
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Multi-Agent
              </span>
            </h3>
            <p className="text-xs text-gray-400 truncate max-w-[260px]">
              {topic || 'Active Research Workspace'}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Close chat drawer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-5 px-4 my-auto">
            <div className="h-14 w-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Bot className="h-7 w-7" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h4 className="text-base font-semibold text-white">Autonomous Research Workspace</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Chat directly with your research. Direct the agents to harvest new sources, verify facts, reformat tables, or edit the report live.
              </p>
            </div>

            {/* Quick Starter Chips */}
            <div className="w-full space-y-2 pt-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 block text-left">
                Suggested Prompts
              </span>
              <div className="grid grid-cols-1 gap-2">
                {QUICK_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSendMessage(prompt)}
                    disabled={isSending}
                    className="text-left text-xs p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-blue-500/30 hover:bg-blue-500/5 text-gray-300 hover:text-white transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <span>{prompt}</span>
                    <Sparkles className="h-3 w-3 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const isUser = m.role === 'user';
            const sources = m.metadata?.sources || [];
            const intents = m.metadata?.intents || [];
            const actions = m.metadata?.actions_executed || [];

            return (
              <div
                key={m.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="h-8 w-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0 mt-0.5">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-4 space-y-2 text-xs leading-relaxed ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-tr-sm shadow-md shadow-blue-600/20'
                      : 'bg-white/[0.04] border border-white/10 text-gray-200 rounded-tl-sm'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 text-[10px] opacity-75">
                    <span className="font-semibold uppercase tracking-wider">
                      {isUser ? 'You' : 'Research Assistant'}
                    </span>
                    {!isUser && (
                      <button
                        onClick={() => handleCopy(m.id, m.content)}
                        className="hover:text-white transition-colors cursor-pointer"
                        title="Copy message"
                      >
                        {copiedId === m.id ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Intent Action Badges */}
                  {!isUser && (intents.length > 0 || actions.length > 0) && (
                    <div className="flex flex-wrap gap-1 pt-1 pb-1">
                      {intents.includes('research_request') && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          🔍 Research Expanded
                        </span>
                      )}
                      {intents.includes('verify_request') && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          🛡️ Claims Verified
                        </span>
                      )}
                      {intents.includes('edit_request') && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          ✏️ Report Edited
                        </span>
                      )}
                      {intents.includes('regenerate') && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          🔄 Regenerated
                        </span>
                      )}
                      {intents.includes('config_update') && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          ⚙️ Parameters Updated
                        </span>
                      )}
                    </div>
                  )}

                  <div className="prose prose-invert prose-xs max-w-none break-words">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {m.content}
                    </ReactMarkdown>
                  </div>


                  {/* Cited Sources Footer */}
                  {sources.length > 0 && (
                    <div className="pt-2 border-t border-white/10 mt-3 space-y-1.5">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
                        Referenced Sources:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {sources.map((src: any, sIdx: number) => (
                          <a
                            key={sIdx}
                            href={src.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 hover:text-white hover:bg-blue-500/20 text-[10px] transition-colors"
                          >
                            <span>{src.domain || src.title || 'Source'}</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="h-8 w-8 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-200 flex-shrink-0 mt-0.5">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Loading Indicator */}
        {isSending && (
          <div className="flex gap-3 justify-start items-center">
            <div className="h-8 w-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0">
              <Bot className="h-4 w-4 animate-pulse" />
            </div>
            <div className="p-3.5 rounded-2xl rounded-tl-sm bg-white/[0.04] border border-white/10 flex items-center gap-2 text-xs text-gray-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
              <span>
                {activeIntents && activeIntents.includes('research_request')
                  ? 'Harvesting new sources & extracting verified claims...'
                  : activeIntents && activeIntents.includes('edit_request')
                  ? 'WriterAgent is revising and refactoring report sections...'
                  : activeIntents && activeIntents.includes('verify_request')
                  ? 'ValidatorAgent is cross-referencing claim corroboration...'
                  : 'Orchestrating multi-agent research operations...'}
              </span>
            </div>
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/10 bg-slate-900/60 space-y-3">
        {/* 1-Click Autonomous Action Buttons */}
        <QuickActions onSelectAction={(prompt) => onSendMessage(prompt)} disabled={isSending} />

        <form onSubmit={handleSubmit} className="relative flex items-center">
          <textarea
            ref={inputRef}
            rows={2}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Direct the research agents... (e.g. 'find more sources on X', 'make concise', 'verify claims')"
            disabled={isSending}
            className="w-full resize-none rounded-2xl bg-white/[0.05] border border-white/10 px-4 py-3 pr-12 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="absolute right-2.5 bottom-3.5 h-8 w-8 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:hover:bg-blue-600 text-white flex items-center justify-center transition-all shadow-md shadow-blue-600/30 cursor-pointer"
            title="Send inquiry"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>

        <div className="flex items-center justify-between text-[10px] text-gray-500 px-1">
          <span>AI answers grounded in verified facts & primary literature</span>
          <span>Shift+Enter for newline</span>
        </div>
      </div>
    </aside>
  );
}
