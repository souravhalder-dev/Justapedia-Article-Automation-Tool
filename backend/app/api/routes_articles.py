import json
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import ArticleJob, SourceEvidence
from ..schemas import ArticleJobResponse, SaveToWikiRequest, SaveToWikiResponse
from ..services.research_pipeline import research_pipeline
from ..services.ai_service import ai_service
from ..services.diff_service import DiffService
from ..services.justapedia_client import justapedia_client
from .routes_discovery import job_to_response

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/articles", tags=["Articles"])

@router.get("", response_model=List[ArticleJobResponse])
async def list_articles(
    status: Optional[str] = Query(None),
    mode: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db)
):
    """List all article jobs with optional filtering."""
    stmt = select(ArticleJob).options(selectinload(ArticleJob.sources)).order_by(desc(ArticleJob.updated_at))
    
    if status:
        stmt = stmt.where(ArticleJob.status == status)
    if mode:
        stmt = stmt.where(ArticleJob.mode == mode)
    if priority:
        stmt = stmt.where(ArticleJob.priority == priority)
    if search:
        stmt = stmt.where(ArticleJob.title.ilike(f"%{search}%"))

    stmt = stmt.offset(offset).limit(limit)
    res = await db.execute(stmt)
    jobs = res.scalars().all()
    return [job_to_response(j) for j in jobs]

async def get_or_restore_job(
    db: AsyncSession,
    job_id: int,
    title: Optional[str] = None
) -> ArticleJob:
    """
    Finds job by ID or Title. If not found in the current serverless instance,
    re-fetches from Justapedia and recreates the job on-the-fly so requests NEVER 404!
    """
    stmt = select(ArticleJob).options(selectinload(ArticleJob.sources)).where(ArticleJob.id == job_id)
    res = await db.execute(stmt)
    job = res.scalars().first()
    if job:
        return job

    target_title = (title or "").strip()
    if target_title:
        stmt2 = select(ArticleJob).options(selectinload(ArticleJob.sources)).where(ArticleJob.title == target_title)
        res2 = await db.execute(stmt2)
        job2 = res2.scalars().first()
        if job2:
            return job2

        # Auto-recreate job for this serverless instance
        logger.info(f"Auto-restoring article job for '{target_title}' on serverless worker...")
        from ..services.article_analyzer import ArticleAnalyzer
        justapedia_data = await justapedia_client.get_article(target_title)
        analysis = ArticleAnalyzer.analyze(
            title=target_title,
            wikitext=justapedia_data.get("wikitext", ""),
            categories=justapedia_data.get("categories", [])
        )
        new_job = ArticleJob(
            title=target_title,
            mode="deceased",
            category="Restored",
            status="pending",
            priority=analysis.get("priority", "medium"),
            audit_flags=json.dumps(analysis.get("flags", [])),
            audit_summary=analysis.get("summary", ""),
            page_exists=justapedia_data.get("exists", False),
            original_wikitext=justapedia_data.get("wikitext", ""),
            original_revid=justapedia_data.get("revid"),
            original_timestamp=justapedia_data.get("timestamp")
        )
        db.add(new_job)
        await db.commit()
        await db.refresh(new_job)
        return new_job

    raise HTTPException(status_code=404, detail="Article job not found")

