-- ==========================================================
-- Migration 004: Deep Asynchronous Fact Verification
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- ==========================================================

-- 1. Create verification_jobs Table
CREATE TABLE IF NOT EXISTS public.verification_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id UUID NOT NULL REFERENCES public.research_jobs(id) ON DELETE CASCADE,
  report_version_id UUID REFERENCES public.report_versions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  total_claims INTEGER DEFAULT 0,
  checked_claims INTEGER DEFAULT 0,
  verified_count INTEGER DEFAULT 0,
  partial_count INTEGER DEFAULT 0,
  conflicting_count INTEGER DEFAULT 0,
  unsupported_count INTEGER DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create verification_results Table
CREATE TABLE IF NOT EXISTS public.verification_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_job_id UUID NOT NULL REFERENCES public.verification_jobs(id) ON DELETE CASCADE,
  research_id UUID NOT NULL REFERENCES public.research_jobs(id) ON DELETE CASCADE,
  claim_text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('verified', 'partially_verified', 'conflicting', 'unsupported')),
  confidence_score FLOAT DEFAULT 0.0,
  supporting_sources JSONB DEFAULT '[]'::jsonb,
  counter_evidence TEXT,
  explanation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_verification_jobs_research 
  ON public.verification_jobs(research_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_verification_results_job 
  ON public.verification_results(verification_job_id, created_at ASC);

-- 3. Row Level Security (RLS) Policies
ALTER TABLE public.verification_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view verification jobs for their research" ON public.verification_jobs
  FOR SELECT USING (
    research_id IN (SELECT id FROM public.research_jobs WHERE user_id = auth.uid() OR user_id IS NULL)
  );

CREATE POLICY "Users insert verification jobs for their research" ON public.verification_jobs
  FOR INSERT WITH CHECK (
    research_id IN (SELECT id FROM public.research_jobs WHERE user_id = auth.uid() OR user_id IS NULL)
  );

CREATE POLICY "Users update verification jobs for their research" ON public.verification_jobs
  FOR UPDATE USING (
    research_id IN (SELECT id FROM public.research_jobs WHERE user_id = auth.uid() OR user_id IS NULL)
  );

CREATE POLICY "Users view verification results for their research" ON public.verification_results
  FOR SELECT USING (
    research_id IN (SELECT id FROM public.research_jobs WHERE user_id = auth.uid() OR user_id IS NULL)
  );

CREATE POLICY "Users insert verification results for their research" ON public.verification_results
  FOR INSERT WITH CHECK (
    research_id IN (SELECT id FROM public.research_jobs WHERE user_id = auth.uid() OR user_id IS NULL)
  );

-- 4. Enable Realtime Replication
ALTER PUBLICATION supabase_realtime ADD TABLE public.verification_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.verification_results;
