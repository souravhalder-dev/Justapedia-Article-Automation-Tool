import pytest
from app.services.ai_service import ai_service
from app.config import settings

@pytest.mark.asyncio
async def test_ollama_connectivity_offline():
    # Testing an unreachable port should return connected: False gracefully without throwing an unhandled exception
    res = await ai_service.test_ollama(base_url="http://127.0.0.1:54321")
    assert res["connected"] is False
    assert "Could not connect" in res["message"] or "error" in res["message"].lower()

@pytest.mark.asyncio
async def test_analyze_and_draft_fallback_to_free_synthesizer():
    # When Ollama is offline or Gemini is unset, it must fall back to the built-in free synthesizer
    settings.AI_PROVIDER = "ollama"
    settings.OLLAMA_BASE_URL = "http://127.0.0.1:54321"  # dummy offline port
    
    result = await ai_service.analyze_and_draft(
        title="John Doe",
        original_wikitext="'''John Doe''' is an American actor.",
        sources=[],
        wikidata_facts={"birth_date": "1940-01-01", "death_date": "2024-05-01"},
        is_deceased=True
    )
    assert result is not None
    assert "generated_draft" in result
    assert "was an American actor" in result["generated_draft"]
