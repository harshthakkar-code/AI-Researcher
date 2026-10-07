'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sparkles,
  Search,
  Pin,
  PinOff,
  Clock,
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useSessionList } from '@/hooks/useSessionList';
import { ResearchJob } from '@/types';

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ isMobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const {
    pinnedSessions,
    recentSessions,
    isLoading,
    searchQuery,
    setSearchQuery,
    togglePin,
  } = useSessionList();

  // Load collapse state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('ai_researcher_sidebar_collapsed');
    if (saved !== null) {
      setIsCollapsed(saved === 'true');
    }
  }, []);

  const handleToggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem('ai_researcher_sidebar_collapsed', String(next));
  };

  const getStatusBadge = (status: ResearchJob['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />;
      case 'failed':
        return <AlertCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />;
      default:
        return <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin shrink-0" />;
    }
  };

  const formatSessionDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours < 24 && d.getDate() === now.getDate()) {
        return 'Today';
      } else if (diffHours < 48) {
        return 'Yesterday';
      }
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const renderSessionItem = (job: ResearchJob) => {
    const href = (job.completed_at || job.status === 'completed') ? `/reports/${job.id}` : `/research/${job.id}`;
    const isActive = pathname === href || pathname?.includes(job.id);

    // Collapsed Mode: strictly an icon button, no text or overflow
    if (isCollapsed) {
      return (
        <div key={job.id} className="flex justify-center py-0.5">
          <Link
            href={href}
            onClick={onMobileClose}
            className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all ${
              isActive
                ? 'bg-blue-600/25 text-white border border-blue-500/40 shadow-sm'
                : 'text-gray-400 hover:bg-white/10 hover:text-gray-200'
            }`}
            title={`${job.topic} • ${job.status}`}
          >
            {getStatusBadge(job.status)}
          </Link>
        </div>
      );
    }

    // Expanded Mode: full item with title, pin toggle, and date
    return (
      <div
        key={job.id}
        className={`group relative flex items-center justify-between rounded-xl px-2.5 py-2 text-xs transition-all ${
          isActive
            ? 'bg-blue-600/15 text-white border border-blue-500/30 font-medium'
            : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
        }`}
      >
        <Link
          href={href}
          onClick={onMobileClose}
          className="flex items-center gap-2.5 min-w-0 flex-1 pr-1.5"
          title={job.topic}
        >
          {getStatusBadge(job.status)}
          <span className="truncate flex-1 text-left">{job.topic}</span>
        </Link>

        {/* Action icons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => togglePin(job.id, e)}
            className={`p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer ${
              job.is_pinned ? 'text-amber-400' : 'text-gray-500 hover:text-gray-300'
            }`}
            title={job.is_pinned ? 'Unpin research' : 'Pin to favorites'}
          >
            {job.is_pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
          </button>
        </div>

        {/* Date shown when not hovering */}
        <span className="text-[10px] text-gray-600 group-hover:hidden pl-1 shrink-0">
          {formatSessionDate(job.created_at)}
        </span>
      </div>
    );
  };

  const content = (
    <div className="flex flex-col h-full select-none overflow-hidden">
      {/* Sidebar Header */}
      <div
        className={`flex items-center ${
          isCollapsed ? 'justify-center' : 'justify-between'
        } px-3 py-3.5 border-b border-white/5 min-h-[57px]`}
      >
        {!isCollapsed ? (
          <>
            <Link
              href="/dashboard"
              onClick={onMobileClose}
              className="flex items-center gap-2.5 group overflow-hidden min-w-0"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-md shadow-blue-500/20 shrink-0">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold tracking-tight text-white block truncate">
                  AI Researcher
                </span>
                <span className="text-[10px] text-gray-500 block truncate">
                  Workspace Library
                </span>
              </div>
            </Link>

            <button
              onClick={handleToggleCollapse}
              className="hidden lg:flex p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button
            onClick={handleToggleCollapse}
            className="hidden lg:flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer mx-auto"
            title="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        {/* Mobile Close Button */}
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Main Action: New Research */}
      <div className={`p-2.5 border-b border-white/5 flex ${isCollapsed ? 'justify-center' : ''}`}>
        <Link
          href="/dashboard"
          onClick={onMobileClose}
          className={`flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-xs shadow-lg shadow-blue-500/15 hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer ${
            isCollapsed ? 'h-9 w-9 p-0' : 'w-full gap-2 py-2 px-3'
          }`}
          title="Start New Research"
        >
          <Plus className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span>New Research</span>}
        </Link>
      </div>

      {/* Search Input (visible when expanded) */}
      {!isCollapsed && (
        <div className="px-3 pt-3 pb-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sessions..."
              className="w-full rounded-xl border border-white/10 bg-white/5 pl-8 pr-7 py-1.5 text-xs text-white placeholder-gray-500 focus:border-blue-500/50 focus:bg-white/10 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-gray-500 hover:text-gray-300"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sessions Scrollable Container */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3 custom-scrollbar overflow-x-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
          </div>
        ) : (
          <>
            {/* Pinned Section */}
            {pinnedSessions.length > 0 && (
              <div className="space-y-1">
                {!isCollapsed ? (
                  <div className="flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-400/90">
                    <span className="flex items-center gap-1.5">
                      <Pin className="h-3 w-3 fill-amber-400/20" />
                      Pinned ({pinnedSessions.length})
                    </span>
                  </div>
                ) : (
                  <div className="border-t border-white/5 my-1" />
                )}
                <div className="space-y-0.5">
                  {pinnedSessions.map((job) => renderSessionItem(job))}
                </div>
              </div>
            )}

            {/* Recent Sessions Section */}
            <div className="space-y-1">
              {!isCollapsed ? (
                <div className="flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    Recent ({recentSessions.length})
                  </span>
                </div>
              ) : (
                <div className="border-t border-white/5 my-1" />
              )}
              {recentSessions.length === 0 && pinnedSessions.length === 0 ? (
                !isCollapsed && (
                  <div className="px-3 py-6 text-center text-xs text-gray-500">
                    {searchQuery ? 'No matching sessions' : 'No research history yet'}
                  </div>
                )
              ) : (
                <div className="space-y-0.5">
                  {recentSessions.map((job) => renderSessionItem(job))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Sidebar Footer */}
      <div className={`p-3 border-t border-white/5 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} text-[11px] text-gray-500 min-h-[48px]`}>
        {!isCollapsed ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/20 animate-pulse" />
              <span>Engine Online</span>
            </div>
            <Link
              href="/dashboard"
              onClick={onMobileClose}
              className="hover:text-gray-300 transition-colors text-[10px]"
            >
              Dashboard
            </Link>
          </>
        ) : (
          <div
            className="h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-400/20 animate-pulse"
            title="AI Researcher Engine Online"
          />
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 h-screen sticky top-0 z-40 bg-[#07090e]/95 backdrop-blur-xl border-r border-white/5 transition-all duration-200 overflow-hidden ${
          isCollapsed ? 'w-14' : 'w-64'
        }`}
      >
        {content}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile Drawer Panel */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-[#07090e] border-r border-white/10 lg:hidden transform transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {content}
      </aside>
    </>
  );
}
