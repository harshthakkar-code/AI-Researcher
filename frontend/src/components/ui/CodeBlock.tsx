'use client';

import React, { useState } from 'react';
import { Copy, Check, Download } from 'lucide-react';

interface CodeBlockProps {
  children?: React.ReactNode;
  className?: string;
}

export default function CodeBlock({ children, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  // Extract raw text and language whether children is a <code> element or string
  let codeString = '';
  let rawLang = '';

  if (React.isValidElement(children)) {
    const codeEl = children as React.ReactElement<any>;
    codeString = String(codeEl.props?.children || '').replace(/\n$/, '');
    const match = /language-(\w+)/.exec(codeEl.props?.className || className || '');
    if (match) rawLang = match[1];
  } else {
    codeString = String(children || '').replace(/\n$/, '');
    const match = /language-(\w+)/.exec(className || '');
    if (match) rawLang = match[1];
  }

  const displayLang = rawLang
    ? rawLang.charAt(0).toUpperCase() + rawLang.slice(1)
    : 'Plain text';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code snippet:', err);
    }
  };

  const handleDownload = () => {
    try {
      const extMap: Record<string, string> = {
        python: 'py',
        javascript: 'js',
        typescript: 'ts',
        jsx: 'jsx',
        tsx: 'tsx',
        json: 'json',
        markdown: 'md',
        md: 'md',
        html: 'html',
        css: 'css',
        sql: 'sql',
        bash: 'sh',
        sh: 'sh',
      };
      const ext = extMap[rawLang.toLowerCase()] || 'txt';
      const blob = new Blob([codeString], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `snippet.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download code snippet:', err);
    }
  };

  return (
    <div className="group relative my-4 overflow-hidden rounded-2xl border border-white/10 bg-[#12161f] shadow-xl not-prose">
      {/* Header bar matching Image 1: </> Plain text on left, download & copy on right */}
      <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.03] px-4 py-2 text-xs text-gray-400">
        <div className="flex items-center gap-2 font-mono text-[11px] text-gray-300">
          <span className="font-semibold text-gray-400">&lt;/&gt;</span>
          <span>{displayLang}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleDownload}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            title="Download snippet"
            type="button"
          >
            <Download className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={handleCopy}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            title="Copy code"
            type="button"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Code body */}
      <pre className="overflow-x-auto p-4 sm:p-5 font-mono text-xs sm:text-sm text-gray-200 leading-relaxed m-0">
        <code>{codeString}</code>
      </pre>
    </div>
  );
}
