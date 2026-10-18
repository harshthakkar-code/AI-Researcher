'use client';

import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { RagSourceCitation } from '@/types';

interface KnowledgeSourceBadgeProps {
  citation: RagSourceCitation;
  index?: number;
}

export default function KnowledgeSourceBadge({ citation, index }: KnowledgeSourceBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const referenceLabel = [
    citation.chapter ? `Ch ${citation.chapter}` : null,
    citation.verse ? `Verse ${citation.verse}` : null,
    citation.page_number ? `Page ${citation.page_number}` : null,
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <div className="my-1.5 border border-indigo-500/20 bg-indigo-950/20 rounded-lg overflow-hidden transition-all duration-200 hover:border-indigo-500/40">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-left text-xs text-indigo-200 hover:bg-indigo-900/20 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
          <span className="font-semibold text-white truncate">
            {citation.document_title}
          </span>
          {referenceLabel && (
            <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-[10px] font-mono text-indigo-300">
              {referenceLabel}
            </span>
          )}
          {citation.section_title && (
            <span className="hidden sm:inline text-[11px] text-gray-400 truncate">
              ({citation.section_title})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          {citation.similarity > 0 && (
            <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-0.5">
              <Sparkles className="h-2.5 w-2.5" />
              {Math.round(citation.similarity * 100)}% match
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-indigo-400" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-indigo-400" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-3.5 py-2.5 bg-black/40 border-t border-indigo-500/10 text-xs text-gray-300 space-y-1.5 font-sans leading-relaxed">
          {citation.section_title && (
            <div className="text-[11px] font-medium text-indigo-300">
              Section: {citation.section_title}
            </div>
          )}
          <blockquote className="border-l-2 border-indigo-500/50 pl-2.5 text-gray-300 italic whitespace-pre-wrap">
            {citation.snippet}
          </blockquote>
        </div>
      )}
    </div>
  );
}
