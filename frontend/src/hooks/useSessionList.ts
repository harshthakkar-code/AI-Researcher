'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ResearchJob } from '@/types';
import { createClient } from '@/lib/supabase/client';

export function useSessionList() {
  const [sessions, setSessions] = useState<ResearchJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/research');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.jobs || []);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Failed to fetch research sessions');
      }
    } catch (err: any) {
      console.error('Error fetching sessions:', err);
      setError(err.message || 'Network error fetching sessions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch and Realtime subscription
  useEffect(() => {
    fetchSessions();

    try {
      const supabase = createClient();
      const channel = supabase
        .channel('realtime_research_jobs')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'research_jobs' },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newJob = payload.new as ResearchJob;
              setSessions((prev) => [newJob, ...prev.filter((j) => j.id !== newJob.id)]);
            } else if (payload.eventType === 'UPDATE') {
              const updatedJob = payload.new as ResearchJob;
              setSessions((prev) =>
                prev.map((j) => (j.id === updatedJob.id ? { ...j, ...updatedJob } : j))
              );
            } else if (payload.eventType === 'DELETE') {
              const oldJob = payload.old as { id: string };
              setSessions((prev) => prev.filter((j) => j.id !== oldJob.id));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (realtimeErr) {
      console.warn('Realtime subscription setup failed, falling back to polling:', realtimeErr);
    }
  }, [fetchSessions]);

  // Active check interval ONLY while any session is actively running
  useEffect(() => {
    const hasActive = sessions.some(
      (s) => s.status !== 'completed' && s.status !== 'failed'
    );
    if (!hasActive) return;

    const interval = setInterval(() => {
      fetchSessions();
    }, 2500);

    return () => clearInterval(interval);
  }, [sessions, fetchSessions]);

  // Toggle Pin
  const togglePin = useCallback(
    async (id: string, e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }

      // Optimistic update
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_pinned: !s.is_pinned } : s))
      );

      try {
        const res = await fetch(`/api/research/${id}/pin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
          // Revert if failed
          setSessions((prev) =>
            prev.map((s) => (s.id === id ? { ...s, is_pinned: !s.is_pinned } : s))
          );
        }
      } catch (err) {
        console.error('Failed to toggle pin:', err);
        // Revert
        setSessions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, is_pinned: !s.is_pinned } : s))
        );
      }
    },
    []
  );

  // Filtered lists
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase().trim();
    return sessions.filter(
      (s) =>
        s.topic.toLowerCase().includes(q) ||
        s.status.toLowerCase().includes(q)
    );
  }, [sessions, searchQuery]);

  const pinnedSessions = useMemo(() => {
    return filteredSessions.filter((s) => s.is_pinned);
  }, [filteredSessions]);

  const recentSessions = useMemo(() => {
    return filteredSessions.filter((s) => !s.is_pinned);
  }, [filteredSessions]);

  return {
    sessions,
    filteredSessions,
    pinnedSessions,
    recentSessions,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    togglePin,
    refreshSessions: fetchSessions,
  };
}
