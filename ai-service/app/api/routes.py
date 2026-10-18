from fastapi import APIRouter, BackgroundTasks, HTTPException, Response, UploadFile, File, Form
from typing import Dict, Any, List, Optional
from app.models.schemas import (
    HealthResponse,
    ResearchRequest,
    ResearchResponse,
    ChatRequest,
    ChatResponse,
    ResearchConfig,
    CustomExportRequest,
    DocumentSchema,
    DocumentIngestionJobSchema,
    DocumentPreviewResponse,
    RagSearchRequest,
    SessionKnowledgeScopeRequest,
    RagSourceCitation,
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
    create_document,
    update_document,
    get_document,
    get_user_documents,
    delete_document,
    create_ingestion_job,
    get_latest_ingestion_job,
    bind_session_documents,
    get_session_document_ids,
)
from app.services.verification import run_verification_pipeline
from app.agents.chat import ChatAgent
from app.agents.router import intent_router
from app.services.export import ExportService
from app.services.ingestion import ingestion_service
from app.services.rag import rag_service



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
        request.topic,
        request.source_mode
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


async def run_chat_pipeline(research_id: str, user_text: str, source_mode: str = "knowledge_base"):
    """Executes multi-intent research actions and persists assistant responses in background."""
    try:
        router_result = await intent_router.execute(
            research_id=research_id,
            user_message=user_text,
            source_mode=source_mode
        )
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
                "rag_citations": [c.model_dump() for c in response.rag_citations],
                "export": response.export,
                "source_mode": source_mode,
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

    source_mode = request.source_mode or "knowledge_base"

    # 1. Save User Message immediately
    save_session_message(
        research_id=research_id,
        role="user",
        content=user_text,
        message_type="text",
        metadata={"source_mode": source_mode}
    )

    # 2. Mark job status as researching so sidebar and subscribers reflect active state immediately
    update_job_status(research_id=research_id, status="researching", progress=50)

    # 3. Launch background chat pipeline via asyncio
    asyncio.create_task(run_chat_pipeline(research_id=research_id, user_text=user_text, source_mode=source_mode))

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


# ─────────────────────────────────────────────────────────────
# Document Management & RAG Ingestion Endpoints
# ─────────────────────────────────────────────────────────────

@router.post("/documents/preview", response_model=DocumentPreviewResponse)
async def preview_document(file: UploadFile = File(...)):
    """Pre-ingestion validation and structural preview before embedding generation."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    content = await file.read()
    valid, msg, stats = ingestion_service.validate_and_inspect(content, file.filename)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)

    preview = ingestion_service.generate_preview(content, file.filename, doc_id="preview")
    return preview


@router.post("/documents/upload", status_code=202)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    user_id: Optional[str] = Form(None),
):
    """Uploads a PDF, creates document record and triggers background ingestion worker."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF documents are supported")

    content = await file.read()
    valid, msg, stats = ingestion_service.validate_and_inspect(content, file.filename)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)

    doc_title = title.strip() if title else file.filename.replace(".pdf", "").replace("_", " ")

    # Create document record
    doc_record = create_document(
        title=doc_title,
        filename=file.filename,
        storage_path=f"documents/{file.filename}",
        file_size_bytes=len(content),
        user_id=user_id,
        metadata=stats
    )
    if not doc_record:
        raise HTTPException(status_code=500, detail="Failed to create document record")

    doc_id = doc_record["id"]

    # Create dedicated ingestion job
    job_record = create_ingestion_job(document_id=doc_id, user_id=user_id)
    job_id = job_record["id"] if job_record else "direct"

    # Launch durable background task
    background_tasks.add_task(
        ingestion_service.process_document_background,
        document_id=doc_id,
        file_bytes=content,
        job_id=job_id,
        user_id=user_id
    )

    return {
        "status": "processing",
        "document_id": doc_id,
        "job_id": job_id,
        "title": doc_title,
        "message": "Document uploaded successfully. Parsing and embedding generation started in background."
    }


@router.get("/documents")
async def list_documents(user_id: Optional[str] = None):
    """Lists all knowledge documents available along with their latest ingestion job telemetry."""
    docs = get_user_documents(user_id=user_id)
    enriched = []
    for d in docs:
        job = get_latest_ingestion_job(d["id"])
        enriched.append({**d, "latest_job": job})
    return enriched


@router.get("/documents/{document_id}")
async def get_document_details(document_id: str):
    """Fetches details of a document and its latest ingestion job progress."""
    doc = get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    job = get_latest_ingestion_job(document_id)
    return {
        "document": doc,
        "latest_job": job
    }


@router.delete("/documents/{document_id}")
async def remove_document(document_id: str):
    """Deletes a document and its associated chunks from the vector database."""
    success = delete_document(document_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete document")
    return {"status": "deleted", "document_id": document_id}


@router.post("/documents/{document_id}/retry", status_code=202)
async def retry_document_ingestion(document_id: str, background_tasks: BackgroundTasks):
    """Retries a failed ingestion job."""
    doc = get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    job = create_ingestion_job(document_id=document_id, user_id=doc.get("user_id"))
    job_id = job["id"] if job else "retry"

    return {
        "status": "retrying",
        "document_id": document_id,
        "job_id": job_id,
        "message": "Retry job queued."
    }


@router.post("/research/{research_id}/scope")
async def update_session_knowledge_scope(research_id: str, request: SessionKnowledgeScopeRequest):
    """Binds or unbinds specific knowledge base documents to a research session."""
    bind_session_documents(research_id, request.document_ids)
    return {
        "status": "updated",
        "research_id": research_id,
        "active_document_ids": request.document_ids
    }


@router.get("/research/{research_id}/scope")
async def get_session_knowledge_scope(research_id: str):
    """Returns active knowledge base document IDs bound to this session."""
    doc_ids = get_session_document_ids(research_id)
    return {
        "research_id": research_id,
        "active_document_ids": doc_ids
    }


@router.post("/rag/search")
async def direct_rag_search(request: RagSearchRequest):
    """Direct hybrid vector retrieval endpoint for testing and document queries."""
    citations = await rag_service.retrieve(
        query=request.query,
        document_ids=request.document_ids,
        top_k=request.top_k
    )
    return {
        "query": request.query,
        "citations_count": len(citations),
        "citations": [c.model_dump() for c in citations]
    }





