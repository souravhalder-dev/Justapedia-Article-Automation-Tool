import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Optional

# Base directory of backend
BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    APP_NAME: str = "Justapedia Article Research & Editorial Studio"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Justapedia Wiki MediaWiki API
    JUSTAPEDIA_API_URL: str = "https://justapedia.org/api.php"
    JUSTAPEDIA_BOT_USERNAME: Optional[str] = None
    JUSTAPEDIA_BOT_PASSWORD: Optional[str] = None
    
    # Safe Test Mode: If True, saves are directed to Justapedia:Sandbox instead of live article
    SAFE_TEST_MODE: bool = False
    SANDBOX_PAGE_TITLE: str = "Justapedia:Sandbox"
    
    # Standard MediaWiki Request Headers (Realistic User-Agent to pass Cloudflare/WAF)
    USER_AGENT: str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    
    # AI / LLM Configuration
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-3.8-flash"
    
    # Research & Search Configuration
    SEARCH_PROVIDER: str = "hybrid"  # duckduckgo, wikipedia, hybrid
    MAX_SEARCH_RESULTS: int = 8
    
    # Database: Use /tmp directory if running in Vercel serverless environment
    DATABASE_URL: str = os.environ.get(
        "DATABASE_URL",
        "sqlite+aiosqlite:////tmp/justapedia_editorial.db" if os.environ.get("VERCEL") else f"sqlite+aiosqlite:///{BASE_DIR}/justapedia_editorial.db"
    )
    
    # Rate Limiting & Safety
    REQUEST_DELAY_SECONDS: float = 0.5
    MAX_BATCH_SIZE: int = 50

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore"
    }

settings = Settings()
