'use client';

import React, { useEffect } from 'react';
import { RotateCcw, AlertCircle, X, Sparkles, MessageSquare } from 'lucide-react';

interface RevertConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isReverting: boolean;
  promptSnippet?: string;
  versionNumber?: number;
}

export default function RevertConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isReverting,
  promptSnippet,
  versionNumber,
}: RevertConfirmModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isReverting) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isReverting, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={() => {
          if (!isReverting) onClose();
        }}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl border border-amber-500/30 bg-[#0e131f] p-6 text-left shadow-2xl shadow-amber-950/30 transition-all z-10 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white leading-6">
                Revert to Previous State?
              </h3>
              <p className="text-xs text-gray-400">
                Roll back document & conversation turn
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isReverting}
            className="rounded-lg p-1 text-gray-400 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Snippet Preview */}
        {promptSnippet && (
          <div className="rounded-xl border border-white/5 bg-black/40 p-3.5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
              <MessageSquare className="h-3 w-3" />
              <span>Prompt to Restore</span>
            </div>
            <p className="text-xs text-gray-200 line-clamp-3 italic">
              &ldquo;{promptSnippet}&rdquo;
            </p>
          </div>
        )}

        {/* Explanation */}
        <div className="space-y-2 text-xs text-gray-300 leading-relaxed">
          <div className="flex items-start gap-2 text-gray-300">
            <Sparkles className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
            <span>
              The report document will be restored to{' '}
              {versionNumber ? (
                <strong className="text-white">Version #{versionNumber}</strong>
              ) : (
                <strong className="text-white">its previous revision</strong>
              )}
              .
            </span>
          </div>
          <div className="flex items-start gap-2 text-gray-300">
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              This chat turn will be rolled back, and your original prompt will be restored into the chat box so you can edit and try again.
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isReverting}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-gray-300 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isReverting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-amber-600/25 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isReverting ? (
              <>
                <RotateCcw className="h-3.5 w-3.5 animate-rewind" />
                <span>Reverting...</span>
              </>
            ) : (
              <>
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Revert & Restore</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
