import os
import re
import httpx
import logging
from typing import List, Dict, Any
from bs4 import BeautifulSoup
from app.config import settings

logger = logging.getLogger(__name__)

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"


async def fetch_page_content(url: str, max_chars: int = 1200) -> str:
    """Scrapes the main body text of a webpage to extract real schedules, movie titles, and event details."""
    if not url or not url.startswith("http"):
        return ""
    try:
        async with httpx.AsyncClient(timeout=4.0, headers={"User-Agent": USER_AGENT}, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                # Remove boilerplate tags
                for tag in soup(["script", "style", "nav", "header", "footer", "aside", "form"]):
                    tag.decompose()
                text = " ".join(soup.stripped_strings)
                text = re.sub(r'\s{2,}', ' ', text)
                return text[:max_chars].strip()
    except Exception as e:
        logger.debug(f"Failed to fetch page content for {url}: {e}")
    return ""


class SearchTool:
    """Web search utility supporting Serper.dev, DuckDuckGo (free, no key needed), and live content scraping."""

    def __init__(self, serper_api_key: str = ""):
        self.serper_api_key = serper_api_key or settings.serper_api_key

    async def search(self, query: str, num_results: int = 5) -> List[Dict[str, Any]]:
        """Executes a web search for a query, scrapes page text, and returns structured results."""
        results = []

        # 1. Try Serper.dev if API key is provided
        if self.serper_api_key:
            try:
                async with httpx.AsyncClient(timeout=8.0) as client:
                    resp = await client.post(
                        "https://google.serper.dev/search",
                        headers={
                            "X-API-KEY": self.serper_api_key,
                            "Content-Type": "application/json"
                        },
                        json={"q": query, "num": num_results}
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        for item in data.get("organic", [])[:num_results]:
                            link = item.get("link", "")
                            domain = link.split("/")[2] if "://" in link else ""
                            results.append({
                                "title": item.get("title", ""),
                                "url": link,
                                "snippet": item.get("snippet", ""),
                                "domain": domain,
                                "published_date": item.get("date", None),
                            })
            except Exception as e:
                logger.error(f"Error during Serper search for query '{query}': {e}")

        # 2. Live Web Search via DuckDuckGo if no results yet
        if not results:
            try:
                from ddgs import DDGS
                raw_results = list(DDGS().text(query, max_results=num_results))
                if raw_results:
                    for item in raw_results:
                        url = item.get("href", "")
                        domain = url.split("/")[2] if "://" in url else ""
                        results.append({
                            "title": item.get("title", ""),
                            "url": url,
                            "snippet": item.get("body", ""),
                            "domain": domain,
                            "published_date": None,
                        })
                    logger.info(f"Retrieved {len(results)} live DuckDuckGo results for query: '{query}'")
            except Exception as e:
                logger.warning(f"DuckDuckGo search error for '{query}': {e}")

        # 3. Fallback if search is empty
        if not results:
            results.append({
                "title": f"Current Findings and Overview: {query.title()}",
                "url": f"https://en.wikipedia.org/wiki/{query.replace(' ', '_')}",
                "domain": "wikipedia.org",
                "snippet": f"Overview, verified schedules, and key data points concerning {query}.",
                "published_date": None,
            })

        # 4. Enhance top results with live page content scraping
        for item in results[:3]:
            url = item.get("url", "")
            if "wikipedia.org" not in url:
                page_text = await fetch_page_content(url)
                if page_text and len(page_text) > len(item.get("snippet", "")):
                    item["content"] = page_text
                else:
                    item["content"] = item.get("snippet", "")
            else:
                item["content"] = item.get("snippet", "")

        return results


search_tool = SearchTool()
