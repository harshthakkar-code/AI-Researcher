import re
import json
import logging
from typing import Dict, Any, List, Optional, Tuple
from app.config import settings
from app.agents.chat import ChatAgent
from app.agents.researcher import ResearcherAgent
from app.agents.writer import WriterAgent
from app.agents.validator import ValidatorAgent
from app.services.supabase import (
    get_job_details,
    get_report_for_research,
    save_report,
    update_research_config,
    add_agent_log,
    get_session_messages,
)
from app.models.schemas import ChatResponse, ChatSourceRef

logger = logging.getLogger(__name__)


class IntentRouter:
    """Intelligent intent classifier and orchestrator for autonomous research sessions.
    
    Classifies user messages into one or multiple actionable intents and coordinates
    parallel and sequential agent execution (research, validation, editing, Q&A).
    """

    def __init__(self):
        self.chat_agent = ChatAgent()
        self.researcher_agent = ResearcherAgent()
        self.writer_agent = WriterAgent()
        self.validator_agent = ValidatorAgent()

    async def classify_intents(
        self,
        user_message: str,
        topic: str,
        chat_history: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        """Uses Gemini with regex/heuristic fallback to identify distinct intents in user prompt."""
        if settings.gemini_api_key:
            try:
                from google import genai
                client = genai.Client(api_key=settings.gemini_api_key)

                history_context = ""
                if chat_history:
                    lines = []
                    for m in chat_history[-4:]:
                        role = "User" if m.get("role") == "user" else "Assistant"
                        content = m.get("content", "")
                        if len(content) > 280:
                            content = content[:280] + "..."
                        lines.append(f"{role}: {content}")
                    history_context = "\n".join(lines)

                prompt = f"""You are the Master Orchestration Router for an autonomous multi-agent research system.
Topic: "{topic}"
User Prompt: "{user_message}"

Recent Conversation Context:
{history_context or 'No previous messages in thread.'}

Classify this prompt into ONE OR MORE of the following operational intents (resolving references like "this", "it", or "the table above" using the conversation context):
1. "chat": The user is asking a question or seeking explanation/clarification from the existing research.
2. "research_request": The user wants to search, gather more sources, or investigate an additional angle or subtopic.
3. "edit_request": The user wants to modify, shorten, expand, translate, or reformat the current report.
4. "verify_request": The user wants to fact-check, verify claims, or check for inconsistencies.
5. "regenerate": The user wants a full regeneration/re-synthesis of the report.
6. "config_update": The user wants to adjust parameters (e.g., date ranges, depth, source policy).
7. "export_request": The user wants to create, download, save, or export a PDF, Word document, or table of a specific section or the entire report (e.g., "create pdf of this Letter M...", "download pdf of table", "export section as pdf").

Return a valid JSON array of objects with "intent" and relevant parameters ("inquiry", "instruction", "claim_query", "config", "target").
Example:
[
  {{"intent": "export_request", "target": "Letter M section"}},
  {{"intent": "chat", "inquiry": "explain spiritual depth"}}
]
"""
                resp = client.models.generate_content(
                    model="gemini-3.5-flash-lite",
                    contents=prompt
                )
                if resp.text:
                    match = re.search(r'\[[\s\S]*?\]', resp.text)
                    if match:
                        parsed = json.loads(match.group(0))
                        if isinstance(parsed, list) and len(parsed) > 0:
                            return parsed
            except Exception as e:
                logger.warning(f"Gemini intent classification fallback: {e}")

        # Heuristic Rule-Based Classification Fallback
        intents = []
        msg_lower = user_message.lower()

        # Check for export/pdf request FIRST before edit or chat
        if any(w in msg_lower for w in ["create pdf", "make pdf", "download pdf", "export pdf", "generate pdf", "save as pdf", "export as pdf", "get pdf", "give me pdf", "export to pdf", "pdf of this", "pdf of section", "download this as pdf", "make a pdf"]):
            intents.append({"intent": "export_request", "target": user_message})

        # Check for config update
        date_match = re.search(r'\b(202[4-9])\b', msg_lower)
        if any(w in msg_lower for w in ["only use", "date range", "from year", "filter by year"]):
            intents.append({
                "intent": "config_update",
                "config": {"date_from": f"{date_match.group(1)}-01-01" if date_match else None}
            })

        # Check for research request
        if any(w in msg_lower for w in ["find more", "look up", "search for", "collect more", "add source", "explore", "investigate"]):
            intents.append({"intent": "research_request", "inquiry": user_message})

        # Check for verification
        if any(w in msg_lower for w in ["verify", "fact check", "fact-check", "is it true", "validate", "check claim"]):
            intents.append({"intent": "verify_request", "claim_query": user_message})

        # Check for regenerate
        if any(w in msg_lower for w in ["regenerate", "re-create", "generate again", "rewrite completely"]):
            intents.append({"intent": "regenerate"})

        # Check for edit (only if not an export request)
        elif not any(i.get("intent") == "export_request" for i in intents) and any(w in msg_lower for w in ["make it concise", "shorten", "add table", "summarize into table", "translate", "edit report", "reformat"]):
            intents.append({"intent": "edit_request", "instruction": user_message})

        # If nothing specific was triggered, default to chat
        if not intents:
            intents.append({"intent": "chat", "inquiry": user_message})

        return intents

    @classmethod
    def extract_target_section(
        cls,
        report_markdown: str,
        user_message: str,
        default_title: str,
        chat_history: Optional[List[Dict[str, Any]]] = None
    ) -> Tuple[str, str]:
        """Extracts the specific requested heading/section or table from report markdown with multi-turn context."""
        if not report_markdown:
            return default_title, f"# {default_title}\n\nNo report content currently available."

        msg_clean = user_message.lower().strip()
        # If user message uses anaphoric pronouns ("this", "the table", "that"), enrich search with prior messages
        if chat_history and any(w in msg_clean for w in ["this", "it", "above", "mentioned", "previous", "that"]):
            for m in reversed(chat_history[-3:]):
                prev_text = (m.get("content") or "").lower()
                msg_clean += " " + prev_text

        lines = report_markdown.split("\n")

        # Parse markdown into heading-based sections
        sections: List[Tuple[str, int, str]] = []
        current_heading: Optional[str] = None
        current_level: int = 0
        current_lines: List[str] = []

        for line in lines:
            h_match = re.match(r'^(#{1,4})\s+(.+)$', line.strip())
            if h_match:
                if current_heading is not None:
                    sections.append((current_heading, current_level, "\n".join(current_lines).strip()))
                current_heading = h_match.group(2).strip()
                current_level = len(h_match.group(1))
                current_lines = [line]
            else:
                if current_lines or current_heading is not None:
                    current_lines.append(line)

        if current_heading is not None:
            sections.append((current_heading, current_level, "\n".join(current_lines).strip()))

        if not sections:
            return default_title, report_markdown

        # 1. Match against heading title (clean of markdown)
        best_section = None
        best_score = 0
        for title, level, content in sections:
            clean_title = re.sub(r'[*_#]', '', title).lower().strip()
            # If section title or significant subphrase appears in user message / context
            if clean_title in msg_clean:
                score = len(clean_title)
                if score > best_score:
                    best_score = score
                    best_section = (title, content)
            else:
                # Check for parts separated by colon, hyphen, or dash
                parts = [p.strip() for p in re.split(r'[:\-–—]', clean_title) if len(p.strip()) >= 3]
                for p in parts:
                    if p in msg_clean:
                        score = len(p)
                        if score > best_score:
                            best_score = score
                            best_section = (title, content)

        # 2. If user mentions table/data, prioritize sections that contain a markdown table
        if not best_section and any(w in msg_clean for w in ["table", "names", "data", "letter"]):
            for title, level, content in sections:
                if "|" in content:
                    best_section = (title, content)
                    break

        if best_section:
            clean_title = re.sub(r'[*_#]', '', best_section[0]).strip()
            return clean_title, best_section[1]

        # 3. Default fallback: return full report markdown
        return default_title, report_markdown

    async def execute(self, research_id: str, user_message: str) -> Dict[str, Any]:
        """Classifies and executes all intents, returning synthesized responses and document updates."""
        job = get_job_details(research_id) or {}
        topic = job.get("topic", "Research Workspace")
        current_report = get_report_for_research(research_id) or {}
        report_markdown = current_report.get("content_markdown", "")
        chat_history = get_session_messages(research_id, limit=8)

        intents = await self.classify_intents(user_message, topic, chat_history=chat_history)
        logger.info(f"Router identified intents for job {research_id}: {intents}")

        actions_taken = []
        new_sources = []
        new_facts = []
        report_updated = False
        revised_markdown = None
        assistant_notes = []
        export_payload = None

        # 1. Export Requests (Direct PDF / document generation of section or full report)
        export_intents = [i for i in intents if i.get("intent") == "export_request"]
        if export_intents:
            target_title, target_markdown = self.extract_target_section(
                report_markdown=report_markdown,
                user_message=user_message,
                default_title=current_report.get("title", f"Research: {topic}"),
                chat_history=chat_history
            )
            export_payload = {
                "title": target_title,
                "format": "pdf",
                "content_markdown": target_markdown,
            }
            actions_taken.append(f"Generated downloadable PDF for '{target_title}'")
            assistant_notes.append(f"📥 **Downloadable PDF Ready**: Prepared PDF for **{target_title}**.")

        # 2. Config Updates
        config_intents = [i for i in intents if i.get("intent") == "config_update"]
        for ci in config_intents:
            cfg = ci.get("config") or {}
            update_research_config(research_id, cfg)
            actions_taken.append("Updated research parameters")
            assistant_notes.append("⚙️ **Configuration Updated**: Adjusted parameters according to your specifications.")

        # 3. Research Requests (Gathering new evidence)
        research_intents = [i for i in intents if i.get("intent") == "research_request"]
        for ri in research_intents:
            inquiry = ri.get("inquiry", user_message)
            res_data = await self.researcher_agent.follow_up_research(research_id, inquiry)
            new_sources.extend(res_data.get("new_sources", []))
            new_facts.extend([f.get("claim") for f in res_data.get("new_facts", []) if f.get("claim")])
            actions_taken.append(f"Harvested {res_data.get('new_sources_count', 0)} sources")
            assistant_notes.append(
                f"🔍 **Research Expanded**: Harvested {res_data.get('new_sources_count', 0)} additional verified sources and extracted {res_data.get('new_facts_count', 0)} fresh claims."
            )

        # 4. Verification Requests
        verify_intents = [i for i in intents if i.get("intent") == "verify_request"]
        for vi in verify_intents:
            claim_q = vi.get("claim_query")
            val_data = await self.validator_agent.verify_specific_claims(research_id, claim_q)
            actions_taken.append(f"Verified {val_data.get('verified_count', 0)} claims")
            assistant_notes.append(f"✅ **Fact-Checking**: {val_data.get('summary')}")

        # 5. Full Regeneration
        regen_intents = [i for i in intents if i.get("intent") == "regenerate"]
        if regen_intents:
            from app.services.supabase import get_sources_for_research, get_facts_for_research
            fresh_sources = get_sources_for_research(research_id, limit=30)
            fresh_facts = get_facts_for_research(research_id, limit=40)
            revised_markdown = await self.writer_agent.generate_report(
                topic=topic,
                sources=fresh_sources,
                validated_facts=fresh_facts,
                conflicts=[]
            )
            report_updated = True
            save_report(research_id, current_report.get("title", f"Research Report: {topic}"), revised_markdown)
            actions_taken.append("Regenerated complete report")
            assistant_notes.append("📄 **Report Regenerated**: Built a completely fresh synthesis document incorporating all active evidence.")

        # 6. Targeted Report Editing (Only if NOT an export request and not already regenerated)
        edit_intents = [i for i in intents if i.get("intent") == "edit_request"]
        if edit_intents and not report_updated and not export_payload:
            instruction = edit_intents[0].get("instruction", user_message)
            revised_markdown, summary = await self.writer_agent.edit_report(
                original_markdown=report_markdown,
                instruction=instruction,
                topic=topic
            )
            report_updated = True
            save_report(research_id, current_report.get("title", f"Research Report: {topic}"), revised_markdown)
            actions_taken.append("Edited report")
            assistant_notes.append(f"✏️ **Document Revised**: {summary}")

        # If user solely asked to export/create a PDF, present the prepared document cleanly without LLM refusal
        has_active_exploration = bool(research_intents or verify_intents or regen_intents or (edit_intents and not export_payload))
        has_pure_chat_question = any(i.get("intent") == "chat" for i in intents) and not export_payload

        if export_payload and not has_active_exploration and not has_pure_chat_question:
            final_message = f"""Here is the complete formatted section and data table for **{export_payload['title']}**.

Click the **Download PDF** button below to download the publication-ready PDF document directly to your device.

***

{export_payload['content_markdown']}"""

            return {
                "message": final_message,
                "message_type": "finding",
                "intents": [i.get("intent") for i in intents],
                "actions_executed": actions_taken,
                "report_updated": False,
                "new_report_markdown": None,
                "sources": [],
                "relevant_facts": [],
                "export": export_payload,
            }

        # 7. Conversational Q&A / Synthesis
        chat_response = await self.chat_agent.answer(research_id, user_message)

        final_message = ""
        if assistant_notes:
            final_message += "\n\n".join(assistant_notes) + "\n\n---\n\n"
        final_message += chat_response.message

        # Compile sources
        all_sources = chat_response.sources
        for s in new_sources[:3]:
            all_sources.append(ChatSourceRef(title=s.get("title"), url=s.get("url"), domain=s.get("domain")))

        return {
            "message": final_message,
            "message_type": "finding" if (report_updated or export_payload) else "text",
            "intents": [i.get("intent") for i in intents],
            "actions_executed": actions_taken,
            "report_updated": report_updated,
            "new_report_markdown": revised_markdown if report_updated else None,
            "sources": all_sources,
            "relevant_facts": chat_response.relevant_facts + new_facts[:3],
            "export": export_payload,
        }


intent_router = IntentRouter()
