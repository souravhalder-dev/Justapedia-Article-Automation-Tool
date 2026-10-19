import difflib
import re
from typing import Dict, Any, List

class DiffService:
    """
    Computes visual and structural differences between original Justapedia wikitext
    and proposed AI-researched drafts.
    """

    @staticmethod
    def generate_diff(original: str, proposed: str) -> Dict[str, Any]:
        orig_lines = (original or "").splitlines()
        prop_lines = (proposed or "").splitlines()

        # Compute line diff
        matcher = difflib.SequenceMatcher(None, orig_lines, prop_lines)
        diff_chunks: List[Dict[str, Any]] = []

        lines_added = 0
        lines_removed = 0

        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == 'equal':
                diff_chunks.append({
                    "type": "equal",
                    "orig_lines": orig_lines[i1:i2],
                    "prop_lines": prop_lines[j1:j2]
                })
            elif tag == 'replace':
                lines_removed += (i2 - i1)
                lines_added += (j2 - j1)
                diff_chunks.append({
                    "type": "modify",
                    "orig_lines": orig_lines[i1:i2],
                    "prop_lines": prop_lines[j1:j2]
                })
            elif tag == 'delete':
                lines_removed += (i2 - i1)
                diff_chunks.append({
                    "type": "delete",
                    "orig_lines": orig_lines[i1:i2],
                    "prop_lines": []
                })
            elif tag == 'insert':
                lines_added += (j2 - j1)
                diff_chunks.append({
                    "type": "insert",
                    "orig_lines": [],
                    "prop_lines": prop_lines[j1:j2]
                })

        # Detect structural changes
        orig_sections = set(re.findall(r"==+\s*([^=]+?)\s*==+", original or ""))
        prop_sections = set(re.findall(r"==+\s*([^=]+?)\s*==+", proposed or ""))
        added_sections = list(prop_sections - orig_sections)

        orig_refs = len(re.findall(r"<ref[ >]", original or ""))
        prop_refs = len(re.findall(r"<ref[ >]", proposed or ""))
        added_refs = max(0, prop_refs - orig_refs)

        # Detect infobox death_date changes
        orig_death = re.search(r"\|\s*death_date\s*=\s*([^\n|]*)", original or "")
        prop_death = re.search(r"\|\s*death_date\s*=\s*([^\n|]*)", proposed or "")
        death_date_changed = bool(prop_death and (not orig_death or orig_death.group(1).strip() != prop_death.group(1).strip()))

        summary_points = []
        if len(original or "") == 0:
            summary_points.append("New article created from scratch with infobox and references.")
        else:
            if death_date_changed:
                summary_points.append(f"Updated death date to: '{prop_death.group(1).strip()}'")
            if added_sections:
                summary_points.append(f"Added sections: {', '.join(added_sections)}")
            if added_refs > 0:
                summary_points.append(f"Added {added_refs} reliable citation(s)")
            summary_points.append(f"+{lines_added} lines, -{lines_removed} lines changed")

        return {
            "chunks": diff_chunks,
            "lines_added": lines_added,
            "lines_removed": lines_removed,
            "added_sections": added_sections,
            "added_refs": added_refs,
            "death_date_changed": death_date_changed,
            "summary": "; ".join(summary_points) if summary_points else "Minor edits and cleanup."
        }
