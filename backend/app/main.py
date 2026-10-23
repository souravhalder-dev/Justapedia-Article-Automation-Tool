import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .config import settings, BASE_DIR
from .database import init_db
from .api.routes_discovery import router as discovery_router
from .api.routes_articles import router as articles_router
from .api.routes_settings import router as settings_router
from .api.routes_batch import router as batch_router
from .api.routes_auth import router as auth_router
from .services.justapedia_client import justapedia_client

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: safely initialize database tables
    try:
        await init_db()
    except Exception as e:
        print(f"Database initialization notice: {e}")
        
    yield
    # Shutdown: gracefully close client sessions
    try:
        await justapedia_client.close()
    except Exception:
        pass

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan
)

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(discovery_router)
app.include_router(articles_router)
app.include_router(settings_router)
app.include_router(batch_router)
app.include_router(auth_router)

@app.get("/api")
@app.get("/api/")
@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "wiki_url": settings.JUSTAPEDIA_API_URL,
        "safe_test_mode": settings.SAFE_TEST_MODE
    }

# Mount static frontend build if present
frontend_dist = os.path.join(BASE_DIR.parent, "frontend", "dist")
if not os.path.exists(frontend_dist):
    alt_dist = os.path.join(os.getcwd(), "frontend", "dist")
    if os.path.exists(alt_dist):
        frontend_dist = alt_dist

INDEX_HEADERS = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
}

if os.path.exists(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")

    @app.get("/assets/{asset_file:path}")
    async def serve_asset(asset_file: str):
        if os.path.exists(assets_dir):
            target_path = os.path.join(assets_dir, asset_file)
            if os.path.exists(target_path) and os.path.isfile(target_path):
                return FileResponse(target_path)
            
            # Resilient fallback for stale asset hashes from client browser caches
            if asset_file.endswith(".js"):
                for f in sorted(os.listdir(assets_dir)):
                    if f.endswith(".js"):
                        return FileResponse(os.path.join(assets_dir, f), media_type="application/javascript")
            elif asset_file.endswith(".css"):
                for f in sorted(os.listdir(assets_dir)):
                    if f.endswith(".css"):
                        return FileResponse(os.path.join(assets_dir, f), media_type="text/css")

        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Asset not found")

    @app.get("/")
    async def serve_index():
        index_file = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file, headers=INDEX_HEADERS)
        return {"status": "online", "app": settings.APP_NAME}

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Don't intercept API paths
        if full_path.startswith("api"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="API route not found")
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        index_file = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file, headers=INDEX_HEADERS)
        return {"status": "online", "app": settings.APP_NAME}
