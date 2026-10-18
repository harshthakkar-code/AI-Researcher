import re
import json
import logging
from typing import List, Dict, Any, Optional, Tuple
from app.config import settings
from app.services.embeddings import embedding_service
from app.services.supabase import search_document_chunks_hybrid
from app.models.schemas import RagSourceCitation

logger = logging.getLogger(__name__)


class RagService:
    """Production Retrieval-Augmented Generation retrieval and query rewriting service."""

    @classmethod
    async def rewrite_query(
        cls,
        user_message: str,
        chat_history: Optional[List[Dict[str, Any]]] = None
    ) -> Tuple[str, Optional[str], Optional[str]]:
        """Resolves conversational pronouns ('that', 'it', 'the verse above') into a standalone search query.
        
        Also extracts explicit metadata filters (chapter, verse) when present in user query.
        """
        # Quick regex extraction of explicit chapter/verse
        explicit_ch = None
        explicit_v = None

        ch_match = re.search(r'chapter\s+(\d+)', user_message, re.IGNORECASE)
        if ch_match:
            explicit_ch = ch_match.group(1)

        v_match = re.search(r'verse\s+(\d+)', user_message, re.IGNORECASE)
        if v_match:
            explicit_v = v_match.group(1)

        dotted_match = re.search(r'\b(\d{1,2})\.(\d{1,2})\b', user_message)
        if dotted_match:
            explicit_ch = dotted_match.group(1)
            explicit_v = dotted_match.group(2)

        # If no conversation history, query is already standalone
        if not chat_history or len(chat_history) == 0:
            return user_message, explicit_ch, explicit_v

        # Use Gemini to rewrite conversational query
        if settings.gemini_api_key:
            try:
                from google import genai
                client = genai.Client(api_key=settings.gemini_api_key)

                recent_turns = []
                for m in chat_history[-4:]:
                    role = "User" if m.get("role") == "user" else "Assistant"
                    snippet = m.get("content", "")[:300]
                    recent_turns.append(f"{role}: {snippet}")
                history_text = "\n".join(recent_turns)

                prompt = f"""You are a RAG Query Reformulator for a multi-document research and knowledge base assistant.
Given the conversation context and latest user question, rephrase the question into a standalone semantic search query suitable for vector retrieval across all uploaded documents.

Recent Conversation:
{history_text}

Latest User Question: "{user_message}"

Directives:
1. Replace ambiguous references ('that', 'which verse', 'it', 'explain more', 'that chapter') with the specific subject discussed.
2. If the user question is in Gujarati, Hindi, or another language, ensure key concepts are preserved and enriched with corresponding English/domain terms to maximize semantic match across all uploaded documents.
3. Return a JSON object with:
   - "standalone_query": "clear standalone semantic search query"
   - "chapter": chapter number (as integer string, e.g. "2") or null if not applicable
   - "verse": verse/section number (as integer string, e.g. "47") or null if not applicable

Example Output:
{{"standalone_query": "Which verse or section explains Nishkama Karma and performing duty without attachment?", "chapter": "2", "verse": "47"}}
"""
                resp = client.models.generate_content(
                    model="gemini-3.5-flash-lite",
                    contents=prompt
                )
                if resp.text:
                    match = re.search(r'\{[\s\S]*?\}', resp.text)
                    if match:
                        data = json.loads(match.group(0))
                        standalone = data.get("standalone_query") or user_message
                        ch = str(data.get("chapter")) if data.get("chapter") else explicit_ch
                        v = str(data.get("verse")) if data.get("verse") else explicit_v
                        return standalone, ch, v
            except Exception as e:
                logger.warning(f"Query rewriter fallback: {e}")

        return user_message, explicit_ch, explicit_v

    @classmethod
    async def retrieve(
        cls,
        query: str,
        chat_history: Optional[List[Dict[str, Any]]] = None,
        document_ids: Optional[List[str]] = None,
        top_k: int = 6,
        user_id: Optional[str] = None
    ) -> List[RagSourceCitation]:
        """Executes full hybrid retrieval: Rewrite -> Embed -> Hybrid PostgreSQL RPC -> Deduplicate."""
        standalone_query, filter_ch, filter_v = await cls.rewrite_query(query, chat_history)
        logger.info(f"RAG Standalone Query: '{standalone_query}' (ch={filter_ch}, v={filter_v})")

        # Generate query embedding
        query_embedding = embedding_service.embed_text(standalone_query)

        # Call PostgreSQL Hybrid Match
        results = search_document_chunks_hybrid(
            query_text=standalone_query,
            query_embedding=query_embedding,
            match_count=top_k,
            filter_document_ids=document_ids,
            filter_chapter=filter_ch,
            filter_verse=filter_v,
            filter_user_id=user_id,
            vector_weight=0.7,
            fts_weight=0.3
        )

        citations: List[RagSourceCitation] = []
        for r in results:
            citations.append(RagSourceCitation(
                document_id=str(r.get("document_id")),
                document_title=r.get("document_title") or "Knowledge Document",
                chapter=str(r.get("chapter")) if r.get("chapter") else None,
                verse=str(r.get("verse")) if r.get("verse") else None,
                page_number=r.get("page_number"),
                section_title=r.get("section_title"),
                snippet=r.get("content", ""),
                similarity=float(r.get("similarity", 0.0)),
                combined_score=float(r.get("combined_score", 0.0))
            ))

        return citations

def sanitize_scriptural_text(text: str) -> str:
    """Strips legacy non-Unicode font artifacts (e.g., `Xm `Xm {h Y_©ñ...) and replacement characters."""
    if not text:
        return ""
    # Strip replacement characters and non-printable control characters
    text = text.replace("\ufffd", "").replace("", "")
    cleaned_lines = []
    for line in text.splitlines():
        # Detect legacy non-Unicode font shloka lines (high concentration of ASCII font symbols)
        leg = sum(1 for c in line if c in "{}~©ñ½²§¥äwËWm`^@$")
        if leg >= 3 and not re.search(r'\b(the|and|of|in|to|is|with|that|for|by|on|chapter|verse|page)\b', line, re.I):
            continue
        cleaned_lines.append(line)
    return "\n".join(cleaned_lines).strip()


class RagService:
    @classmethod
    def format_citations_as_evidence(cls, citations: List[RagSourceCitation]) -> str:
        """Formats retrieved chunks into strict evidence blocks with source citations."""
        if not citations:
            return "No matching document passages found in the knowledge base."

        evidence_blocks = []
        for i, c in enumerate(citations, 1):
            meta_parts = [f"Source: {c.document_title}"]
            if c.chapter:
                meta_parts.append(f"Chapter {c.chapter}")
            if c.verse:
                meta_parts.append(f"Verse {c.verse}")
            if c.page_number:
                meta_parts.append(f"Page {c.page_number}")
            if c.section_title:
                clean_sec = sanitize_scriptural_text(c.section_title)
                if clean_sec and len(clean_sec) > 2:
                    meta_parts.append(f"Section: {clean_sec}")

            header = " | ".join(meta_parts)
            clean_snippet = sanitize_scriptural_text(c.snippet)
            evidence_blocks.append(f"[{i}] [{header}]\n{clean_snippet}\n")

        return "\n---\n".join(evidence_blocks)


rag_service = RagService()
