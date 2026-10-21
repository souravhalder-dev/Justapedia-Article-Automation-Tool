from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import AppSetting
from ..schemas import SettingsUpdate, WikiTestConnectionResponse, OllamaTestResponse
from ..services.justapedia_client import justapedia_client
from ..config import settings
from ..services.ai_service import ai_service

router = APIRouter(prefix="/api/settings", tags=["Settings"])

def mask_secret(val: str) -> str:
    if not val:
        return ""
    if len(val) <= 6:
        return "******"
    return val[:3] + "..." + val[-3:]

@router.get("")
async def get_settings():
    """Retrieve current system configuration with masked secrets."""
    return {
        "justapedia_api_url": settings.JUSTAPEDIA_API_URL,
        "justapedia_bot_username": settings.JUSTAPEDIA_BOT_USERNAME or "",
        "justapedia_has_password": bool(settings.JUSTAPEDIA_BOT_PASSWORD),
        "justapedia_bot_password_masked": mask_secret(settings.JUSTAPEDIA_BOT_PASSWORD or ""),
        "ai_provider": settings.AI_PROVIDER,
        "ollama_base_url": settings.OLLAMA_BASE_URL,
        "ollama_model": settings.OLLAMA_MODEL,
        "gemini_has_key": bool(settings.GEMINI_API_KEY),
        "gemini_key_masked": mask_secret(settings.GEMINI_API_KEY or ""),
        "gemini_model": settings.GEMINI_MODEL,
        "safe_test_mode": settings.SAFE_TEST_MODE,
        "sandbox_page_title": settings.SANDBOX_PAGE_TITLE
    }

@router.post("")
async def update_settings(
    payload: SettingsUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update system settings dynamically."""
    if payload.justapedia_api_url is not None:
        settings.JUSTAPEDIA_API_URL = payload.justapedia_api_url.strip()
        justapedia_client.api_url = settings.JUSTAPEDIA_API_URL
        
    if payload.justapedia_bot_username is not None:
        settings.JUSTAPEDIA_BOT_USERNAME = payload.justapedia_bot_username.strip()
        
    if payload.justapedia_bot_password is not None:
        settings.JUSTAPEDIA_BOT_PASSWORD = payload.justapedia_bot_password.strip()

    if payload.ai_provider is not None:
        settings.AI_PROVIDER = payload.ai_provider.strip().lower()

    if payload.ollama_base_url is not None:
        settings.OLLAMA_BASE_URL = payload.ollama_base_url.strip()

    if payload.ollama_model is not None:
        settings.OLLAMA_MODEL = payload.ollama_model.strip()
        
    if payload.gemini_api_key is not None:
        key = payload.gemini_api_key.strip()
        settings.GEMINI_API_KEY = key
        ai_service.api_key = key
        # Re-initialize Gemini client
        if key:
            try:
                from google import genai
                ai_service.client = genai.Client(api_key=key)
            except Exception:
                pass
                
    if payload.gemini_model is not None:
        settings.GEMINI_MODEL = payload.gemini_model.strip()
        
    if payload.safe_test_mode is not None:
        settings.SAFE_TEST_MODE = payload.safe_test_mode
        
    if payload.sandbox_page_title is not None:
        settings.SANDBOX_PAGE_TITLE = payload.sandbox_page_title.strip()

    return {"message": "Settings updated successfully"}

@router.post("/test-ollama", response_model=OllamaTestResponse)
async def test_ollama_connection(payload: dict = None):
    """Verify live connectivity and list models from local or remote Ollama API."""
    base_url = (payload or {}).get("base_url") or settings.OLLAMA_BASE_URL
    res = await ai_service.test_ollama(base_url=base_url)
    return OllamaTestResponse(
        connected=res.get("connected", False),
        models=res.get("models", []),
        current_model=res.get("current_model", settings.OLLAMA_MODEL),
        base_url=res.get("base_url", settings.OLLAMA_BASE_URL),
        message=res.get("message", "")
    )

@router.post("/test-wiki", response_model=WikiTestConnectionResponse)
async def test_wiki_connection():
    """Verify live connectivity and capabilities of Justapedia Wiki MediaWiki API."""
    res = await justapedia_client.test_connection()
    return WikiTestConnectionResponse(
        connected=res.get("connected", False),
        sitename=res.get("sitename"),
        generator=res.get("generator"),
        logged_in=res.get("logged_in", False),
        username=res.get("username"),
        can_write=res.get("can_write", False),
        message=res.get("message", "")
    )

@router.post("/login-wiki")
async def login_wiki(payload: dict):
    """Authenticate with Justapedia using bot username and bot password."""
    username = payload.get("username") or settings.JUSTAPEDIA_BOT_USERNAME
    password = payload.get("password") or settings.JUSTAPEDIA_BOT_PASSWORD
    
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password are required for login.")
        
    success, message = await justapedia_client.login(username=username, password=password)
    if success:
        settings.JUSTAPEDIA_BOT_USERNAME = username
        settings.JUSTAPEDIA_BOT_PASSWORD = password
        return {"success": True, "message": message, "username": username}
    else:
        return {"success": False, "message": message}
