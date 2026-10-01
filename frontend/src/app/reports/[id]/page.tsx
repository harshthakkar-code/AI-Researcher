'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  FileText,
  Copy,
  Check,
  Download,
  ArrowLeft,
  ExternalLink,
  Calendar,
  Layers,
  BookOpen,
  Loader2,
  AlertCircle,
  Share2,
  Trash2,
} from 'lucide-react';
import { Report, ResearchJob, Source } from '@/types';
import DeleteConfirmModal from '@/components/ui/DeleteConfirmModal';

export default function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [job, setJob] = useState<ResearchJob | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function fetchReportData() {
      try {
        const res = await fetch(`/api/research/${id}`);
        if (res.ok) {
          const data = await res.json();
          setJob(data.job);
          setReport(data.report);
          setSources(data.sources || []);
        }
      } catch (err) {
        console.error('Error fetching report:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchReportData();
  }, [id]);

  const handleCopyMarkdown = () => {
    if (!report?.content_markdown) return;
    navigator.clipboard.writeText(report.content_markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    if (!report?.content_markdown) return;
    const blob = new Blob([report.content_markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research-report-${job?.topic ? job.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-') : id}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const confirmDeleteReport = async () => {
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/research/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete research report');
      }

      setIsDeleteModalOpen(false);
      router.push('/dashboard');
    } catch (err: any) {
      alert(`Error deleting report: ${err.message}`);
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
        <p className="text-gray-400 text-sm">Rendering verified research document...</p>
      </div>
    );
  }

  if (!report && !loading) {
    return (
      <div className="glass-panel rounded-3xl p-12 text-center max-w-lg mx-auto space-y-4">
        <AlertCircle className="h-12 w-12 text-amber-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">Report Generating or Unavailable</h2>
        <p className="text-sm text-gray-400">
          The autonomous agents are still completing synthesis or the report could not be found.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href={`/research/${id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            View Live Progress
          </Link>
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <div className="text-xs text-gray-400 flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />
            {report?.created_at ? new Date(report.created_at).toLocaleDateString() : 'Today'}
          </div>
        </div>

        {/* Export / Share / Delete actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyMarkdown}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>

          <button
            onClick={handleDownloadMarkdown}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 hover:opacity-95 transition-all cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Download .md
          </button>

          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors cursor-pointer"
            title="Delete this report"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Report Content + Sources Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Report Article Container */}
        <article className="lg:col-span-8 glass-panel rounded-3xl p-8 sm:p-12 space-y-6">
          <div className="border-b border-white/5 pb-6 space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
              Autonomous Synthesis Document
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {report?.title || job?.topic}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 pt-2">
              <span>Word Count: ~{report?.word_count || report?.content_markdown.split(/\s+/).length || 0}</span>
              <span>•</span>
              <span>Citations: {sources.length} Verified Sources</span>
              <span>•</span>
              <span className="text-emerald-400 font-semibold">Evidence Grounded</span>
            </div>
          </div>

          {/* Render Markdown Content */}
          <div className="prose-report text-gray-200">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {report?.content_markdown || ''}
            </ReactMarkdown>
          </div>
        </article>

        {/* Sources & Citations Sidebar */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="glass-panel rounded-2xl p-6 space-y-4 sticky top-24">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-400" />
              Primary Reference Index ({sources.length})
            </h3>
            <p className="text-xs text-gray-400">
              Primary literature & datasets used by the agents to construct this research report.
            </p>

            <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
              {sources.length === 0 ? (
                <p className="text-xs text-gray-500">No external source index available.</p>
              ) : (
                sources.map((s, idx) => (
                  <a
                    key={s.id || idx}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all space-y-1 group"
                  >
                    <div className="flex items-center justify-between text-[11px] text-blue-400">
                      <span className="font-semibold">[{idx + 1}] {s.domain || 'Source'}</span>
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <h4 className="text-xs font-medium text-gray-200 group-hover:text-white line-clamp-2">
                      {s.title || s.url}
                    </h4>
                  </a>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        title="Delete Research Report"
        itemTopic={job?.topic || ''}
        isDeleting={isDeleting}
        onConfirm={confirmDeleteReport}
        onClose={() => {
          if (!isDeleting) setIsDeleteModalOpen(false);
        }}
      />
    </div>
  );
}
