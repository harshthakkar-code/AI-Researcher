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
        """Generates 4 to 6 diverse search queries for a topic."""
        if settings.gemini_api_key:
            try:
                from google import genai
                client = genai.Client(api_key=settings.gemini_api_key)
                prompt = f"""You are an elite research analyst. Generate 4 to 6 targeted, diverse web search queries to research the following topic thoroughly:
"{topic}"

Output only a valid JSON array of strings, without markdown code fences or other text. Example:
["query 1", "query 2", "query 3", "query 4"]
"""
                resp = client.models.generate_content(
                    model="gemini-2.0-flash",
                    contents=prompt
                )
                text = resp.text.strip()
                if text.startswith("```"):
                    text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
                queries = json.loads(text)
                if isinstance(queries, list) and len(queries) > 0:
                    return [str(q) for q in queries]
            except Exception as e:
                logger.error(f"Error generating queries with Gemini: {e}")

        # High-quality fallback queries
        return [
            f"latest breakthroughs in {topic} 2026",
            f"state of the art architectures {topic}",
            f"enterprise adoption case studies {topic}",
            f"key challenges and future directions {topic}"
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
                        "confidence": "medium"
                    })

        return {
            "sources": sources,
            "facts": facts
        }


researcher_agent = ResearcherAgent()
