from fastapi import APIRouter, BackgroundTasks, HTTPException, Response
from typing import Dict, Any, List, Optional
from app.models.schemas import (
    HealthResponse,
    ResearchRequest,
    ResearchResponse,
    ChatRequest,
    ChatResponse,
    ResearchConfig,
    CustomExportRequest,
)
from app.services.research import run_research_pipeline
import asyncio
import logging
from app.services.supabase import (
    get_job_details,
    update_job_status,
    save_session_message,
    get_session_messages,
    delete_session_messages,
    update_research_config,
    get_report_for_research,
    get_report_versions,
    revert_to_version,
    create_verification_job,
    get_latest_verification,
    get_verification_results,
)
from app.services.verification import run_verification_pipeline
from app.agents.chat import ChatAgent
from app.agents.router import intent_router
from app.services.export import ExportService



logger = logging.getLogger(__name__)
router = APIRouter()
chat_agent = ChatAgent()



@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint for Render and local readiness verification."""
    return HealthResponse(status="ok", version="0.1.0", environment="development")


@router.post("/research", response_model=ResearchResponse)
async def start_research(request: ResearchRequest, background_tasks: BackgroundTasks):
    """Triggers asynchronous execution of the autonomous multi-agent research pipeline."""
    if not request.research_id:
        raise HTTPException(status_code=400, detail="research_id is required")

    # Launch background task decoupling from HTTP request
    background_tasks.add_task(
        run_research_pipeline,
        request.research_id,
        request.topic
    )

    return ResearchResponse(
        status="started",
        message="Research pipeline launched in background worker",
        research_id=request.research_id
    )


@router.get("/research/{research_id}/status")
async def get_status(research_id: str):
    """Fetches immediate status of a research job."""
    job = get_job_details(research_id)
    if not job:
        raise HTTPException(status_code=404, detail="Research job not found")
    return job


async def run_chat_pipeline(research_id: str, user_text: str):
    """Executes multi-intent research actions and persists assistant responses in background."""
    try:
        router_result = await intent_router.execute(research_id=research_id, user_message=user_text)
        response = ChatResponse(**router_result)

        # Save Assistant Response with Action Metadata
        save_session_message(
            research_id=research_id,
            role="assistant",
            content=response.message,
            message_type=response.message_type,
            metadata={
                "intents": response.intents,
                "actions_executed": response.actions_executed,
                "report_updated": response.report_updated,
                "sources": [s.model_dump() for s in response.sources],
                "relevant_facts": response.relevant_facts,
                "export": response.export,
            }
        )
        update_job_status(research_id=research_id, status="completed", progress=100)
    except Exception as e:
        logger.error(f"Background chat processing error for {research_id}: {e}", exc_info=True)
        save_session_message(
            research_id=research_id,
            role="assistant",
            content=f"⚠️ I encountered an issue processing your request: {e}",
            message_type="text",
            metadata={"error": str(e)}
        )
        update_job_status(research_id=research_id, status="completed", progress=100, error=str(e))


@router.post("/research/{research_id}/chat", status_code=202)
async def chat_with_research(research_id: str, request: ChatRequest):
    """Orchestrates multi-intent actions (research, fact-checking, editing, Q&A) asynchronously in background."""
    job = get_job_details(research_id)
    if not job:
        raise HTTPException(status_code=404, detail="Research session not found")

    user_text = request.message.strip()
    if not user_text:
        raise HTTPException(status_code=400, detail="Message cannot be blank")

    # 1. Save User Message immediately
    save_session_message(
        research_id=research_id,
        role="user",
        content=user_text,
        message_type="text"
    )

    # 2. Mark job status as researching so sidebar and subscribers reflect active state immediately
    update_job_status(research_id=research_id, status="researching", progress=50)

    # 3. Launch background chat pipeline via asyncio
    asyncio.create_task(run_chat_pipeline(research_id=research_id, user_text=user_text))

    return {
        "status": "processing",
        "message": "Research action launched in background",
        "research_id": research_id
    }


@router.get("/research/{research_id}/messages")
async def get_messages(research_id: str, limit: int = 50):
    """Returns chronological chat message history for the research session."""
    messages = get_session_messages(research_id=research_id, limit=limit)
    return {"messages": messages}


@router.delete("/research/{research_id}/messages")
async def delete_messages(research_id: str, request: Optional[Dict[str, Any]] = None):
    """Deletes target message and subsequent messages in conversation thread."""
    msg_id = request.get("messageId") if request else None
    success = delete_session_messages(research_id=research_id, message_id=msg_id)
    return {"status": "deleted" if success else "failed"}


@router.patch("/research/{research_id}/config")
async def update_config(research_id: str, config: ResearchConfig):
    """Updates research parameters such as date bounds, source criteria, and depth."""
    job = get_job_details(research_id)
    if not job:
        raise HTTPException(status_code=404, detail="Research session not found")

    cfg_dict = config.model_dump(exclude_unset=True)
    success = update_research_config(research_id, cfg_dict)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update configuration")

    return {"status": "updated", "config": cfg_dict}


@router.get("/research/{research_id}/versions")
async def get_versions(research_id: str):
    """Returns chronological report version history and active version pointer."""
    rep = get_report_for_research(research_id)
    if not rep:
        raise HTTPException(status_code=404, detail="No report found for this research session")

    versions = get_report_versions(research_id)
    return {
        "report_id": rep.get("id"),
        "active_version_id": rep.get("active_version_id"),
        "versions": versions
    }


@router.post("/research/{research_id}/revert/{version_id}")
async def revert_version(research_id: str, version_id: str):
    """Reverts to a specific prior version by generating a new version with that content."""
    new_v = revert_to_version(research_id, version_id)
    if not new_v:
        raise HTTPException(status_code=400, detail="Failed to revert to specified version")

    return {
        "status": "reverted",
        "new_version": new_v
    }


@router.post("/research/{research_id}/verify", status_code=202)
async def start_verification(research_id: str, background_tasks: BackgroundTasks):
    """Triggers asynchronous deep verification of report claims."""
    rep = get_report_for_research(research_id)
    if not rep:
        raise HTTPException(status_code=404, detail="No report found to verify")

    v_job = create_verification_job(research_id, report_version_id=rep.get("active_version_id"))
    if not v_job:
        raise HTTPException(status_code=500, detail="Failed to initialize verification job")

    background_tasks.add_task(run_verification_pipeline, research_id, v_job["id"])

    return {
        "job_id": v_job["id"],
        "status": "pending",
        "message": "Deep claim verification launched in background worker"
    }


@router.get("/research/{research_id}/verification")
async def get_verification(research_id: str):
    """Returns the latest verification job and its detailed claim results."""
    latest_job = get_latest_verification(research_id)
    if not latest_job:
        return {"job": None, "results": []}

    results = get_verification_results(latest_job["id"])
    return {
        "job": latest_job,
        "results": results
    }


@router.get("/research/{research_id}/export")
async def export_document(research_id: str, format: str = "pdf"):
    """Exports the research document in PDF, DOCX, or Markdown format."""
    rep = get_report_for_research(research_id)
    if not rep:
        raise HTTPException(status_code=404, detail="No report found to export")

    fmt = format.lower().strip()
    if fmt == "pdf":
        filename, data = ExportService.to_pdf(research_id)
        return Response(
            content=data,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    elif fmt in ("docx", "word", "doc"):
        filename, data = ExportService.to_docx(research_id)
        return Response(
            content=data,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    elif fmt in ("md", "markdown"):
        filename, data = ExportService.to_markdown(research_id)
        return Response(
            content=data.encode("utf-8"),
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported export format: {format}. Supported formats: pdf, docx, md")


@router.post("/research/{research_id}/export")
async def export_custom_document(research_id: str, request: CustomExportRequest):
    """Exports custom markdown content (e.g. specific section or table) in PDF, DOCX, or Markdown format."""
    fmt = request.format.lower().strip()
    clean_title = request.title.strip() or "Research Export"

    if fmt == "pdf":
        filename, data = ExportService.render_markdown_to_pdf(
            title=clean_title,
            content_markdown=request.content_markdown,
            topic=clean_title,
        )
        return Response(
            content=data,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    elif fmt in ("md", "markdown"):
        return Response(
            content=request.content_markdown.encode("utf-8"),
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{clean_title}.md"'}
        )
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {fmt}. Supported formats: pdf, md")




