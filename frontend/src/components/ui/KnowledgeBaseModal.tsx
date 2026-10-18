'use client';

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  RefreshCw,
  X,
  FileText,
  Sparkles,
  Layers,
  Database,
  Cpu,
  Clock,
} from 'lucide-react';
import { KnowledgeDocument, DocumentPreview, DocumentIngestionJob } from '@/types';

interface KnowledgeBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSessionId?: string;
}

export default function KnowledgeBaseModal({
  isOpen,
  onClose,
  activeSessionId,
}: KnowledgeBaseModalProps) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Preview State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<DocumentPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // 1. Lock Background Scrolling while Modal is Open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Fetch Documents
  const fetchDocuments = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const res = await fetch(`${apiBase}/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data || []);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDocuments();
    }
  }, [isOpen]);

  // 2. Periodic Polling: Every 20 seconds (or every 3 seconds if active ingestion is in progress)
  useEffect(() => {
    if (!isOpen) return;

    const hasActiveJob = documents.some(
      (d) =>
        d.status === 'processing' ||
        d.status === 'validating' ||
        d.status === 'pending' ||
        (d.latest_job && d.latest_job.status !== 'completed' && d.latest_job.status !== 'failed')
    );

    const pollIntervalMs = hasActiveJob ? 3000 : 20000;

    const interval = setInterval(() => {
      fetchDocuments(true);
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [isOpen, documents]);

  // File Inspection Preview
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Only PDF documents are supported.');
      return;
    }

    setSelectedFile(file);
    setUploadError(null);
    setIsPreviewing(true);
    setPreview(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${apiBase}/documents/preview`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to inspect document');
      }

      const data: DocumentPreview = await res.json();
      setPreview(data);
    } catch (err: any) {
      setUploadError(err.message || 'Inspection error');
    } finally {
      setIsPreviewing(false);
    }
  };

  // Confirm Ingestion
  const handleConfirmUpload = async () => {
    if (!selectedFile) return;

    try {
      setIsUploading(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', selectedFile.name.replace('.pdf', '').replace(/_/g, ' '));

      const res = await fetch(`${apiBase}/documents/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Upload failed');
      }

      setSelectedFile(null);
      setPreview(null);
      await fetchDocuments();
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document from the knowledge base?')) {
      return;
    }

    try {
      const res = await fetch(`${apiBase}/documents/${docId}`, { method: 'DELETE' });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#0b0f19] border border-white/10 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Knowledge Base & RAG Library</h2>
              <p className="text-xs text-gray-400">
                Ground your research with scriptures, books, and reference documents
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Upload Area */}
          <div className="border-2 border-dashed border-indigo-500/20 hover:border-indigo-500/40 bg-indigo-950/10 rounded-xl p-5 text-center transition-colors">
            <input
              type="file"
              id="pdf-upload-input"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="pdf-upload-input"
              className="cursor-pointer flex flex-col items-center justify-center space-y-2"
            >
              <div className="h-10 w-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                <UploadCloud className="h-5 w-5" />
              </div>
              <div className="text-xs font-medium text-white">
                Click to upload PDF Document
              </div>
              <div className="text-[11px] text-gray-400">
                Supports scriptures, books, and technical manuals with verse & chapter tracking
              </div>
            </label>
          </div>

          {uploadError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Pre-Ingestion Inspection Preview */}
          {isPreviewing && (
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-center gap-2 text-xs text-gray-300">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
              <span>Inspecting PDF structure, chapters, and verse boundaries...</span>
            </div>
          )}

          {preview && selectedFile && (
            <div className="p-5 rounded-xl bg-gradient-to-br from-indigo-950/40 to-black/60 border border-indigo-500/30 space-y-4">
              <div className="flex items-center justify-between border-b border-indigo-500/20 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-400" />
                  <span className="text-xs font-semibold text-white truncate">
                    {preview.filename}
                  </span>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {preview.text_quality}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                  <span className="text-[10px] text-gray-400 block">Total Pages</span>
                  <span className="text-sm font-semibold text-white">{preview.total_pages}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                  <span className="text-[10px] text-gray-400 block">Detected Verses</span>
                  <span className="text-sm font-semibold text-indigo-300">
                    {preview.detected_verses > 0 ? `${preview.detected_verses} verses` : 'N/A'}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                  <span className="text-[10px] text-gray-400 block">Chapters</span>
                  <span className="text-sm font-semibold text-white">
                    {preview.detected_chapters} chapters
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                  <span className="text-[10px] text-gray-400 block">Candidate Chunks</span>
                  <span className="text-sm font-semibold text-emerald-400">
                    ~{preview.estimated_chunks} chunks
                  </span>
                </div>
              </div>

              {preview.sample_headings.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">
                    Detected Structure & Sections:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {preview.sample_headings.map((h, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-white/5 text-[10px] text-gray-300 border border-white/10"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setPreview(null);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmUpload}
                  disabled={isUploading}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Starting Ingestion...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Confirm & Generate Embeddings</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Document List Header with Auto-refresh status */}
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Indexed Knowledge Sources ({documents.length})
            </h3>
            <button
              onClick={() => fetchDocuments()}
              className="text-[11px] text-gray-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
              title="Click to refresh telemetry"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Synced {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </button>
          </div>

          {/* Document Cards */}
          {isLoading && documents.length === 0 ? (
            <div className="py-8 flex items-center justify-center text-xs text-gray-400 gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
              <span>Loading knowledge base...</span>
            </div>
          ) : documents.length === 0 ? (
            <div className="py-8 text-center border border-white/5 rounded-xl bg-white/[0.01]">
              <BookOpen className="h-8 w-8 text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-400">No documents ingested yet.</p>
              <p className="text-[11px] text-gray-500 mt-1">
                Upload the Bhagavad Gita PDF to ground your research in scripture.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => {
                const job = doc.latest_job;
                const isCompleted = doc.status === 'indexed';
                const isProcessing =
                  doc.status === 'processing' ||
                  doc.status === 'validating' ||
                  doc.status === 'pending';

                const progress = isCompleted ? 100 : job ? job.progress_percentage : 0;
                const embeddingsCount = isCompleted
                  ? doc.total_chunks
                  : job?.embeddings_created || 0;
                const chunksCount = doc.total_chunks || job?.chunks_created || 0;
                const pagesCount = doc.total_pages || job?.pages_processed || 0;
                const stageText = isCompleted
                  ? 'Document fully indexed & ready for RAG search'
                  : job?.current_stage || 'Processing document...';

                return (
                  <div
                    key={doc.id}
                    className="p-4 rounded-xl bg-white/[0.02] border border-white/10 hover:border-indigo-500/30 transition-all space-y-3 shadow-sm"
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                          <BookOpen className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-white truncate">
                            {doc.title}
                          </h4>
                          <span className="text-[11px] text-gray-400">
                            DOC STATUS:{' '}
                            <span className="text-gray-200 font-medium">{doc.title}</span> →{' '}
                            <span className={isCompleted ? 'text-emerald-400 font-semibold' : 'text-indigo-300'}>
                              {doc.status}
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isCompleted && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Ready for RAG
                          </span>
                        )}
                        {isProcessing && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Processing ({progress}%)
                          </span>
                        )}
                        {doc.status === 'failed' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Failed
                          </span>
                        )}

                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors ml-1"
                          title="Delete document"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar & Current Stage */}
                    <div className="space-y-1.5 bg-black/30 p-3 rounded-lg border border-white/5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-300 flex items-center gap-1.5 font-medium">
                          {isCompleted ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Cpu className="h-3.5 w-3.5 text-indigo-400" />
                          )}
                          <span>{stageText}</span>
                        </span>
                        <span className="font-mono text-indigo-300 font-bold">
                          PROGRESS: {progress}%
                        </span>
                      </div>

                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            isCompleted
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                              : 'bg-gradient-to-r from-indigo-500 to-cyan-400'
                          }`}
                          style={{ width: `${Math.max(5, progress)}%` }}
                        />
                      </div>

                      {/* Detailed Metric Chips */}
                      <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                        <div className="p-1.5 rounded bg-white/[0.02] border border-white/5 text-center">
                          <span className="text-gray-400 text-[10px] block">EMBEDDINGS CREATED</span>
                          <span className="font-mono font-semibold text-emerald-300">
                            {embeddingsCount} / {chunksCount || embeddingsCount}
                          </span>
                        </div>

                        <div className="p-1.5 rounded bg-white/[0.02] border border-white/5 text-center">
                          <span className="text-gray-400 text-[10px] block">INDEXED CHUNKS</span>
                          <span className="font-mono font-semibold text-white">
                            {chunksCount} passages
                          </span>
                        </div>

                        <div className="p-1.5 rounded bg-white/[0.02] border border-white/5 text-center">
                          <span className="text-gray-400 text-[10px] block">PAGES PROCESSED</span>
                          <span className="font-mono font-semibold text-indigo-300">
                            {pagesCount} pages
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-white/[0.01] flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-1.5 text-[11px]">
            <Clock className="h-3.5 w-3.5 text-indigo-400" />
            <span>Auto-refreshing every 20s while open</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
