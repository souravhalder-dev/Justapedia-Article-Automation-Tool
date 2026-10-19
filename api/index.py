import sys
import os
import traceback
import logging

logger = logging.getLogger(__name__)

# Ensure the root directory of the repository is in Python's import search path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(CURRENT_DIR)
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

try:
    from backend.app.main import app
except Exception as e:
    tb_str = traceback.format_exc()
    logger.critical(f"FATAL: Failed to import FastAPI application: {e}\n{tb_str}")
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    app = FastAPI(title="Justapedia Serverless Diagnostic Fallback")

    @app.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "DELETE"])
    async def diagnostic_fallback(full_path: str):
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "error_type": type(e).__name__,
                "detail": str(e),
                "traceback": tb_str.splitlines()[-15:]
            }
        )

# Exported ASGI entrypoint for Vercel Serverless
__all__ = ["app"]
