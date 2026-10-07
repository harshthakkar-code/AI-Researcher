'use client';

import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import { ClaimStatus } from '@/types';

interface ClaimBadgeProps {
  status: ClaimStatus;
  showText?: boolean;
}

export default function ClaimBadge({ status, showText = true }: ClaimBadgeProps) {
  switch (status) {
    case 'verified':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="h-3 w-3" />
          {showText && <span>Corroborated</span>}
        </span>
      );
    case 'partially_verified':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <AlertTriangle className="h-3 w-3" />
          {showText && <span>Partially Corroborated</span>}
        </span>
      );
    case 'conflicting':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <XCircle className="h-3 w-3" />
          {showText && <span>Discrepancy / Conflict</span>}
        </span>
      );
    case 'unsupported':
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/20">
          <HelpCircle className="h-3 w-3" />
          {showText && <span>Unsupported</span>}
        </span>
      );
  }
}
