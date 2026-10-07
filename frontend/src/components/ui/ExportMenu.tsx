'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Download,
  ChevronDown,
  FileText,
  FileType,
  FileCode,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

interface ExportMenuProps {
  researchId: string;
  reportTopic?: string;
  className?: string;
}

type ExportFormat = 'pdf' | 'docx' | 'md';

interface ExportOption {
  format: ExportFormat;
  label: string;
  extension: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  badge?: string;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    format: 'pdf',
    label: 'PDF Document',
    extension: '.pdf',
    description: 'Publication layout with audit status & tables',
    icon: FileText,
    iconColor: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    badge: 'Popular',
  },
  {
    format: 'docx',
    label: 'Word Document',
    extension: '.docx',
    description: 'Editable Microsoft Word format (.docx)',
    icon: FileType,
    iconColor: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  },
  {
    format: 'md',
    label: 'Markdown with YAML',
    extension: '.md',
    description: 'Raw markdown with metadata frontmatter',
    icon: FileCode,
    iconColor: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  },
];

export function ExportMenu({ researchId, reportTopic, className = '' }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [completedFormat, setCompletedFormat] = useState<ExportFormat | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleExport = async (format: ExportFormat) => {
    try {
      setExportingFormat(format);
      const res = await fetch(`/api/research/${researchId}/export?format=${format}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to export document');
      }

      // Extract filename from Content-Disposition header if available
      let filename = `research-report-${researchId}.${format}`;
      const disposition = res.headers.get('content-disposition');
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      } else if (reportTopic) {
        const clean = reportTopic.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 40);
        filename = `${clean}.${format}`;
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setCompletedFormat(format);
      setTimeout(() => setCompletedFormat(null), 2500);
      setIsOpen(false);
    } catch (err: any) {
      console.error('Export download error:', err);
      alert(`Export failed: ${err.message}`);
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={exportingFormat !== null}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
        title="Export research in multiple publication formats"
      >
        {exportingFormat ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Exporting {exportingFormat.toUpperCase()}...</span>
          </>
        ) : (
          <>
            <Download className="h-3.5 w-3.5" />
            <span>Export</span>
            <ChevronDown className={`h-3 w-3 text-white/70 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 origin-top-right rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-white/10 p-2 shadow-2xl ring-1 ring-black/40 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-2 border-b border-white/5 mb-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Export Research Document
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Select publication format with embedded audit
            </p>
          </div>

          <div className="space-y-1">
            {EXPORT_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isCurrentExporting = exportingFormat === opt.format;
              const isRecentCompleted = completedFormat === opt.format;

              return (
                <button
                  key={opt.format}
                  onClick={() => handleExport(opt.format)}
                  disabled={exportingFormat !== null}
                  className="w-full flex items-start gap-3 rounded-xl p-2.5 text-left hover:bg-white/5 transition-colors cursor-pointer group disabled:opacity-50"
                >
                  <div className={`p-2 rounded-lg border shrink-0 ${opt.iconColor}`}>
                    {isCurrentExporting ? (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                    ) : isRecentCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-white group-hover:text-blue-300 transition-colors">
                        {opt.label}
                      </span>
                      {opt.badge && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 leading-snug mt-0.5 line-clamp-1">
                      {opt.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
