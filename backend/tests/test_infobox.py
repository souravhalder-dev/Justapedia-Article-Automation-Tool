import pytest
from app.services.ai_service import (
    parse_date_components,
    format_wiki_birth_date,
    format_wiki_death_date,
    format_american_location,
    rewrite_article_prose,
    synthesize_original_death_section,
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

def test_rewrite_article_prose_converts_spelling_and_dates():
    raw_wikitext = (
        "{{short description|English actor}}\n"
        "{{use dmy dates|date=July 2020}}\n"
        "'''Geoffrey Stone''' (born 15 June 1945) is an English actor who has appeared in the [[National Theatre]]. "
        "His favourite colour was featured in a television programme. On 11 July 2024, he passed away.<ref>{{cite web |title=Honour}}</ref>"
    )
    rewritten = rewrite_article_prose(
        draft=raw_wikitext,
        title="Geoffrey Stone",
        is_deceased=True,
        birth_date="1945-06-15",
        death_date="2024-07-11"
    )

    # Wikipedia maintenance templates must be removed
    assert "{{short description" not in rewritten
    assert "{{use dmy dates" not in rewritten

    # British spelling in prose must be normalized to American spelling
    assert "favorite" in rewritten
    assert "favourite" not in rewritten
    assert "color" in rewritten
    assert "colour" not in rewritten
    assert "program" in rewritten
    assert "programme" not in rewritten

    # Dates in prose normalized to American Month Day, Year
    assert "July 11, 2024" in rewritten
    assert "11 July 2024" not in rewritten

    # Tense conversion for deceased subject
    assert "was an English actor" in rewritten

    # Lead lifetime format
    assert "(June 15, 1945 – July 11, 2024)" in rewritten

    # Protected markup (internal wikilinks and citation templates) remains intact
    assert "[[National Theatre]]" in rewritten
    assert "<ref>{{cite web |title=Honour}}</ref>" in rewritten

def test_unverified_fields_left_blank_no_guessing():
    # Only birth date and death date are known; place and cause are unknown
    wikidata_facts = {
        "birth_date": "1950-01-01",
        "death_date": "2023-12-01",
        "death_place": None,
        "cause_of_death": None,
        "occupations": ["writer"]
    }
    raw_article = "'''Jane Writer''' is an author."

    section = synthesize_original_death_section(
        title="Jane Writer",
        death_date_raw="2023-12-01",
        death_place_str="",
        death_cause_str="",
        birth_date_raw="1950-01-01",
        sources=[]
    )
    # Must NOT guess a location or cause
    assert "United States" not in section
    assert "cause of death" not in section.lower()
    assert "died on December 1, 2023 at the age of 73." in section

@pytest.mark.asyncio
async def test_fallback_synthesizer_leaves_unverified_fields_blank():
    wikidata_facts = {
        "birth_date": "1950-01-01",
        "death_date": "2023-12-01",
        # Place and cause are completely unverified
        "death_place": "",
        "cause_of_death": "",
        "occupations": ["writer"]
    }
    raw_article = "'''Jane Writer''' is an author."

    result = await ai_service.analyze_and_draft(
        title="Jane Writer",
        original_wikitext=raw_article,
        sources=[],
        wikidata_facts=wikidata_facts,
        is_deceased=True
    )
    draft = result["generated_draft"]

    # Infobox must contain death_date but NOT guess death_place or death_cause
    assert "| death_date         = {{death date and age|2023|12|1|1950|1|1}}" in draft
    assert "| death_place" not in draft
    assert "| death_cause" not in draft
    assert "United States" not in draft

def test_posthumous_developments_coverage():
    sources = [
        {"url": "https://example.com/death", "title": "Death Notice", "publisher": "News 1"},
        {"url": "https://example.com/memorial", "title": "Memorial Service Held", "publisher": "News 2"},
        {"url": "https://example.com/awards", "title": "Posthumous Honor", "publisher": "Academy"}
    ]
    raw_context = (
        "A private funeral and memorial service was held at the chapel. "
        "She was posthumously awarded an honorary lifetime achievement medal."
    )
    section = synthesize_original_death_section(
        title="Eleanor Vance",
        death_date_raw="2024-05-10",
        death_place_str="Boston, Massachusetts, U.S.",
        death_cause_str="stroke",
        birth_date_raw="1940-02-15",
        sources=sources,
        raw_context_text=raw_context
    )

    # Must cover death
    assert "died on May 10, 2024 in Boston, Massachusetts, U.S. at the age of 84." in section
    # Must cover memorial/funeral developments
    assert "memorial services and commemorative gatherings were held" in section
    # Must cover posthumous developments
    assert "== Posthumous developments ==" in section
    # Must have reliable inline citations
    assert "<ref>{{cite web |url=https://example.com/memorial" in section

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
