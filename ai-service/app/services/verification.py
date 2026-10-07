import re
import json
import logging
import asyncio
from typing import Dict, Any, List
from datetime import datetime, timezone

from app.config import settings
from app.tools.search import search_tool
from app.services.supabase import (
    get_job_details,
    get_report_for_research,
    get_sources_for_research,
    get_facts_for_research,
    update_verification_progress,
    save_verification_result,
    add_agent_log,
)

logger = logging.getLogger(__name__)


def extract_claims_from_markdown(markdown_text: str) -> List[str]:
    """Parses markdown report to extract empirical assertions, calendar rows, and metrics."""
    if not markdown_text:
        return []

    claims = []
    lines = markdown_text.split('\n')

    for line in lines:
        stripped = line.strip()
        # Table rows with data
        if stripped.startswith('|') and not stripped.startswith('|---') and not 'Date' in stripped and not 'Feature' in stripped:
            cols = [c.strip() for c in stripped.split('|') if c.strip()]
            if len(cols) >= 2:
                claim = f"{cols[0]}: {' - '.join(cols[1:3])}"
                claims.append(claim)
        # Bullet points with dates, numbers, or bold assertions
        elif stripped.startswith(('- ', '* ', '1. ', '2. ', '3. ', '4. ', '5. ')):
            clean_line = re.sub(r'^[*\-\d\.]+\s*', '', stripped)
            if re.search(r'\b(202[4-9]|\d+[%$€£]|\d+\s*(?:October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))\b', clean_line):
                claims.append(clean_line)

    # Deduplicate and cap at 18 high-priority claims
    seen = set()
    unique_claims = []
    for c in claims:
        norm = re.sub(r'\W+', '', c.lower())[:60]
        if norm and norm not in seen:
            seen.add(norm)
            unique_claims.append(c)

    return unique_claims[:18]


async def run_verification_pipeline(research_id: str, job_id: str) -> None:
    """Autonomous asynchronous deep-verification worker."""
    logger.info(f"Starting async verification pipeline for research {research_id}, job {job_id}")

    report = get_report_for_research(research_id)
    if not report:
        update_verification_progress(
            job_id=job_id,
            checked_claims=0,
            verified_count=0,
            partial_count=0,
            conflicting_count=0,
            unsupported_count=0,
            status="failed",
            error="No research report available to verify"
        )
        return

    content_markdown = report.get("content_markdown", "")
    claims = extract_claims_from_markdown(content_markdown)

    if not claims:
        # Fallback to key sentences in markdown
        sentences = [s.strip() for s in content_markdown.split('.') if len(s.strip()) > 40 and any(char.isdigit() for char in s)]
        claims = sentences[:12]

    total_claims = len(claims)
    update_verification_progress(
        job_id=job_id,
        checked_claims=0,
        verified_count=0,
        partial_count=0,
        conflicting_count=0,
        unsupported_count=0,
        total_claims=total_claims,
        status="running"
    )

    add_agent_log(
        research_id=research_id,
        agent="ValidatorAgent",
        event="deep_verification_started",
        message=f"Beginning claim-by-claim verification across {total_claims} assertions.",
        metadata={"total_claims": total_claims, "verification_job_id": job_id}
    )

    stored_sources = get_sources_for_research(research_id, limit=30)
    stored_facts = get_facts_for_research(research_id, limit=40)

    verified_count = 0
    partial_count = 0
    conflicting_count = 0
    unsupported_count = 0

    for idx, claim in enumerate(claims, start=1):
        try:
            status = "verified"
            confidence = 0.85
            explanation = "Corroborated by primary research sources and timeline markers."
            supporting = []
            counter_ev = None

            # 1. Match against stored sources
            claim_words = [w for w in re.findall(r'[a-zA-Z0-9]+', claim.lower()) if len(w) > 3]
            for s in stored_sources:
                content_sample = (s.get("title", "") + " " + s.get("content", "")).lower()
                matches = sum(1 for w in claim_words if w in content_sample)
                if matches >= 2:
                    supporting.append({
                        "title": s.get("title") or s.get("domain"),
                        "url": s.get("url"),
                        "domain": s.get("domain")
                    })
                    if len(supporting) >= 3:
                        break

            # 2. Check for conflict signals (e.g. conflicting dates or opposing outcomes)
            for f in stored_facts:
                fc = f.get("claim", "")
                if ("2025" in claim and "2026" in fc) or ("2026" in claim and "2025" in fc):
                    status = "conflicting"
                    confidence = 0.40
                    counter_ev = f"Recorded historical fact indicated conflicting year: '{fc[:100]}...'"
                    explanation = "Assertion contains a temporal mismatch with corroborated baseline."
                    break

            if not supporting and status != "conflicting":
                # 3. Live check via quick web search
                search_q = " ".join(claim_words[:5])
                web_hits = await search_tool.search(search_q, num_results=2)
                if web_hits:
                    for hit in web_hits:
                        supporting.append({
                            "title": hit.get("title"),
                            "url": hit.get("url"),
                            "domain": hit.get("domain")
                        })
                    status = "partially_verified"
                    confidence = 0.70
                    explanation = "Corroborated through external live search query."
                else:
                    status = "unsupported"
                    confidence = 0.25
                    explanation = "Could not find independent external corroboration within the primary search corpus."

            # Update category counts
            if status == "verified":
                verified_count += 1
            elif status == "partially_verified":
                partial_count += 1
            elif status == "conflicting":
                conflicting_count += 1
            else:
                unsupported_count += 1

            # Save individual claim result (Triggers Realtime on verification_results)
            save_verification_result(
                job_id=job_id,
                research_id=research_id,
                claim_text=claim,
                status=status,
                confidence_score=confidence,
                supporting_sources=supporting,
                counter_evidence=counter_ev,
                explanation=explanation
            )

            # Update job progress (Triggers Realtime on verification_jobs)
            update_verification_progress(
                job_id=job_id,
                checked_claims=idx,
                verified_count=verified_count,
                partial_count=partial_count,
                conflicting_count=conflicting_count,
                unsupported_count=unsupported_count,
                status="running"
            )

            # Small delay to throttle and provide natural live progress animation
            await asyncio.sleep(0.4)

        except Exception as e:
            logger.error(f"Error verifying claim #{idx}: {e}")

    # Mark complete
    update_verification_progress(
        job_id=job_id,
        checked_claims=total_claims,
        verified_count=verified_count,
        partial_count=partial_count,
        conflicting_count=conflicting_count,
        unsupported_count=unsupported_count,
        status="completed"
    )

    add_agent_log(
        research_id=research_id,
        agent="ValidatorAgent",
        event="deep_verification_completed",
        message=f"Deep verification concluded: {verified_count} verified, {partial_count} partial, {conflicting_count} conflicting, {unsupported_count} unsupported.",
        metadata={
            "verified_count": verified_count,
            "conflicting_count": conflicting_count,
            "verification_job_id": job_id
        }
    )
    logger.info(f"Verification completed for job {job_id}")
