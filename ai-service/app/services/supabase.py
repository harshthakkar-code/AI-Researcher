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
    content_markdown: str,
    change_summary: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Saves report with immutable version history and updates active_version_id."""
    client = get_supabase_client()
    word_count = len(content_markdown.split())
    if not client:
        logger.info(f"[MOCK REPORT] {title} ({word_count} words)")
        return {
            "id": "mock-report-id",
            "research_id": research_id,
            "title": title,
            "content_markdown": content_markdown,
            "word_count": word_count,
            "version_number": 1,
            "change_summary": change_summary or "Initial report",
        }

    try:
        # 1. Check if report container already exists
        res = client.table("reports").select("*").eq("research_id", research_id).limit(1).execute()
        existing_report = res.data[0] if (res.data and len(res.data) > 0) else None

        if not existing_report:
            # Create primary report container
            rep_res = client.table("reports").insert({
                "research_id": research_id,
                "title": title,
                "content_markdown": content_markdown,
                "word_count": word_count,
            }).execute()
            report_id = rep_res.data[0]["id"]
            next_version = 1
            summary = change_summary or "Initial autonomous research report"
        else:
            report_id = existing_report["id"]
            # Find current max version number
            v_res = client.table("report_versions").select("version_number").eq("report_id", report_id).order("version_number", desc=True).limit(1).execute()
            if v_res.data and len(v_res.data) > 0:
                next_version = v_res.data[0]["version_number"] + 1
            else:
                next_version = 2
                # Backfill version 1 if absent
                try:
                    client.table("report_versions").insert({
                        "report_id": report_id,
                        "version_number": 1,
                        "content_markdown": existing_report.get("content_markdown") or content_markdown,
                        "word_count": existing_report.get("word_count") or word_count,
                        "change_summary": "Initial autonomous research report",
                    }).execute()
                except Exception as e_backfill:
                    logger.debug(f"Version 1 backfill notice: {e_backfill}")

            summary = change_summary or f"Version {next_version} update"

        # 2. Insert new version record
        v_insert = client.table("report_versions").insert({
            "report_id": report_id,
            "version_number": next_version,
            "content_markdown": content_markdown,
            "word_count": word_count,
            "change_summary": summary,
        }).execute()
        new_version = v_insert.data[0] if (v_insert.data and len(v_insert.data) > 0) else None
        active_v_id = new_version["id"] if new_version else None

        # 3. Update report container with active_version_id and latest content
        update_data = {
            "title": title,
            "content_markdown": content_markdown,
            "word_count": word_count,
        }
        if active_v_id:
            update_data["active_version_id"] = active_v_id

        client.table("reports").update(update_data).eq("id", report_id).execute()

        return new_version
    except Exception as e:
        logger.error(f"Failed to save versioned report: {e}", exc_info=True)
        # Fallback simple insert
        try:
            client.table("reports").insert({
                "research_id": research_id,
                "title": title,
                "content_markdown": content_markdown,
                "word_count": word_count,
            }).execute()
        except Exception:
            pass
        return None


def get_report_versions(research_id: str) -> List[Dict[str, Any]]:
    """Retrieves all version records for a research report ordered by version number descending."""
    client = get_supabase_client()
    if not client:
        return []

    try:
        rep_res = client.table("reports").select("id, active_version_id").eq("research_id", research_id).limit(1).execute()
        if not rep_res.data or len(rep_res.data) == 0:
            return []

        report_id = rep_res.data[0]["id"]
        v_res = client.table("report_versions").select("*").eq("report_id", report_id).order("version_number", desc=True).execute()
        return v_res.data or []
    except Exception as e:
        logger.error(f"Failed to get report versions: {e}")
        return []


def revert_to_version(research_id: str, version_id: str) -> Optional[Dict[str, Any]]:
    """Reverts document to target version by creating a new version with the target's content."""
    client = get_supabase_client()
    if not client:
        return None

    try:
        # 1. Fetch target version
        v_res = client.table("report_versions").select("*").eq("id", version_id).single().execute()
        target_version = v_res.data
        if not target_version:
            logger.error(f"Target version {version_id} not found")
            return None

        # 2. Fetch report title
        rep = get_report_for_research(research_id) or {}
        title = rep.get("title", "Research Report")

        # 3. Create new version with target content
        summary = f"Reverted back to Version #{target_version.get('version_number', 'previous')}"
        new_v = save_report(
            research_id=research_id,
            title=title,
            content_markdown=target_version.get("content_markdown", ""),
            change_summary=summary
        )
        return new_v
    except Exception as e:
        logger.error(f"Failed to revert report version: {e}")
        return None



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


