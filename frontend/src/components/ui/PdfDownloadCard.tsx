'use client';

import { useState } from 'react';
import { FileText, Download, Loader2, Check, Copy, Sparkles } from 'lucide-react';

interface PdfExportData {
  title: string;
  format?: string;
  content_markdown: string;
}

interface PdfDownloadCardProps {
  researchId: string;
  exportData: PdfExportData;
}

export default function PdfDownloadCard({ researchId, exportData }: PdfDownloadCardProps) {
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const cleanTitle = exportData.title || 'Research Document';
  const fileName = `${cleanTitle.replace(/[\\/:*?"<>|]/g, '-').trim()}.pdf`;

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      const res = await fetch(`/api/research/${researchId}/export`, {
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
      setDownloading(false);
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(exportData.content_markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy markdown:', err);
    }
  };

  return (
    <div className="relative my-3 overflow-hidden rounded-2xl border border-red-500/20 bg-gradient-to-r from-red-500/10 via-slate-900/60 to-blue-500/10 p-4 sm:p-5 shadow-2xl backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Document Info */}
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 shadow-inner">
            <FileText className="h-6 w-6" />
          </div>

          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-300">
                PDF
              </span>
              <span className="text-xs font-semibold text-gray-400">Publication Document</span>
            </div>
            <h4 className="text-sm sm:text-base font-bold text-white truncate max-w-md sm:max-w-lg">
              {fileName}
            </h4>
            <p className="text-xs text-gray-300/80">
              Includes complete data table, etymological context & verified source links
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopyMarkdown}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            title="Copy section markdown"
            type="button"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-lg shadow-red-500/20 hover:opacity-95 transition-all cursor-pointer disabled:opacity-50"
            type="button"
          >
            {downloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Download PDF</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
