import io
import re
import pymupdf as fitz
import logging
from typing import List, Dict, Any, Optional, Tuple
from app.services.embeddings import embedding_service
from app.services.supabase import (
    update_document,
    create_ingestion_job,
    update_ingestion_progress,
    bulk_insert_document_chunks,
)
from app.models.schemas import DocumentPreviewResponse

logger = logging.getLogger(__name__)


class DocumentIngestionService:
    """Production PDF ingestion, structure detection, chunking, and embedding pipeline."""

    @classmethod
    def validate_and_inspect(cls, file_bytes: bytes, filename: str) -> Tuple[bool, str, Dict[str, Any]]:
        """Validates PDF integrity and inspects text density."""
        if not file_bytes.startswith(b"%PDF-"):
            return False, "File is not a valid PDF (missing %PDF- magic bytes)", {}

        try:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            total_pages = len(doc)
            if total_pages == 0:
                return False, "PDF contains zero pages", {}

            # Measure character density across first 10 pages
            sample_count = min(10, total_pages)
            total_chars = 0
            for i in range(sample_count):
                total_chars += len(doc[i].get_text("text").strip())

            avg_chars = total_chars / sample_count if sample_count > 0 else 0
            is_scanned = avg_chars < 40

            stats = {
                "total_pages": total_pages,
                "avg_chars_per_page": avg_chars,
                "is_scanned": is_scanned,
                "encrypted": doc.is_encrypted,
            }
            return True, "Valid PDF", stats
        except Exception as e:
            return False, f"Failed to parse PDF: {str(e)}", {}

    @classmethod
    def generate_preview(cls, file_bytes: bytes, filename: str, doc_id: str) -> DocumentPreviewResponse:
        """Inspects PDF layout and produces preview metrics before embedding generation."""
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        total_pages = len(doc)

        detected_chapters = set()
        detected_verses = set()
        sample_headings = []
        total_chars = 0

        # Scan across pages to detect structural pattern
        for page_idx in range(total_pages):
            text = doc[page_idx].get_text("text")
            total_chars += len(text)

            # Match Chapter headers (e.g., "Chapter 1 – Arjuna’s Distress")
            ch_match = re.search(r'Chapter\s+(\d+)\s*[–\-:]\s*([^\n\r]+)', text, re.IGNORECASE)
            if ch_match:
                ch_num = ch_match.group(1)
                detected_chapters.add(ch_num)
                if len(sample_headings) < 6:
                    sample_headings.append(f"Chapter {ch_num}: {ch_match.group(2).strip()}")

            # Match Section headers like "Duty is Worship", "The Soul is Eternal"
            sec_matches = re.findall(r'^[A-Z][A-Za-z0-9 ,’\'-]{4,45}$', text, re.MULTILINE)
            for sm in sec_matches:
                if sm.strip() and not sm.strip().startswith("Chapter") and sm.strip() not in sample_headings:
                    if len(sample_headings) < 8:
                        sample_headings.append(sm.strip())

            # Match Verse notations (e.g. "(1.1)", "(2.47)", "(18.66)")
            v_matches = re.findall(r'\((\d{1,2})\.(\d{1,2})\)', text)
            for vm in v_matches:
                detected_verses.add(f"{vm[0]}.{vm[1]}")

        avg_chars = total_chars / total_pages if total_pages > 0 else 0
        text_quality = "Good (Selectable Text)" if avg_chars > 80 else "Low (Possible Scan)"
        
        # Estimate chunks
        estimated_chunks = max(len(detected_verses), int(total_pages * 0.95))
        estimated_tokens = estimated_chunks * 650

        detected_edition = "Verse-Purport Format with Commentary" if len(detected_verses) > 20 else "Standard Document Layout"

        return DocumentPreviewResponse(
            document_id=doc_id,
            filename=filename,
            total_pages=total_pages,
            text_quality=text_quality,
            characters_per_page_avg=round(avg_chars, 1),
            detected_edition=detected_edition,
            detected_chapters=len(detected_chapters),
            detected_verses=len(detected_verses),
            sample_headings=sample_headings[:6],
            estimated_chunks=estimated_chunks,
            estimated_tokens=estimated_tokens
        )

    @classmethod
    def chunk_document(
        cls,
        doc: fitz.Document,
        document_id: str,
        user_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Adaptive chunker designed for Bhagavad Gita and general structured texts.
        
        Preserves Verse Number, Chapter, Section Headings, and commentary blocks.
        """
        chunks: List[Dict[str, Any]] = []
        current_chapter = "1"
        current_section = "Introduction"
        chunk_index = 0

        for page_idx in range(len(doc)):
            page_num = page_idx + 1
            raw_text = doc[page_idx].get_text("text")
            if not raw_text.strip():
                continue

            # Update current Chapter if page contains a new Chapter header
            ch_match = re.search(r'Chapter\s+(\d+)', raw_text, re.IGNORECASE)
            if ch_match:
                current_chapter = ch_match.group(1)

            # Check for Section title (short isolated line)
            lines = [l.strip() for l in raw_text.splitlines() if l.strip()]
            for l in lines[:5]:
                if len(l) < 50 and not l.startswith("Chapter") and not l.isdigit() and "Bhagavad Gita" not in l:
                    current_section = l
                    break

            # Handle "Summary of Chapter X"
            if "Summary of Chapter" in raw_text:
                summary_start = raw_text.find("Summary of Chapter")
                summary_content = raw_text[summary_start:].strip()
                chunks.append({
                    "document_id": document_id,
                    "user_id": user_id,
                    "chunk_index": chunk_index,
                    "page_number": page_num,
                    "chapter": current_chapter,
                    "verse": "summary",
                    "section_title": f"Summary of Chapter {current_chapter}",
                    "language": "en",
                    "content": f"[Bhagavad Gita - Chapter {current_chapter} Summary | Page {page_num}]\n{summary_content}",
                    "token_count": len(summary_content.split()),
                    "metadata": {"type": "chapter_summary", "page": page_num, "chapter": current_chapter}
                })
                chunk_index += 1
                continue

            # Detect verse blocks using verse markers: (Chapter.Verse)
            verse_matches = list(re.finditer(r'\((\d{1,2})\.(\d{1,2})\)', raw_text))

            if verse_matches:
                # Segment page by verses
                for i, vm in enumerate(verse_matches):
                    ch_num = vm.group(1)
                    v_num = vm.group(2)
                    start_pos = 0 if i == 0 else verse_matches[i - 1].end()
                    end_pos = verse_matches[i + 1].start() if i + 1 < len(verse_matches) else len(raw_text)

                    verse_chunk_text = raw_text[start_pos:end_pos].strip()
                    # Clean repeated running headers & footers
                    verse_chunk_text = re.sub(r'The Bhagavad Gita\s*\d*', '', verse_chunk_text)
                    verse_chunk_text = re.sub(r'Chapter\s*\d+\s*\d*', '', verse_chunk_text)

                    header = f"[Bhagavad Gita - Chapter {ch_num}, Verse {v_num} | Section: {current_section} | Page {page_num}]"
                    full_content = f"{header}\n{verse_chunk_text}"

                    chunks.append({
                        "document_id": document_id,
                        "user_id": user_id,
                        "chunk_index": chunk_index,
                        "page_number": page_num,
                        "chapter": ch_num,
                        "verse": v_num,
                        "section_title": current_section,
                        "language": "en",
                        "content": full_content,
                        "token_count": len(full_content.split()),
                        "metadata": {
                            "chapter": ch_num,
                            "verse": v_num,
                            "section": current_section,
                            "page": page_num
                        }
                    })
                    chunk_index += 1
            else:
                # General paragraph chunking fallback (for Introduction, Foreword, etc.)
                cleaned = re.sub(r'The Bhagavad Gita\s*\d*', '', raw_text)
                cleaned = re.sub(r'Introduction\s*\d*', '', cleaned)
                paragraphs = [p.strip() for p in cleaned.split("\n\n") if len(p.strip()) > 80]

                for p in paragraphs:
                    header = f"[Bhagavad Gita - Chapter {current_chapter} | Section: {current_section} | Page {page_num}]"
                    content = f"{header}\n{p}"
                    chunks.append({
                        "document_id": document_id,
                        "user_id": user_id,
                        "chunk_index": chunk_index,
                        "page_number": page_num,
                        "chapter": current_chapter,
                        "verse": None,
                        "section_title": current_section,
                        "language": "en",
                        "content": content,
                        "token_count": len(content.split()),
                        "metadata": {"page": page_num, "chapter": current_chapter, "section": current_section}
                    })
                    chunk_index += 1

        return chunks

    @classmethod
    async def process_document_background(
        cls,
        document_id: str,
        file_bytes: bytes,
        job_id: str,
        user_id: Optional[str] = None
    ) -> None:
        """Executes full background ingestion: Extract -> Chunk -> Embed -> Index."""
        try:
            update_ingestion_progress(job_id, "validating", "Validating PDF format", 10)
            valid, msg, stats = cls.validate_and_inspect(file_bytes, "document.pdf")
            if not valid:
                raise ValueError(msg)

            update_ingestion_progress(job_id, "extracting", "Extracting pages & structure", 25, pages_processed=stats.get("total_pages", 0))
            doc = fitz.open(stream=file_bytes, filetype="pdf")

            update_ingestion_progress(job_id, "chunking", "Creating verse-aware chunks", 45)
            chunks = cls.chunk_document(doc, document_id, user_id=user_id)
            total_chunks = len(chunks)

            if total_chunks == 0:
                raise ValueError("No text content could be extracted from this PDF.")

            update_ingestion_progress(
                job_id,
                "embedding",
                f"Generating embeddings (0/{total_chunks})",
                55,
                chunks_created=total_chunks
            )

            # Generate batch embeddings with progress reporting
            texts_to_embed = [c["content"] for c in chunks]
            batch_size = 25
            all_embeddings = []

            for idx in range(0, total_chunks, batch_size):
                batch_texts = texts_to_embed[idx:idx + batch_size]
                batch_embeddings = embedding_service.embed_batch(batch_texts)
                all_embeddings.extend(batch_embeddings)

                progress = 55 + int((len(all_embeddings) / total_chunks) * 35)
                update_ingestion_progress(
                    job_id,
                    "embedding",
                    f"Generating embeddings ({len(all_embeddings)}/{total_chunks})",
                    progress,
                    embeddings_created=len(all_embeddings)
                )

            # Attach embeddings to chunks
            for i, chunk in enumerate(chunks):
                chunk["embedding"] = all_embeddings[i]

            update_ingestion_progress(job_id, "indexing", "Inserting into vector database", 92)
            bulk_insert_document_chunks(chunks)

            # Mark complete
            update_ingestion_progress(
                job_id,
                "completed",
                "Document fully indexed & ready for RAG search",
                100,
                pages_processed=len(doc),
                chunks_created=total_chunks,
                embeddings_created=len(all_embeddings)
            )

            update_document(document_id, {
                "status": "indexed",
                "total_pages": len(doc),
                "total_chunks": total_chunks,
                "detected_structure": {
                    "total_verses_extracted": total_chunks,
                    "format": "adaptive_verse_purport"
                }
            })
            logger.info(f"Successfully indexed document {document_id} with {total_chunks} chunks.")

        except Exception as e:
            logger.error(f"Ingestion job failed for {document_id}: {e}", exc_info=True)
            update_ingestion_progress(job_id, "failed", f"Failed: {str(e)}", 100, error=str(e))
            update_document(document_id, {
                "status": "failed",
                "error_message": str(e)
            })


ingestion_service = DocumentIngestionService()
