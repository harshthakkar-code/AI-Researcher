'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ReportVersion } from '@/types';

export function useVersionHistory(researchId: string) {
  const [versions, setVersions] = useState<ReportVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isReverting, setIsReverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    if (!researchId) return;
    try {
      const res = await fetch(`/api/research/${researchId}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions || []);
        setActiveVersionId(data.active_version_id || (data.versions?.[0]?.id ?? null));
      }
    } catch (err: any) {
      console.error('Failed to load report versions:', err);
    } finally {
      setLoading(false);
    }
  }, [researchId]);

  useEffect(() => {
    fetchVersions();

    const supabase = createClient();
    if (!supabase) return;

    // Realtime channel for new report versions
    const channel = supabase
      .channel(`versions-${researchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'report_versions',
        },
        () => {
          fetchVersions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [researchId, fetchVersions]);

  const revertToVersion = async (versionId: string): Promise<ReportVersion | null> => {
    setIsReverting(true);
    setError(null);
    try {
      const res = await fetch(`/api/research/${researchId}/revert/${versionId}`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to revert report version');
      }

      const data = await res.json();
      await fetchVersions();
      return data.new_version || null;
    } catch (err: any) {
      console.error('Revert error:', err);
      setError(err.message || 'Failed to revert version');
      return null;
    } finally {
      setIsReverting(false);
    }
  };

  return {
    versions,
    activeVersionId,
    loading,
    isReverting,
    error,
    revertToVersion,
    reloadVersions: fetchVersions,
  };
}
