'use client';

import { useState } from 'react';
import {
  X,
  History,
  RotateCcw,
  GitCompare,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { ReportVersion } from '@/types';
import VersionDiffModal from '@/components/ui/VersionDiffModal';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  versions: ReportVersion[];
  activeVersionId: string | null;
  isReverting: boolean;
  onRevert: (versionId: string) => Promise<void>;
}

export default function VersionHistoryModal({
  isOpen,
  onClose,
  versions,
  activeVersionId,
  isReverting,
  onRevert,
}: VersionHistoryModalProps) {
  const [diffTargetVersion, setDiffTargetVersion] = useState<ReportVersion | null>(null);

  if (!isOpen) return null;

  const activeVersion =
    versions.find((v) => v.id === activeVersionId) || versions[0] || null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
        <div className="w-full max-w-3xl max-h-[85vh] rounded-3xl bg-slate-950 border border-white/10 shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <History className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Document Version History
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {versions.length} {versions.length === 1 ? 'Revision' : 'Revisions'}
                  </span>
                </h3>
                <p className="text-xs text-gray-400">
                  Every AI edit, verification, or regeneration is saved as an immutable version.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Timeline List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {versions.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-xs">
                No historical revisions recorded yet.
              </div>
            ) : (
              versions.map((ver, idx) => {
                const isActive = ver.id === activeVersionId || (idx === 0 && !activeVersionId);

                return (
                  <div
                    key={ver.id}
                    className={`rounded-2xl p-5 border transition-all duration-200 space-y-3 ${
                      isActive
                        ? 'bg-blue-600/10 border-blue-500/40 shadow-lg shadow-blue-500/5'
                        : 'bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono ${
                            isActive
                              ? 'bg-blue-600 text-white'
                              : 'bg-white/10 text-gray-300'
                          }`}
                        >
                          v{ver.version_number}
                        </span>

                        {isActive && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="h-3 w-3" />
                            Current Active
                          </span>
                        )}

                        <span className="text-xs text-gray-400 flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          {ver.created_at
                            ? new Date(ver.created_at).toLocaleString()
                            : 'Initial Creation'}
                        </span>
                      </div>

                      <div className="text-xs text-gray-400 flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        <span>~{ver.word_count || ver.content_markdown.split(/\s+/).length} words</span>
                      </div>
                    </div>

                    {/* Change Summary */}
                    <p className="text-xs text-gray-300 font-medium leading-relaxed pl-1 border-l-2 border-white/10">
                      {ver.change_summary || 'Autonomous synthesis revision'}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/5">
                      {!isActive && (
                        <>
                          <button
                            onClick={() => setDiffTargetVersion(ver)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 text-xs font-medium transition-colors cursor-pointer"
                          >
                            <GitCompare className="h-3.5 w-3.5" />
                            <span>Compare with Current</span>
                          </button>

                          <button
                            onClick={() => onRevert(ver.id)}
                            disabled={isReverting}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600 hover:text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                          >
                            {isReverting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" />
                            )}
                            <span>Revert to v{ver.version_number}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-white/10 bg-slate-900/60 flex items-center justify-between text-xs text-gray-400">
            <span>Reverting creates a clean new version (no history is ever erased)</span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {/* Sub-Modal: Diff Comparison */}
      <VersionDiffModal
        isOpen={Boolean(diffTargetVersion)}
        onClose={() => setDiffTargetVersion(null)}
        baseVersion={activeVersion}
        compareVersion={diffTargetVersion}
      />
    </>
  );
}
