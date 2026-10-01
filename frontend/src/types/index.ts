export type ResearchStatus =
  | 'pending'
  | 'planning'
  | 'researching'
  | 'validating'
  | 'writing'
  | 'completed'
  | 'failed';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface ResearchJob {
  id: string;
  user_id?: string | null;
  topic: string;
  status: ResearchStatus;
  progress: number;
  error?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface ResearchQuery {
  id: string;
  research_id: string;
  query: string;
  search_order: number;
  results_count: number;
  created_at: string;
}

export interface Source {
  id: string;
  research_id: string;
  title: string | null;
  url: string;
  domain: string | null;
  published_at?: string | null;
  content?: string | null;
  source_type: string;
  relevance_score: number;
  created_at: string;
}

export interface Fact {
  id: string;
  research_id: string;
  claim: string;
  source_id?: string | null;
  confidence: ConfidenceLevel;
  validated: boolean;
  created_at: string;
}

export interface Report {
  id: string;
  research_id: string;
  title: string;
  content_markdown: string;
  word_count?: number;
  created_at: string;
}

export interface AgentLog {
  id: string;
  research_id: string;
  agent: string;
  event: string;
  message: string;
  metadata?: Record<string, any>;
  created_at: string;
}
