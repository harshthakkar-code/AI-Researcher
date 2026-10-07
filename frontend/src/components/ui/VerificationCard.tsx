'use client';

import { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RefreshCw,
  X,
} from 'lucide-react';
import { VerificationJob, VerificationResult } from '@/types';
import ClaimBadge from '@/components/ui/ClaimBadge';

interface VerificationCardProps {
  job: VerificationJob | null;
  results: VerificationResult[];
  isRunning: boolean;
  isStarting: boolean;
  onStartVerification: () => Promise<void>;
  onClose?: () => void;
}

export default function VerificationCard({
  job,
  results,
  isRunning,
  isStarting,
  onStartVerification,
  onClose,
}: VerificationCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);

  if (!job && !isRunning && !isStarting) return null;

  const total = job?.total_claims || results.length || 0;
  const checked = job?.checked_claims || results.length || 0;
  const percent = total > 0 ? Math.min(100, Math.round((checked / total) * 100)) : 0;

  return (
    <div className="glass-panel rounded-3xl p-6 sm:p-8 space-y-6 border border-blue-500/20 shadow-2xl relative overflow-hidden animate-in fade-in duration-300">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            {isRunning ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ShieldCheck className="h-5 w-5" />
            )}
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Empirical Fact Verification
              {isRunning && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300 animate-pulse border border-blue-500/30">
                  Checking in background...
                </span>
              )}
              {job?.status === 'completed' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Audit Completed
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-400">
              Cross-referencing assertions, timestamps, and statistics against stored literature & web evidence.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onStartVerification}
            disabled={isRunning || isStarting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
            title="Re-run verification across active report"
          >
            {isStarting || isRunning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            <span>{job?.status === 'completed' ? 'Re-Verify' : 'Run Audit'}</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar & Percentage */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-gray-300 font-medium">
          <span>
            {checked} of {total} claims evaluated
          </span>
          <span className="font-mono text-blue-400 font-bold">{percent}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden relative">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isRunning
                ? 'bg-gradient-to-r from-blue-500 to-indigo-500'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Breakdown Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
          <div className="flex items-center justify-between text-emerald-400 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Corroborated
            </span>
            <span className="text-base font-bold">{job?.verified_count || 0}</span>
          </div>
          <p className="text-[10px] text-emerald-400/70">Verified in primary sources</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1">
          <div className="flex items-center justify-between text-amber-400 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Partial
            </span>
            <span className="text-base font-bold">{job?.partial_count || 0}</span>
          </div>
          <p className="text-[10px] text-amber-400/70">Substance verified with minor variance</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-1">
          <div className="flex items-center justify-between text-rose-400 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5" /> Discrepancies
            </span>
            <span className="text-base font-bold">{job?.conflicting_count || 0}</span>
          </div>
          <p className="text-[10px] text-rose-400/70">Conflicting date or counter-evidence</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-gray-500/10 border border-gray-500/20 space-y-1">
          <div className="flex items-center justify-between text-gray-300 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5" /> Unsupported
            </span>
            <span className="text-base font-bold">{job?.unsupported_count || 0}</span>
          </div>
          <p className="text-[10px] text-gray-400">Needs additional citations</p>
        </div>
      </div>

      {/* Collapsible Claim-by-Claim Feed */}
      {isExpanded && results.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Claim Audit Breakdown ({results.length})
            </span>
            <span className="text-[11px] text-gray-500">Click assertion to view evidence details</span>
          </div>

          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {results.map((res) => {
              const isSelected = selectedResultId === res.id;
              const sources = res.supporting_sources || [];

              return (
                <div
                  key={res.id}
                  onClick={() => setSelectedResultId(isSelected ? null : res.id)}
                  className={`p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer space-y-2 ${
                    isSelected
                      ? 'bg-white/[0.06] border-blue-500/40'
                      : 'bg-white/[0.02] border-white/5 hover:border-white/15 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-xs text-gray-200 font-medium leading-relaxed flex-1">
                      {res.claim_text}
                    </p>
                    <ClaimBadge status={res.status} />
                  </div>

                  {/* Expanded evidence explanation */}
                  {isSelected && (
                    <div className="pt-2 border-t border-white/10 space-y-2 text-xs text-gray-300 animate-in fade-in duration-150">
                      {res.explanation && (
                        <p className="leading-relaxed text-gray-400">
                          <strong className="text-gray-200">Evaluation:</strong> {res.explanation}
                        </p>
                      )}

                      {res.counter_evidence && (
                        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px]">
                          <strong>Counter-Evidence Flag:</strong> {res.counter_evidence}
                        </div>
                      )}

                      {sources.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                            Corroborating Literature:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {sources.map((src, sIdx) => (
                              <a
                                key={sIdx}
                                href={src.url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 hover:text-white text-[11px] transition-colors"
                              >
                                <span>{src.domain || src.title || 'Source'}</span>
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
