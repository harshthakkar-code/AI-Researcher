import json
import logging
import re
from typing import List, Dict, Any
from app.config import settings
from app.tools.search import search_tool

logger = logging.getLogger(__name__)


class ResearcherAgent:
    """Agent responsible for topic understanding, query generation, web search, and fact extraction."""

    def __init__(self):
        self.role = "Senior Research Analyst"
        self.goal = "Formulate high-yield search queries, collect authoritative sources, and extract factual claims."

    async def generate_queries(self, topic: str) -> List[str]:
        """Generates 4 to 5 targeted, high-precision search queries across multiple facets for ANY topic."""
        if settings.gemini_api_key:
            try:
                from google import genai
                client = genai.Client(api_key=settings.gemini_api_key)
                prompt = f"""You are a universal principal research intelligence analyst.
Your mission is to decompose ANY topic—whether in artificial intelligence, computer science, medicine, finance, quantum physics, engineering, geopolitics, business strategy, culture, festivals, events, history, or daily life—into targeted, high-yield web search queries.

User Topic: "{topic}"

Instructions:
1. Understand the core domain and underlying intent of the user's inquiry (technical, factual, comparative, statistical, schedule, or analytical).
2. Auto-correct any subtle typos in technical terms, names, locations, or dates (e.g., "gujrat" -> "Gujarat").
3. Formulate 4 to 5 distinct, high-precision search queries covering critical dimensions:
   - If inquiry is about events, festivals, holidays, releases, or timelines: generate queries specifically targeting EXACT CALENDAR DATES (day, month, year), full chronological schedules, and primary panchang/calendar portals (e.g., Drik Panchang, official festival calendars).
   - If technical / scientific: target foundational mechanisms, latest benchmark comparisons, and empirical datasets.
   - If business / market: target quantitative market indicators, revenue figures, and competitive dynamics.
4. Keep queries natural, keyword-dense, and optimized for web search engines.

Output ONLY a valid JSON array of strings, without markdown code fences or conversational text:
["query 1", "query 2", "query 3", "query 4"]
"""
                candidate_models = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash"]
                for model_name in candidate_models:
                    try:
                        resp = client.models.generate_content(
                            model=model_name,
                            contents=prompt
                        )
                        text = resp.text.strip()
                        if text.startswith("```"):
                            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
                        queries = json.loads(text)
                        if isinstance(queries, list) and len(queries) > 0:
                            logger.info(f"Generated universal search queries with Gemini ({model_name})")
                            return [str(q) for q in queries]
                    except Exception as model_err:
                        logger.warning(f"Query generation with {model_name} failed: {model_err}")
            except Exception as e:
                logger.error(f"Error initializing Gemini client for queries: {e}")

        # Universal fallback query generator
        clean_topic = topic.strip()
        return [
            f"{clean_topic} overview technical analysis",
            f"{clean_topic} latest verified research data",
            f"{clean_topic} key architecture comparison benchmarks",
            f"{clean_topic} authoritative guide deep dive",
            f"latest developments {clean_topic}"
        ]

    async def collect_sources_and_facts(self, topic: str, queries: List[str]) -> Dict[str, Any]:
        """Executes search queries, collects deduplicated sources, and extracts facts."""
        seen_urls = set()
        sources = []
        facts = []

        # Universal high-trust domain authorities
        universal_authorities = [
            "gov", "edu", "org", "arxiv.org", "nature.com", "ieee.org", "acm.org",
            "sciencedirect.com", "nih.gov", "ncbi.nlm.nih.gov", "github.com",
            "huggingface.co", "reuters.com", "bloomberg.com", "ft.com", "wsj.com",
            "economist.com", "techcrunch.com", "theverge.com", "bbc.com", "apnews.com",
            "thehindu.com", "indianexpress.com", "investopedia.com"
        ]

        for q in queries:
            results = await search_tool.search(q, num_results=5)
            for res in results:
                url = res.get("url")
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)
                sources.append(res)

                # Extract claims from snippet/title
                snippet = res.get("snippet", "")
                title = res.get("title", "")
                content = res.get("content", "")
                domain = res.get("domain", "")

                is_high_cred = any(t in domain for t in universal_authorities)

                if snippet:
                    facts.append({
                        "claim": f"{title}: {snippet}",
                        "source_url": url,
                        "domain": domain,
                        "confidence": "high" if is_high_cred else "medium"
                    })

                # Universal factual extraction from deep scraped content
                if content and len(content) > len(snippet):
                    sentences = [s.strip() for s in content.split(".") if 35 < len(s.strip()) < 260]
                    for s in sentences:
                        # Extract sentences with quantitative data, metrics, causal verbs, or temporal details
                        has_data = bool(re.search(r'\d+[%$€£]|\b\d{4}\b|\b\d+(?:\.\d+)?\s*(?:billion|million|trillion|percent|users|parameters|tokens|ms|gb|tb|kg|hz|mph|km)\b', s, re.IGNORECASE))
                        has_analytical_verb = bool(re.search(r'\b(demonstrates?|achieved?|discovered?|published?|announced?|developed?|launched?|reveals?|architecture|algorithm|benchmark|mechanism|policy|breakthrough)\b', s, re.IGNORECASE))
                        
                        if has_data or has_analytical_verb:
                            facts.append({
                                "claim": f"{title}: {s}",
                                "source_url": url,
                                "domain": domain,
                                "confidence": "high" if is_high_cred else "medium"
                            })
                            if len(facts) >= 28:
                                break

        return {
            "sources": sources,
            "facts": facts
        }

    async def follow_up_research(
        self,
        research_id: str,
        inquiry: str,
        config: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Conducts targeted iterative follow-up web research based on user chat instruction."""
        from app.services.supabase import (
            get_job_details,
            add_source,
            add_fact,
            add_agent_log,
        )

        job = get_job_details(research_id) or {}
        topic = job.get("topic", "Research Inquiry")

        add_agent_log(
            research_id=research_id,
            agent=self.role,
            event="follow_up_research_started",
            message=f"Initiating targeted follow-up research on: {inquiry}",
            metadata={"inquiry": inquiry}
        )

        # 1. Formulate 2-3 high-precision queries for the specific subtopic
        queries = [f"{topic} {inquiry}", f"{inquiry} verified data"]
        if settings.gemini_api_key:
            try:
                from google import genai
                client = genai.Client(api_key=settings.gemini_api_key)
                prompt = f"""Formulate 2 precise search queries to answer this follow-up inquiry regarding "{topic}":
Inquiry: "{inquiry}"
Return a plain JSON list of 2 string queries. Example: ["query 1", "query 2"]"""
                resp = client.models.generate_content(
                    model="gemini-3.5-flash-lite",
                    contents=prompt
                )
                if resp.text:
                    match = re.search(r'\[[\s\S]*?\]', resp.text)
                    if match:
                        parsed = json.loads(match.group(0))
                        if isinstance(parsed, list) and len(parsed) > 0:
                            queries = [str(q) for q in parsed[:3]]
            except Exception as e:
                logger.warning(f"Fallback to default queries for follow-up: {e}")

        # 2. Collect sources and extract facts
        results = await self.collect_sources_and_facts(topic, queries)
        new_sources = results.get("sources", [])
        new_facts = results.get("facts", [])

        added_source_ids = []
        for s in new_sources:
            sid = add_source(
                research_id=research_id,
                title=s.get("title", "Follow-up Source"),
                url=s.get("url", ""),
                domain=s.get("domain", ""),
                content=s.get("content", ""),
                relevance_score=s.get("relevance_score", 1.0)
            )
            if sid:
                added_source_ids.append(sid)

        for f in new_facts:
            add_fact(
                research_id=research_id,
                claim=f.get("claim", ""),
                confidence=f.get("confidence", "medium"),
                validated=True if f.get("confidence") == "high" else False
            )

        add_agent_log(
            research_id=research_id,
            agent=self.role,
            event="follow_up_research_completed",
            message=f"Added {len(new_sources)} new sources and {len(new_facts)} facts for '{inquiry}'",
            metadata={"sources_count": len(new_sources), "facts_count": len(new_facts)}
        )

        return {
            "queries": queries,
            "new_sources_count": len(new_sources),
            "new_facts_count": len(new_facts),
            "new_sources": new_sources[:5],
            "new_facts": new_facts[:10]
        }


researcher_agent = ResearcherAgent()

