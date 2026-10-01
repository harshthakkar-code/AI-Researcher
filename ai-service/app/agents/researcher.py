import json
import logging
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
        """Generates 4 to 6 targeted, diverse search queries for a topic."""
        if settings.gemini_api_key:
            try:
                from google import genai
                client = genai.Client(api_key=settings.gemini_api_key)
                prompt = f"""You are an elite research analyst. Generate 4 to 5 targeted, highly specific web search queries to research the following topic thoroughly:
"{topic}"

Output only a valid JSON array of strings, without markdown code fences or other text. Example:
["query 1", "query 2", "query 3", "query 4"]
"""
                candidate_models = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.8-flash"]
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
                            logger.info(f"Generated search queries with Gemini ({model_name})")
                            return [str(q) for q in queries]
                    except Exception as model_err:
                        logger.warning(f"Query generation with {model_name} failed: {model_err}")
            except Exception as e:
                logger.error(f"Error initializing Gemini client for queries: {e}")

        # Dynamic query generation matching the user's specific subject
        clean_topic = topic.strip()
        lower_t = clean_topic.lower()

        if any(w in lower_t for w in ["concert", "event", "show", "tickets", "match", "festival"]):
            return [
                f"{clean_topic}",
                f"{clean_topic} schedule dates tickets",
                f"{clean_topic} venue lineup booking",
                f"latest announcements {clean_topic}"
            ]
        elif any(w in lower_t for w in ["release", "launch", "movie", "game", "product"]):
            return [
                f"{clean_topic}",
                f"{clean_topic} release date details",
                f"{clean_topic} official announcement",
                f"{clean_topic} specs reviews"
            ]
        else:
            return [
                f"{clean_topic}",
                f"latest news and updates {clean_topic}",
                f"key facts and overview {clean_topic}",
                f"analysis and details {clean_topic}"
            ]

    async def collect_sources_and_facts(self, topic: str, queries: List[str]) -> Dict[str, Any]:
        """Executes search queries, collects deduplicated sources, and extracts facts."""
        seen_urls = set()
        sources = []
        facts = []

        for q in queries:
            results = await search_tool.search(q, num_results=3)
            for res in results:
                url = res.get("url")
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)
                sources.append(res)

                # Extract claims from snippet/title
                snippet = res.get("snippet", "")
                title = res.get("title", "")
                if snippet:
                    facts.append({
                        "claim": f"{title}: {snippet}",
                        "source_url": url,
                        "domain": res.get("domain", ""),
                        "confidence": "high" if any(t in res.get("domain", "") for t in ["gov", "edu", "org", "bookmyshow", "insider", "ticketmaster", "reuters", "thehindu"]) else "medium"
                    })

        return {
            "sources": sources,
            "facts": facts
        }


researcher_agent = ResearcherAgent()
