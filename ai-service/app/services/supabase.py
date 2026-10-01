import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from supabase import create_client, Client
from app.config import settings

logger = logging.getLogger(__name__)

_supabase_client: Optional[Client] = None
_warned_unconfigured: bool = False


def get_supabase_client() -> Optional[Client]:
    """Returns singleton Supabase client using Service Role key."""
    global _supabase_client, _warned_unconfigured
    if _supabase_client is None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            if not _warned_unconfigured:
                logger.info("Supabase credentials not configured in .env. Running in offline/development mode.")
                _warned_unconfigured = True
            return None
        _supabase_client = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key
        )
    return _supabase_client


def update_job_status(
    research_id: str,
    status: str,
    progress: int,
    error: Optional[str] = None
) -> None:
    """Updates research_jobs record status and progress."""
    client = get_supabase_client()
    if not client:
        logger.info(f"[MOCK SUPABASE] update_job_status: id={research_id} status={status} progress={progress}% error={error}")
        return

    update_payload: Dict[str, Any] = {
        "status": status,
        "progress": progress,
    }
    if error:
        update_payload["error"] = error
    if status == "planning" and progress == 5:
        update_payload["started_at"] = datetime.now(timezone.utc).isoformat()
    elif status in ("completed", "failed"):
        update_payload["completed_at"] = datetime.now(timezone.utc).isoformat()

    try:
        client.table("research_jobs").update(update_payload).eq("id", research_id).execute()
    except Exception as e:
        logger.error(f"Failed to update job status: {e}")


def add_agent_log(
    research_id: str,
    agent: str,
    event: str,
    message: str,
    metadata: Optional[Dict[str, Any]] = None
) -> None:
    """Appends an event log to the agent_logs table."""
    client = get_supabase_client()
    if not client:
        logger.info(f"[MOCK LOG] [{agent}] {event}: {message} ({metadata or {}})")
        return

    payload = {
        "research_id": research_id,
        "agent": agent,
        "event": event,
        "message": message,
        "metadata": metadata or {},
    }
    try:
        client.table("agent_logs").insert(payload).execute()
    except Exception as e:
        logger.error(f"Failed to insert agent log: {e}")


def add_research_query(research_id: str, query: str, search_order: int, results_count: int = 0) -> None:
    """Inserts a generated search query into research_queries table."""
    client = get_supabase_client()
    if not client:
        logger.info(f"[MOCK QUERY] #{search_order}: {query}")
        return

    payload = {
        "research_id": research_id,
        "query": query,
        "search_order": search_order,
        "results_count": results_count,
    }
    try:
        client.table("research_queries").insert(payload).execute()
    except Exception as e:
        logger.error(f"Failed to insert query: {e}")


def add_source(
    research_id: str,
    title: str,
    url: str,
    domain: str,
    content: str,
    relevance_score: float = 1.0,
    published_at: Optional[str] = None
) -> Optional[str]:
    """Inserts a source and returns the inserted source ID."""
    client = get_supabase_client()
    if not client:
        logger.info(f"[MOCK SOURCE] {title} ({url})")
        return f"mock-source-{url[:15]}"

    payload = {
        "research_id": research_id,
        "title": title,
        "url": url,
        "domain": domain,
        "content": content,
        "relevance_score": relevance_score,
        "published_at": published_at,
    }
    try:
        res = client.table("sources").insert(payload).execute()
        if res.data and len(res.data) > 0:
            return res.data[0].get("id")
    except Exception as e:
        logger.error(f"Failed to insert source: {e}")
    return None


def add_fact(
    research_id: str,
    claim: str,
    source_id: Optional[str] = None,
    confidence: str = "medium",
    validated: bool = False
) -> None:
    """Inserts an extracted fact into facts table."""
    client = get_supabase_client()
    if not client:
        logger.info(f"[MOCK FACT] [{confidence}] {claim}")
        return

    payload = {
        "research_id": research_id,
        "claim": claim,
        "source_id": source_id,
        "confidence": confidence,
        "validated": validated,
    }
    try:
        client.table("facts").insert(payload).execute()
    except Exception as e:
        logger.error(f"Failed to insert fact: {e}")


def save_report(
    research_id: str,
    title: str,
    content_markdown: str
) -> None:
    """Saves the final generated Markdown report."""
    client = get_supabase_client()
    word_count = len(content_markdown.split())
    if not client:
        logger.info(f"[MOCK REPORT] {title} ({word_count} words)")
        return

    payload = {
        "research_id": research_id,
        "title": title,
        "content_markdown": content_markdown,
        "word_count": word_count,
    }
    try:
        client.table("reports").insert(payload).execute()
    except Exception as e:
        logger.error(f"Failed to insert report: {e}")


def get_job_details(research_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves research_job by ID."""
    client = get_supabase_client()
    if not client:
        return {"id": research_id, "topic": "Sample Topic", "status": "pending"}

    try:
        res = client.table("research_jobs").select("*").eq("id", research_id).single().execute()
        return res.data
    except Exception as e:
        logger.error(f"Failed to get research job: {e}")
        return None
