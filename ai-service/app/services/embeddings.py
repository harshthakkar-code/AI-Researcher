import logging
from typing import List, Optional
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.config import settings

logger = logging.getLogger(__name__)

_gemini_client = None


def get_genai_client():
    global _gemini_client
    if _gemini_client is None:
        if not settings.gemini_api_key:
            return None
        from google import genai
        _gemini_client = genai.Client(api_key=settings.gemini_api_key)
    return _gemini_client


class EmbeddingService:
    """Production embedding generator using Gemini embedding models with 768-dim output."""

    @classmethod
    @retry(
        reraise=True,
        stop=stop_after_attempt(4),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    def embed_text(cls, text: str) -> List[float]:
        """Generates a 768-dimension embedding for a single text chunk or query."""
        client = get_genai_client()
        if not client:
            # Fallback deterministic mock for development
            logger.warning("No GEMINI_API_KEY set. Returning deterministic mock embedding.")
            return [0.0] * settings.embedding_dimension

        from google.genai import types

        config = types.EmbedContentConfig(
            output_dimensionality=settings.embedding_dimension
        )

        res = client.models.embed_content(
            model=settings.embedding_model,
            contents=text,
            config=config
        )
        return res.embeddings[0].values

    @classmethod
    def embed_batch(cls, texts: List[str], batch_size: int = 25) -> List[List[float]]:
        """Embeds a list of texts using batch content calls with exponential backoff for rate limits."""
        if not texts:
            return []

        client = get_genai_client()
        if not client:
            return [[0.0] * settings.embedding_dimension for _ in texts]

        import time
        from google.genai import types

        all_embeddings: List[List[float]] = []
        config = types.EmbedContentConfig(
            output_dimensionality=settings.embedding_dimension
        )

        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            
            # Helper to execute batch call with retry on 429
            def _call_with_retry(attempts=4):
                delay = 4.0
                for attempt in range(attempts):
                    try:
                        return client.models.embed_content(
                            model=settings.embedding_model,
                            contents=batch,
                            config=config
                        )
                    except Exception as e:
                        if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                            logger.warning(f"Rate limited (429). Retrying in {delay:.1f}s (attempt {attempt+1}/{attempts})...")
                            time.sleep(delay)
                            delay *= 2.0
                        else:
                            raise e
                # Final attempt
                return client.models.embed_content(
                    model=settings.embedding_model,
                    contents=batch,
                    config=config
                )

            res = _call_with_retry()
            for emb in res.embeddings:
                all_embeddings.append(emb.values)

            # Polite delay between batches to respect RPM quotas
            time.sleep(0.8)

        return all_embeddings


embedding_service = EmbeddingService()

