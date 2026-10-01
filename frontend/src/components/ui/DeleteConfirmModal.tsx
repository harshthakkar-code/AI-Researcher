'use client';

import React, { useEffect } from 'react';
import { Trash2, AlertTriangle, Loader2, X } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  title: string;
  itemTopic: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function DeleteConfirmModal({
  isOpen,
  title = 'Delete Research Report',
  itemTopic,
  isDeleting,
  onConfirm,
  onClose,
}: DeleteConfirmModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={() => {
          if (!isDeleting) onClose();
        }}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl border border-red-500/20 bg-[#0e131f] p-6 text-left shadow-2xl shadow-red-950/30 transition-all z-10 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white leading-6">{title}</h3>
              <p className="text-xs text-gray-400">This action cannot be undone.</p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-lg p-1 text-gray-400 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Details */}
        <div className="rounded-xl border border-white/5 bg-black/40 p-4 space-y-2">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Research Topic
          </span>
          <p className="text-sm font-medium text-white line-clamp-2">
            &ldquo;{itemTopic}&rdquo;
          </p>
        </div>

        <p className="text-xs text-gray-300 leading-relaxed">
          Permanently deletes this research job and all associated records, including the generated Markdown report, citations, harvested sources, and agent telemetry logs from PostgreSQL.
        </p>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-gray-300 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-red-600/25 hover:bg-red-500 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                <span>Permanently Delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
