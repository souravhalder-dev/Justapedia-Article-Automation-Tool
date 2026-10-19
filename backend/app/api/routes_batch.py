import asyncio
import logging
from typing import List
from fastapi import APIRouter, Depends, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db, AsyncSessionLocal
from ..models import ArticleJob
from .routes_articles import research_article, generate_draft

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/batch", tags=["Batch Processing"])

class BatchActionRequest(BaseModel):
    job_ids: List[int]

async def _run_batch_research(job_ids: List[int]):
    for jid in job_ids:
        async with AsyncSessionLocal() as db:
            try:
                await research_article(job_id=jid, db=db)
                await asyncio.sleep(1.0)  # Gentle rate-limiting delay
            except Exception as e:
                logger.error(f"Batch research error on job {jid}: {e}")

async def _run_batch_generate(job_ids: List[int]):
    for jid in job_ids:
        async with AsyncSessionLocal() as db:
            try:
                await generate_draft(job_id=jid, db=db)
                await asyncio.sleep(1.0)  # Gentle rate-limiting delay
            except Exception as e:
                logger.error(f"Batch generate error on job {jid}: {e}")

@router.post("/research")
async def batch_research(
    req: BatchActionRequest,
    background_tasks: BackgroundTasks
):
    """Trigger background research for multiple articles with rate-limiting."""
    background_tasks.add_task(_run_batch_research, req.job_ids)
    return {
        "message": f"Queued research for {len(req.job_ids)} article(s)",
        "job_ids": req.job_ids
    }

@router.post("/generate")
async def batch_generate(
    req: BatchActionRequest,
    background_tasks: BackgroundTasks
):
    """Trigger background draft generation for multiple articles."""
    background_tasks.add_task(_run_batch_generate, req.job_ids)
    return {
        "message": f"Queued draft generation for {len(req.job_ids)} article(s)",
        "job_ids": req.job_ids
    }
