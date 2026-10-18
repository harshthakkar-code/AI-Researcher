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
from app.services.rag import rag_service

logger = logging.getLogger(__name__)


async def run_research_pipeline(
    research_id: str,
    topic_override: Optional[str] = None,
    source_mode_override: Optional[str] = None
):
    """Executes the complete autonomous multi-agent research pipeline."""
    try:
        logger.info(f"Starting research pipeline for job ID: {research_id}")

        # 0. Fetch job details
        job = get_job_details(research_id)
        topic = topic_override or (job.get("topic") if job else None) or "Latest developments in AI Agents"
        config = (job.get("config") if job else {}) or {}
        source_mode = source_mode_override or config.get("source_mode") or "knowledge_base"

        scope_label = (
            "Knowledge Base (PDF & Documents)" if source_mode == "knowledge_base"
            else "Web Intelligence" if source_mode == "web"
            else "Hybrid (Knowledge Base + Web)"
        )

        # 1. Planning stage
        update_job_status(research_id, "planning", 5)
        add_agent_log(
            research_id=research_id,
            agent="System",
            event="RESEARCH_STARTED",
            message=f"Autonomous research job initiated for topic: '{topic}' [Scope: {scope_label}]",
            metadata={"source_mode": source_mode}
        )

        add_agent_log(
            research_id=research_id,
            agent="Researcher",
            event="PLANNING_STARTED",
            message=f"Analyzing topic intent and synthesizing targeted retrieval vectors for {scope_label}...",
            metadata={"source_mode": source_mode}
        )

        queries = await researcher_agent.generate_queries(topic)
        for i, q in enumerate(queries):
            add_research_query(research_id, q, i + 1)

        add_agent_log(
            research_id=research_id,
            agent="Researcher",
            event="QUERIES_GENERATED",
            message=f"Generated {len(queries)} distinct retrieval vectors",
            metadata={"queries": queries}
        )

        # 2. Researching & Source Collection
        update_job_status(research_id, "researching", 25)

        sources = []
        raw_facts = []

        # Step 2a: Check Knowledge Base (RAG) for internal documents/scriptures if in knowledge_base or hybrid mode
        if source_mode in ("knowledge_base", "hybrid"):
            try:
                add_agent_log(
                    research_id=research_id,
                    agent="RagAgent",
                    event="KNOWLEDGE_BASE_SEARCH",
                    message=f"Querying vector database across indexed documents for: '{topic}'...",
                    metadata={"source_mode": source_mode}
                )
                kb_citations = await rag_service.retrieve(topic, top_k=14)

                # Expand coverage by querying top sub-queries
                for q in queries[:2]:
                    try:
                        sub_citations = await rag_service.retrieve(q, top_k=4)
                        kb_citations.extend(sub_citations)
                    except Exception:
                        pass

                # Deduplicate by document + chapter + verse + page
                seen_chunk_keys = set()
                unique_kb_citations = []
                for c in kb_citations:
                    ckey = f"{c.document_id}-{c.chapter}-{c.verse}-{c.page_number}"
                    if ckey not in seen_chunk_keys:
                        seen_chunk_keys.add(ckey)
                        unique_kb_citations.append(c)

                if unique_kb_citations:
                    doc_title = unique_kb_citations[0].document_title
                    add_agent_log(
                        research_id=research_id,
                        agent="RagAgent",
                        event="KNOWLEDGE_BASE_RETRIEVED",
                        message=f"Grounding research in {len(unique_kb_citations)} authoritative passages from Knowledge Base ({doc_title})",
                        metadata={"document": doc_title, "passages": len(unique_kb_citations)}
                    )

                    for c in unique_kb_citations:
                        kb_url = f"kb://{c.document_id}?page={c.page_number}#ch{c.chapter}v{c.verse}"
                        sources.append({
                            "title": f"{c.document_title} - Ch {c.chapter or 'N/A'}, Verse {c.verse or 'N/A'} (Page {c.page_number or 'N/A'})",
                            "url": kb_url,
                            "domain": f"Knowledge Base ({c.document_title})",
                            "snippet": c.snippet,
                            "content": c.snippet,
                            "published_date": None
                        })
                        raw_facts.append({
                            "claim": f"[{c.document_title} Ch {c.chapter or 'N/A'} V {c.verse or 'N/A'} P {c.page_number or 'N/A'}]: {c.snippet[:350]}",
                            "source_url": kb_url,
                            "domain": f"Knowledge Base ({c.document_title})"
                        })
                else:
                    add_agent_log(
                        research_id=research_id,
                        agent="RagAgent",
                        event="KNOWLEDGE_BASE_EMPTY",
                        message="No matching passages found in Knowledge Base for this topic."
                    )
            except Exception as kb_err:
                logger.warning(f"Knowledge base lookup error: {kb_err}")

        # Step 2b: Query Web Search only if in web/hybrid mode, or as fallback if knowledge base had 0 results
        if source_mode in ("web", "hybrid") or (source_mode == "knowledge_base" and len(sources) == 0):
            if source_mode == "knowledge_base" and len(sources) == 0:
                add_agent_log(
                    research_id=research_id,
                    agent="Researcher",
                    event="FALLBACK_WEB_SEARCH",
                    message="No relevant Knowledge Base chunks indexed; activating web research fallback..."
                )
            else:
                add_agent_log(
                    research_id=research_id,
                    agent="Researcher",
                    event="SEARCH_STARTED",
                    message="Executing live search queries across authoritative academic and industry indices..."
                )

            search_results = await researcher_agent.collect_sources_and_facts(topic, queries)
            sources.extend(search_results.get("sources", []))
            raw_facts.extend(search_results.get("facts", []))

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
            conflicts=conflicts,
            source_mode=source_mode
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
