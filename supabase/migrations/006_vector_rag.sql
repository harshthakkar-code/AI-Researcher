-- ═══════════════════════════════════════════════════════════════════
-- Migration: 006_vector_rag.sql
-- Description: Production Vector DB, Hybrid RAG, Ingestion Jobs & Knowledge Scoping
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- ═══════════════════════════════════════════════════════════════════

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Documents Registry Table
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'application/pdf',
  file_size_bytes BIGINT,
  storage_path TEXT NOT NULL,
  total_pages INTEGER DEFAULT 0,
  total_chunks INTEGER DEFAULT 0,
  detected_structure JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'validating', 'preview_ready', 'processing', 'indexed', 'failed')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Dedicated Ingestion Jobs Table (Durable Telemetry & Step Tracking)
CREATE TABLE IF NOT EXISTS public.document_ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'validating', 'extracting', 'chunking', 'embedding', 'indexing', 'completed', 'failed')),
  current_stage TEXT NOT NULL DEFAULT 'queued',
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  pages_processed INTEGER DEFAULT 0,
  chunks_created INTEGER DEFAULT 0,
  embeddings_created INTEGER DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 4. Document Chunks Table (768-dim vector via Gemini MRL embedding model)
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  page_number INTEGER,
  chapter TEXT,
  verse TEXT,
  section_title TEXT,
  language TEXT DEFAULT 'en',
  content TEXT NOT NULL,
  token_count INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  embedding vector(768) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Full-Text Search Column for Accelerated Hybrid Retrieval
ALTER TABLE public.document_chunks ADD COLUMN IF NOT EXISTS content_search tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- 6. Indices (HNSW Vector Index + GIN FTS Index + B-Tree)
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw
ON public.document_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_document_chunks_fts
ON public.document_chunks USING gin(content_search);

CREATE INDEX IF NOT EXISTS idx_document_chunks_doc_id ON public.document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_user_id ON public.document_chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_chapter_verse ON public.document_chunks(chapter, verse);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);
CREATE INDEX IF NOT EXISTS idx_document_ingestion_jobs_doc ON public.document_ingestion_jobs(document_id);

-- 7. Session Document Link (User Knowledge Scope per research session)
CREATE TABLE IF NOT EXISTS public.session_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id UUID NOT NULL REFERENCES public.research_jobs(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(research_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_session_documents_res ON public.session_documents(research_id);
CREATE INDEX IF NOT EXISTS idx_session_documents_doc ON public.session_documents(document_id);

-- 8. Hybrid Retrieval Function with RRF (Reciprocal Rank Fusion) and Explicit Metadata Filtering
CREATE OR REPLACE FUNCTION public.match_document_chunks_hybrid (
  query_text text,
  query_embedding vector(768),
  match_count int DEFAULT 8,
  filter_document_ids uuid[] DEFAULT NULL,
  filter_chapter text DEFAULT NULL,
  filter_verse text DEFAULT NULL,
  filter_user_id uuid DEFAULT NULL,
  vector_weight float DEFAULT 0.7,
  fts_weight float DEFAULT 0.3
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  document_title text,
  content text,
  page_number int,
  chapter text,
  verse text,
  section_title text,
  similarity float,
  combined_score float,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH vector_matches AS (
    SELECT
      c.id,
      1 - (c.embedding <=> query_embedding) AS vec_score,
      ROW_NUMBER() OVER (ORDER BY c.embedding <=> query_embedding ASC) AS vec_rank
    FROM public.document_chunks c
    WHERE
      (filter_user_id IS NULL OR c.user_id = filter_user_id)
      AND (filter_document_ids IS NULL OR c.document_id = ANY(filter_document_ids))
      AND (filter_chapter IS NULL OR c.chapter = filter_chapter)
      AND (filter_verse IS NULL OR c.verse = filter_verse)
    ORDER BY c.embedding <=> query_embedding ASC
    LIMIT 30
  ),
  fts_matches AS (
    SELECT
      c.id,
      ts_rank_cd(c.content_search, websearch_to_tsquery('english', query_text)) AS fts_score,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank_cd(c.content_search, websearch_to_tsquery('english', query_text)) DESC
      ) AS fts_rank
    FROM public.document_chunks c
    WHERE
      (filter_user_id IS NULL OR c.user_id = filter_user_id)
      AND (filter_document_ids IS NULL OR c.document_id = ANY(filter_document_ids))
      AND (filter_chapter IS NULL OR c.chapter = filter_chapter)
      AND (filter_verse IS NULL OR c.verse = filter_verse)
      AND c.content_search @@ websearch_to_tsquery('english', query_text)
    LIMIT 30
  )
  SELECT
    c.id,
    c.document_id,
    d.title AS document_title,
    c.content,
    c.page_number,
    c.chapter,
    c.verse,
    c.section_title,
    COALESCE(vm.vec_score, 0.0)::float AS similarity,
    (
      COALESCE(1.0 / (60.0 + vm.vec_rank), 0.0) * vector_weight +
      COALESCE(1.0 / (60.0 + fm.fts_rank), 0.0) * fts_weight
    )::float AS combined_score,
    c.metadata
  FROM public.document_chunks c
  JOIN public.documents d ON d.id = c.document_id
  LEFT JOIN vector_matches vm ON vm.id = c.id
  LEFT JOIN fts_matches fm ON fm.id = c.id
  WHERE vm.id IS NOT NULL OR fm.id IS NOT NULL
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- 9. Row Level Security (RLS)
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_documents ENABLE ROW LEVEL SECURITY;

-- Documents RLS Policies
CREATE POLICY "Users can view their own documents"
  ON public.documents FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert their own documents"
  ON public.documents FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update their own documents"
  ON public.documents FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can delete their own documents"
  ON public.documents FOR DELETE
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Document Ingestion Jobs RLS Policies
CREATE POLICY "Users can view their own ingestion jobs"
  ON public.document_ingestion_jobs FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert their own ingestion jobs"
  ON public.document_ingestion_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update their own ingestion jobs"
  ON public.document_ingestion_jobs FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Document Chunks RLS Policies
CREATE POLICY "Users can view chunks of their documents"
  ON public.document_chunks FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert chunks of their documents"
  ON public.document_chunks FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can delete chunks of their documents"
  ON public.document_chunks FOR DELETE
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Session Documents RLS Policies
CREATE POLICY "Users can view session documents"
  ON public.session_documents FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.research_jobs r
    WHERE r.id = session_documents.research_id
    AND (r.user_id = auth.uid() OR r.user_id IS NULL)
  ));

CREATE POLICY "Users can manage session documents"
  ON public.session_documents FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.research_jobs r
    WHERE r.id = session_documents.research_id
    AND (r.user_id = auth.uid() OR r.user_id IS NULL)
  ));
