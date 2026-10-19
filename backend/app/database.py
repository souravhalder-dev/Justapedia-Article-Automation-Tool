import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from .config import settings

# Determine database URL (force /tmp on Vercel for writable SQLite storage)
db_url = settings.DATABASE_URL
if os.environ.get("VERCEL") and "sqlite" in db_url:
    db_url = "sqlite+aiosqlite:////tmp/justapedia_editorial.db"

# Ensure sqlite directory exists
try:
    if db_url.startswith("sqlite+aiosqlite:///"):
        db_path = db_url.replace("sqlite+aiosqlite:///", "")
        dir_name = os.path.dirname(os.path.abspath(db_path))
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)
except Exception as e:
    print(f"Notice: SQLite directory preparation: {e}")

engine = create_async_engine(
    db_url,
    echo=settings.DEBUG,
    connect_args={"check_same_thread": False} if "sqlite" in db_url else {}
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

Base = declarative_base()

async def get_db():
    await init_db()
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def init_db():
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        print(f"Notice: database init_db: {e}")
