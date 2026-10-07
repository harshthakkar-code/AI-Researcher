-- ==========================================================
-- Migration 003: Report Versioning & History Tracking
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- ==========================================================

-- 1. Extend reports Table with active_version_id
ALTER TABLE public.reports 
  ADD COLUMN IF NOT EXISTS active_version_id UUID;

-- 2. Create report_versions Table
CREATE TABLE IF NOT EXISTS public.report_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content_markdown TEXT NOT NULL,
  word_count INTEGER,
  change_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by report and chronological order
CREATE INDEX IF NOT EXISTS idx_report_versions_report_id_vnum 
  ON public.report_versions(report_id, version_number ASC);

-- 3. Row Level Security (RLS) Policies
ALTER TABLE public.report_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view report versions for their jobs" ON public.report_versions
  FOR SELECT USING (
    report_id IN (
      SELECT r.id FROM public.reports r 
      JOIN public.research_jobs j ON r.research_id = j.id 
      WHERE j.user_id = auth.uid() OR j.user_id IS NULL
    )
  );

CREATE POLICY "Users insert report versions for their jobs" ON public.report_versions
  FOR INSERT WITH CHECK (
    report_id IN (
      SELECT r.id FROM public.reports r 
      JOIN public.research_jobs j ON r.research_id = j.id 
      WHERE j.user_id = auth.uid() OR j.user_id IS NULL
    )
  );

-- 4. Enable Realtime Replication for report_versions
ALTER PUBLICATION supabase_realtime ADD TABLE public.report_versions;

-- 5. Seed initial version 1 for any existing reports without versions
INSERT INTO public.report_versions (report_id, version_number, content_markdown, word_count, change_summary, created_at)
SELECT id, 1, content_markdown, word_count, 'Initial autonomous research report', created_at
FROM public.reports
WHERE id NOT IN (SELECT DISTINCT report_id FROM public.report_versions);

-- Set active_version_id for existing reports
UPDATE public.reports r
SET active_version_id = v.id
FROM public.report_versions v
WHERE v.report_id = r.id AND r.active_version_id IS NULL;
