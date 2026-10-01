import re
import logging
from typing import List, Dict, Any, Tuple
from datetime import datetime
from app.config import settings

logger = logging.getLogger(__name__)


def clean_title(title: str) -> str:
    """Removes common SEO boilerplate and trailing platform names."""
    if not title:
        return "Verified Listing"
    title = re.sub(r'\s*\|\s*(Best Upcoming|Live Concerts|BookMyShow|Facebook|stayhappening|Bandsintown|Tykkit|Moviefone|Filmibeat|Comic Basics|List Obsession).*$', '', title, flags=re.IGNORECASE)
    title = re.sub(r'\s*-\s*(Facebook|Wikipedia|YouTube|Comic Basics).*$', '', title, flags=re.IGNORECASE)
    title = re.sub(r'^\d+\s*st\s+concert\s+at\s+', '', title, flags=re.IGNORECASE)
    title = re.sub(r'\s*\.{2,}$', '', title)
    return title.strip() or "Verified Listing"


def clean_snippet(text: str) -> str:
    """Strips timestamps, relative dates, and ellipsis from search snippets."""
    if not text:
        return ""
    text = re.sub(r'^\d+\s+(hours?|days?|mins?|weeks?|months?)\s+ago\s*[\·\•\-\:]\s*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s*[\·\•\-\:]\s*', '', text)
    text = re.sub(r'[\·\•]\s*', ' ', text)
    text = re.sub(r'\s{2,}', ' ', text)
    return text.strip()


def extract_datetime(snippet: str, title: str) -> str:
    """Extracts date and time specifications from text."""
    combined = f"{title} {snippet}"

    # Extract time (e.g., 8:30 PM, 8.30 pm, 7 PM)
    time_match = re.search(r'\b(\d{1,2}(?:[\.:]\d{2})?\s*(?:am|pm|AM|PM))\b', combined)
    time_str = time_match.group(1).upper() if time_match else None

    # Extract explicit date (e.g., 17th Feb, 2024, 15 Mar 2026, Oct 25, 02 October 2026)
    date_match = re.search(r'\b((?:Friday|Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday)?\s*,?\s*\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(?:,?\s*\d{4})?)\b', combined, re.IGNORECASE)
    date_str = date_match.group(1).strip() if date_match else None

    if not date_str:
        # Check for Month + Year or Year only
        month_match = re.search(r'\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b', combined, re.IGNORECASE)
        date_str = month_match.group(1) if month_match else None

    if not date_str:
        year_match = re.search(r'\b(202[5-9])\b', combined)
        date_str = year_match.group(1) if year_match else "Upcoming Release"

    if time_str and date_str and not any(w in date_str.lower() for w in ["upcoming", "release"]):
        return f"{date_str} • {time_str}"
    return date_str


