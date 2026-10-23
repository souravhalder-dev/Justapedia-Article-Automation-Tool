import pytest
from app.services.article_analyzer import ArticleAnalyzer

def test_analyze_deceased_missing_death_date():
    wikitext = """
{{short description|American actor}}
{{Infobox person
| name = Jane Doe
| birth_date = {{birth date|1940|1|1}}
}}
'''Jane Doe''' (born January 1, 1940) was an American actress who died in 2024.
== References ==
{{reflist}}
    """
    categories = ["Category:Deaths in 2024", "Category:American actors"]
    res = ArticleAnalyzer.analyze("Jane Doe", wikitext, categories)
    
    assert res["is_deceased"] is True
    assert "missing_death_date" in res["flags"]
    assert res["priority"] == "high"

def test_analyze_contradictory_living_category():
    wikitext = """
{{Infobox person
| name = John Smith
| death_date = {{Death date and age|2024|5|1|1950|2|2}}
}}
'''John Smith''' was an American musician.
    """
    categories = ["Category:Living people", "Category:Deaths in 2024"]
    res = ArticleAnalyzer.analyze("John Smith", wikitext, categories)

    assert "contradictory_living_category" in res["flags"]
    assert res["priority"] == "high"

def test_analyze_empty_non_existent():
    res = ArticleAnalyzer.analyze("Uncreated Person", "", [])
    assert "non_existent_page" in res["flags"]
    assert res["priority"] == "high"

def test_analyze_few_citations():
    wikitext = """
{{Infobox person
| name = Alice
| birth_date = 1960
}}
'''Alice''' is an author. She wrote books.
    """
    res = ArticleAnalyzer.analyze("Alice", wikitext, [])
    assert "no_citations" in res["flags"]
    assert "short_stub" in res["flags"]

def test_analyze_redirect_page():
    wikitext = "#REDIRECT [[Arthur Pendelton]]"
    res = ArticleAnalyzer.analyze("Art Pendelton", wikitext, [])
    assert "redirect_page" in res["flags"]
    assert res.get("is_redirect") is True
