import logging
import re
import json
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .justapedia_client import justapedia_client
from .article_analyzer import ArticleAnalyzer
from ..models import ArticleJob

logger = logging.getLogger(__name__)

DECEASED_DEFAULT_CATEGORIES = [
    "Category:2024 deaths",
    "Category:Deaths in 2024",
    "Category:2023 deaths",
    "Category:Deaths in 2023",
    "Category:2025 deaths",
    "Category:Deaths in 2025",
    "Category:2022 deaths"
]

class DiscoveryService:
    """
    Discovers articles needing research, update, or creation across:
    - Deceased Individuals Mode
    - Category Mode
    - Specific Article Mode
    """

    @staticmethod
    def is_list_or_meta_page(title: str) -> bool:
        """Filter out list articles, timelines, indexes, and internal mediawiki pages."""
        lower = title.lower().strip()
        prefixes = (
            "deaths in ",
            "list of ",
            "timeline of ",
            "index of ",
            "death and funeral of ",
            "category:",
            "template:",
            "file:",
            "wikipedia:",
            "justapedia:",
            "portal:",
            "draft:"
        )
        return any(lower.startswith(p) for p in prefixes)

    @staticmethod
    def _build_deceased_categories(user_category: Optional[str]) -> List[str]:
        """
        Builds prioritized list of categories to scan for deceased individuals.
        Handles year extraction, scanning both 'YYYY deaths' and 'Deaths in YYYY',
        and cascading into adjacent years to ensure the user gets their requested target count.
        """
        if not user_category or not user_category.strip():
            return list(DECEASED_DEFAULT_CATEGORIES)

        raw = user_category.strip()
        clean_cat = raw if raw.lower().startswith("category:") else f"Category:{raw}"

        # Extract 4-digit year if present (e.g. 2024)
        match = re.search(r"\b(19\d\d|20\d\d)\b", raw)
        if match:
            year = int(match.group(1))
            cats = [
                f"Category:{year} deaths",
                f"Category:Deaths in {year}",
                f"Category:{year - 1} deaths",
                f"Category:Deaths in {year - 1}",
                f"Category:{year + 1} deaths",
                f"Category:Deaths in {year + 1}",
                f"Category:{year - 2} deaths",
                f"Category:Deaths in {year - 2}"
            ]
            if clean_cat not in cats:
                cats.insert(0, clean_cat)
            return cats

        return [clean_cat] + list(DECEASED_DEFAULT_CATEGORIES)

    @staticmethod
    async def discover_deceased(
        db: AsyncSession,
        categories: Optional[List[str]] = None,
        limit_per_cat: int = 50,
        filter_incomplete_only: bool = True
    ) -> List[ArticleJob]:
        user_cat = categories[0] if (categories and len(categories) > 0) else None
        cats_to_scan = DiscoveryService._build_deceased_categories(user_cat)
        target_count = max(1, limit_per_cat)

        discovered_jobs: List[ArticleJob] = []
        seen_titles = set()

        # Exclude articles already completed / saved by user
        existing_saved_res = await db.execute(select(ArticleJob.title).where(ArticleJob.status == "saved"))
        saved_titles = set(existing_saved_res.scalars().all())

        for cat in cats_to_scan:
            if len(discovered_jobs) >= target_count:
                break

            cmcontinue = None
            pages_scanned = 0
            max_pages = 25

            while len(discovered_jobs) < target_count and pages_scanned < max_pages:
                pages_scanned += 1
                batch_limit = min(50, (target_count - len(discovered_jobs)) + 15)

                try:
                    res = await justapedia_client.get_category_members(cat, limit=batch_limit, cmcontinue=cmcontinue)
                except Exception as e:
                    logger.error(f"Error fetching members for {cat} (continue={cmcontinue}): {e}")
                    break

                members = res.get("members", [])
                if not members:
                    break

                for member in members:
                    if len(discovered_jobs) >= target_count:
                        break

                    # ns == 0 indicates main encyclopedia namespace
                    if member.get("ns") != 0:
                        continue

                    title = (member.get("title") or "").strip()
                    if not title or DiscoveryService.is_list_or_meta_page(title):
                        continue

                    if title in seen_titles or title in saved_titles:
                        continue

                    job = await DiscoveryService._process_and_store_article(
                        db=db,
                        title=title,
                        mode="deceased",
                        category=cat,
                        filter_incomplete_only=filter_incomplete_only
                    )
                    if job:
                        seen_titles.add(title)
                        discovered_jobs.append(job)

                cmcontinue = res.get("continue")
                if not cmcontinue:
                    break

        await db.commit()
        return discovered_jobs

    @staticmethod
    async def discover_category(
        db: AsyncSession,
        category_name: str,
        limit: int = 50,
        filter_incomplete_only: bool = False
    ) -> List[ArticleJob]:
        cat = category_name.strip()
        if not cat.lower().startswith("category:"):
            cat = f"Category:{cat}"

        target_count = max(1, limit)
        discovered_jobs: List[ArticleJob] = []
        seen_titles = set()

        existing_saved_res = await db.execute(select(ArticleJob.title).where(ArticleJob.status == "saved"))
        saved_titles = set(existing_saved_res.scalars().all())

        cmcontinue = None
        pages_scanned = 0
        max_pages = 25

        while len(discovered_jobs) < target_count and pages_scanned < max_pages:
            pages_scanned += 1
            batch_limit = min(50, (target_count - len(discovered_jobs)) + 15)

            try:
                res = await justapedia_client.get_category_members(cat, limit=batch_limit, cmcontinue=cmcontinue)
            except Exception as e:
                logger.error(f"Error scanning category {cat}: {e}")
                break

            members = res.get("members", [])
            if not members:
                break

            for member in members:
                if len(discovered_jobs) >= target_count:
                    break

                if member.get("ns") != 0:
                    continue

                title = (member.get("title") or "").strip()
                if not title or DiscoveryService.is_list_or_meta_page(title):
                    continue

                if title in seen_titles or title in saved_titles:
                    continue

                job = await DiscoveryService._process_and_store_article(
                    db=db,
                    title=title,
                    mode="category",
                    category=cat,
                    filter_incomplete_only=filter_incomplete_only
                )
                if job:
                    seen_titles.add(title)
                    discovered_jobs.append(job)

            cmcontinue = res.get("continue")
            if not cmcontinue:
                break

        await db.commit()
        return discovered_jobs

    @staticmethod
    async def add_specific_articles(
        db: AsyncSession,
        titles: List[str]
    ) -> List[ArticleJob]:
        jobs: List[ArticleJob] = []
        for raw_title in titles:
            title = raw_title.strip()
            if not title:
                continue
            job = await DiscoveryService._process_and_store_article(
                db=db,
                title=title,
                mode="specific",
                category=None,
                filter_incomplete_only=False
            )
            if job:
                jobs.append(job)
        await db.commit()
        return jobs

    @staticmethod
    async def _process_and_store_article(
        db: AsyncSession,
        title: str,
        mode: str,
        category: Optional[str] = None,
        filter_incomplete_only: bool = False
    ) -> Optional[ArticleJob]:
        # Check if job already exists in database
        stmt = select(ArticleJob).where(ArticleJob.title == title)
        result = await db.execute(stmt)
        existing_job = result.scalars().first()

        # If article was already edited and saved/published, do not show it again
        if existing_job and existing_job.status == "saved":
            return None

        # Fetch current article from Justapedia
        wiki_data = await justapedia_client.get_article(title)
        exists = wiki_data.get("exists", False)
        wikitext = wiki_data.get("wikitext", "")
        revid = wiki_data.get("revid")
        timestamp = wiki_data.get("timestamp")
        categories = wiki_data.get("categories", [])

        # Audit and gap analysis
        audit = ArticleAnalyzer.analyze(title, wikitext, categories)
        flags = audit.get("flags", [])
        priority = audit.get("priority", "medium")
        summary = audit.get("summary", "")

        # Check if article has any biographical/editorial update gaps
        update_gaps = {
            "non_existent_page",
            "missing_death_date",
            "missing_birth_date",
            "contradictory_living_category",
            "missing_death_cause",
            "missing_death_place",
            "missing_infobox",
            "no_citations",
            "short_stub"
        }
        has_update_gap = (not exists) or any(f in update_gaps for f in flags)

        # If filtering for incomplete only and article is already complete/has no update gaps, skip it
        if filter_incomplete_only and not has_update_gap:
            return None

        if existing_job:
            # Update existing record
            existing_job.page_exists = exists
            existing_job.original_wikitext = wikitext
            existing_job.original_revid = revid
            existing_job.original_timestamp = timestamp
            existing_job.audit_flags = json.dumps(flags)
            existing_job.audit_summary = summary
            existing_job.priority = priority
            if category:
                existing_job.category = category
            return existing_job
        else:
            # Create new record
            new_job = ArticleJob(
                title=title,
                mode=mode,
                category=category,
                status="discovered",
                priority=priority,
                audit_flags=json.dumps(flags),
                audit_summary=summary,
                page_exists=exists,
                original_wikitext=wikitext,
                original_revid=revid,
                original_timestamp=timestamp
            )
            db.add(new_job)
            return new_job
