import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from app.config import settings
from app.services.context import ContextBuilder
from app.models.schemas import ChatResponse, ChatSourceRef

logger = logging.getLogger(__name__)


class ChatAgent:
    """Conversational Research Agent that answers questions grounded in active research context."""

    def __init__(self):
        self.role = "Principal Research Advisor & Intelligence Analyst"

    async def answer(self, research_id: str, user_message: str) -> ChatResponse:
        """Processes a user question against the research workspace context."""
        context = await ContextBuilder.build_chat_context(research_id, user_message)

        topic = context.get("topic", "Research Topic")
        sections = context.get("relevant_sections", [])
        facts = context.get("relevant_facts", [])
        sources = context.get("relevant_sources", [])
        chat_history = context.get("chat_history", [])
        config = context.get("config", {})
        current_date = datetime.now().strftime("%B %d, %Y")

        # Format sections text
        sections_text = ""
        for sec in sections:
            sections_text += f"\n### Section: {sec.get('title')}\n{sec.get('content')}\n"

        # Format facts text
        facts_text = ""
        for i, f in enumerate(facts, 1):
            val_status = "Verified" if f.get("validated") else "Reported"
            facts_text += f"{i}. [{val_status} | {f.get('confidence')} confidence] {f.get('claim')}\n"

        # Format sources text
        sources_text = ""
        for s in sources:
            sources_text += f"- [{s.get('title')}]({s.get('url')}) (Domain: {s.get('domain')})\n"

        # Format conversation history
        history_text = ""
        for m in chat_history:
            role_name = "User" if m.get("role") == "user" else "Assistant"
            history_text += f"{role_name}: {m.get('content')}\n"

        # Attempt Gemini Generation
        if settings.gemini_api_key:
            try:
                from google import genai
                client = genai.Client(api_key=settings.gemini_api_key)

                system_prompt = f"""You are the Principal Research Intelligence Advisor for an autonomous research platform.
You are conversing with a user who is examining the research investigation into: "{topic}".
Today's date is: {current_date}.

RESEARCH CONTEXT:
Active Configuration: {config or 'Standard'}

RELEVANT REPORT SECTIONS:
{sections_text or 'No specific report sections retrieved.'}

VERIFIED FACTS & EVIDENCE:
{facts_text or 'No direct fact points available.'}

AVAILABLE SOURCES:
{sources_text or 'No external sources provided.'}

RECENT CONVERSATION HISTORY:
{history_text or 'No previous messages.'}

OPERATING GUIDELINES:
1. Grounded & Authoritative: Answer the user's inquiry with precision, using the verified facts and report sections provided above.
2. In-text Citations: When asserting key claims, cite the relevant source in markdown `[Source Name](url)` whenever matching sources are listed.
3. Honesty & Boundary Distinction: If the user asks about something not addressed in the research, state clearly that it was not covered in the original findings, then offer a reasoned analytical perspective if helpful.
4. Rich Formatting: Use clear markdown (bullet points, bold highlights, concise data tables where appropriate).
5. Directness: Avoid repetitive filler like "As an AI, I..." or "Based on the research report provided above...". Speak directly, authoritatively, and constructively.
6. Export & Download Capabilities: The platform HAS built-in automated PDF, DOCX, and Markdown export capabilities. NEVER state that you cannot generate or download files, and NEVER tell the user to use 'Ctrl + P' or browser print. Present the requested content cleanly and confirm that the download is prepared.
"""

                user_prompt = f"User Question: {user_message}"

                candidate_models = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash"]
                for model_name in candidate_models:
                    try:
                        resp = client.models.generate_content(
                            model=model_name,
                            contents=[
                                {"role": "user", "parts": [{"text": f"{system_prompt}\n\n{user_prompt}"}]}
                            ]
                        )
                        if resp.text:
                            source_refs = [
                                ChatSourceRef(
                                    title=s.get("title"),
                                    url=s.get("url"),
                                    domain=s.get("domain")
                                )
                                for s in sources[:5] if s.get("url")
                            ]
                            fact_claims = [f.get("claim") for f in facts[:5] if f.get("claim")]
                            return ChatResponse(
                                message=resp.text.strip(),
                                message_type="text",
                                sources=source_refs,
                                relevant_facts=fact_claims
                            )
                    except Exception as model_err:
                        logger.warning(f"ChatAgent model {model_name} failed: {model_err}. Trying fallback...")
            except Exception as e:
                logger.error(f"Error in ChatAgent Gemini client: {e}")

        # Fallback Algorithmic Response
        fallback_msg = f"### Research Findings on {topic}\n\n"
        if facts:
            fallback_msg += "**Direct Fact Findings:**\n"
            for f in facts[:4]:
                fallback_msg += f"- {f.get('claim')}\n"
            fallback_msg += "\n"
        if sections:
            sec = sections[0]
            fallback_msg += f"**From Section: {sec.get('title')}**\n{sec.get('content')[:400]}...\n\n"
        if sources:
            fallback_msg += "**Primary Sources:**\n"
            for s in sources[:3]:
                fallback_msg += f"- [{s.get('title')}]({s.get('url')})\n"

        return ChatResponse(
            message=fallback_msg.strip(),
            message_type="text",
            sources=[
                ChatSourceRef(title=s.get("title"), url=s.get("url"), domain=s.get("domain"))
                for s in sources[:3] if s.get("url")
            ],
            relevant_facts=[f.get("claim") for f in facts[:3] if f.get("claim")]
        )
