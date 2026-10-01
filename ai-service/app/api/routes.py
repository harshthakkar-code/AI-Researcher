from fastapi import APIRouter, BackgroundTasks, HTTPException
from app.models.schemas import HealthResponse, ResearchRequest, ResearchResponse
from app.services.research import run_research_pipeline
from app.services.supabase import get_job_details

router = APIRouter()


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
