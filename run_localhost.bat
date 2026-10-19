@echo off
title Justapedia Article Automation Studio - Localhost Server
echo ==============================================================================
echo Starting Justapedia Article Automation Studio on http://localhost:8000
echo ==============================================================================

cd /d "%~dp0"

echo Building latest frontend bundle...
cd frontend
call npm run build
cd ..

echo Starting FastAPI server with Uvicorn...
start "" "http://localhost:8000"
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload

pause
