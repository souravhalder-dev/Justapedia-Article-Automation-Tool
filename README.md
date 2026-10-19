# Justapedia Article Research, Update & Creation Automation Studio

An AI-assisted editorial research, updating, and article creation studio designed for **Justapedia Wiki** (`justapedia.org`). The application discovers outdated, incomplete, or stub biographies of deceased individuals, conducts multi-source factual research, synthesizes neutral American English encyclopedic prose with inline citations, provides visual before-and-after diffs, and empowers editors to publish directly to Justapedia Wiki with explicit approval.

---

## 🌟 Key Features

### 1. Three Article Discovery Modes
- **🪦 Deceased Individuals Mode**:
  - Automatically queries death categories (e.g., `Category:Deaths in 2025`, `2024`, `2023`, `2022`).
  - Audits each article to detect missing death dates, unrecorded causes of death, missing death places, stub articles, and critical contradictions (such as deceased individuals still tagged in `Category:Living people`).
  - Prioritizes articles with high-severity biographical gaps.
- **📁 Category Mode**:
  - Scans any Justapedia category (e.g., `Category:American television actresses` or `Category:Pulitzer Prize winners`).
  - Audits all member articles and calculates citation counts, infobox presence, and section completeness.
- **✍️ Specific Article Mode**:
  - Supports manual entry of one or more article titles (batch or single).
  - Automatically checks whether the article exists on Justapedia (for updating) or is missing (for full new article creation).

### 2. MediaWiki API Integration (`https://justapedia.org/api.php`)
- **Authentication**: Supports standard user login and MediaWiki **Bot Passwords** (`Special:BotPasswords`) using the login token flow.
- **CSRF Token Management**: Automatically obtains and refreshes authenticated CSRF edit tokens.
- **Edit Conflict Protection**: Uses MediaWiki's `basetimestamp` parameter to detect conflicts if another editor modified the page since it was loaded.
- **Safe Test / Sandbox Mode**: Built-in toggle to redirect edits to `Justapedia:Sandbox` (or a designated sandbox subpage) to safely verify bot formatting and live API edits without modifying production articles.
- **Explicit Editorial Control**: The application **never** auto-publishes without explicit human review and approval via the "Save to Justapedia" action.

### 3. AI Research Pipeline & Anti-Hallucination Fact Verification
- **Multi-Source Retrieval**: Queries Wikipedia API, Wikidata structured claims (P569 birth date, P570 death date, descriptions, identifiers), and reliable web search results (news publications, obituaries, biographical directories).
- **Strict Anti-Hallucination Safeguards**: Only claims verified by external sources are incorporated. Facts, URLs, publication dates, and quotes are never fabricated.
- **Contradiction & Discrepancy Detection**: When sources disagree (e.g., conflicting death dates, disputed causes of death), the system does not silently guess; it flags the discrepancy with an alert badge for human editorial review.

### 4. Wikipedia / Justapedia Editorial Style
- **Professional American English**: Neutral Point of View (NPOV), encyclopedic phrasing, and verified citations.
- **Template & Infobox Compatibility**: Preserves existing templates (e.g. `{{short description}}`, `{{Use American English}}`, `{{Use mdy dates}}`), updates `{{Infobox person}}`, and maintains proper category tags (`[[Category:Births in YYYY]]`, `[[Category:Deaths in YYYY]]`).
- **Inline Citations**: Generates compliant `<ref>{{cite web |url=... |title=... |publisher=... |date=... |access-date=...}}</ref>` tags and reference lists (`{{reflist}}`).

### 5. Interactive Editorial Studio & Before-and-After Comparison
- **Visual Diff Viewer**: Side-by-side and unified diffs comparing original wikitext vs proposed drafts, with stats on lines added, lines removed, and sections created.
- **Wikitext Editor**: Syntax toolbar with one-click helpers for sections, bold, italic, internal links `[[...]]`, citations `<ref>`, and templates, with real-time word/character counters.
- **Live Rendered Preview**: Parses wikitext into styled HTML with a floated biographical infobox, section dividers, superscript citation links `[1]`, formatted reference list, and categories bar.
- **Source Evidence Inspector**: Inspects all retrieved sources with publisher details, URL, reliability score badge, and extracted quote snippets.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Backend & Research** | Python 3.14, FastAPI, Uvicorn, Pydantic v2, SQLAlchemy (Async), aiosqlite |
| **Wiki Integration** | MediaWiki API (`api.php`), mwparserfromhell, httpx, BeautifulSoup4, lxml |
| **AI & LLM** | Google Gemini API (`google-genai` SDK, `gemini-2.5-flash`), Deterministic Rule-Based Synthesizer fallback |
| **Frontend Dashboard** | React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons |
| **Database** | SQLite with persistent asynchronous SQLAlchemy storage |

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Python 3.10+ (Python 3.14 supported)
- Node.js 18+ and npm

### 2. Installation
Clone the repository and install dependencies:

```bash
# Install backend Python dependencies
pip install -r backend/requirements.txt

# Install frontend Node dependencies & build frontend assets
cd frontend
npm install
npm run build
cd ..
```

### 3. Configuration (.env)
Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` to configure your settings:
```ini
# Port for the web server
PORT=8000

# Justapedia Wiki API
JUSTAPEDIA_API_URL=https://justapedia.org/api.php

# Safe Sandbox Mode (Set to true to redirect saves to Justapedia:Sandbox for testing)
SAFE_TEST_MODE=true
SANDBOX_PAGE_TITLE=Justapedia:Sandbox

# Justapedia Bot Credentials (Optional, can also be configured in the UI settings)
JUSTAPEDIA_BOT_USERNAME=
JUSTAPEDIA_BOT_PASSWORD=

# Google Gemini API Key (Optional, get one from https://aistudio.google.com/)
# If omitted, the built-in deterministic synthesizer handles fact compilation.
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
```

### 4. Running the Application
Launch the unified server with one command:

```bash
python run.py
```

Open your browser to:
- **Editorial Dashboard**: [http://localhost:8000](http://localhost:8000)
- **Interactive API Documentation (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)

*(Optional development mode: run `npm run dev` in `frontend/` to run Vite dev server with hot module reloading at `http://localhost:5173`).*

---

## 🔑 Configuring Justapedia API & Bot Passwords

MediaWiki wikis like Justapedia require authentication for write operations. To configure an account:

1. Log into your Justapedia account at [https://justapedia.org](https://justapedia.org).
2. Navigate to **Special:BotPasswords** (`https://justapedia.org/wiki/Special:BotPasswords`).
3. Enter a Bot Name (e.g., `EditorialAssistant`) and check the required grants:
   - **Edit existing pages**
   - **Create, edit, and move pages**
4. Click **Create** and copy the generated password.
5. In the Editorial Studio dashboard, click **Settings** (top right) or edit `.env`:
   - Enter your **Bot Username** (e.g., `YourUsername@EditorialAssistant`).
   - Enter the **Bot Password**.
   - Click **Login Account** or **Test Connection** to verify connectivity.

---

## 🧪 Testing

Run the automated test suite with pytest:

```bash
python -m pytest -o pythonpath=backend backend/tests -v
```

All unit and integration tests cover:
- Biographical gap analysis & deceased detection logic
- Contradictory living category detection
- Line-by-line diff and structural modification detection
- Live Justapedia MediaWiki API connectivity and revision fetching

---

## 📖 End-to-End Workflow Walkthrough

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
