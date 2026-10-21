from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

class SourceEvidenceSchema(BaseModel):
    id: Optional[int] = None
    url: str
    title: str
    publisher: Optional[str] = None
    publish_date: Optional[str] = None
    snippet: Optional[str] = None
    is_verified: bool = True
    reliability_score: int = 85

    class Config:
        from_attributes = True

class ArticleJobCreate(BaseModel):
    title: str
    mode: str = "specific"
    category: Optional[str] = None
    priority: str = "medium"

class BatchCreateArticles(BaseModel):
    titles: List[str]
    mode: str = "specific"
    category: Optional[str] = None

class CategoryDiscoverRequest(BaseModel):
    category_name: Optional[str] = None
    limit: int = 25
    mode: str = "category"  # "category" or "deceased"
    filter_incomplete_only: bool = True

class ArticleJobResponse(BaseModel):
    id: int
    title: str
    mode: str
    category: Optional[str] = None
    status: str
    priority: str
    audit_flags: List[str] = []
    audit_summary: Optional[str] = None
    page_exists: bool = True
    original_wikitext: Optional[str] = None
    original_revid: Optional[int] = None
    original_timestamp: Optional[str] = None
    researched_facts: Optional[Dict[str, Any]] = None
    discrepancies: Optional[List[Dict[str, Any]]] = None
    generated_draft: Optional[str] = None
    user_edited_draft: Optional[str] = None
    diff_summary: Optional[str] = None
    diff_json: Optional[Dict[str, Any]] = None
    edit_summary: Optional[str] = None
    saved_revid: Optional[int] = None
    saved_timestamp: Optional[str] = None
    saved_url: Optional[str] = None
    is_sandbox_save: bool = False
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    sources: List[SourceEvidenceSchema] = []

    class Config:
        from_attributes = True

class SaveToWikiRequest(BaseModel):
    custom_title: Optional[str] = None
    wikitext: str
    edit_summary: str = "Update biographical details and citations via Justapedia Editorial Assistant"
    is_minor: bool = False
    is_bot: bool = True
    use_sandbox: Optional[bool] = None  # None uses system default setting

class SaveToWikiResponse(BaseModel):
    success: bool
    title: str
    revid: Optional[int] = None
    url: Optional[str] = None
    is_sandbox: bool = False
    message: str
    raw_response: Optional[Dict[str, Any]] = None

class SettingsUpdate(BaseModel):
    justapedia_api_url: Optional[str] = None
    justapedia_bot_username: Optional[str] = None
    justapedia_bot_password: Optional[str] = None
    ai_provider: Optional[str] = None
    ollama_base_url: Optional[str] = None
    ollama_model: Optional[str] = None
    gemini_api_key: Optional[str] = None
    gemini_model: Optional[str] = None
    safe_test_mode: Optional[bool] = None
    sandbox_page_title: Optional[str] = None

class OllamaTestResponse(BaseModel):
    connected: bool
    models: List[str] = []
    current_model: str = "llama3.2"
    base_url: str = "http://localhost:11434"
    message: str

class WikiTestConnectionResponse(BaseModel):
    connected: bool
    sitename: Optional[str] = None
    generator: Optional[str] = None
    logged_in: bool = False
    username: Optional[str] = None
    can_write: bool = False
    message: str
