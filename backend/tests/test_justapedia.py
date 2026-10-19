import pytest
from app.services.justapedia_client import JustapediaClient
from app.config import settings

@pytest.mark.asyncio
async def test_justapedia_test_connection():
    client = JustapediaClient()
    try:
        res = await client.test_connection()
        assert res["connected"] is True
        assert res["sitename"] == "Justapedia"
        assert res["can_write"] is True
    finally:
        await client.close()

@pytest.mark.asyncio
async def test_justapedia_get_article():
    client = JustapediaClient()
    try:
        # Check an article that exists on Justapedia
        res = await client.get_article("Shannen Doherty")
        assert res["exists"] is True
        assert "Shannen Doherty" in res["title"]
        assert len(res["wikitext"]) > 500
    finally:
        await client.close()
