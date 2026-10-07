'use client';

import { useMemo } from 'react';
import { X, GitCompare, ArrowLeftRight } from 'lucide-react';
import { ReportVersion } from '@/types';

interface VersionDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseVersion: ReportVersion | null;
  compareVersion: ReportVersion | null;
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
}

export default function VersionDiffModal({
  isOpen,
  onClose,
  baseVersion,
  compareVersion,
}: VersionDiffModalProps) {
  const diffLines = useMemo(() => {
    if (!baseVersion || !compareVersion) return [];

    const baseLines = baseVersion.content_markdown.split('\n');
    const compareLines = compareVersion.content_markdown.split('\n');

    const result: DiffLine[] = [];
    const maxLen = Math.max(baseLines.length, compareLines.length);

    // Simple line-by-line diff comparison
    for (let i = 0; i < maxLen; i++) {
      const baseLine = baseLines[i];
      const compLine = compareLines[i];

      if (baseLine === compLine) {
        if (baseLine !== undefined) {
          result.push({ type: 'unchanged', text: baseLine });
        }
      } else {
        if (compLine !== undefined) {
          result.push({ type: 'removed', text: compLine });
        }
        if (baseLine !== undefined) {
          result.push({ type: 'added', text: baseLine });
        }
      }
    }
    return result;
  }, [baseVersion, compareVersion]);

  if (!isOpen || !baseVersion || !compareVersion) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-5xl max-h-[85vh] rounded-3xl bg-slate-950 border border-white/10 shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <GitCompare className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Version Comparison
                <span className="text-xs font-normal text-gray-400">
                  v{compareVersion.version_number} vs v{baseVersion.version_number} (Current)
                </span>
              </h3>
              <p className="text-xs text-gray-400">
                Red lines were in v{compareVersion.version_number}, green lines are in current v{baseVersion.version_number}
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

        {/* Diff Content View */}
        <div className="flex-1 overflow-y-auto p-6 font-mono text-xs leading-relaxed space-y-0.5 bg-black/40 select-text">
          {diffLines.map((line, idx) => (
            <div
              key={idx}
              className={`px-3 py-1 rounded flex items-start gap-3 ${
                line.type === 'added'
                  ? 'bg-emerald-500/15 text-emerald-300 border-l-2 border-emerald-400'
                  : line.type === 'removed'
                  ? 'bg-rose-500/15 text-rose-300 border-l-2 border-rose-400 line-through opacity-80'
                  : 'text-gray-400 opacity-60 hover:opacity-100'
              }`}
            >
              <span className="w-5 text-[10px] select-none text-gray-500 font-bold">
                {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
              </span>
              <span className="flex-1 whitespace-pre-wrap break-words">{line.text || ' '}</span>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-slate-900/60 flex items-center justify-between text-xs text-gray-400">
          <span>Comparing active version with historical revision</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium transition-colors cursor-pointer"
          >
            Close Diff
          </button>
        </div>
      </div>
    </div>
  );
}
