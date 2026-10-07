-- ==========================================================
-- Migration 002: Persistent Session Chat & Research Config
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- ==========================================================

-- 1. Extend research_jobs with config and last_activity_at
ALTER TABLE public.research_jobs 
  ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Create session_messages Table
CREATE TABLE IF NOT EXISTS public.session_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id UUID NOT NULL REFERENCES public.research_jobs(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'finding', 'verification', 'update')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for speedy chronological retrieval per research session
CREATE INDEX IF NOT EXISTS idx_session_messages_research_id_created_at 
  ON public.session_messages(research_id, created_at ASC);

-- 3. Row Level Security (RLS) Policies
ALTER TABLE public.session_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view session messages for their jobs" ON public.session_messages
  FOR SELECT USING (
    research_id IN (SELECT id FROM public.research_jobs WHERE user_id = auth.uid() OR user_id IS NULL)
  );

CREATE POLICY "Users insert session messages for their jobs" ON public.session_messages
  FOR INSERT WITH CHECK (
    research_id IN (SELECT id FROM public.research_jobs WHERE user_id = auth.uid() OR user_id IS NULL)
  );

CREATE POLICY "Users delete session messages for their jobs" ON public.session_messages
  FOR DELETE USING (
    research_id IN (SELECT id FROM public.research_jobs WHERE user_id = auth.uid() OR user_id IS NULL)
  );

-- 4. Enable Realtime Replication for session_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_messages;
