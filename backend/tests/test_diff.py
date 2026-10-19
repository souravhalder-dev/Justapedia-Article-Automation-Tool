import pytest
from app.services.diff_service import DiffService

def test_diff_service_addition():
    orig = "== Career ==\nHe was an actor.\n"
    prop = "== Career ==\nHe was an actor.\n\n== Death ==\nHe died in 2024.<ref>Source</ref>\n\n== References ==\n{{reflist}}"
    
    diff = DiffService.generate_diff(orig, prop)
    assert diff["lines_added"] > 0
    assert "Death" in diff["added_sections"]
    assert "References" in diff["added_sections"]
    assert diff["added_refs"] == 1

def test_diff_death_date_change():
    orig = "{{Infobox person\n| name = Jane\n| birth_date = 1950\n}}"
    prop = "{{Infobox person\n| name = Jane\n| birth_date = 1950\n| death_date = 2024-05-10\n}}"
    
    diff = DiffService.generate_diff(orig, prop)
    assert diff["death_date_changed"] is True
    assert "2024-05-10" in diff["summary"]
