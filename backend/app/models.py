from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base

class ArticleJob(Base):
    __tablename__ = "article_jobs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=False, index=True)
    mode = Column(String(50), default="specific")  # deceased, category, specific
    category = Column(String(255), nullable=True)
    status = Column(String(50), default="discovered", index=True)  
    # discovered, analyzed, researching, draft_ready, under_review, saved, skipped, error
    priority = Column(String(20), default="medium")  # high, medium, low
    
    # Audit & Gap Analysis
    audit_flags = Column(Text, default="[]")  # JSON list of flags: ["missing_death_date", "stub", etc.]
    audit_summary = Column(Text, nullable=True)
    
    # Original Justapedia Article Content
    page_exists = Column(Boolean, default=True)
    original_wikitext = Column(Text, nullable=True)
    original_revid = Column(Integer, nullable=True)
    original_timestamp = Column(String(50), nullable=True)
    
    # AI Researched Facts & Verification
    researched_facts = Column(Text, nullable=True)  # JSON structured facts
    discrepancies = Column(Text, nullable=True)  # JSON list of conflicting/uncertain claims
    
    # Draft & Review
    generated_draft = Column(Text, nullable=True)  # Proposed updated or new wikitext
    user_edited_draft = Column(Text, nullable=True)  # Manually edited by user
    diff_summary = Column(Text, nullable=True)
    diff_json = Column(Text, nullable=True)  # JSON structured changes
    
    # Save & Publishing Status
    edit_summary = Column(String(500), nullable=True)
    saved_revid = Column(Integer, nullable=True)
    saved_timestamp = Column(String(50), nullable=True)
    saved_url = Column(String(500), nullable=True)
    is_sandbox_save = Column(Boolean, default=False)
    
    # Error tracking
    error_message = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    sources = relationship("SourceEvidence", back_populates="job", cascade="all, delete-orphan", lazy="selectin")


class SourceEvidence(Base):
    __tablename__ = "source_evidences"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    job_id = Column(Integer, ForeignKey("article_jobs.id", ondelete="CASCADE"), nullable=False)
    url = Column(String(1000), nullable=False)
    title = Column(String(500), nullable=False)
    publisher = Column(String(255), nullable=True)
    publish_date = Column(String(100), nullable=True)
    snippet = Column(Text, nullable=True)
    is_verified = Column(Boolean, default=True)
    reliability_score = Column(Integer, default=85)  # 0 - 100
    created_at = Column(DateTime, default=datetime.utcnow)

    job = relationship("ArticleJob", back_populates="sources")


class AppSetting(Base):
    __tablename__ = "app_settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=True)
    description = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
