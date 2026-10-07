-- ═══════════════════════════════════════════════════════════════════
-- Migration: 005_session_library.sql
-- Description: Adds is_pinned and message_count to research_jobs for Phase 6 Session Management
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.research_jobs
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0;

-- Index for fast ordering by pinned status and activity/creation date
CREATE INDEX IF NOT EXISTS idx_research_jobs_pinned ON public.research_jobs(is_pinned, created_at DESC);