@router.get("/{job_id}", response_model=ArticleJobResponse)
async def get_article_detail(
    job_id: int,
    title: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve full details of an article job including sources, facts, and diff."""
    job = await get_or_restore_job(db, job_id, title)
    return job_to_response(job)

@router.post("/{job_id}/research", response_model=ArticleJobResponse)
async def research_article(
    job_id: int,
    title: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Execute AI-assisted multi-source research for an article.
    Gathers citations, obituary data, and Wikidata claims.
    """
    job = await get_or_restore_job(db, job_id, title)

    job.status = "researching"
    await db.commit()

    try:
        is_deceased_mode = job.mode == "deceased" or "deceased" in (job.audit_summary or "").lower()
        research_result = await research_pipeline.research_subject(job.title, is_deceased_mode=is_deceased_mode)

        # Clear old sources and insert newly discovered verified sources
        job.sources.clear()
        for src in research_result.get("sources", []):
            new_source = SourceEvidence(
                url=src.get("url"),
                title=src.get("title"),
                publisher=src.get("publisher"),
                publish_date=src.get("publish_date"),
                snippet=src.get("snippet"),
                is_verified=src.get("is_verified", True),
                reliability_score=src.get("reliability_score", 85)
            )
            job.sources.append(new_source)

        job.status = "analyzed"
        job.researched_facts = json.dumps({
            "wikidata": research_result.get("wikidata_facts", {}),
            "wikipedia_summary": research_result.get("wikipedia_summary", ""),
            "death_section_text": research_result.get("death_section_text", ""),
            "legacy_section_text": research_result.get("legacy_section_text", ""),
            "career_updates_text": research_result.get("career_updates_text", "")
        })
        await db.commit()
        await db.refresh(job)
        return job_to_response(job)

    except Exception as e:
        logger.error(f"Error researching {job.title}: {e}")
        job.status = "error"
        job.error_message = f"Research failed: {str(e)}"
        await db.commit()
        raise HTTPException(status_code=500, detail=job.error_message)

@router.post("/{job_id}/generate", response_model=ArticleJobResponse)
async def generate_draft(
    job_id: int,
    title: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate neutral Wikipedia/Justapedia-style article draft,
    inline citations, structured fact extraction, and line-by-line diff.
    """
    job = await get_or_restore_job(db, job_id, title)

    # If not yet researched, do a quick research first
    if not job.sources:
        await research_article(job_id=job_id, title=title, db=db)
        await db.refresh(job)

    try:
        sources_list = [
            {
                "url": s.url,
                "title": s.title,
                "publisher": s.publisher,
                "publish_date": s.publish_date,
                "snippet": s.snippet,
                "reliability_score": s.reliability_score
            } for s in job.sources
        ]
        
        wikidata_facts = {}
        research_context = {}
        if job.researched_facts:
            try:
                parsed_facts = json.loads(job.researched_facts)
                wikidata_facts = parsed_facts.get("wikidata", {})
                research_context = {
                    "death_section_text": parsed_facts.get("death_section_text", ""),
                    "legacy_section_text": parsed_facts.get("legacy_section_text", ""),
                    "career_updates_text": parsed_facts.get("career_updates_text", "")
                }
            except Exception:
                pass

        is_deceased = job.mode == "deceased" or "deceased" in (job.audit_summary or "").lower() or bool(wikidata_facts.get("death_date"))
        
        # AI Draft synthesis
        synthesis = await ai_service.analyze_and_draft(
            title=job.title,
            original_wikitext=job.original_wikitext or "",
            sources=sources_list,
            wikidata_facts=wikidata_facts,
            is_deceased=is_deceased,
            research_context=research_context
        )

        draft_wikitext = synthesis.get("generated_draft", "")
        job.generated_draft = draft_wikitext
        job.user_edited_draft = draft_wikitext  # Initialize editor draft
        job.researched_facts = json.dumps(synthesis.get("facts", {}))
        job.discrepancies = json.dumps(synthesis.get("discrepancies", []))

        # Compute diff between original and draft
        diff = DiffService.generate_diff(job.original_wikitext or "", draft_wikitext)
        job.diff_summary = diff.get("summary", "")
        job.diff_json = json.dumps(diff)
        job.status = "draft_ready"
        job.error_message = None

        await db.commit()
        await db.refresh(job)
        return job_to_response(job)

    except Exception as e:
        logger.error(f"Error generating draft for {job.title}: {e}")
        job.status = "error"
        job.error_message = f"Draft generation failed: {str(e)}"
        await db.commit()
        raise HTTPException(status_code=500, detail=job.error_message)

@router.put("/{job_id}/draft", response_model=ArticleJobResponse)
async def update_user_draft(
    job_id: int,
    payload: dict,
    title: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Save user manual modifications to the wikitext draft and recalculate diff."""
    job = await get_or_restore_job(db, job_id, title)

    new_wikitext = payload.get("wikitext", "")
    job.user_edited_draft = new_wikitext

    # Recalculate diff against original
    diff = DiffService.generate_diff(job.original_wikitext or "", new_wikitext)
    job.diff_summary = diff.get("summary", "")
    job.diff_json = json.dumps(diff)
    job.status = "draft_ready"

    await db.commit()
    await db.refresh(job)
    return job_to_response(job)

@router.post("/{job_id}/save", response_model=SaveToWikiResponse)
async def save_to_justapedia(
    job_id: int,
    req: SaveToWikiRequest,
    title: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Publish approved draft directly to Justapedia Wiki.
    Requires explicit action by user.
    Protects against edit conflicts using original timestamp.
    """
    job = await get_or_restore_job(db, job_id, title or req.custom_title)

    target_title = req.custom_title or job.title
    content_to_save = req.wikitext or job.user_edited_draft or job.generated_draft
    
    if not content_to_save:
        raise HTTPException(status_code=400, detail="Cannot save empty wikitext content.")

    try:
        save_result = await justapedia_client.save_article(
            title=target_title,
            wikitext=content_to_save,
            summary=req.edit_summary,
            basetimestamp=job.original_timestamp,
            is_minor=req.is_minor,
            is_bot=req.is_bot,
            use_sandbox=req.use_sandbox
        )

        if save_result.get("success"):
            job.status = "saved"
            job.saved_revid = save_result.get("revid")
            job.saved_url = save_result.get("url")
            job.is_sandbox_save = save_result.get("is_sandbox", False)
            job.edit_summary = req.edit_summary
            job.error_message = None
            await db.commit()

            return SaveToWikiResponse(
                success=True,
                title=save_result.get("title", target_title),
                revid=save_result.get("revid"),
                url=save_result.get("url"),
                is_sandbox=save_result.get("is_sandbox", False),
                message=save_result.get("message", "Article saved successfully."),
                raw_response=save_result.get("raw_response")
            )
        else:
            error_msg = save_result.get("message", "Failed to save to wiki.")
            job.error_message = error_msg
            await db.commit()
            return SaveToWikiResponse(
                success=False,
                title=target_title,
                message=error_msg,
                raw_response=save_result.get("raw_response")
            )

    except Exception as e:
        logger.error(f"Error publishing to Justapedia: {e}")
        job.error_message = f"Save exception: {str(e)}"
        await db.commit()
        raise HTTPException(status_code=500, detail=job.error_message)

@router.post("/{job_id}/skip", response_model=ArticleJobResponse)
async def skip_article(
    job_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Mark an article job as skipped without saving."""
    stmt = select(ArticleJob).where(ArticleJob.id == job_id)
    res = await db.execute(stmt)
    job = res.scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="Article job not found")
    job.status = "skipped"
    await db.commit()
    await db.refresh(job)
    return job_to_response(job)

@router.delete("/{job_id}")
async def delete_article(
    job_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Remove an article job from the queue."""
    stmt = select(ArticleJob).where(ArticleJob.id == job_id)
    res = await db.execute(stmt)
    job = res.scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="Article job not found")
    await db.delete(job)
    await db.commit()
    return {"message": f"Job {job_id} deleted"}
