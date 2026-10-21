import pytest
from app.services.ai_service import (
    parse_date_components,
    format_wiki_birth_date,
    format_wiki_death_date,
    convert_infobox_dates_to_plain_text,
    update_short_description,
    format_american_location,
    rewrite_article_prose,
    synthesize_original_death_section,
    ai_service
)

def test_parse_date_components():
    assert parse_date_components("1949-07-07") == (1949, 7, 7)
    assert parse_date_components("July 11, 2024") == (2024, 7, 11)
    assert parse_date_components("February 6, 2002") == (2002, 2, 6)
    assert parse_date_components("21 July 2024") == (2024, 7, 21)
    assert parse_date_components("{{birth date|2002|2|6}}") == (2002, 2, 6)
    assert parse_date_components("{{death date and age|2024|7|21|2002|2|6}}") == (2024, 7, 21)
    assert parse_date_components(None) is None

def test_format_wiki_birth_date():
    # Plain text in American date format (Month Day, Year) without any templates
    assert format_wiki_birth_date("1949-07-07") == "July 7, 1949"
    assert format_wiki_birth_date("February 6, 2002") == "February 6, 2002"
    assert format_wiki_birth_date("6 February 2002") == "February 6, 2002"
    assert format_wiki_birth_date("1949") == "1949"

def test_format_wiki_death_date():
    # Plain text in American date format (Month Day, Year) without any templates
    assert format_wiki_death_date("2024-07-21") == "July 21, 2024"
    assert format_wiki_death_date("2024-07-11", "1949-07-07") == "July 11, 2024"
    assert format_wiki_death_date("21 July 2024") == "July 21, 2024"
    assert format_wiki_death_date("2024") == "2024"

def test_convert_infobox_dates_to_plain_text():
    wikitext = (
        "{{Infobox person\n"
        "| name = Jane Doe\n"
        "| birth_date = {{birth date and age|2002|2|6}}\n"
        "| death_date = {{death date and age|2024|7|21|2002|2|6}}\n"
        "| death_place = Blanco, Texas, U.S.\n"
        "}}"
    )
    converted = convert_infobox_dates_to_plain_text(wikitext)
    assert "| birth_date = February 6, 2002" in converted
    assert "| death_date = July 21, 2024" in converted
    assert "{{birth date" not in converted
    assert "{{death date" not in converted

def test_format_american_location():
    assert format_american_location("Blanco, Texas, United States") == "Blanco, Texas, U.S."
    assert format_american_location("New York City, NY, USA") == "New York City, NY, U.S."
    assert format_american_location("London, England") == "London, England"