def get_report_for_research(research_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves the latest generated report for a research session."""
    client = get_supabase_client()
    if not client:
        return None

    try:
        res = client.table("reports").select("*").eq("research_id", research_id).order("created_at", desc=True).limit(1).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
        return None
    except Exception as e:
        logger.error(f"Failed to fetch report for research {research_id}: {e}")
        return None


def get_sources_for_research(research_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieves collected sources for a research session."""
    client = get_supabase_client()
    if not client:
        return []

    try:
        res = client.table("sources").select("*").eq("research_id", research_id).order("relevance_score", desc=True).limit(limit).execute()
        return res.data or []
    except Exception as e:
        logger.error(f"Failed to fetch sources for research {research_id}: {e}")
        return []


def get_facts_for_research(research_id: str, limit: int = 60) -> List[Dict[str, Any]]:
    """Retrieves extracted and validated facts for a research session."""
    client = get_supabase_client()
    if not client:
        return []

    try:
        res = client.table("facts").select("*").eq("research_id", research_id).order("created_at", desc=False).limit(limit).execute()
        return res.data or []
    except Exception as e:
        logger.error(f"Failed to fetch facts for research {research_id}: {e}")
        return []


def save_session_message(
    research_id: str,
    role: str,
    content: str,
    message_type: str = "text",
    metadata: Optional[Dict[str, Any]] = None
) -> Optional[Dict[str, Any]]:
    """Persists a chat session message and updates last_activity_at."""
    client = get_supabase_client()
    if not client:
        logger.info(f"[MOCK SESSION MSG] [{role}]: {content[:60]}...")
        return {
            "id": "mock-msg-id",
            "research_id": research_id,
            "role": role,
            "content": content,
            "message_type": message_type,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

    payload = {
        "research_id": research_id,
        "role": role,
        "content": content,
        "message_type": message_type,
        "metadata": metadata or {},
    }

    try:
        res = client.table("session_messages").insert(payload).execute()
        # Update last_activity_at on research_jobs
        try:
            client.table("research_jobs").update({
                "last_activity_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", research_id).execute()
        except Exception as e_time:
            logger.debug(f"Could not update last_activity_at: {e_time}")

        if res.data and len(res.data) > 0:
            return res.data[0]
        return payload
    except Exception as e:
        logger.error(f"Failed to save session message: {e}")
        return None


def get_session_messages(research_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieves chronological session messages for a research job, prioritizing the latest history."""
    client = get_supabase_client()
    if not client:
        return []

    try:
        # Fetch the most recent messages up to the limit
        res = client.table("session_messages").select("*").eq("research_id", research_id).order("created_at", desc=True).limit(limit).execute()
        messages = res.data or []
        # Return in ascending chronological order so conversation context reads naturally from earlier to latest
        messages.sort(key=lambda m: m.get("created_at") or "")
        return messages
    except Exception as e:
        logger.error(f"Failed to fetch session messages for {research_id}: {e}")
        return []


def delete_session_messages(research_id: str, message_id: Optional[str] = None) -> bool:
    """Deletes the target message and all subsequent messages in the session."""
    client = get_supabase_client()
    if not client:
        return False

    try:
        if message_id:
            target = client.table("session_messages").select("created_at").eq("id", message_id).single().execute()
            if target.data and target.data.get("created_at"):
                client.table("session_messages").delete().eq("research_id", research_id).gte("created_at", target.data["created_at"]).execute()
            else:
                client.table("session_messages").delete().eq("id", message_id).execute()
        return True
    except Exception as e:
        logger.error(f"Failed to delete session messages for {research_id}: {e}")
        return False


def update_research_config(research_id: str, config: Dict[str, Any]) -> bool:
    """Updates research configuration JSON on research_jobs."""
    client = get_supabase_client()
    if not client:
        logger.info(f"[MOCK CONFIG UPDATE] {research_id} -> {config}")
        return True

    try:
        client.table("research_jobs").update({
            "config": config,
            "last_activity_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", research_id).execute()
        return True
    except Exception as e:
        logger.error(f"Failed to update research config for {research_id}: {e}")
        return False


def create_verification_job(
    research_id: str,
    report_version_id: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Creates a new verification_jobs record in pending status."""
    client = get_supabase_client()
    if not client:
        return {
            "id": "mock-verify-job-id",
            "research_id": research_id,
            "status": "pending",
            "total_claims": 0,
            "checked_claims": 0,
        }

    try:
        res = client.table("verification_jobs").insert({
            "research_id": research_id,
            "report_version_id": report_version_id,
            "status": "pending",
            "started_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"Failed to create verification job: {e}")
        return None


def update_verification_progress(
    job_id: str,
    checked_claims: int,
    verified_count: int,
    partial_count: int,
    conflicting_count: int,
    unsupported_count: int,
    total_claims: Optional[int] = None,
    status: str = "running",
    error: Optional[str] = None
) -> None:
    """Updates progress counts and status of an active verification job."""
    client = get_supabase_client()
    if not client:
        return

    update_payload: Dict[str, Any] = {
        "status": status,
        "checked_claims": checked_claims,
        "verified_count": verified_count,
        "partial_count": partial_count,
        "conflicting_count": conflicting_count,
        "unsupported_count": unsupported_count,
    }
    if total_claims is not None:
        update_payload["total_claims"] = total_claims
    if error:
        update_payload["error"] = error
    if status in ("completed", "failed"):
        update_payload["completed_at"] = datetime.now(timezone.utc).isoformat()

    try:
        client.table("verification_jobs").update(update_payload).eq("id", job_id).execute()
    except Exception as e:
        logger.error(f"Failed to update verification job progress: {e}")


def save_verification_result(
    job_id: str,
    research_id: str,
    claim_text: str,
    status: str,
    confidence_score: float = 0.0,
    supporting_sources: Optional[List[Dict[str, Any]]] = None,
    counter_evidence: Optional[str] = None,
    explanation: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Inserts a single checked claim result into verification_results table."""
    client = get_supabase_client()
    if not client:
        return None

    try:
        res = client.table("verification_results").insert({
            "verification_job_id": job_id,
            "research_id": research_id,
            "claim_text": claim_text,
            "status": status,
            "confidence_score": confidence_score,
            "supporting_sources": supporting_sources or [],
            "counter_evidence": counter_evidence,
            "explanation": explanation,
        }).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"Failed to save verification result: {e}")
        return None


def get_latest_verification(research_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves the most recent verification_jobs record for a research session."""
    client = get_supabase_client()
    if not client:
        return None

    try:
        res = client.table("verification_jobs").select("*").eq("research_id", research_id).order("created_at", desc=True).limit(1).execute()
        return res.data[0] if (res.data and len(res.data) > 0) else None
    except Exception as e:
        logger.error(f"Failed to get latest verification job: {e}")
        return None


def get_verification_results(job_id: str) -> List[Dict[str, Any]]:
    """Retrieves individual claim verification items for a job."""
    client = get_supabase_client()
    if not client:
        return []

    try:
        res = client.table("verification_results").select("*").eq("verification_job_id", job_id).order("created_at", desc=False).execute()
        return res.data or []
    except Exception as e:
        logger.error(f"Failed to fetch verification results: {e}")
        return []


