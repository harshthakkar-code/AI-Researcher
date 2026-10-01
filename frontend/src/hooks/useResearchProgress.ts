'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ResearchJob, AgentLog, Source, Fact, Report } from '@/types';

export function useResearchProgress(researchId: string) {
  const [job, setJob] = useState<ResearchJob | null>(null);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFullState = useCallback(async () => {
    try {
      const res = await fetch(`/api/research/${researchId}`);
      if (!res.ok) throw new Error('Failed to fetch research details');
      const data = await res.json();
      setJob(data.job);

      // Strictly deduplicate logs by ID
      const incomingLogs = data.logs || [];
      const logMap = new Map<string, AgentLog>();
      incomingLogs.forEach((l: AgentLog) => {
        if (l.id) logMap.set(l.id, l);
      });
      setLogs(Array.from(logMap.values()));

      setSources(data.sources || []);
      setFacts(data.facts || []);
      setReport(data.report || null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [researchId]);

  useEffect(() => {
    fetchFullState();

    const supabase = createClient();
    if (!supabase) return;

    // Realtime subscription for job status updates
    const jobChannel = supabase
      .channel(`job-updates-${researchId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'research_jobs',
          filter: `id=eq.${researchId}`,
        },
        (payload) => {
          setJob(payload.new as ResearchJob);
          // If completed, re-fetch full artifacts (report, sources, facts)
          if ((payload.new as ResearchJob).status === 'completed') {
            fetchFullState();
          }
        }
      )
      .subscribe();

    // Realtime subscription for live agent logs stream
    const logsChannel = supabase
      .channel(`logs-stream-${researchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_logs',
          filter: `research_id=eq.${researchId}`,
        },
        (payload) => {
          const newLog = payload.new as AgentLog;
          setLogs((prev) => {
            if (prev.some((l) => l.id === newLog.id)) {
              return prev;
            }
            return [...prev, newLog];
          });
        }
      )
      .subscribe();

    // Fallback polling every 3 seconds if realtime websocket is connecting or idle
    const pollInterval = setInterval(() => {
      if (job?.status !== 'completed' && job?.status !== 'failed') {
        fetchFullState();
      }
    }, 3000);

    return () => {
      supabase.removeChannel(jobChannel);
      supabase.removeChannel(logsChannel);
      clearInterval(pollInterval);
    };
  }, [researchId, fetchFullState, job?.status]);

  return { job, logs, sources, facts, report, loading, error, refetch: fetchFullState };
}
