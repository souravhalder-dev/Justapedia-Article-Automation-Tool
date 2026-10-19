Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "Starting Justapedia Article Automation Studio on http://localhost:8000" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan

Set-Location -Path $PSScriptRoot

Write-Host "Starting FastAPI server with Uvicorn on http://localhost:8000..." -ForegroundColor Green
Start-Process "http://localhost:8000"
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
