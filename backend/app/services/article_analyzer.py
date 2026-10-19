import re
from typing import Dict, Any, List
import mwparserfromhell

class ArticleAnalyzer:
    """
    Analyzes Justapedia article wikitext to identify missing biographical details,
    outdated information, lack of citations, and gaps in deceased coverage.
    """

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
        has_bio_infobox = any("infobox" in t and any(b in t for b in ["person", "actor", "musical artist", "writer", "politician", "scientist", "athlete", "military person"]) for t in templates)
        has_birth_template = any("birth" in t for t in templates)
        bio_keywords = ["born", "birth", "early life", "graduated", "career", "died", "death"]
        is_biography = has_bio_infobox or has_birth_template or sum(1 for kw in bio_keywords if kw in lower_text) >= 2

        # 2. Determine if subject is deceased
        has_death_cat = any(c.lower().startswith("category:deaths in") or "death" in c.lower() for c in categories)
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
            has_death_date = bool(re.search(r"death[ _]?date\s*=", lower_text)) or any("death date" in t for t in templates)
            if not has_death_date:
                flags.append("missing_death_date")

            has_death_cause = bool(re.search(r"(death[ _]?cause|cause[ _]?of[ _]?death)\s*=", lower_text)) or any(w in lower_text for w in ["cause of death", "died of", "succumbed to", "battle with"])
            if not has_death_cause:
                flags.append("missing_death_cause")

            has_death_place = bool(re.search(r"death[ _]?place\s*=", lower_text))
            if not has_death_place:
                flags.append("missing_death_place")

            # Outdated living category check
            if "category:living people" in cat_str:
                flags.append("contradictory_living_category")

        # Birth date
        has_birth_date = bool(re.search(r"birth[ _]?date\s*=", lower_text)) or any("birth date" in t for t in templates)
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
        if "contradictory_living_category" in flags or "missing_death_date" in flags or "no_citations" in flags or "short_stub" in flags:
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
