'use client';

import { use, useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import {
  FileText,
  Copy,
  Check,
  ArrowLeft,
  ExternalLink,
  Calendar,
  BookOpen,
  Loader2,
  AlertCircle,
  Trash2,
  Sparkles,
  History,
  ShieldCheck,
  User,
  ArrowUp,
  ArrowDown,
  Zap,
  RotateCcw,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Pencil,
  MoreHorizontal,
  Download,
} from 'lucide-react';
import { Report, ResearchJob, Source, SessionMessage } from '@/types';
import DeleteConfirmModal from '@/components/ui/DeleteConfirmModal';
import VersionHistoryModal from '@/components/ui/VersionHistoryModal';
import RevertConfirmModal from '@/components/ui/RevertConfirmModal';
import VerificationCard from '@/components/ui/VerificationCard';
import { ExportMenu } from '@/components/ui/ExportMenu';
import CodeBlock from '@/components/ui/CodeBlock';
import { useSessionChat } from '@/hooks/useSessionChat';
import { useVersionHistory } from '@/hooks/useVersionHistory';
import { useVerification } from '@/hooks/useVerification';

const markdownComponents = {
  pre({ children, ...props }: any) {
    return <CodeBlock {...props}>{children}</CodeBlock>;
  },
  code({ className, children, ...props }: any) {
    return (
      <code className={className || "rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-blue-300"} {...props}>
        {children}
      </code>
    );
  },
};

interface QuickPrompt {
  label: string;
  prompt: string;
}

const QUICK_PROMPTS: QuickPrompt[] = [
  { label: 'Summarize Key Points', prompt: 'Summarize the core findings in 3 key bullet points' },
  { label: 'Verify Claims & Sources', prompt: 'Verify all primary assertions and cite verified sources' },
  { label: 'Practical Next Steps', prompt: 'Explain the practical implications and recommended next steps' },
  { label: '2026 Forecasts & Data', prompt: 'Add 2026 industry forecasts, quantitative metrics, and empirical data' },
];

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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down'>>({});
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const [chatInput, setChatInput] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Version History State & Hook
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const {
    versions,
    activeVersionId,
    isReverting,
    revertToVersion,
    reloadVersions,
  } = useVersionHistory(id);

  // Deep Verification State & Hook
  const [isVerificationVisible, setIsVerificationVisible] = useState(false);
  const {
    job: verificationJob,
    results: verificationResults,
    isRunning: isVerifying,
    isStarting: isStartingVerification,
    startVerification,
  } = useVerification(id);

  // Live update notice
  const [reportUpdatedNotice, setReportUpdatedNotice] = useState<string | null>(null);

  const fetchReportData = useCallback(async () => {
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
  }, [id]);

  const [revertingMsgId, setRevertingMsgId] = useState<string | null>(null);
  const [collapsingMsgIds, setCollapsingMsgIds] = useState<string[]>([]);
  const [isDocumentGlowing, setIsDocumentGlowing] = useState(false);
  const [isInputGlowing, setIsInputGlowing] = useState(false);
  const [revertConfirmTarget, setRevertConfirmTarget] = useState<{
    type: 'user' | 'assistant';
    message: SessionMessage;
    promptSnippet?: string;
    targetVersionNumber?: number;
  } | null>(null);
  const [downloadingExportId, setDownloadingExportId] = useState<string | null>(null);

  const handleDownloadPdf = async (exportData: { title: string; content_markdown: string; format?: string }, msgId: string) => {
    try {
      setDownloadingExportId(msgId);
      const cleanTitle = exportData.title || 'Research Document';
      const fileName = `${cleanTitle.replace(/[\\/:*?"<>|]/g, '-').trim()}.pdf`;

      const res = await fetch(`/api/research/${id}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: cleanTitle,
          content_markdown: exportData.content_markdown,
          format: 'pdf',
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloadingExportId(null);
    }
  };

  const handleReportUpdated = useCallback(() => {
    fetchReportData();
    reloadVersions();
    setReportUpdatedNotice('Research document updated live by AI agents!');
    setTimeout(() => setReportUpdatedNotice(null), 4000);
  }, [fetchReportData, reloadVersions]);

  const {
    messages: chatMessages,
    isSending: isChatSending,
    error: chatError,
    activeIntents,
    sendMessage: handleSendChatMessage,
    revertFromMessage,
  } = useSessionChat(id, {
    isJobResearching: job?.status === 'researching',
    onReportUpdated: handleReportUpdated,
  });

  const handleRevertFromUserMessage = async (msg: SessionMessage) => {
    try {
      setRevertingMsgId(msg.id);

      // Find all messages from this message onwards to animate collapse together
      const msgIdx = chatMessages.findIndex((m) => m.id === msg.id);
      const affectedIds = msgIdx >= 0 ? chatMessages.slice(msgIdx).map((m) => m.id) : [msg.id];
      setCollapsingMsgIds(affectedIds);

      // Allow 420ms for the rewind icon spin & collapsing exit animation to play visually
      await new Promise((resolve) => setTimeout(resolve, 420));

      // 1. Populate prompt in input box for editing
      setChatInput(msg.content);
      chatInputRef.current?.focus();
      setIsInputGlowing(true);
      setTimeout(() => setIsInputGlowing(false), 1400);

      // 2. If this chat turn modified the report, find the previous version that actually has different content
      if (versions.length > 1) {
        const targetV =
          versions.find((v, idx) => idx > 0 && v.content_markdown !== report?.content_markdown) ||
          versions[1];

        if (targetV) {
          const newV = await revertToVersion(targetV.id);
          if (newV) {
            setReport((prev) =>
              prev
                ? {
                    ...prev,
                    content_markdown: newV.content_markdown,
                    word_count: newV.word_count || newV.content_markdown.split(/\s+/).length,
                    active_version_id: newV.id,
                  }
                : prev
            );
            setIsDocumentGlowing(true);
            setTimeout(() => setIsDocumentGlowing(false), 1400);
          }
          await fetchReportData();
          reloadVersions();
        }
      }

      // 3. Rollback conversation messages from this point in database
      await revertFromMessage(msg.id);

      setReportUpdatedNotice('↩️ Conversation rolled back to this point. Prompt restored to input!');
      setTimeout(() => setReportUpdatedNotice(null), 4000);
    } catch (err: any) {
      console.error('Error reverting chat turn:', err);
    } finally {
      setRevertingMsgId(null);
      setCollapsingMsgIds([]);
    }
  };

  const handleRevertAssistantTurn = async (assistantMsg: SessionMessage) => {
    try {
      setRevertingMsgId(assistantMsg.id);

      // 1. Find the user message immediately preceding this assistant message
      const msgIdx = chatMessages.findIndex((m) => m.id === assistantMsg.id);
      let targetUserMsg: SessionMessage | null = null;
      if (msgIdx > 0 && chatMessages[msgIdx - 1]?.role === 'user') {
        targetUserMsg = chatMessages[msgIdx - 1];
      }

      const deleteFromIdx = targetUserMsg
        ? chatMessages.findIndex((m) => m.id === targetUserMsg!.id)
        : msgIdx;
      const affectedIds =
        deleteFromIdx >= 0
          ? chatMessages.slice(deleteFromIdx).map((m) => m.id)
          : [assistantMsg.id];
      setCollapsingMsgIds(affectedIds);

      // Allow 420ms for the rewind icon spin & collapsing exit animation to play visually
      await new Promise((resolve) => setTimeout(resolve, 420));

      // 2. Restore that user prompt into the chat input
      if (targetUserMsg) {
        setChatInput(targetUserMsg.content);
        chatInputRef.current?.focus();
        setIsInputGlowing(true);
        setTimeout(() => setIsInputGlowing(false), 1400);
      }

      // 3. Find the previous version that actually has different content
      if (versions.length > 1) {
        const targetV =
          versions.find((v, idx) => idx > 0 && v.content_markdown !== report?.content_markdown) ||
          versions[1];

        if (targetV) {
          const newV = await revertToVersion(targetV.id);
          if (newV) {
            setReport((prev) =>
              prev
                ? {
                    ...prev,
                    content_markdown: newV.content_markdown,
                    word_count: newV.word_count || newV.content_markdown.split(/\s+/).length,
                    active_version_id: newV.id,
                  }
                : prev
            );
            setIsDocumentGlowing(true);
            setTimeout(() => setIsDocumentGlowing(false), 1400);
          }
          await fetchReportData();
          reloadVersions();
        }
      }

      // 4. Delete the chat messages from this turn onwards (both user prompt & assistant response)
      const deleteFromId = targetUserMsg ? targetUserMsg.id : assistantMsg.id;
      await revertFromMessage(deleteFromId);

      setReportUpdatedNotice('↩️ Conversation & document rolled back to this turn! Prompt restored.');
      setTimeout(() => setReportUpdatedNotice(null), 4000);
    } catch (err: any) {
      console.error('Error reverting assistant turn:', err);
    } finally {
      setRevertingMsgId(null);
      setCollapsingMsgIds([]);
    }
  };

  const handleOpenRevertModal = (msg: SessionMessage, type: 'user' | 'assistant') => {
    let promptSnippet: string | undefined = undefined;
    if (type === 'user') {
      promptSnippet = msg.content;
    } else {
      const msgIdx = chatMessages.findIndex((m) => m.id === msg.id);
      if (msgIdx > 0 && chatMessages[msgIdx - 1]?.role === 'user') {
        promptSnippet = chatMessages[msgIdx - 1].content;
      }
    }

    const targetV =
      versions.find((v, idx) => idx > 0 && v.content_markdown !== report?.content_markdown) ||
      versions[1];

    setRevertConfirmTarget({
      type,
      message: msg,
      promptSnippet,
      targetVersionNumber: targetV?.version_number,
    });
  };

  const handleExecuteConfirmedRevert = async () => {
    if (!revertConfirmTarget) return;
    const { type, message } = revertConfirmTarget;
    setRevertConfirmTarget(null);

    if (type === 'user') {
      await handleRevertFromUserMessage(message);
    } else {
      await handleRevertAssistantTurn(message);
    }
  };

  // Realtime subscription for job status updates and live document updates
  useEffect(() => {
    fetchReportData();

    try {
      const supabase = createClient();
      const channel = supabase
        .channel(`report-live-${id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'research_jobs',
            filter: `id=eq.${id}`,
          },
          (payload) => {
            const updatedJob = payload.new as ResearchJob;
            setJob(updatedJob);
            if (updatedJob.status === 'completed') {
              fetchReportData();
              reloadVersions();
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'reports',
            filter: `research_id=eq.${id}`,
          },
          (payload) => {
            if (payload.new) {
              const updatedReport = payload.new as Report;
              setReport(updatedReport);
              reloadVersions();
              setReportUpdatedNotice('Research document updated live by AI agents!');
              setTimeout(() => setReportUpdatedNotice(null), 4000);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (e) {
      console.warn('Realtime subscription error in report page:', e);
    }
  }, [id, fetchReportData, reloadVersions]);

  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Monitor scroll position to show/hide the floating scroll-to-bottom arrow button
  useEffect(() => {
    const handleScroll = () => {
      const scrollBottom =
        document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
      setShowScrollBottom(scrollBottom > 220);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToLatest = () => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Smooth scroll to bottom on new messages or thinking state
  useEffect(() => {
    if (chatMessages.length > 0 || isChatSending) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages.length, isChatSending]);

  const handleRevert = async (versionId: string) => {
    const newV = await revertToVersion(versionId);
    if (newV) {
      setReport((prev) =>
        prev
          ? {
              ...prev,
              content_markdown: newV.content_markdown,
              word_count: newV.word_count || newV.content_markdown.split(/\s+/).length,
              active_version_id: newV.id,
            }
          : prev
      );
      setIsDocumentGlowing(true);
      setTimeout(() => setIsDocumentGlowing(false), 1400);
      setReportUpdatedNotice(`Reverted back to Version #${newV.version_number}!`);
      setTimeout(() => setReportUpdatedNotice(null), 4000);
      setIsHistoryOpen(false);
    }
  };

  // Close more menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    }
    if (isMoreMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMoreMenuOpen]);

  // Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCopyText = (identifier: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(identifier);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleQuickExport = async (format: 'pdf' | 'docx' | 'md') => {
    try {
      const res = await fetch(`/api/research/${id}/export?format=${format}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const clean = job?.topic ? job.topic.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 40) : 'report';
      a.download = `${clean}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export error: ${err}`);
    }
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

  const handleChatSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isChatSending) return;
    const text = chatInput.trim();
    setChatInput('');
    await handleSendChatMessage(text);
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleQuickPromptClick = async (prompt: string) => {
    if (isChatSending) return;
    await handleSendChatMessage(prompt);
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleRegenerate = async (msg: SessionMessage) => {
    if (isChatSending) return;
    const prompt = `Please re-examine and regenerate findings for: ${job?.topic || 'this topic'}`;
    await handleSendChatMessage(prompt);
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
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

  // Determine previous version for quick 1-click revert
  const currentVersionNumber = versions[0]?.version_number || 1;
  const previousVersion = versions.length > 1 ? versions[1] : null;

  return (
    <div className="flex flex-col min-h-[calc(100vh-6rem)] space-y-6">
      {/* Streamlined Top Navigation Bar (Reduced options like ChatGPT) */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
        {/* Left: Back & Document Format Pills */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>

          {/* Quick Format Pills (like ChatGPT PDF, DOCX, HTML) */}
          <div className="flex items-center gap-1 rounded-xl bg-white/5 border border-white/10 p-1 text-[11px] font-medium text-gray-400">
            <span className="px-2 text-gray-500 text-[10px] hidden md:inline">Export:</span>
            <button
              onClick={() => handleQuickExport('pdf')}
              className="px-2 py-0.5 rounded-md hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              title="Quick download PDF"
            >
              PDF
            </button>
            <button
              onClick={() => handleQuickExport('docx')}
              className="px-2 py-0.5 rounded-md hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              title="Quick download Word document"
            >
              DOCX
            </button>
            <button
              onClick={() => handleQuickExport('md')}
              className="px-2 py-0.5 rounded-md hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              title="Quick download Markdown"
            >
              MD
            </button>
          </div>
        </div>

        {/* Right: Verification, Export & More Dropdown */}
        <div className="flex items-center gap-2">
          {/* Fact Verification Action */}
          <button
            onClick={() => {
              setIsVerificationVisible(true);
              if (!verificationJob && !isVerifying) {
                startVerification();
              }
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              isVerifying
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                : verificationJob?.status === 'completed'
                ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                : 'border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
            title="Empirical fact-checking"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>
              {isVerifying
                ? 'Verifying...'
                : verificationJob?.status === 'completed'
                ? `Verified (${verificationJob.verified_count}/${verificationJob.total_claims})`
                : 'Verify'}
            </span>
          </button>

          {/* Full Export Menu */}
          <ExportMenu researchId={id} reportTopic={job?.topic} />

          {/* More Menu Dropdown (...) */}
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
              className="p-2 rounded-xl border border-white/10 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="More options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {isMoreMenuOpen && (
              <div className="absolute right-0 mt-2 w-52 origin-top-right rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-white/10 p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 space-y-1">
                <button
                  onClick={() => {
                    setIsHistoryOpen(true);
                    setIsMoreMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
                >
                  <History className="h-3.5 w-3.5 text-blue-400" />
                  <span>Version History (v{currentVersionNumber})</span>
                </button>
                <button
                  onClick={() => {
                    handleCopyText('report-md', report?.content_markdown || '');
                    setIsMoreMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Copy Report Markdown</span>
                </button>
                <div className="border-t border-white/5 my-1" />
                <button
                  onClick={() => {
                    setIsDeleteModalOpen(true);
                    setIsMoreMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Report</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Deep Empirical Fact Verification Card (expandable) */}
      {(isVerificationVisible || isVerifying || Boolean(verificationJob)) && (
        <VerificationCard
          job={verificationJob}
          results={verificationResults}
          isRunning={isVerifying}
          isStarting={isStartingVerification}
          onStartVerification={startVerification}
          onClose={() => setIsVerificationVisible(false)}
        />
      )}

      {/* Unified ChatGPT Document & Conversation Stream */}
      <div className="max-w-4xl mx-auto w-full space-y-8 min-w-0">
        {/* Main Research Report Article */}
          <article
            className={`glass-panel rounded-3xl p-8 sm:p-12 space-y-6 relative border shadow-2xl transition-all duration-500 ${
              isDocumentGlowing
                ? 'border-amber-400/80 animate-revert-glow'
                : 'border-white/10'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-6">
              <div className="space-y-2 flex-1 min-w-[280px]">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                  Autonomous Synthesis Document
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {report?.title || job?.topic}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 pt-2">
                  <span>Version #{currentVersionNumber}</span>
                  <span>•</span>
                  <span>Word Count: ~{report?.word_count || report?.content_markdown.split(/\s+/).length || 0}</span>
                  <span>•</span>
                  <span>Citations: {sources.length} Verified Sources</span>
                  <span>•</span>
                  <span className="text-emerald-400 font-semibold">Evidence Grounded</span>
                </div>
              </div>
            </div>

            {/* Markdown Content of Document */}
            <div className="prose-report text-gray-200">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={markdownComponents}
              >
                {report?.content_markdown || ''}
              </ReactMarkdown>
            </div>
          </article>

          {/* Unified ChatGPT-style Conversation Thread */}
          {chatMessages.length > 0 && (
            <div className="space-y-6 pt-4">
              <div className="flex items-center gap-3">
                <div className="h-px bg-white/10 flex-1" />
                <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                  Conversation & Revisions ({chatMessages.length})
                </span>
                <div className="h-px bg-white/10 flex-1" />
              </div>

              <div className="space-y-8">
                {chatMessages.map((msg) => {
                  const isUser = msg.role === 'user';
                  const isCollapsing = collapsingMsgIds.includes(msg.id);

                  // User message on the RIGHT side with hover actions (Image 1 & 2)
                  if (isUser) {
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col items-end group space-y-1.5 transition-all duration-300 ${
                          isCollapsing ? 'animate-rewind-sweep' : ''
                        }`}
                      >
                        {/* Document reference badge */}
                        <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-1 text-[11px] text-gray-300 max-w-sm">
                          <FileText className="h-3 w-3 text-blue-400 shrink-0" />
                          <span className="truncate">{report?.title || job?.topic}</span>
                        </div>

                        {/* Blue Message Bubble */}
                        <div className="rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-2.5 text-sm text-white shadow-md max-w-xl leading-relaxed">
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>

                        {/* Hover Action Bar Below User Message (Image 2) */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleCopyText(msg.id, msg.content)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                            title="Copy message"
                          >
                            {copiedId === msg.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setChatInput(msg.content);
                              chatInputRef.current?.focus();
                            }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                            title="Edit & resend"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenRevertModal(msg, 'user')}
                            disabled={revertingMsgId === msg.id}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-400 hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
                            title="Revert chat to this point"
                          >
                            {revertingMsgId === msg.id ? (
                              <RotateCcw className="h-3.5 w-3.5 animate-rewind text-amber-400" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  }

                  // Assistant Response on the LEFT side with hover actions & inline revert (Image 1)
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col items-start group space-y-2 w-full transition-all duration-300 ${
                        isCollapsing ? 'animate-rewind-sweep' : ''
                      }`}
                    >
                      {/* Intent badge if triggered an action */}
                      {msg.metadata?.intent && msg.metadata.intent !== 'chat' && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <Zap className="h-3 w-3" />
                          <span>Action: {msg.metadata.intent.replace('_', ' ').toUpperCase()}</span>
                        </div>
                      )}

                      {/* Assistant Markdown Content */}
                      <div className="glass-panel rounded-2xl p-6 text-sm text-gray-200 prose-report border border-white/10 shadow-lg w-full">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw]}
                          components={markdownComponents}
                        >
                          {msg.content}
                        </ReactMarkdown>

                        {/* Download button ONLY when user prompted to create/export PDF for this response */}
                        {msg.metadata?.export && (
                          <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 not-prose">
                            <div className="flex items-center gap-2.5 text-xs text-gray-300">
                              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/20 text-red-400 border border-red-500/30">
                                <FileText className="h-4 w-4" />
                              </span>
                              <div>
                                <p className="font-semibold text-white truncate max-w-xs sm:max-w-md">
                                  {msg.metadata.export.title || 'Section Data'}.pdf
                                </p>
                                <p className="text-[11px] text-gray-400">PDF of this response & data table</p>
                              </div>
                            </div>

                            <button
                              onClick={() => handleDownloadPdf(msg.metadata!.export, msg.id)}
                              disabled={downloadingExportId === msg.id}
                              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-red-500/20 transition-all cursor-pointer disabled:opacity-50"
                              type="button"
                            >
                              {downloadingExportId === msg.id ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  <span>Generating...</span>
                                </>
                              ) : (
                                <>
                                  <Download className="h-3.5 w-3.5" />
                                  <span>Download PDF</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Action Bar Below Assistant Response (Icon-only, visible on hover like ChatGPT) */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pt-1">
                        <button
                          onClick={() => handleCopyText(msg.id, msg.content)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                          title="Copy response"
                        >
                          {copiedId === msg.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => setFeedback((prev) => ({ ...prev, [msg.id]: 'up' }))}
                          className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer ${
                            feedback[msg.id] === 'up' ? 'text-blue-400' : 'text-gray-400 hover:text-white'
                          }`}
                          title="Good response"
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setFeedback((prev) => ({ ...prev, [msg.id]: 'down' }))}
                          className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer ${
                            feedback[msg.id] === 'down' ? 'text-red-400' : 'text-gray-400 hover:text-white'
                          }`}
                          title="Bad response"
                        >
                          <ThumbsDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleRegenerate(msg)}
                          disabled={isChatSending}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                          title="Regenerate response"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>

                        {/* Revert Icon Only (with hover tooltip) */}
                        <button
                          onClick={() => handleOpenRevertModal(msg, 'assistant')}
                          disabled={revertingMsgId === msg.id || isReverting}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-amber-400 hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
                          title="Revert response & restore prompt"
                        >
                          {revertingMsgId === msg.id || isReverting ? (
                            <RotateCcw className="h-3.5 w-3.5 animate-rewind text-amber-400" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Assistant Generating State */}
                {isChatSending && (
                  <div className="flex items-start gap-3.5">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-blue-500/20">
                      <Sparkles className="h-4 w-4 animate-spin" />
                    </div>
                    <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-gray-300">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                      <span>Autonomous agents are researching, reasoning, and synthesizing your request...</span>
                    </div>
                  </div>
                )}

                {chatError && (
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{chatError}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Anchor for auto-scrolling */}
          <div ref={chatBottomRef} />
      </div>

      {/* Sticky ChatGPT-style Bottom Chat Input Bar */}
      <div className="sticky bottom-0 z-30 shrink-0 bg-gradient-to-t from-[#07090e] via-[#07090e]/95 to-transparent pt-6 pb-4 mt-auto">
        <div className="relative max-w-4xl mx-auto w-full px-4 space-y-2.5">
          {/* Floating Scroll to Bottom Down Arrow Button (like ChatGPT) */}
          <button
            type="button"
            onClick={scrollToLatest}
            className={`absolute -top-11 left-1/2 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-[#121622]/95 text-gray-300 shadow-2xl backdrop-blur-xl hover:bg-white/15 hover:text-white hover:border-white/35 transition-all cursor-pointer z-40 ${
              showScrollBottom ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-90 pointer-events-none'
            }`}
            title="Scroll to latest message"
          >
            <ArrowDown className="h-4 w-4" />
          </button>

          {/* Quick Prompts Chips */}
          <div className="flex flex-wrap items-center gap-2 pb-0.5">
            {QUICK_PROMPTS.map((item) => (
              <button
                key={item.label}
                onClick={() => handleQuickPromptClick(item.prompt)}
                disabled={isChatSending}
                className="text-[11px] font-medium rounded-full border border-white/10 bg-[#121622]/90 backdrop-blur-md px-3 py-1.5 text-gray-400 hover:text-white hover:bg-white/10 hover:border-blue-500/30 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <Sparkles className="h-3 w-3 text-blue-400 shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            ))}
          </div>

          {/* ChatGPT Capsule Input */}
          <form
            onSubmit={handleChatSubmit}
            className={`relative flex items-center rounded-2xl border bg-[#121622]/95 backdrop-blur-2xl shadow-2xl transition-all p-1 ${
              isInputGlowing
                ? 'border-blue-400 ring-2 ring-blue-400/50 animate-chat-catch'
                : 'border-white/15 focus-within:border-blue-500/60 focus-within:ring-2 focus-within:ring-blue-500/25'
            }`}
          >
            <textarea
              ref={chatInputRef}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleChatSubmit(e);
                }
              }}
              placeholder="Ask a question, request an edit, or deep-verify facts..."
              rows={1}
              className="flex-1 bg-transparent py-3 pl-4 pr-12 text-sm text-white placeholder-gray-500 focus:outline-none resize-none max-h-32"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || isChatSending}
              className="absolute right-2.5 h-8 w-8 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-20 disabled:hover:bg-blue-600 flex items-center justify-center text-white transition-all cursor-pointer shadow-md"
              title="Send message (Enter)"
            >
              {isChatSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </button>
          </form>

          {/* Disclaimer text */}
          <p className="text-[10px] text-center text-gray-500">
            Autonomous AI Researcher • Real-time evidence reasoning with multi-agent consensus
          </p>
        </div>
      </div>


      {/* Version History Modal with Diff View & Rollback */}
      <VersionHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        versions={versions}
        activeVersionId={activeVersionId}
        isReverting={isReverting}
        onRevert={handleRevert}
      />

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

      {/* Revert Confirmation Modal */}
      <RevertConfirmModal
        isOpen={Boolean(revertConfirmTarget)}
        onClose={() => setRevertConfirmTarget(null)}
        onConfirm={handleExecuteConfirmedRevert}
        isReverting={Boolean(revertingMsgId)}
        promptSnippet={revertConfirmTarget?.promptSnippet}
        versionNumber={revertConfirmTarget?.targetVersionNumber}
      />
    </div>
  );
}
