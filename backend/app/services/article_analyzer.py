import re
from typing import Dict, Any, List
import mwparserfromhell

class ArticleAnalyzer:
    """
    Analyzes Justapedia article wikitext to identify missing biographical details,
    outdated information, lack of citations, and gaps in deceased coverage.
    """

    @staticmethod
    def _has_field_value(wikitext: str, field_names: List[str]) -> bool:
        """
        Check if any of the specified infobox fields has a non-empty value.
        Ignores wikitext comments <!-- --> and empty whitespace.
        """
        try:
            parsed = mwparserfromhell.parse(wikitext)
            for tmpl in parsed.filter_templates():
                if str(tmpl.name).strip().lower().startswith("infobox"):
                    for name in field_names:
                        if tmpl.has(name):
                            raw_val = str(tmpl.get(name).value)
                            cleaned = re.sub(r"<!--.*?-->", "", raw_val)
                            cleaned = re.sub(r"<ref.*?(?:/>|</ref>)", "", cleaned, flags=re.DOTALL)
                            cleaned = cleaned.strip()
                            if cleaned and cleaned not in ("?", "unknown", "n/a", "-", "--"):
                                return True
        except Exception:
            pass

        names_re = "|".join(re.escape(name) for name in field_names)
        pattern = rf"\|\s*(?:{names_re})\s*=\s*([^\n|}}]+)"
        for match in re.finditer(pattern, wikitext, re.IGNORECASE):
            raw_val = match.group(1)
            cleaned = re.sub(r"<!--.*?-->", "", raw_val)
            cleaned = re.sub(r"<ref.*?(?:/>|</ref>)", "", cleaned, flags=re.DOTALL)
            cleaned = cleaned.strip()
            if cleaned and cleaned not in ("?", "unknown", "n/a", "-", "--"):
                return True
        return False

    @staticmethod
    def analyze(title: str, wikitext: str, categories: List[str] = None) -> Dict[str, Any]:
        flags: List[str] = []
        categories = categories or []
        cat_str = " ".join(categories).lower()
        lower_text = (wikitext or "").lower()
        length = len(wikitext or "")

        # Check if page is empty / missing
        if length == 0:
            return {
                "is_biography": True,
                "is_deceased": False,
                "priority": "high",
                "flags": ["non_existent_page"],
                "summary": "Article does not exist on Justapedia. Ready for complete creation."
            }

        # Parse wikitext using mwparserfromhell
        try:
            parsed = mwparserfromhell.parse(wikitext)
            templates = [t.name.strip().lower() for t in parsed.filter_templates()]
        except Exception:
            templates = []

        # 1. Determine if this is a biography
        has_bio_infobox = any(t.startswith("infobox") for t in templates)
        has_birth_template = any("birth" in t for t in templates)
        bio_keywords = ["born", "birth", "early life", "graduated", "career", "died", "death"]
        is_biography = has_bio_infobox or has_birth_template or sum(1 for kw in bio_keywords if kw in lower_text) >= 2

        # 2. Determine if subject is deceased
        has_death_cat = any("death" in c.lower() for c in categories)
        has_death_template = any("death" in t for t in templates)
        death_keywords = ["died", "passed away", "killed", "death", "succumbed", "fatal", "obituary"]
        has_death_mentions = any(kw in lower_text for kw in death_keywords)
        
        is_deceased = has_death_cat or has_death_template or has_death_mentions

        # 3. Check for specific biographical gaps
        # Infobox
        if not has_bio_infobox:
            flags.append("missing_infobox")

        # Death date & details if deceased
        if is_deceased or has_death_cat:
            has_death_field = ArticleAnalyzer._has_field_value(wikitext, ["death_date", "death-date", "date of death", "died", "date_of_death"])
            has_death_tmpl = any("death date" in t or t.startswith("death") for t in templates)
            has_death_date = has_death_field or has_death_tmpl
            if not has_death_date:
                flags.append("missing_death_date")

            has_death_cause_field = ArticleAnalyzer._has_field_value(wikitext, ["death_cause", "death-cause", "cause_of_death", "cause"])
            has_death_cause_text = any(w in lower_text for w in ["cause of death", "died of", "succumbed to", "battle with", "died from", "died following"])
            has_death_cause = has_death_cause_field or has_death_cause_text
            if not has_death_cause:
                flags.append("missing_death_cause")

            has_death_place_field = ArticleAnalyzer._has_field_value(wikitext, ["death_place", "death-place", "place_of_death"])
            if not has_death_place_field:
                flags.append("missing_death_place")

            # Outdated living category check
            if "category:living people" in cat_str or "living people" in cat_str:
                flags.append("contradictory_living_category")

        # Birth date check for biographies
        if is_biography:
            has_birth_field = ArticleAnalyzer._has_field_value(wikitext, ["birth_date", "birth-date", "date of birth", "born", "date_of_birth"])
            has_birth_tmpl = any("birth date" in t or t.startswith("birth") for t in templates)
            has_birth_text = bool(re.search(r"born\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}|\(\s*(?:born\s+|b\.\s*)?\d{1,2}\s+[A-Za-z]+\s+\d{4}|\(\s*(?:born\s+|b\.\s*)?[A-Za-z]+\s+\d{1,2},\s+\d{4}", wikitext, re.IGNORECASE))
            has_birth_date = has_birth_field or has_birth_tmpl or has_birth_text
            if not has_birth_date:
                flags.append("missing_birth_date")

        # Citations & References count
        ref_count = len(re.findall(r"<ref[ >]", wikitext, re.IGNORECASE))
        if ref_count == 0:
            flags.append("no_citations")
        elif ref_count < 3:
            flags.append("few_citations")

        # References section check
        has_ref_section = bool(re.search(r"==\s*references\s*==", lower_text)) or any(r in t for t in templates for r in ["reflist", "references"])
        if not has_ref_section and ref_count > 0:
            flags.append("missing_reflist")

        # Stub or very short
        if length < 800 or any("stub" in t for t in templates):
            flags.append("short_stub")
        elif length < 2000:
            flags.append("needs_expansion")

        # Sections check
        has_career = bool(re.search(r"==\s*(career|life and career|professional life|works|acting)\s*==", lower_text))
        if not has_career and length > 500:
            flags.append("missing_career_section")

        # 4. Calculate Priority
        priority = "low"
        if "contradictory_living_category" in flags or "missing_death_date" in flags or "missing_birth_date" in flags or "no_citations" in flags or "short_stub" in flags:
            priority = "high"
        elif "missing_infobox" in flags or "missing_death_cause" in flags or "few_citations" in flags or "needs_expansion" in flags:
            priority = "medium"

        # 5. Build Human Summary
        summary_parts = []
        if is_deceased:
            summary_parts.append("Deceased individual.")
            if "missing_death_date" in flags:
                summary_parts.append("Death date missing from infobox/text.")
            if "missing_death_cause" in flags:
                summary_parts.append("Cause of death not documented.")
            if "contradictory_living_category" in flags:
                summary_parts.append("CRITICAL: Still listed in Category:Living people!")
        if "missing_birth_date" in flags:
            summary_parts.append("Birth date missing from infobox/text.")
        if "missing_infobox" in flags:
            summary_parts.append("Missing standard biographical infobox.")
        if "no_citations" in flags:
            summary_parts.append("Zero inline citations found.")
        elif "few_citations" in flags:
            summary_parts.append(f"Only {ref_count} citation(s) present.")
        if "short_stub" in flags:
            summary_parts.append(f"Short stub article ({length} characters).")

        summary = " ".join(summary_parts) if summary_parts else "Article is reasonably structured, but can be updated with newly verified sources."

        return {
            "is_biography": is_biography,
            "is_deceased": is_deceased,
            "ref_count": ref_count,
            "article_length": length,
            "priority": priority,
            "flags": flags,
            "summary": summary
        }
