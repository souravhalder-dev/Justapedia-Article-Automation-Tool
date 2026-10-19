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

@app.get("/")
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

if os.path.exists(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

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
            return FileResponse(index_file)
        return {"status": "online", "app": settings.APP_NAME}
