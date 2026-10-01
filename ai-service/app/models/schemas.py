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
