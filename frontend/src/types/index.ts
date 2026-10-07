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
  config?: Record<string, any> | null;
  is_pinned?: boolean;
  message_count?: number;
  last_activity_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export type SessionMessageRole = 'user' | 'assistant' | 'system';
export type SessionMessageType = 'text' | 'finding' | 'verification' | 'update';

export interface SessionMessage {
  id: string;
  research_id: string;
  role: SessionMessageRole;
  content: string;
  message_type: SessionMessageType;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface ResearchConfig {
  date_from?: string;
  date_to?: string;
  research_depth?: 'brief' | 'moderate' | 'deep';
  min_sources?: number;
  source_policy?: 'trusted' | 'academic' | 'all';
  response_length?: 'compact' | 'standard' | 'detailed';
  citation_mode?: 'inline' | 'footnote' | 'biblio';
  geographic_scope?: string;
  language?: string;
}

export interface ChatSourceRef {
  title?: string | null;
  url: string;
  domain?: string | null;
}

export interface ChatResponse {
  message: string;
  message_type: SessionMessageType;
  intents?: string[];
  actions_executed?: string[];
  report_updated?: boolean;
  new_report_markdown?: string | null;
  sources?: ChatSourceRef[];
  relevant_facts?: string[];
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

export interface ReportVersion {
  id: string;
  report_id: string;
  version_number: number;
  content_markdown: string;
  word_count?: number;
  change_summary?: string | null;
  created_at: string;
}

export interface Report {
  id: string;
  research_id: string;
  title: string;
  content_markdown: string;
  word_count?: number;
  active_version_id?: string | null;
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

export type VerificationStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ClaimStatus = 'verified' | 'partially_verified' | 'conflicting' | 'unsupported';

export interface VerificationJob {
  id: string;
  research_id: string;
  report_version_id?: string | null;
  status: VerificationStatus;
  total_claims: number;
  checked_claims: number;
  verified_count: number;
  partial_count: number;
  conflicting_count: number;
  unsupported_count: number;
  error?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface VerificationResult {
  id: string;
  verification_job_id: string;
  research_id: string;
  claim_text: string;
  status: ClaimStatus;
  confidence_score: number;
  supporting_sources?: { title?: string; url: string; domain?: string }[];
  counter_evidence?: string | null;
  explanation?: string | null;
  created_at: string;
}

