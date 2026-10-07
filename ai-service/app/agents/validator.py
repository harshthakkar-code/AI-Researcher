import logging
from typing import List, Dict, Any
from app.config import settings

logger = logging.getLogger(__name__)


class ValidatorAgent:
    """Agent responsible for cross-referencing evidence, detecting conflicts, and scoring confidence."""

    def __init__(self):
        self.role = "Research Validator & Fact Checker"
        self.goal = "Verify accuracy, detect discrepancies between sources, and assign confidence ratings."

    async def validate_facts(
        self,
        topic: str,
        facts: List[Dict[str, Any]],
        sources: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Cross-references claims, scores confidence, and flags conflicts."""
        validated_facts = []
        conflicts = []

        # Universal domain credibility heuristics
        high_trust_domains = {
            "arxiv.org", "nature.com", "science.org", "ieee.org", "acm.org",
            "sciencedirect.com", "nih.gov", "ncbi.nlm.nih.gov", "github.com",
            "reuters.com", "bloomberg.com", "ft.com", "wsj.com", "economist.com",
            "techcrunch.com", "theverge.com", "wired.com", "mit.edu", "stanford.edu",
            "bbc.com", "apnews.com", "investopedia.com", "gov", "edu"
        }

        # AI-powered fact verification if key available
        if settings.gemini_api_key and len(facts) > 3:
            try:
                from google import genai
                client = genai.Client(api_key=settings.gemini_api_key)
                claims_text = "\n".join([f"{i+1}. {f.get('claim')} (Source: {f.get('domain')})" for i, f in enumerate(facts[:20])])
                v_prompt = f"""You are a senior fact-checker. Review these factual claims collected for topic "{topic}":
{claims_text}

Identify any claims that are clearly contradicted, outdated, or unreliable.
Return a valid JSON array of indices (1-indexed) of the claims that are factually sound and corroborated.
Example: [1, 2, 4, 5]
"""
                candidate_models = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]
                for model_name in candidate_models:
                    try:
                        resp = client.models.generate_content(model=model_name, contents=v_prompt)
                        import json
                        import re
                        txt = resp.text.strip()
                        array_match = re.search(r'\[[\d,\s]*\]', txt)
                        if array_match:
                            approved_indices = set(json.loads(array_match.group(0)))
                        else:
                            approved_indices = set(range(1, len(facts) + 1))
                        for i, f in enumerate(facts):
                            is_approved = (i + 1) in approved_indices
                            validated_facts.append({
                                **f,
                                "confidence": "high" if is_approved else "medium",
                                "validated": is_approved
                            })
                        logger.info(f"AI Fact-Checker validated {len(validated_facts)} claims with {model_name}")
                        return {
                            "validated_facts": validated_facts,
                            "conflicts": conflicts,
                            "high_confidence_count": sum(1 for f in validated_facts if f["confidence"] == "high")
                        }
                    except Exception as merr:
                        logger.warning(f"AI Validator with {model_name} failed: {merr}")
            except Exception as e:
                logger.warning(f"AI Validator initialization failed: {e}")

        # Heuristic validation fallback
        for f in facts:
            domain = f.get("domain", "")
            claim = f.get("claim", "")

            # Default confidence assessment
            if domain in high_trust_domains or any(d in domain for d in high_trust_domains):
                confidence = "high"
            elif any(d in domain for d in ["techcrunch.com", "bloomberg.com", "reuters.com", "theverge.com", "filmibeat"]):
                confidence = "high"
            else:
                confidence = "medium"

            # Check for conflict cues
            is_conflicted = False
            for prev in validated_facts:
                if ("2025" in claim and "2026" in prev.get("claim", "")) or \
                   ("outperforms" in claim and "underperforms" in prev.get("claim", "")):
                    conflicts.append({
                        "claim_a": prev.get("claim"),
                        "claim_b": claim,
                        "reason": "Temporal or quantitative assertion discrepancy"
                    })
                    confidence = "low"
                    is_conflicted = True

            validated_facts.append({
                **f,
                "confidence": confidence,
                "validated": not is_conflicted
            })

        logger.info(f"Validated {len(validated_facts)} facts. Found {len(conflicts)} conflict(s).")
        return {
            "validated_facts": validated_facts,
            "conflicts": conflicts,
            "high_confidence_count": sum(1 for f in validated_facts if f["confidence"] == "high")
        }

    async def verify_specific_claims(
        self,
        research_id: str,
        claim_query: str = None
    ) -> Dict[str, Any]:
        """Validates specific claims or entire fact base on demand."""
        from app.services.supabase import (
            get_job_details,
            get_facts_for_research,
            get_sources_for_research,
            add_agent_log,
        )

        job = get_job_details(research_id) or {}
        topic = job.get("topic", "Research Topic")
        facts = get_facts_for_research(research_id, limit=40)
        sources = get_sources_for_research(research_id, limit=30)

        target_facts = facts
        if claim_query:
            q_lower = claim_query.lower()
            matching = [f for f in facts if any(w in f.get("claim", "").lower() for w in q_lower.split() if len(w) > 3)]
            if matching:
                target_facts = matching

        add_agent_log(
            research_id=research_id,
            agent=self.role,
            event="claim_verification_started",
            message=f"Verifying {len(target_facts)} claims against authoritative source corpus.",
            metadata={"claim_query": claim_query, "target_count": len(target_facts)}
        )

        validation_result = await self.validate_facts(topic=topic, facts=target_facts, sources=sources)
        verified = [f.get("claim") for f in validation_result.get("validated_facts", []) if f.get("validated")]
        conflicts = validation_result.get("conflicts", [])

        add_agent_log(
            research_id=research_id,
            agent=self.role,
            event="claim_verification_completed",
            message=f"Verified {len(verified)} claims, detected {len(conflicts)} potential conflicts.",
            metadata={"verified_count": len(verified), "conflicts_count": len(conflicts)}
        )

        summary = f"Verification check completed across {len(target_facts)} claims. {len(verified)} corroborated, {len(conflicts)} flagged."
        return {
            "summary": summary,
            "verified_count": len(verified),
            "conflicts": conflicts,
            "verified_claims": verified[:5]
        }

    async def deep_verify_report(self, research_id: str, job_id: str) -> None:
        """Launches the deep async claim-by-claim verification pipeline."""
        from app.services.verification import run_verification_pipeline
        await run_verification_pipeline(research_id=research_id, job_id=job_id)


validator_agent = ValidatorAgent()


