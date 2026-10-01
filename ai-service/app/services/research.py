import asyncio
import logging
from typing import Optional
from app.services.supabase import (
    update_job_status,
    add_agent_log,
    add_research_query,
    add_source,
    add_fact,
    save_report,
    get_job_details,
)
from app.agents.researcher import researcher_agent
from app.agents.validator import validator_agent
from app.agents.writer import writer_agent

logger = logging.getLogger(__name__)


async def run_research_pipeline(research_id: str, topic_override: Optional[str] = None):
    """Executes the complete autonomous multi-agent research pipeline."""
    try:
        logger.info(f"Starting research pipeline for job ID: {research_id}")

        # 0. Fetch job details
        job = get_job_details(research_id)
        topic = topic_override or (job.get("topic") if job else None) or "Latest developments in AI Agents"

        # 1. Planning stage
        update_job_status(research_id, "planning", 5)
        add_agent_log(
            research_id=research_id,
            agent="System",
            event="RESEARCH_STARTED",
            message=f"Autonomous research job initiated for topic: '{topic}'"
        )

        add_agent_log(
            research_id=research_id,
            agent="Researcher",
            event="PLANNING_STARTED",
            message="Analyzing topic intent and synthesizing targeted search queries..."
        )

        queries = await researcher_agent.generate_queries(topic)
        for i, q in enumerate(queries):
            add_research_query(research_id, q, i + 1)

        add_agent_log(
            research_id=research_id,
            agent="Researcher",
            event="QUERIES_GENERATED",
            message=f"Generated {len(queries)} distinct research angles",
            metadata={"queries": queries}
        )

        # 2. Researching & Source Collection
        update_job_status(research_id, "researching", 25)
        add_agent_log(
            research_id=research_id,
            agent="Researcher",
            event="SEARCH_STARTED",
            message=f"Executing search queries across authoritative academic and industry indices..."
        )

        search_results = await researcher_agent.collect_sources_and_facts(topic, queries)
        sources = search_results["sources"]
        raw_facts = search_results["facts"]

        source_url_to_id = {}
        for s in sources:
            source_id = add_source(
                research_id=research_id,
                title=s.get("title", ""),
                url=s.get("url", ""),
                domain=s.get("domain", ""),
                content=s.get("snippet", ""),
                relevance_score=1.0,
                published_at=s.get("published_date")
            )
            if source_id:
                source_url_to_id[s.get("url")] = source_id

            add_agent_log(
                research_id=research_id,
                agent="Researcher",
                event="SOURCE_FOUND",
                message=f"Retrieved primary reference: {s.get('domain')} - '{s.get('title')}'",
                metadata={"url": s.get("url")}
            )

        update_job_status(research_id, "researching", 50)

        # 3. Evidence Validation Stage
        update_job_status(research_id, "validating", 65)
        add_agent_log(
            research_id=research_id,
            agent="Validator",
            event="VALIDATION_STARTED",
            message=f"Cross-referencing {len(raw_facts)} claims across retrieved sources..."
        )

        validation_result = await validator_agent.validate_facts(topic, raw_facts, sources)
        validated_facts = validation_result["validated_facts"]
        conflicts = validation_result["conflicts"]

        for f in validated_facts:
            src_id = source_url_to_id.get(f.get("source_url"))
            add_fact(
                research_id=research_id,
                claim=f.get("claim", ""),
                source_id=src_id,
                confidence=f.get("confidence", "medium"),
                validated=f.get("validated", True)
            )

        if conflicts:
            add_agent_log(
                research_id=research_id,
                agent="Validator",
                event="CONFLICT_DETECTED",
                message=f"Detected {len(conflicts)} discrepancies; reconciled with domain authority ranking",
                metadata={"conflicts": conflicts}
            )
        else:
            add_agent_log(
                research_id=research_id,
                agent="Validator",
                event="FACTS_VERIFIED",
                message=f"Verified {len(validated_facts)} claims with high confidence alignment"
            )

        # 4. Report Writing Stage
        update_job_status(research_id, "writing", 80)
        add_agent_log(
            research_id=research_id,
            agent="Writer",
            event="WRITING_STARTED",
            message="Synthesizing validated evidence into structured executive research report..."
        )

        report_markdown = await writer_agent.generate_report(
            topic=topic,
            sources=sources,
            validated_facts=validated_facts,
            conflicts=conflicts
        )

        save_report(
            research_id=research_id,
            title=f"Autonomous Research: {topic}",
            content_markdown=report_markdown
        )

        add_agent_log(
            research_id=research_id,
            agent="Writer",
            event="REPORT_GENERATED",
            message=f"Report completed ({len(report_markdown.split())} words, {len(sources)} citations)"
        )

        # 5. Completed
        update_job_status(research_id, "completed", 100)
        add_agent_log(
            research_id=research_id,
            agent="System",
            event="RESEARCH_COMPLETED",
            message="Autonomous research pipeline concluded successfully"
        )
        logger.info(f"Research pipeline completed successfully for ID: {research_id}")

    except Exception as e:
        logger.exception(f"Pipeline error on job {research_id}: {e}")
        update_job_status(research_id, "failed", 0, error=str(e))
        add_agent_log(
            research_id=research_id,
            agent="System",
            event="PIPELINE_ERROR",
            message=f"Research failed: {str(e)}"
        )
