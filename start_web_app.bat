@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Python environment not found. Run: python -m venv .venv
  exit /b 1
)
if not exist "frontend\dist\index.html" (
  echo Frontend build not found. Run: cd frontend ^&^& pnpm install ^&^& pnpm run build
  exit /b 1
)
start "The Jimmy App" http://127.0.0.1:8000
".venv\Scripts\python.exe" -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
