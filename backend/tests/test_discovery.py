import pytest
import json
from unittest.mock import AsyncMock, patch
from app.services.discovery_service import DiscoveryService
from app.models import ArticleJob
from app.database import AsyncSessionLocal, init_db

@pytest.mark.asyncio
async def test_is_list_or_meta_page():
    assert DiscoveryService.is_list_or_meta_page("Deaths in 2024") is True
    assert DiscoveryService.is_list_or_meta_page("Deaths in April 2024") is True
    assert DiscoveryService.is_list_or_meta_page("List of actors who died in 2024") is True
    assert DiscoveryService.is_list_or_meta_page("Timeline of 2024") is True
    assert DiscoveryService.is_list_or_meta_page("Category:2024 deaths") is True
    assert DiscoveryService.is_list_or_meta_page("Shelley Duvall") is False
    assert DiscoveryService.is_list_or_meta_page("Toby Keith") is False

def test_build_deceased_categories():
    cats = DiscoveryService._build_deceased_categories("Category:2024 deaths")
    assert "Category:2024 deaths" in cats
    assert "Category:Deaths in 2024" in cats
    assert "Category:2023 deaths" in cats

    cats_empty = DiscoveryService._build_deceased_categories(None)
    assert len(cats_empty) >= 4

@pytest.mark.asyncio
async def test_filter_incomplete_only_skips_complete_articles():
    await init_db()
    async with AsyncSessionLocal() as session:
        # Fully documented complete biography wikitext (> 800 chars, citations, all dates)
        complete_wikitext = """{{Infobox person
| name = Jane Complete
| birth_date = {{birth date|1950|1|1}}
| death_date = {{death date and age|2024|2|2|1950|1|1}}
| death_cause = Cardiac arrest
| death_place = New York, NY
}}
Jane Complete (January 1, 1950 - February 2, 2024) was an American author who published numerous novels and essays throughout her distinguished forty-year career. She received multiple national and international literary awards for her contributions to modern literature.

== Early life and education ==
She was born in New York City and attended Columbia University, graduating with honors in comparative literature.

== Career ==
She had a long career in writing and was appointed professor of literature.<ref>https://example.com/source1</ref><ref>https://example.com/source2</ref><ref>https://example.com/source3</ref>

== References ==
{{reflist}}
"""
        complete_categories = ["Category:2024 deaths", "Category:American authors"]

        with patch("app.services.discovery_service.justapedia_client.get_article", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = {
                "exists": True,
                "title": "Jane Complete",
                "wikitext": complete_wikitext,
                "categories": complete_categories,
                "revid": 123,
                "timestamp": "2024-03-01T00:00:00Z"
            }
            # When filter_incomplete_only is True, complete article should be skipped (returns None)
            job = await DiscoveryService._process_and_store_article(
                db=session,
                title="Jane Complete",
                mode="deceased",
                category="Category:2024 deaths",
                filter_incomplete_only=True
            )
            assert job is None

            # Now an incomplete article missing death date
            incomplete_wikitext = """{{Infobox person
| name = John Incomplete
| birth_date = {{birth date|1950|1|1}}
}}
John Incomplete (born January 1, 1950) was an actor who died in 2024.
== References ==
{{reflist}}
"""
            mock_get.return_value = {
                "exists": True,
                "title": "John Incomplete",
                "wikitext": incomplete_wikitext,
                "categories": ["Category:2024 deaths"],
                "revid": 124,
                "timestamp": "2024-03-01T00:00:00Z"
            }
            # Should be retained because missing_death_date is an update gap
            job_incomplete = await DiscoveryService._process_and_store_article(
                db=session,
                title="John Incomplete",
                mode="deceased",
                category="Category:2024 deaths",
                filter_incomplete_only=True
            )
            assert job_incomplete is not None
            assert job_incomplete.title == "John Incomplete"
            flags = json.loads(job_incomplete.audit_flags)
            assert "missing_death_date" in flags
