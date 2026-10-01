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

        # Domain credibility heuristics
        high_trust_domains = {"arxiv.org", "github.blog", "nature.com", "ieee.org", "acm.org"}

        for f in facts:
            domain = f.get("domain", "")
            claim = f.get("claim", "")

            # Default confidence assessment
            if domain in high_trust_domains:
                confidence = "high"
            elif any(d in domain for d in ["techcrunch.com", "bloomberg.com", "reuters.com", "theverge.com"]):
                confidence = "high"
            else:
                confidence = "medium"

            # Check for conflict cues
            is_conflicted = False
            for prev in validated_facts:
                # Check for timeline or claim friction
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


validator_agent = ValidatorAgent()
