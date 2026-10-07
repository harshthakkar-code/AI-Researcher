'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { VerificationJob, VerificationResult } from '@/types';

export function useVerification(researchId: string) {
  const [job, setJob] = useState<VerificationJob | null>(null);
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVerificationState = useCallback(async () => {
    if (!researchId) return;
    try {
      const res = await fetch(`/api/research/${researchId}/verify`);
      if (res.ok) {
        const data = await res.json();
        setJob(data.job || null);
        setResults(data.results || []);
      }
    } catch (err: any) {
      console.error('Failed to load verification state:', err);
    }
  }, [researchId]);

  useEffect(() => {
    fetchVerificationState();

    const supabase = createClient();
    if (!supabase) return;

    // Realtime channel for verification job updates
    const jobChannel = supabase
      .channel(`verification-job-${researchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'verification_jobs',
          filter: `research_id=eq.${researchId}`,
        },
        (payload) => {
          if (payload.new) {
            setJob(payload.new as VerificationJob);
          }
        }
      )
      .subscribe();

    // Realtime channel for individual verified claims
    const resultsChannel = supabase
      .channel(`verification-results-${researchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'verification_results',
          filter: `research_id=eq.${researchId}`,
        },
        (payload) => {
          const newResult = payload.new as VerificationResult;
          setResults((prev) => {
            if (prev.some((r) => r.id === newResult.id)) {
              return prev;
            }
            return [...prev, newResult];
          });
        }
      )
      .subscribe();

    // Polling fallback when running
    const interval = setInterval(() => {
      if (job?.status === 'running' || job?.status === 'pending') {
        fetchVerificationState();
      }
    }, 2500);

    return () => {
      supabase.removeChannel(jobChannel);
      supabase.removeChannel(resultsChannel);
      clearInterval(interval);
    };
  }, [researchId, fetchVerificationState, job?.status]);

  const startVerification = async () => {
    setIsStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/research/${researchId}/verify`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to start verification pipeline');
      }

      const data = await res.json();
      setJob({
        id: data.job_id,
        research_id: researchId,
        status: 'pending',
        total_claims: 0,
        checked_claims: 0,
        verified_count: 0,
        partial_count: 0,
        conflicting_count: 0,
        unsupported_count: 0,
        created_at: new Date().toISOString(),
      });
      setResults([]);
    } catch (err: any) {
      console.error('Error starting verification:', err);
      setError(err.message || 'Verification failed to start');
    } finally {
      setIsStarting(false);
    }
  };

  return {
    job,
    results,
    isStarting,
    isRunning: job?.status === 'running' || job?.status === 'pending',
    error,
    startVerification,
    reloadVerification: fetchVerificationState,
  };
}
