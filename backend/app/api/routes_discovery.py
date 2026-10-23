from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from ..database import get_db
from ..schemas import ArticleJobResponse, CategoryDiscoverRequest, BatchCreateArticles
from ..services.discovery_service import DiscoveryService
from ..models import ArticleJob

router = APIRouter(prefix="/api/discovery", tags=["Discovery"])

def job_to_response(job: ArticleJob) -> dict:
    import json
    flags = []
    if job.audit_flags:
        try:
            flags = json.loads(job.audit_flags)
        except Exception:
            flags = []

    facts = None
    if job.researched_facts:
        try:
            facts = json.loads(job.researched_facts)
        except Exception:
            facts = None

    discrepancies = None
    if job.discrepancies:
        try:
            discrepancies = json.loads(job.discrepancies)
        except Exception:
            discrepancies = None

    diff_json = None
    if job.diff_json:
        try:
            diff_json = json.loads(job.diff_json)
        except Exception:
            diff_json = None

    return {
        "id": job.id,
        "title": job.title,
        "mode": job.mode,
        "category": job.category,
        "status": job.status,
        "priority": job.priority,
        "audit_flags": flags,
        "audit_summary": job.audit_summary,
        "page_exists": job.page_exists,
        "original_wikitext": job.original_wikitext,
        "original_revid": job.original_revid,
        "original_timestamp": job.original_timestamp,
        "researched_facts": facts,
        "discrepancies": discrepancies,
        "generated_draft": job.generated_draft,
        "user_edited_draft": job.user_edited_draft,
        "diff_summary": job.diff_summary,
        "diff_json": diff_json,
        "edit_summary": job.edit_summary,
        "saved_revid": job.saved_revid,
        "saved_timestamp": job.saved_timestamp,
        "saved_url": job.saved_url,
        "is_sandbox_save": job.is_sandbox_save,
        "error_message": job.error_message,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
        "sources": [
            {
                "id": s.id,
                "url": s.url,
                "title": s.title,
                "publisher": s.publisher,
                "publish_date": s.publish_date,
                "snippet": s.snippet,
                "is_verified": s.is_verified,
                "reliability_score": s.reliability_score
            } for s in (getattr(job, "__dict__", {}).get("sources", []) or [])
        ]
    }

@router.post("/deceased", response_model=List[ArticleJobResponse])
async def discover_deceased(
    req: CategoryDiscoverRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Discover articles about deceased individuals across death categories (e.g. Deaths in 2024, 2023).
    Audits them for missing death dates, stubs, and citation gaps.
    """
    try:
        categories = [req.category_name] if req.category_name else None
        jobs = await DiscoveryService.discover_deceased(
            db=db,
            categories=categories,
            limit_per_cat=req.limit,
            filter_incomplete_only=req.filter_incomplete_only,
            exclude_titles=req.exclude_titles
        )
        return [job_to_response(j) for j in jobs]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Discovery failed: {str(e)}")

@router.post("/category", response_model=List[ArticleJobResponse])
async def discover_category(
    req: CategoryDiscoverRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Discover and audit articles within any specified Justapedia category.
    """
    try:
        jobs = await DiscoveryService.discover_category(
            db=db,
            category_name=req.category_name,
            limit=req.limit,
            filter_incomplete_only=req.filter_incomplete_only,
            exclude_titles=req.exclude_titles
        )
        return [job_to_response(j) for j in jobs]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Category discovery failed: {str(e)}")

@router.post("/specific", response_model=List[ArticleJobResponse])
async def add_specific_articles(
    req: BatchCreateArticles,
    db: AsyncSession = Depends(get_db)
):
    """
    Manually add one or more specific article titles for research and updating or new creation.
    """
    try:
        jobs = await DiscoveryService.add_specific_articles(
            db=db,
            titles=req.titles
        )
        return [job_to_response(j) for j in jobs]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add specific articles: {str(e)}")
