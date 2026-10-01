-- ==========================================================
-- Autonomous AI Researcher - Complete Database Schema & RLS
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- ==========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Research Jobs Table
CREATE TABLE IF NOT EXISTS public.research_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'planning', 'researching', 'validating', 'writing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Research Queries Table
CREATE TABLE IF NOT EXISTS public.research_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id UUID NOT NULL REFERENCES public.research_jobs(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  search_order INTEGER NOT NULL,
  results_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Sources Table
CREATE TABLE IF NOT EXISTS public.sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id UUID NOT NULL REFERENCES public.research_jobs(id) ON DELETE CASCADE,
  title TEXT,
  url TEXT NOT NULL,
  domain TEXT,
  published_at TIMESTAMPTZ,
  content TEXT,
  source_type TEXT DEFAULT 'web',
  relevance_score FLOAT DEFAULT 0.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Facts Table
CREATE TABLE IF NOT EXISTS public.facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id UUID NOT NULL REFERENCES public.research_jobs(id) ON DELETE CASCADE,
  claim TEXT NOT NULL,
  source_id UUID REFERENCES public.sources(id) ON DELETE SET NULL,
  confidence TEXT DEFAULT 'medium' CHECK (confidence IN ('high', 'medium', 'low')),
  validated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Reports Table
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id UUID NOT NULL REFERENCES public.research_jobs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  word_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Agent Logs Table (Telemetry & Live Progress Feed)
CREATE TABLE IF NOT EXISTS public.agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id UUID NOT NULL REFERENCES public.research_jobs(id) ON DELETE CASCADE,
  agent TEXT NOT NULL,
  event TEXT NOT NULL,
  message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_research_jobs_user_id ON public.research_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_research_queries_research_id ON public.research_queries(research_id);
CREATE INDEX IF NOT EXISTS idx_sources_research_id ON public.sources(research_id);
CREATE INDEX IF NOT EXISTS idx_facts_research_id ON public.facts(research_id);
CREATE INDEX IF NOT EXISTS idx_reports_research_id ON public.reports(research_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_research_id ON public.agent_logs(research_id);

-- ==========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can select/update their own profile
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Research Jobs
CREATE POLICY "Users view own research jobs" ON public.research_jobs
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users insert own research jobs" ON public.research_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users update own research jobs" ON public.research_jobs
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

-- Research Queries
CREATE POLICY "Users view queries for their jobs" ON public.research_queries
  FOR SELECT USING (
    research_id IN (SELECT id FROM public.research_jobs WHERE user_id = auth.uid() OR user_id IS NULL)
  );

-- Sources
CREATE POLICY "Users view sources for their jobs" ON public.sources
  FOR SELECT USING (
    research_id IN (SELECT id FROM public.research_jobs WHERE user_id = auth.uid() OR user_id IS NULL)
  );

-- Facts
CREATE POLICY "Users view facts for their jobs" ON public.facts
  FOR SELECT USING (
    research_id IN (SELECT id FROM public.research_jobs WHERE user_id = auth.uid() OR user_id IS NULL)
  );

-- Reports
CREATE POLICY "Users view reports for their jobs" ON public.reports
  FOR SELECT USING (
    research_id IN (SELECT id FROM public.research_jobs WHERE user_id = auth.uid() OR user_id IS NULL)
  );

-- Agent Logs
CREATE POLICY "Users view agent logs for their jobs" ON public.agent_logs
  FOR SELECT USING (
    research_id IN (SELECT id FROM public.research_jobs WHERE user_id = auth.uid() OR user_id IS NULL)
  );

-- ==========================================================
-- REALTIME SUBSCRIPTIONS REPLICATION
-- Enable realtime updates on research_jobs and agent_logs
-- ==========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.research_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_logs;
