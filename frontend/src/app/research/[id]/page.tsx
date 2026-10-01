'use client';

import { use } from 'react';
import Link from 'next/link';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  FileText,
  Search,
  BrainCircuit,
  Terminal,
  Layers,
} from 'lucide-react';
import { useResearchProgress } from '@/hooks/useResearchProgress';

export default function ResearchProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { job, logs, sources, facts, report, loading, error } = useResearchProgress(id);

  if (loading && !job) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
        <p className="text-gray-400 text-sm">Connecting to autonomous agent network...</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="glass-panel rounded-3xl p-12 text-center max-w-lg mx-auto space-y-4">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">Research Job Not Found</h2>
        <p className="text-sm text-gray-400">{error || 'The requested research job could not be retrieved.'}</p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  // Stepper state definition
  const steps = [
    {
      id: 'planning',
      title: 'Planning & Query Generation',
      desc: 'Formulating targeted search vectors',
      agent: 'Researcher',
      status: job.progress >= 20 ? 'done' : job.status === 'planning' ? 'active' : 'pending',
    },
    {
      id: 'researching',
      title: 'Web Search & Source Retrieval',
      desc: 'Harvesting primary references',
      agent: 'Researcher',
      status: job.progress >= 50 ? 'done' : job.status === 'researching' ? 'active' : 'pending',
    },
    {
      id: 'validating',
      title: 'Evidence Validation & Fact-Checking',
      desc: 'Cross-referencing claims & detecting conflicts',
      agent: 'Validator',
      status: job.progress >= 75 ? 'done' : job.status === 'validating' ? 'active' : 'pending',
    },
    {
      id: 'writing',
      title: 'Report Synthesis & Citation Grounding',
      desc: 'Drafting structured executive Markdown',
      agent: 'Writer',
      status: job.status === 'completed' ? 'done' : job.status === 'writing' ? 'active' : 'pending',
    },
  ];

  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';

  return (
    <div className="space-y-8">
      {/* Top Banner / Topic Header */}
      <div className="glass-panel-glow rounded-3xl p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                isCompleted
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : isFailed
                  ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                  : 'bg-blue-500/10 text-blue-400 border border-blue-500/30 animate-pulse'
              }`}
            >
              {!isCompleted && !isFailed && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isCompleted && <CheckCircle2 className="h-3.5 w-3.5" />}
              {isFailed && <AlertCircle className="h-3.5 w-3.5" />}
              Status: {job.status}
            </span>

            <span className="text-xs text-gray-400">
              Job ID: <code className="text-gray-300">{job.id.slice(0, 8)}...</code>
            </span>
          </div>

          {isCompleted && (
            <Link
              href={`/reports/${job.id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:opacity-95 transition-all"
            >
              <FileText className="h-4 w-4" />
              View Full Report
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-white">
          Researching: <span className="text-blue-400">{job.topic}</span>
        </h1>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-400">
            <span>Overall Progress</span>
            <span className="font-semibold text-white">{job.progress}%</span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-700 ${
                isCompleted
                  ? 'bg-emerald-500'
                  : isFailed
                  ? 'bg-red-500'
                  : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500'
              }`}
              style={{ width: `${job.progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Grid: Stepper + Live Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Pipeline Stepper & Telemetry Cards */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel rounded-2xl p-6 space-y-6">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-400" />
              Agent Workflow Pipeline
            </h2>

            <div className="space-y-4">
              {steps.map((step, idx) => (
                <div
                  key={step.id}
                  className={`flex items-start gap-4 p-3.5 rounded-xl border transition-all ${
                    step.status === 'active'
                      ? 'bg-blue-500/10 border-blue-500/30'
                      : step.status === 'done'
                      ? 'bg-emerald-500/5 border-emerald-500/20'
                      : 'bg-white/[0.02] border-white/5 opacity-60'
                  }`}
                >
                  <div className="mt-0.5">
                    {step.status === 'done' && (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    )}
                    {step.status === 'active' && (
                      <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                    )}
                    {step.status === 'pending' && (
                      <div className="h-5 w-5 rounded-full border border-gray-600 flex items-center justify-center text-[10px] text-gray-500">
                        {idx + 1}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">{step.title}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-gray-400">
                        {step.agent}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-panel rounded-xl p-4 space-y-1">
              <span className="text-xs text-gray-400 flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5 text-blue-400" />
                Retrieved Sources
              </span>
              <p className="text-2xl font-bold text-white">{sources.length}</p>
            </div>

            <div className="glass-panel rounded-xl p-4 space-y-1">
              <span className="text-xs text-gray-400 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-purple-400" />
                Validated Claims
              </span>
              <p className="text-2xl font-bold text-white">{facts.length}</p>
            </div>
          </div>
        </div>

        {/* Right Column: Live Agent Logs Feed */}
        <div className="lg:col-span-7 space-y-6">
          <div className="glass-panel rounded-2xl p-6 flex flex-col h-[520px]">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Terminal className="h-4 w-4 text-emerald-400" />
                Live Agent Telemetry Stream
              </h2>
              <span className="text-xs text-gray-500 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                Realtime updates
              </span>
            </div>

            {/* Scrollable logs container */}
            <div className="flex-1 overflow-y-auto space-y-3 font-mono text-xs pr-2">
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2">
                  <BrainCircuit className="h-6 w-6 animate-pulse" />
                  <p>Awaiting first telemetry event from AI service worker...</p>
                </div>
              ) : (
                logs.map((log, idx) => {
                  const agentColor =
                    log.agent === 'Researcher'
                      ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                      : log.agent === 'Validator'
                      ? 'text-purple-400 bg-purple-500/10 border-purple-500/20'
                      : log.agent === 'Writer'
                      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                      : 'text-gray-400 bg-white/5 border-white/10';

                  return (
                    <div
                      key={log.id ? `${log.id}-${idx}` : `${log.created_at}-${log.event}-${idx}`}
                      className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${agentColor}`}>
                            [{log.agent}]
                          </span>
                          <span className="text-gray-300 font-bold">{log.event}</span>
                        </div>
                        <span className="text-[10px] text-gray-500">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-gray-400 font-sans text-xs leading-relaxed">{log.message}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Discovered Sources Section */}
      {sources.length > 0 && (
        <section className="glass-panel rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-400" />
            Harvested Primary Sources ({sources.length})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sources.map((s, idx) => (
              <a
                key={s.id ? `${s.id}-${idx}` : `${s.url}-${idx}`}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="group p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all flex flex-col justify-between gap-2"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-blue-400">
                    <span className="font-semibold truncate max-w-[200px]">{s.domain || 'Source'}</span>
                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <h4 className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors line-clamp-2">
                    {s.title || s.url}
                  </h4>
                  {s.content && (
                    <p className="text-xs text-gray-400 line-clamp-2">{s.content}</p>
                  )}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Validated Evidence Claims Section */}
      {facts.length > 0 && (
        <section className="glass-panel rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-purple-400" />
            Verified Factual Evidence Claims ({facts.length})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {facts.map((f, i) => (
              <div
                key={f.id ? `${f.id}-${i}` : `fact-${i}`}
                className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      f.confidence === 'high'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : f.confidence === 'medium'
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {f.confidence} Confidence
                  </span>
                  <span className="text-[10px] text-gray-500">Verified</span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">{f.claim}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
