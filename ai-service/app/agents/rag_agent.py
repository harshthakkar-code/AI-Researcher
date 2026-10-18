# -*- coding: utf-8 -*-
import logging
from typing import Dict, Any, List, Optional
from app.config import settings
from app.services.rag import rag_service
from app.models.schemas import RagSourceCitation

logger = logging.getLogger(__name__)


class RagAgent:
    """Specialized Knowledge Base Agent for strict grounded answering with scriptural citations."""

    def __init__(self):
        self.model = "gemini-2.5-flash"

    async def answer(
        self,
        question: str,
        chat_history: Optional[List[Dict[str, Any]]] = None,
        document_ids: Optional[List[str]] = None,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Performs RAG retrieval and synthesizes a grounded answer with verified citations."""
        citations: List[RagSourceCitation] = await rag_service.retrieve(
            query=question,
            chat_history=chat_history,
            document_ids=document_ids,
            top_k=settings.rag_top_k,
            user_id=user_id
        )

        evidence_text = rag_service.format_citations_as_evidence(citations)

        # Check if any evidence meets threshold
        has_relevant_evidence = len(citations) > 0 and any(c.similarity >= settings.rag_similarity_threshold for c in citations)

        if not has_relevant_evidence and len(citations) == 0:
            return {
                "message": (
                    "I searched the uploaded document knowledge base, but I could not find relevant passages "
                    "answering your specific question. Please verify that the pertinent document is indexed, "
                    "or try rephrasing your inquiry."
                ),
                "citations": [],
                "grounded": False
            }

        prompt = f"""You are the Master Scriptural & Document Scholar in an Autonomous Multi-Agent Research System.
You answer user questions strictly based on verified evidence passages extracted from uploaded knowledge base documents.

EVIDENCE PASSAGES FROM UPLOADED DOCUMENTS:
---
{evidence_text}
---

USER QUESTION:
"{question}"

STRICT OPERATIONAL DIRECTIVES:
1. GROUNDED FIDELITY: Base your explanation primarily on the evidence passages above.
2. CITATION DISCIPLINE: For every principle, explanation, or verse quoted, cite the exact source metadata provided in the brackets:
   Format: [Source: Title, Chapter X, Verse Y, Page Z].
3. ZERO SCRIPTURAL HALLUCINATIONS: Do NOT invent, assume, or guess verse numbers, chapter contexts, or purports that are absent in the retrieved passages.
4. INSUFFICIENT EVIDENCE: If the passages do not contain enough direct evidence to answer the question completely, clearly state:
   "The uploaded document does not contain sufficient direct evidence on this topic."
5. DVAITA / COMMENTARY FAITHFULNESS: If the retrieved passage contains commentary from Sri Raghavendra Teertha (Gita Vivruti) or Sri Madhwacharya, preserve their philosophical nuances faithfully.
6. FORMATTING: Structure your answer cleanly with Markdown headings, bullet points, and highlight key concepts for maximum readability.
7. LANGUAGE ADAPTABILITY: If the user question is asked in Gujarati (ગુજરાતી), Hindi, or asks for Gujarati, provide the complete, fluent, and authentic response in that language, retaining Sanskrit terms (e.g., નિષ્કામ કર્મ, સ્વધર્મ) and exact bracketed citations.
8. ZERO FONT ARTIFACTS: The raw PDF evidence was typeset with legacy non-Unicode fonts. NEVER output ASCII junk strings or corrupted replacement characters. Always output clean, standard Unicode Devanagari or authentic Gujarati script.
"""

        answer_text = ""
        if settings.gemini_api_key:
            from google import genai
            client = genai.Client(api_key=settings.gemini_api_key)
            candidate_models = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.1-flash-lite"]
            for model_name in candidate_models:
                try:
                    resp = client.models.generate_content(
                        model=model_name,
                        contents=prompt
                    )
                    if resp.text:
                        answer_text = resp.text
                        break
                except Exception as e:
                    logger.warning(f"RAG model {model_name} failed: {e}. Trying next candidate...")
            if not answer_text:
                answer_text = "I retrieved the relevant knowledge base passages, but could not synthesize a summary at this moment."
        else:
            answer_text = (
                f"### Grounded Response (Mock)\n\n"
                f"Based on the retrieved passages:\n\n{evidence_text}\n\n"
                f"*(Running in development mode without Gemini API key)*"
            )

        return {
            "message": answer_text,
            "citations": citations,
            "grounded": has_relevant_evidence
        }


rag_agent = RagAgent()
