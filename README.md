# Justapedia Article Research, Update & Creation Automation Studio

An AI-assisted editorial research, updating, and article creation studio designed for **Justapedia Wiki** (`justapedia.org`). The application discovers outdated, incomplete, or stub biographies of deceased individuals, conducts multi-source factual research, synthesizes neutral American English encyclopedic prose with inline citations, provides visual before-and-after diffs, and empowers editors to publish directly to Justapedia Wiki with explicit approval.

---

##  End-to-End Workflow Walkthrough

1. **Discover Articles**:
   - Go to the top discovery bar.
   - Click **Deceased Individuals Mode**, choose a year preset like `Deaths in 2024`, and click **Discover**.
   - Or enter specific titles like `Richard Simmons` in **Specific Article Mode**.
2. **Review Audit Flags**:
   - In the left editorial queue, view audit flags (`Missing Death Cause`, `Contradictory Living Category`, `No Citations`, `Stub`).
3. **Research Subject**:
   - Select an article from the queue.
   - Click **Research Subject**. The system queries Wikipedia, Wikidata, and reliable web news/obituaries.
4. **Generate Draft**:
   - Click **Generate Draft**. The AI synthesizes neutral encyclopedic prose, adds inline `<ref>` tags, and extracts structured facts.
5. **Inspect Diffs & Sources**:
   - View the **Before & After Diff** tab to inspect changes.
   - Switch to **Verified Sources** to review citations and any flagged discrepancy alerts.
   - Switch to **Live Rendered Preview** to view the rendered article and infobox.
   - Use the **Wikitext Editor** to make manual adjustments if desired.
6. **Save to Justapedia**:
   - Click the green **Save to Justapedia** button.
   - Review target title, edit summary, and sandbox test mode toggle.
   - Click **Confirm & Publish**. The article is saved via the Justapedia API, and the new revision ID with direct link is displayed.
