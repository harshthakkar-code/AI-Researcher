import re
import logging
from typing import Dict, Any, List, Optional
from app.services.supabase import (
    get_job_details,
    get_report_for_research,
    get_sources_for_research,
    get_facts_for_research,
    get_session_messages,
)

logger = logging.getLogger(__name__)

STOP_WORDS = {
    "a", "an", "the", "and", "or", "but", "if", "then", "else", "when", "at", "from",
    "by", "for", "with", "about", "against", "between", "into", "through", "during",
    "before", "after", "above", "below", "to", "of", "up", "down", "in", "out", "on",
    "off", "over", "under", "again", "further", "then", "once", "here", "there", "all",
    "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor",
    "not", "only", "own", "same", "so", "than", "too", "very", "s", "t", "can", "will",
    "just", "don", "should", "now", "what", "where", "which", "who", "whom", "this",
    "that", "these", "those", "am", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "having", "do", "does", "did", "doing", "would", "could", "tell", "me"
}


def extract_keywords(text: str) -> List[str]:
    """Tokenizes and filters out common stopwords to extract semantic keywords."""
    words = re.findall(r'[a-zA-Z0-9_\-]+', text.lower())
    return [w for w in words if w not in STOP_WORDS and len(w) > 2]


def parse_markdown_sections(markdown_text: str) -> List[Dict[str, str]]:
    """Splits markdown into sections by header."""
    if not markdown_text:
        return []

    lines = markdown_text.split('\n')
    sections: List[Dict[str, str]] = []
    current_title = "Overview"
    current_content: List[str] = []

    for line in lines:
        header_match = re.match(r'^(#{1,3})\s+(.*)', line)
        if header_match:
            if current_content:
                sections.append({
                    "title": current_title,
                    "content": "\n".join(current_content).strip()
                })
                current_content = []
            current_title = header_match.group(2).strip()
        else:
            current_content.append(line)

    if current_content:
        sections.append({
            "title": current_title,
            "content": "\n".join(current_content).strip()
        })

    return sections


class ContextBuilder:
    """Intelligent context retrieval service for conversational research interactions.
    
    Avoids dumping entire research corpora into prompts. Employs semantic token scoring,
    structural section slicing, and multi-turn history extraction.
    """

    @classmethod
    async def build_chat_context(
        cls,
        research_id: str,
        user_message: str,
        max_sections: int = 3,
        max_facts: int = 12,
        max_sources: int = 5,
        max_history_turns: int = 6
    ) -> Dict[str, Any]:
        """Builds tailored context for the ChatAgent given a user message."""
        # 1. Fetch Session Data
        job = get_job_details(research_id) or {}
        report = get_report_for_research(research_id) or {}
        sources = get_sources_for_research(research_id, limit=40)
        facts = get_facts_for_research(research_id, limit=50)
        history = get_session_messages(research_id, limit=max_history_turns * 2)

        topic = job.get("topic", "Universal Research")
        config = job.get("config") or {}
        report_content = report.get("content_markdown", "")

        query_keywords = extract_keywords(user_message)
        is_summary_query = any(k in user_message.lower() for k in ["summar", "overview", "what is this", "main point", "key finding", "highlight"])

        # 2. Select Relevant Report Sections
        relevant_sections: List[Dict[str, str]] = []
        if report_content:
            all_sections = parse_markdown_sections(report_content)
            if is_summary_query:
                # Prioritize Executive Summary and Master Data/Calendar Table
                for sec in all_sections:
                    sec_lower = sec["title"].lower()
                    if any(t in sec_lower for t in ["executive summary", "calendar", "matrix", "overview", "key"]):
                        relevant_sections.append(sec)
                if not relevant_sections and all_sections:
                    relevant_sections = all_sections[:2]
            else:
                # Score sections based on keyword frequency in title and body
                scored_sections = []
                for sec in all_sections:
                    score = 0
                    sec_title_lower = sec["title"].lower()
                    sec_body_lower = sec["content"].lower()

                    for kw in query_keywords:
                        if kw in sec_title_lower:
                            score += 4
                        score += sec_body_lower.count(kw)

                    scored_sections.append((score, sec))

                scored_sections.sort(key=lambda x: x[0], reverse=True)
                # Take top scoring sections with score > 0, fallback to first 2 sections if no hits
                matched = [s for score, s in scored_sections if score > 0]
                relevant_sections = matched[:max_sections] if matched else all_sections[:2]

        # 3. Select Relevant Facts
        relevant_facts: List[Dict[str, Any]] = []
        if facts:
            scored_facts = []
            for f in facts:
                claim = f.get("claim", "")
                claim_lower = claim.lower()
                score = sum(1 for kw in query_keywords if kw in claim_lower)
                if f.get("validated"):
                    score += 0.5  # Prioritize validated claims
                scored_facts.append((score, f))

            scored_facts.sort(key=lambda x: x[0], reverse=True)
            matched_facts = [f for score, f in scored_facts if score > 0]
            relevant_facts = (matched_facts[:max_facts] if matched_facts else facts[:max_facts])

        # 4. Select Relevant Sources
        relevant_sources: List[Dict[str, Any]] = []
        if sources:
            scored_sources = []
            for s in sources:
                score = 0
                title_lower = (s.get("title") or "").lower()
                domain_lower = (s.get("domain") or "").lower()
                content_lower = (s.get("content") or "").lower()

                for kw in query_keywords:
                    if kw in title_lower or kw in domain_lower:
                        score += 2
                    if kw in content_lower:
                        score += 1

                scored_sources.append((score, s))

            scored_sources.sort(key=lambda x: x[0], reverse=True)
            matched_sources = [s for score, s in scored_sources if score > 0]
            relevant_sources = (matched_sources[:max_sources] if matched_sources else sources[:max_sources])

        # 5. Format Chat History
        recent_history = [
            {"role": m.get("role"), "content": m.get("content")}
            for m in history[-max_history_turns:]
            if m.get("role") in ("user", "assistant")
        ]

        return {
            "topic": topic,
            "config": config,
            "report_title": report.get("title", topic),
            "relevant_sections": relevant_sections,
            "relevant_facts": [
                {
                    "claim": f.get("claim"),
                    "confidence": f.get("confidence"),
                    "validated": f.get("validated")
                }
                for f in relevant_facts
            ],
            "relevant_sources": [
                {
                    "title": s.get("title") or s.get("domain") or "Verified Source",
                    "url": s.get("url"),
                    "domain": s.get("domain")
                }
                for s in relevant_sources
            ],
            "chat_history": recent_history,
        }
