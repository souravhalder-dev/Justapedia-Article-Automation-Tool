import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .justapedia_client import justapedia_client
from .article_analyzer import ArticleAnalyzer
from ..models import ArticleJob
import json

logger = logging.getLogger(__name__)

DECEASED_DEFAULT_CATEGORIES = [
    "Category:Deaths in 2025",
    "Category:Deaths in 2024",
    "Category:Deaths in 2023",
    "Category:Deaths in 2022"
]

class DiscoveryService:
    """
    Discovers articles needing research, update, or creation across:
    - Deceased Individuals Mode
    - Category Mode
    - Specific Article Mode
    """

    @staticmethod
    async def discover_deceased(
        db: AsyncSession,
        categories: Optional[List[str]] = None,
        limit_per_cat: int = 15,
        filter_incomplete_only: bool = True
    ) -> List[ArticleJob]:
        cats = categories or DECEASED_DEFAULT_CATEGORIES
        discovered_jobs: List[ArticleJob] = []

        for cat in cats:
            try:
                res = await justapedia_client.get_category_members(cat, limit=limit_per_cat)
                members = res.get("members", [])
                
                for member in members:
                    # Ignore Category: or File: sub-namespaces, focus on main article namespace (ns == 0)
                    if member.get("ns") != 0:
                        continue
                    
                    title = member.get("title")
                    job = await DiscoveryService._process_and_store_article(
                        db=db,
                        title=title,
                        mode="deceased",
                        category=cat,
                        filter_incomplete_only=filter_incomplete_only
                    )
                    if job:
                        discovered_jobs.append(job)
            except Exception as e:
                logger.error(f"Error scanning category {cat}: {e}")

        await db.commit()
        return discovered_jobs

    @staticmethod
    async def discover_category(
        db: AsyncSession,
        category_name: str,
        limit: int = 25,
        filter_incomplete_only: bool = False
    ) -> List[ArticleJob]:
        cat = category_name.strip()
        if not cat.lower().startswith("category:"):
            cat = f"Category:{cat}"

        res = await justapedia_client.get_category_members(cat, limit=limit)
        members = res.get("members", [])
        discovered_jobs: List[ArticleJob] = []

        for member in members:
            if member.get("ns") != 0:
                continue
            title = member.get("title")
            job = await DiscoveryService._process_and_store_article(
                db=db,
                title=title,
                mode="category",
                category=cat,
                filter_incomplete_only=filter_incomplete_only
            )
            if job:
                discovered_jobs.append(job)

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

        # If filtering for incomplete only and article has no issues
        if filter_incomplete_only and len(flags) == 0 and exists:
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