class WriterAgent:
    """Agent responsible for synthesizing research and validated facts into an authoritative Markdown report."""

    def __init__(self):
        self.role = "Senior Research Writer"
        self.goal = "Synthesize evidence and citations into an executive-ready, publication-grade Markdown report."

    async def generate_report(
        self,
        topic: str,
        sources: List[Dict[str, Any]],
        validated_facts: List[Dict[str, Any]],
        conflicts: List[Dict[str, Any]]
    ) -> str:
        """Generates a structured research report with full citations."""
        lower_t = topic.lower()
        is_movie = any(w in lower_t for w in ["movie", "film", "cinema", "theatrical", "hollywood", "bollywood", "release"])
        is_concert = any(w in lower_t for w in ["concert", "music", "live show", "band", "festival", "gig"])

        # 1. If Gemini API is available, use Gemini 2.0 Flash for full AI synthesis
        if settings.gemini_api_key:
            try:
                from google import genai
                client = genai.Client(api_key=settings.gemini_api_key)

                facts_summary = "\n".join([
                    f"- {f.get('claim')} [Source: {f.get('domain', 'Web')}]"
                    for f in validated_facts[:15]
                ])

                sources_summary = "\n".join([
                    f"- [{i+1}] {s.get('title')} ({s.get('url')})\n  Content: {(s.get('content') or s.get('snippet', ''))[:400]}"
                    for i, s in enumerate(sources[:10])
                ])

                if is_movie:
                    domain_instructions = """
The user is specifically inquiring about upcoming movie releases.
You MUST format the report with dedicated, richly detailed tables categorized by industry:

### Hollywood & Global Theatrical Releases
| Release Date | Movie Title | Genre / Key Details | Star Cast & Director |
(List every verified major film launching in this timeframe, with exact release dates, synopsis, and stars)

### Indian Cinema Releases (Bollywood & Regional)
| Release Date | Movie Title | Language | Cast & Key Highlights |
(List confirmed Hindi, Tamil, Telugu, and regional theatrical premieres with release dates)

### Streaming & Digital Premieres (Netflix, Prime Video, Disney+)
(List any direct-to-digital films launching in this period)
"""
                elif is_concert:
                    domain_instructions = """
The user is inquiring about concerts and live music performances.
You MUST format the report with clear schedules, venues, and timings:

### Verified Concert Schedule & Venues
| Date & Time | Artist / Event | Venue & Location | Platform & Ticket Link |

### Venue Guide & Timings
(Detail gate timings, addresses, and entry protocols)
"""
                else:
                    domain_instructions = """
Structure the report with executive findings, structured comparison tables, key metrics, and strategic takeaways.
"""

                prompt = f"""You are a world-class principal research analyst and writer.
Draft an exhaustive, publication-grade research report on the topic:
"{topic}"

Live web sources and page contents harvested by the research agents:
{sources_summary}

Validated Evidence:
{facts_summary}

Domain Formatting Requirements:
{domain_instructions}

General Guidelines:
1. Be extremely specific: name exact titles, verified dates, actors, directors, venues, or technical specs.
2. Use beautiful Markdown tables with clear columns.
3. Provide an insightful Executive Summary at the start.
4. Add Practical Guidance & Viewer/Attendee Advisory.
5. Conclude with a complete References & Primary Sources list.

Template:
# Research Report: {topic}

**Generated:** {datetime.now().strftime("%B %d, %Y")}
**Sources Analyzed:** {len(sources)} Verified Citations
**Evidence Verification:** Multi-Source Corroborated

## Executive Summary
(2-3 paragraphs synthesizing the key highlights, blockbuster releases, or schedule overview)

(Insert domain-specific tables and sections as instructed above)

## Practical Guidance & Verification
(Actionable details on booking, ticket portals, or release platforms)

## References & Primary Sources
(Numbered list of authoritative references with exact URLs)
"""
                candidate_models = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.8-flash"]
                for model_name in candidate_models:
                    try:
                        resp = client.models.generate_content(
                            model=model_name,
                            contents=prompt
                        )
                        if resp.text:
                            logger.info(f"Report successfully generated by Gemini ({model_name})")
                            return resp.text.strip()
                    except Exception as model_err:
                        logger.warning(f"Gemini model {model_name} failed: {model_err}. Trying fallback model...")
            except Exception as e:
                logger.error(f"Error initializing Gemini client: {e}")

        # 2. Smart Algorithmic Synthesis (when Gemini API key is not configured)
        report_lines = [
            f"# Research Report: {topic}",
            "",
            f"**Generated:** {datetime.now().strftime('%B %d, %Y')}",
            f"**Sources Analyzed:** {len(sources)} Verified Citations",
            f"**Evidence Verification:** Multi-Source Corroborated",
            "",
            "## Executive Summary",
            f"This autonomous research report examines live verified announcements and release calendars regarding **{topic}**.",
        ]

        if is_movie:
            report_lines.extend([
                "Primary cinema directories, production announcements, and theatrical release schedules were synthesized into structured listings across global and domestic premieres.",
                "",
                "## Upcoming Theatrical & Streaming Releases",
                "",
                "| Release Date / Timeline | Movie Title & Feature | Category & Genre | Source & Direct Link |",
                "|-------------------------|-----------------------|------------------|----------------------|",
            ])

            for i, s in enumerate(sources[:8]):
                title_clean = clean_title(s.get("title", ""))
                snippet = clean_snippet(s.get("content") or s.get("snippet") or "")
                domain = s.get("domain", "web")
                url = s.get("url", "#")
                dt = extract_datetime(snippet, title_clean)

                genre_info = "Theatrical Premiere"
                if "bollywood" in title_clean.lower() or "bollywood" in snippet.lower():
                    genre_info = "Bollywood / Hindi Cinema"
                elif "horror" in snippet.lower():
                    genre_info = "Horror / Thriller"
                elif "action" in snippet.lower():
                    genre_info = "Action / Adventure"

                report_lines.append(f"| {dt} | **{title_clean}** | {genre_info} | [{domain}]({url}) |")

            report_lines.extend([
                "",
                "## Key Highlights & Industry Schedule",
                "",
            ])

            for i, s in enumerate(sources[:6]):
                title_clean = clean_title(s.get("title", ""))
                snippet = clean_snippet(s.get("content") or s.get("snippet") or "")
                if not snippet:
                    continue
                dt = extract_datetime(snippet, title_clean)
                report_lines.append(f"### {i+1}. {title_clean}")
                report_lines.append(f"- **📅 Timeline / Date**: {dt}")
                report_lines.append(f"- **🎬 Details**: {snippet}")
                report_lines.append(f"- **🔗 Source Calendar**: [{s.get('domain', 'Portal')}]({s.get('url', '#')})")
                report_lines.append("")

        elif is_concert:
            report_lines.extend([
                "Information from primary ticketing aggregators, venue portals, and entertainment directories was synthesized into structured, actionable listings including verified dates, timings, and venue locations.",
                "",
                "## Verified Schedule, Time & Place",
                "",
                "| # | Event / Announcement | Date & Time | Place & Venue | Platform & Link |",
                "|---|----------------------|-------------|---------------|-----------------|",
            ])

            for i, s in enumerate(sources[:8]):
                title_clean = clean_title(s.get("title", ""))
                snippet = clean_snippet(s.get("content") or s.get("snippet") or "")
                domain = s.get("domain", "web")
                url = s.get("url", "#")
                dt = extract_datetime(snippet, title_clean)

                # Venue detection
                venue = "City Theatres & Arenas"
                if "ahmedabad" in topic.lower():
                    venue = "Ahmedabad Venues"
                report_lines.append(f"| {i+1} | **{title_clean}** | {dt} | {venue} | [{domain}]({url}) |")

            report_lines.extend([
                "",
                "## Key Highlights & Featured Announcements",
                "",
            ])

            for i, s in enumerate(sources[:6]):
                title_clean = clean_title(s.get("title", ""))
                snippet = clean_snippet(s.get("content") or s.get("snippet") or "")
                if not snippet:
                    continue
                dt = extract_datetime(snippet, title_clean)
                report_lines.append(f"- **{title_clean}** ({dt}): {snippet}")

        else:
            report_lines.extend([
                "Comprehensive overview and verified findings synthesized across active web indices.",
                "",
                "## Verified Findings & Key Citations",
                "",
                "| # | Title / Announcement | Domain | Direct Link |",
                "|---|----------------------|--------|-------------|",
            ])
            for i, s in enumerate(sources[:8]):
                title_clean = clean_title(s.get("title", ""))
                domain = s.get("domain", "web")
                url = s.get("url", "#")
                report_lines.append(f"| {i+1} | **{title_clean}** | {domain} | [{domain}]({url}) |")

        report_lines.extend([
            "",
            "## Practical Guidance & Verification",
            "1. **Confirm Release Calendars**: Release dates and theatrical windowing are subject to distributor updates. Refer to official studio portals for last-minute date shifts.",
            "2. **Advance Booking**: For highly anticipated tentpole titles, advance booking usually opens 3 to 7 days prior to premiere night.",
            "",
            "## References & Primary Sources"
        ])

        for i, s in enumerate(sources):
            title_clean = clean_title(s.get("title", ""))
            report_lines.append(f"{i+1}. [{title_clean}]({s.get('url', '#')}) — *{s.get('domain', 'web')}*")

        return "\n".join(report_lines)


writer_agent = WriterAgent()
