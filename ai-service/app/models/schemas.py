from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "0.1.0"
    environment: str = "development"


class ResearchRequest(BaseModel):
    research_id: str = Field(..., description="UUID of the research job created in Supabase")
    topic: Optional[str] = Field(None, description="Topic to research (optional if fetched from Supabase)")
    source_mode: Optional[str] = Field("knowledge_base", description="Source scope: 'knowledge_base' | 'web' | 'hybrid'")


class ResearchResponse(BaseModel):
    status: str
    message: str
    research_id: str


class ResearchJobStatus(BaseModel):
    id: str
    topic: str
    status: str
    progress: int
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class AgentLogEntry(BaseModel):
    agent: str
    event: str
    message: str
    metadata: Optional[Dict[str, Any]] = None


class ResearchConfig(BaseModel):
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    research_depth: Optional[str] = "deep"
    min_sources: Optional[int] = 5
    source_policy: Optional[str] = "trusted"
    response_length: Optional[str] = "detailed"
    citation_mode: Optional[str] = "inline"
    geographic_scope: Optional[str] = None
    language: Optional[str] = "en"


class ChatRequest(BaseModel):
    research_id: str = Field(..., description="UUID of the research session")
    message: str = Field(..., description="User question or instruction")
    source_mode: Optional[str] = Field("knowledge_base", description="Source scope: 'knowledge_base' | 'web' | 'hybrid'")


class ChatSourceRef(BaseModel):
    title: Optional[str] = None
    url: str
    domain: Optional[str] = None


class RagSourceCitation(BaseModel):
    document_id: str
    document_title: str
    chapter: Optional[str] = None
    verse: Optional[str] = None
    page_number: Optional[int] = None
    section_title: Optional[str] = None
    snippet: str
    similarity: float = 0.0
    combined_score: Optional[float] = None


class ChatResponse(BaseModel):
    message: str
    message_type: str = "text"
    intents: List[str] = []
    actions_executed: List[str] = []
    report_updated: bool = False
    new_report_markdown: Optional[str] = None
    sources: List[ChatSourceRef] = []
    relevant_facts: List[str] = []
    rag_citations: List[RagSourceCitation] = []
    export: Optional[Dict[str, Any]] = None


class CustomExportRequest(BaseModel):
    title: str = "Research Export"
    content_markdown: str
    format: str = "pdf"


class SessionMessageSchema(BaseModel):
    id: str
    research_id: str
    role: str
    content: str
    message_type: str = "text"
    metadata: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None


class ReportVersionSchema(BaseModel):
    id: str
    report_id: str
    version_number: int
    content_markdown: str
    word_count: Optional[int] = None
    change_summary: Optional[str] = None
    created_at: Optional[datetime] = None


class ReportVersionsResponse(BaseModel):
    versions: List[ReportVersionSchema]
    active_version_id: Optional[str] = None


# ─────────────────────────────────────────────────────────────
# Document & RAG Schemas
# ─────────────────────────────────────────────────────────────

class DocumentSchema(BaseModel):
    id: str
    user_id: Optional[str] = None
    title: str
    filename: str
    file_type: str = "application/pdf"
    file_size_bytes: Optional[int] = None
    storage_path: str
    total_pages: int = 0
    total_chunks: int = 0
    detected_structure: Dict[str, Any] = {}
    status: str = "pending"
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = {}
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class DocumentIngestionJobSchema(BaseModel):
    id: str
    document_id: str
    user_id: Optional[str] = None
    status: str = "queued"
    current_stage: str = "queued"
    progress_percentage: int = 0
    pages_processed: int = 0
    chunks_created: int = 0
    embeddings_created: int = 0
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class DocumentChunkSchema(BaseModel):
    id: str
    document_id: str
    chunk_index: int
    page_number: Optional[int] = None
    chapter: Optional[str] = None
    verse: Optional[str] = None
    section_title: Optional[str] = None
    language: str = "en"
    content: str
    token_count: Optional[int] = None
    metadata: Dict[str, Any] = {}


class DocumentPreviewResponse(BaseModel):
    document_id: str
    filename: str
    total_pages: int
    text_quality: str
    characters_per_page_avg: float
    detected_edition: str
    detected_chapters: int
    detected_verses: int
    sample_headings: List[str] = []
    estimated_chunks: int
    estimated_tokens: int


class RagSearchRequest(BaseModel):
    query: str
    document_ids: Optional[List[str]] = None
    chapter: Optional[str] = None
    verse: Optional[str] = None
    top_k: int = 6
    similarity_threshold: float = 0.50


class SessionKnowledgeScopeRequest(BaseModel):
    document_ids: List[str]
