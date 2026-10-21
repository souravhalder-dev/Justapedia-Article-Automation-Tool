import pytest
from app.services.ai_service import (
    parse_date_components,
    format_wiki_birth_date,
    format_wiki_death_date,
    format_american_location,
    ai_service
)

def test_parse_date_components():
    assert parse_date_components("1949-07-07") == (1949, 7, 7)
    assert parse_date_components("July 11, 2024") == (2024, 7, 11)
    assert parse_date_components("January 1, 1950") == (1950, 1, 1)
    assert parse_date_components(None) is None

def test_format_wiki_birth_date():
    # For deceased individuals: {{birth date|...}} without 'and age' per MOS:DATE
    assert format_wiki_birth_date("1949-07-07", is_deceased=True) == "{{birth date|1949|7|7}}"
    # For living individuals: {{birth date and age|...}}
    assert format_wiki_birth_date("1949-07-07", is_deceased=False) == "{{birth date and age|1949|7|7}}"
    assert format_wiki_birth_date("1949", is_deceased=True) == "1949"

def test_format_wiki_death_date():
    # When both birth and death are known, use {{death date and age}} with 6 parameters
    assert format_wiki_death_date("2024-07-11", "1949-07-07") == "{{death date and age|2024|7|11|1949|7|7}}"
    # When birth is unknown, use {{death date}} with 3 parameters
    assert format_wiki_death_date("2024-07-11", "") == "{{death date|2024|7|11}}"
    assert format_wiki_death_date("2024", "") == "2024"

def test_format_american_location():
    assert format_american_location("Blanco, Texas, United States") == "Blanco, Texas, U.S."
    assert format_american_location("New York City, NY, USA") == "New York City, NY, U.S."
    assert format_american_location("London, England") == "London, England"

@pytest.mark.asyncio
async def test_fallback_synthesizer_generates_infobox_with_american_conventions():
    wikidata_facts = {
        "birth_date": "1940-05-12",
        "death_date": "2024-03-15",
        "death_place": "Austin, Texas, United States",
        "cause_of_death": "Cardiac arrest",
        "occupations": ["actor", "director"]
    }
    raw_article = "'''Test Subject''' (born May 12, 1940) is an American actor."
    
    result = await ai_service.analyze_and_draft(
        title="Test Subject",
        original_wikitext=raw_article,
        sources=[],
        wikidata_facts=wikidata_facts,
        is_deceased=True
    )
    draft = result["generated_draft"]
    
    # Check Infobox person exists
    assert "{{Infobox person" in draft
    assert "| death_date         = {{death date and age|2024|3|15|1940|5|12}}" in draft
    assert "| birth_date         = {{birth date|1940|5|12}}" in draft
    # Check American location formatting (U.S.)
    assert "| death_place        = Austin, Texas, U.S." in draft
    assert "| death_cause        = Cardiac arrest" in draft
    # Check tense conversion
    assert "was an American actor" in draft
    # Check category updates
    assert "[[Category:2024 deaths]]" in draft

@pytest.mark.asyncio
async def test_original_wording_synthesis_no_verbatim_copy():
    # Provide raw copyrighted text in research context
    raw_copyrighted_source = "HE TRAGICALLY PERISHED FROM MASSIVE HEART COMPLICATIONS AFTER COLLAPSING AT HOME."
    
    wikidata_facts = {
        "birth_date": "1940-05-12",
        "death_date": "2024-03-15",
        "death_place": "Austin, Texas, United States",
        "cause_of_death": "cardiac arrest"
    }
    raw_article = "{{Infobox person\n| name = Arthur Pendelton\n}}\n'''Arthur Pendelton''' is an American writer."
    
    sources = [{
        "url": "https://example.com/pendelton-obit",
        "title": "Arthur Pendelton Obituary",
        "publisher": "The Washington Post"
    }]
    
    result = await ai_service.analyze_and_draft(
        title="Arthur Pendelton",
        original_wikitext=raw_article,
        sources=sources,
        wikidata_facts=wikidata_facts,
        is_deceased=True,
        research_context={"death_section_text": raw_copyrighted_source}
    )
    draft = result["generated_draft"]
    
    # 1. Verbatim raw copyrighted text must NEVER appear in the draft
    assert raw_copyrighted_source not in draft
    assert "HE TRAGICALLY PERISHED" not in draft
    
    # 2. Content must be synthesized in original wording with facts preserved
    assert "== Illness and death ==" in draft
    assert "died on March 15, 2024 in Austin, Texas, U.S. at the age of 83." in draft
    assert "cause of death was cardiac arrest" in draft
    
    # 3. Reliable inline citation must be attached
    assert "<ref>{{cite web |url=https://example.com/pendelton-obit" in draft
