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


class ChatSourceRef(BaseModel):
    title: Optional[str] = None
    url: str
    domain: Optional[str] = None


class ChatResponse(BaseModel):
    message: str
    message_type: str = "text"
    intents: List[str] = []
    actions_executed: List[str] = []
    report_updated: bool = False
    new_report_markdown: Optional[str] = None
    sources: List[ChatSourceRef] = []
    relevant_facts: List[str] = []
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


