'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Search,
  Zap,
  ShieldCheck,
  BrainCircuit,
  Trash2,
  Pin,
  BookOpen,
  Globe,
  ChevronDown,
  Check,
  Database,
} from 'lucide-react';
import { ResearchJob, SourceMode } from '@/types';
import DeleteConfirmModal from '@/components/ui/DeleteConfirmModal';

export default function Dashboard() {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [sourceMode, setSourceMode] = useState<SourceMode>('knowledge_base');
  const [isSourceMenuOpen, setIsSourceMenuOpen] = useState(false);
  const sourceMenuRef = useRef<HTMLDivElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentJobs, setRecentJobs] = useState<ResearchJob[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal State
  const [modalJob, setModalJob] = useState<ResearchJob | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Suggestions tailored to the active research scope
  const kbSuggestions = [
    "What does the Bhagavad Gita say about performing duty without attachment?",
    "Chapter 2 Verse 47 meaning and philosophical commentary",
    "How does Krishna describe the characteristics of a Sthitaprajna?",
    "The philosophy of Nishkama Karma and Svadharma in Gita",
  ];

  const webSuggestions = [
    'Latest developments in AI Agents',
    'Quantum computing breakthroughs in 2026',
    'Self-correcting code generation architectures',
    'Multi-agent consensus protocols in enterprise',
  ];

  const hybridSuggestions = [
    'Synthesizing Eastern philosophical ethics with AI alignment',
    'Bhagavad Gita leadership principles compared with modern organizational psychology',
    'Dharma and modern ethical frameworks in autonomous systems',
  ];

  const activeSuggestions =
    sourceMode === 'knowledge_base'
      ? kbSuggestions
      : sourceMode === 'hybrid'
      ? hybridSuggestions
      : webSuggestions;

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sourceMenuRef.current && !sourceMenuRef.current.contains(event.target as Node)) {
        setIsSourceMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchRecentJobs();
  }, []);

  const fetchRecentJobs = async () => {
    try {
      setIsLoadingJobs(true);
      const res = await fetch('/api/research');
      if (res.ok) {
        const data = await res.json();
        setRecentJobs(data.jobs || []);
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  const handleStartResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          source_mode: sourceMode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize research job');
      }

      router.push(`/research/${data.job.id}`);
    } catch (err: any) {
      setErrorMessage(err.message);
      setIsSubmitting(false);
    }
  };

  const promptDeleteJob = (job: ResearchJob, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setModalJob(job);
    setIsModalOpen(true);
  };

  const confirmDeleteJob = async () => {
    if (!modalJob) return;

    try {
      setIsDeleting(true);
      const res = await fetch(`/api/research/${modalJob.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete research job');
      }

      // Optimistically remove from state
      setRecentJobs((prev) => prev.filter((j) => j.id !== modalJob.id));
      setIsModalOpen(false);
      setModalJob(null);
    } catch (err: any) {
      alert(`Error deleting job: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTogglePin = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setRecentJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, is_pinned: !j.is_pinned } : j))
    );
    try {
      await fetch(`/api/research/${jobId}/pin`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl glass-panel-glow p-8 sm:p-12">
        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-semibold text-blue-400">
            <Zap className="h-3.5 w-3.5 text-blue-400" />
            Evidence-Grounded Autonomous Architecture
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Autonomous <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">Multi-Agent</span> AI Research Engine
          </h1>

          <p className="text-base sm:text-lg text-gray-300 font-normal leading-relaxed">
            Enter any topic. Our specialized agents autonomously decompose the subject, query primary academic and industry indices, cross-verify evidence, and draft a verified, publication-grade report.
          </p>

          {/* Research Input Form */}
          <form id="new" onSubmit={handleStartResearch} className="pt-2 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Integrated Search Bar with Clean Context Selector */}
              <div className="relative flex-1 flex flex-col sm:flex-row items-stretch sm:items-center rounded-2xl border border-white/10 bg-white/5 shadow-inner focus-within:border-blue-500/80 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all p-1.5 sm:p-2 gap-2">
                
                {/* Context Selector Trigger Button */}
                <div className="relative" ref={sourceMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsSourceMenuOpen(!isSourceMenuOpen)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap shadow-sm ${
                      sourceMode === 'knowledge_base'
                        ? 'border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20'
                        : sourceMode === 'web'
                        ? 'border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                    }`}
                  >
                    {sourceMode === 'knowledge_base' && <BookOpen className="h-4 w-4 text-purple-400" />}
                    {sourceMode === 'web' && <Globe className="h-4 w-4 text-blue-400" />}
                    {sourceMode === 'hybrid' && <Sparkles className="h-4 w-4 text-amber-400" />}
                    <span>
                      {sourceMode === 'knowledge_base' ? 'Knowledge Base' : sourceMode === 'web' ? 'Web Intelligence' : 'Hybrid'}
                    </span>
                    <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${isSourceMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Clean, Minimal Dropdown Menu */}
                  {isSourceMenuOpen && (
                    <div className="absolute left-0 top-full mt-2 w-52 rounded-xl border border-white/15 bg-slate-950/95 backdrop-blur-xl p-1.5 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="space-y-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSourceMode('knowledge_base');
                            setIsSourceMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                            sourceMode === 'knowledge_base'
                              ? 'bg-purple-500/20 text-purple-200'
                              : 'text-gray-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-purple-400" />
                            <span>Knowledge Base</span>
                          </span>
                          {sourceMode === 'knowledge_base' && <Check className="h-3.5 w-3.5 text-purple-400" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSourceMode('web');
                            setIsSourceMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                            sourceMode === 'web'
                              ? 'bg-blue-500/20 text-blue-200'
                              : 'text-gray-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-blue-400" />
                            <span>Web Intelligence</span>
                          </span>
                          {sourceMode === 'web' && <Check className="h-3.5 w-3.5 text-blue-400" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSourceMode('hybrid');
                            setIsSourceMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                            sourceMode === 'hybrid'
                              ? 'bg-amber-500/20 text-amber-200'
                              : 'text-gray-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-amber-400" />
                            <span>Hybrid</span>
                          </span>
                          {sourceMode === 'hybrid' && <Check className="h-3.5 w-3.5 text-amber-400" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input Text Box */}
                <div className="relative flex-1 flex items-center">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder={
                      sourceMode === 'knowledge_base'
                        ? "Search Knowledge Base (e.g. What does Bhagavad Gita say about duty?)..."
                        : sourceMode === 'web'
                        ? "Search Web Intelligence (e.g. Latest breakthroughs in AI Agents)..."
                        : "Search all sources (Knowledge Base + Live Web)..."
                    }
                    disabled={isSubmitting}
                    className="w-full bg-transparent py-3 pl-9 pr-3 text-white placeholder-gray-500 focus:outline-none text-sm sm:text-base"
                  />
                </div>
              </div>

              {/* Start Research Button */}
              <button
                type="submit"
                disabled={isSubmitting || !topic.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-8 py-4 font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:opacity-95 hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base whitespace-nowrap cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Deploying Agents...</span>
                  </>
                ) : (
                  <>
                    <span>Start Research</span>
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </div>

            {errorMessage && (
              <p className="text-sm text-red-400 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" />
                {errorMessage}
              </p>
            )}

            {/* Dynamic Topic Suggestions based on active scope */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-xs text-gray-400">
                {sourceMode === 'knowledge_base' ? 'Scriptural topics:' : 'Popular topics:'}
              </span>
              {activeSuggestions.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setTopic(sug)}
                  className="rounded-lg border border-white/5 bg-white/5 px-2.5 py-1 text-xs text-gray-300 hover:border-purple-500/30 hover:bg-purple-500/10 hover:text-purple-300 transition-colors cursor-pointer"
                >
                  {sug}
                </button>
              ))}
            </div>
          </form>
        </div>


        {/* Ambient background decoration */}
        <div className="absolute right-0 top-0 -z-0 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
        <div className="absolute right-32 bottom-0 -z-0 h-80 w-80 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />
      </section>

      {/* Feature Highlights Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel rounded-2xl p-6 space-y-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Search className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-semibold text-white">Researcher Agent</h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            Deconstructs complex research queries into targeted search vectors, querying academic indices and live web endpoints.
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-6 space-y-3">
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-semibold text-white">Validator Agent</h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            Performs cross-source fact checking, isolates conflicting assertions, and scores evidence confidence.
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-6 space-y-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <FileText className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-semibold text-white">Writer Agent</h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            Synthesizes grounded findings into an executive-ready Markdown report with inline source citations and analysis.
          </p>
        </div>
      </section>

      {/* Recent Research Jobs */}
      <section id="history" className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Recent Research</h2>
            <p className="text-sm text-gray-400">Track and review previous autonomous research outputs</p>
          </div>
          <button
            onClick={fetchRecentJobs}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
          >
            Refresh
          </button>
        </div>

        {isLoadingJobs ? (
          <div className="glass-panel rounded-2xl p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
            <p className="text-sm">Loading research library...</p>
          </div>
        ) : recentJobs.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center text-gray-400 space-y-3">
            <BrainCircuit className="h-10 w-10 text-gray-500 mx-auto" />
            <p className="text-base font-medium text-gray-300">No research jobs yet</p>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              Submit your first research topic above to trigger the autonomous agent pipeline.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentJobs.map((job) => (
              <div
                key={job.id}
                className="glass-panel rounded-2xl p-6 transition-all hover:border-white/20 hover:bg-white/[0.03] flex flex-col justify-between gap-4 group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                        job.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : job.status === 'failed'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse'
                      }`}
                    >
                      {job.status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
                      {job.status === 'failed' && <AlertCircle className="h-3 w-3" />}
                      {job.status !== 'completed' && job.status !== 'failed' && (
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-ping" />
                      )}
                      {job.status}
                    </span>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(job.created_at).toLocaleDateString()}
                      </span>
                      <button
                        onClick={(e) => handleTogglePin(job.id, e)}
                        className={`transition-colors p-1.5 rounded-lg hover:bg-white/10 cursor-pointer ${
                          job.is_pinned ? 'text-amber-400' : 'text-gray-500 hover:text-amber-400'
                        }`}
                        title={job.is_pinned ? 'Unpin' : 'Pin to favorites'}
                      >
                        <Pin className={`h-4 w-4 ${job.is_pinned ? 'fill-amber-400/20' : ''}`} />
                      </button>
                      <button
                        onClick={(e) => promptDeleteJob(job, e)}
                        className="text-gray-500 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10 cursor-pointer"
                        title="Delete research"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold text-white line-clamp-2">
                    {job.topic}
                  </h3>
                </div>

                <div className="space-y-3">
                  {/* Progress bar */}
                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        job.status === 'completed'
                          ? 'bg-emerald-500'
                          : job.status === 'failed'
                          ? 'bg-red-500'
                          : 'bg-blue-500'
                      }`}
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Progress: {job.progress}%</span>
                    <div className="flex items-center gap-2">
                      {job.status === 'completed' ? (
                        <Link
                          href={`/reports/${job.id}`}
                          className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium"
                        >
                          View Report <ArrowRight className="h-3 w-3" />
                        </Link>
                      ) : (
                        <Link
                          href={`/research/${job.id}`}
                          className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 font-medium"
                        >
                          Live Progress <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isModalOpen}
        title="Delete Research Report"
        itemTopic={modalJob?.topic || ''}
        isDeleting={isDeleting}
        onConfirm={confirmDeleteJob}
        onClose={() => {
          if (!isDeleting) {
            setIsModalOpen(false);
            setModalJob(null);
          }
        }}
      />

      {/* Platform Footer */}
      <footer className="border-t border-white/5 pt-8 pb-4 text-center text-xs text-gray-500">
        Autonomous AI Researcher Platform • Next.js + FastAPI + Supabase + CrewAI
      </footer>
    </div>
  );
}