def test_rewrite_article_prose_converts_spelling_and_dates():
    raw_wikitext = (
        "{{short description|English actor}}\n"
        "{{use dmy dates|date=July 2020}}\n"
        "{{Infobox person\n"
        "| name = Geoffrey Stone\n"
        "| birth_date = {{birth date|1945|6|15}}\n"
        "| death_date = {{death date|2024|7|11}}\n"
        "}}\n"
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

    # Wikipedia maintenance templates must be removed, but short description is updated
    assert "{{short description|English actor (1945–2024)}}" in rewritten
    assert "{{use dmy dates" not in rewritten

    # Infobox dates must be converted to plain text American format (no templates)
    assert "| birth_date = June 15, 1945" in rewritten
    assert "| death_date = July 11, 2024" in rewritten
    assert "{{birth date" not in rewritten
    assert "{{death date" not in rewritten

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

    # Infobox must contain plain text death_date but NOT guess death_place or death_cause
    assert "| death_date         = December 1, 2023" in draft
    assert "{{death date" not in draft
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
    assert "memorial services and funeral gatherings were conducted" in section
    # Must cover posthumous developments
    assert "== Posthumous developments ==" in section
    # Must have reliable inline citations
    assert "<ref>{{cite web |url=https://example.com/memorial" in section

def test_update_short_description_preserves_and_updates():
    raw_1 = "{{short description|American actress}}\n{{Infobox person\n}}"
    up_1 = update_short_description(raw_1, "Shelley Duvall", "1949-07-07", "2024-07-11")
    assert "{{short description|American actress (1949–2024)}}" in up_1

    raw_2 = "{{short description|American actress (born 1949)}}\n{{Infobox person\n}}"
    up_2 = update_short_description(raw_2, "Shelley Duvall", "1949-07-07", "2024-07-11")
    assert "{{short description|American actress (1949–2024)}}" in up_2

    raw_3 = "{{Infobox person\n}}"
    up_3 = update_short_description(raw_3, "Jane", "1950-01-01", "2023-12-01", default_role="American novelist")
    assert "{{short description|American novelist (1950–2023)}}" in up_3

def test_citations_placed_before_content():
    sources = [
        {"url": "https://example.com/nyt-obit", "title": "Obituary", "publisher": "The New York Times"},
        {"url": "https://example.com/reuters", "title": "Cause Report", "publisher": "Reuters"}
    ]
    section = synthesize_original_death_section(
        title="John Smith",
        death_date_raw="2024-08-01",
        death_place_str="Chicago, Illinois, U.S.",
        death_cause_str="heart failure",
        birth_date_raw="1944-01-15",
        sources=sources
    )
    # Citations must appear before or alongside the facts with attribution
    assert "According to verified coverage in The New York Times,<ref>{{cite web |url=https://example.com/nyt-obit" in section
    assert "As confirmed by official reports,<ref>{{cite web |url=https://example.com/reuters" in section

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
    
    # Check Infobox person exists with plain text American dates (no templates)
    assert "{{Infobox person" in draft
    assert "| death_date         = March 15, 2024" in draft
    assert "| birth_date         = May 12, 1940" in draft
    assert "{{death date" not in draft
    assert "{{birth date" not in draft
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
    assert "cause of death was attributed to cardiac arrest" in draft
    
    # 3. Reliable inline citation must be attached before/alongside the factual statement
    assert "According to verified coverage in The Washington Post,<ref>{{cite web |url=https://example.com/pendelton-obit" in draft


@pytest.mark.asyncio
async def test_update_all_infobox_fields_from_wikipedia_and_wikidata():
    """
    Verifies that all missing infobox fields (birth info, birth name, birth place,
    death date, death cause, death place, resting place, occupation, years active, partner)
    are updated from Wikipedia & Wikidata info, with American plain text dates (no templates).
    """
    stub = """{{Short description|American actress}}
{{Infobox person
| name = Shelley Duvall
| occupation = Actress
}}
'''Shelley Duvall''' is an actress.
"""
    wiki_infobox = {
        "birth_name": "Shelley Alexis Duvall",
        "birth_date": "{{birth date|1949|7|7}}",
        "birth_place": "[[Fort Worth, Texas]], United States",
        "death_date": "{{death date and age|2024|7|11|1949|7|7}}",
        "death_place": "[[Blanco, Texas]], United States",
        "death_cause": "Complications from [[diabetes mellitus|diabetes]]",
        "resting_place": "Cremated; ashes scattered",
        "occupation": "Actress, producer, writer",
        "years_active": "1970–2002, 2022–present",
        "partner": "[[Dan Gilroy (musician)|Dan Gilroy]] (1989–present)"
    }
    wikidata_facts = {
        "birth_date": "1949-07-07",
        "death_date": "2024-07-11",
        "cause_of_death": "diabetes complications",
        "occupations": ["actor", "producer"]
    }
    sources = [
        {"url": "https://example.com/obit", "title": "Obituary", "publisher": "The Hollywood Reporter"}
    ]

    result = await ai_service.analyze_and_draft(
        title="Shelley Duvall",
        original_wikitext=stub,
        sources=sources,
        wikidata_facts=wikidata_facts,
        is_deceased=True,
        research_context={"wikipedia_infobox": wiki_infobox}
    )
    draft = result["generated_draft"]

    # Verify all infobox fields are updated
    assert "| birth_name = Shelley Alexis Duvall" in draft
    assert "| birth_date = July 7, 1949" in draft
    assert "{{birth date" not in draft
    assert "| birth_place = [[Fort Worth, Texas]], U.S." in draft
    assert "| death_date = July 11, 2024" in draft
    assert "{{death date" not in draft
    assert "| death_place = [[Blanco, Texas]], U.S." in draft
    assert "| death_cause = Complications from [[diabetes mellitus|diabetes]]" in draft
    assert "| resting_place = Cremated; ashes scattered" in draft
    assert "| occupation = Actress, producer, writer" in draft
    assert "1970–2002, 2022–2024" in draft or "1970–2002, 2022–2023" in draft
    assert "–present" not in draft  # Range closed upon death


@pytest.mark.asyncio
async def test_update_both_birth_and_death_categories_and_remove_living_people():
    """
    Verifies that the updater updates BOTH birth and death categories
    ([[Category:YYYY births]], [[Category:YYYY deaths]], [[Category:Deaths in YYYY]])
    and removes [[Category:Living people]].
    """
    article_with_living_cat = """{{Infobox person
| name = Gene Hackman
| birth_date = January 30, 1930
}}
'''Eugene Allen Hackman''' is a retired American actor.
[[Category:Living people]]
"""
    wikidata_facts = {
        "birth_date": "1930-01-30",
        "death_date": "2024-08-15",
        "death_place": "Santa Fe, New Mexico, U.S.",
        "cause_of_death": "natural causes"
    }

    result = await ai_service.analyze_and_draft(
        title="Gene Hackman",
        original_wikitext=article_with_living_cat,
        sources=[{"url": "https://example.com/obit", "title": "Obit", "publisher": "Reuters"}],
        wikidata_facts=wikidata_facts,
        is_deceased=True
    )
    draft = result["generated_draft"]

    # Must remove Living people
    assert "[[Category:Living people]]" not in draft
    # Must add death categories
    assert "[[Category:2024 deaths]]" in draft
    assert "[[Category:Deaths in 2024]]" in draft
    # Must add birth category
    assert "[[Category:1930 births]]" in draft


@pytest.mark.asyncio
async def test_article_analyzer_flags_cleared_after_full_update():
    """
    Verifies that an incomplete article with multiple audit flags
    (missing death date, cause, place, contradictory living category,
    missing birth date, short stub, missing career section) has ALL flags cleared
    after being updated.
    """
    from app.services.article_analyzer import ArticleAnalyzer

    initial_stub = """{{Infobox person
| name = Arthur Pendelton
}}
'''Arthur Pendelton''' is an American writer.
"""
    cats = ["Category:2024 deaths", "Category:Living people"]
    before = ArticleAnalyzer.analyze("Arthur Pendelton", initial_stub, cats)
    
    # Verify flags existed before update
    assert "missing_death_date" in before["flags"]
    assert "missing_death_cause" in before["flags"]
    assert "missing_death_place" in before["flags"]
    assert "contradictory_living_category" in before["flags"]
    assert "missing_birth_date" in before["flags"]
    assert "short_stub" in before["flags"]

    wikidata_facts = {
        "birth_date": "1940-05-12",
        "death_date": "2024-03-15",
        "death_place": "Austin, Texas, U.S.",
        "cause_of_death": "cardiac arrest",
        "occupations": ["novelist", "author"]
    }
    sources = [
        {"url": "https://example.com/obit1", "title": "Obit 1", "publisher": "The Washington Post"},
        {"url": "https://example.com/obit2", "title": "Obit 2", "publisher": "The New York Times"},
        {"url": "https://example.com/obit3", "title": "Obit 3", "publisher": "Associated Press"}
    ]

    result = await ai_service.analyze_and_draft(
        title="Arthur Pendelton",
        original_wikitext=initial_stub,
        sources=sources,
        wikidata_facts=wikidata_facts,
        is_deceased=True
    )
    draft = result["generated_draft"]

    # Re-analyze updated wikitext
    after = ArticleAnalyzer.analyze("Arthur Pendelton", draft, ["Category:2024 deaths", "Category:1940 births"])
    
    # All critical biographical flags must be resolved
    assert "missing_death_date" not in after["flags"]
    assert "missing_death_cause" not in after["flags"]
    assert "missing_death_place" not in after["flags"]
    assert "contradictory_living_category" not in after["flags"]
    assert "missing_birth_date" not in after["flags"]
    assert "short_stub" not in after["flags"]
    assert "missing_career_section" not in after["flags"]
    assert "few_citations" not in after["flags"]
    assert "no_citations" not in after["flags"]
    assert after["priority"] in ("low", "medium")

