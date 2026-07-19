@echo off
setlocal

cd /d "%~dp0"
set "APP_DIR=%CD%"
set "PYTHON_EXE=%APP_DIR%\.venv\Scripts\python.exe"

echo.
echo ========================================
echo  The Jimmy App
echo  Collaborative Bughouse Coach
echo ========================================
echo.

if not exist "%PYTHON_EXE%" (
    echo Creating local Python environment...
    py -3 -m venv .venv
    if errorlevel 1 (
        echo.
        echo Could not create the virtual environment.
        echo Install Python 3.11+ from https://www.python.org/downloads/windows/
        echo Make sure "Add python.exe to PATH" is enabled.
        pause
        exit /b 1
    )
)

echo Installing/updating Python dependencies...
"%PYTHON_EXE%" -m pip install -r requirements.txt
if errorlevel 1 (
    echo.
    echo Dependency installation failed.
    echo Check your internet connection, then run this file again.
    pause
    exit /b 1
)

if not exist "%APP_DIR%\engines\fairy-stockfish.exe" (
    echo.
    echo WARNING: Fairy-Stockfish was not found at:
    echo %APP_DIR%\engines\fairy-stockfish.exe
    echo.
    echo The app will still open, but engine analysis needs that file.
    echo.
)

if not exist "%APP_DIR%\secrets" mkdir "%APP_DIR%\secrets"
if not exist "%APP_DIR%\data" mkdir "%APP_DIR%\data"
if not exist "%APP_DIR%\logs" mkdir "%APP_DIR%\logs"

echo Starting The Jimmy App...
echo Open http://localhost:8501 if your browser does not open automatically.
start "" "http://localhost:8501"

"%PYTHON_EXE%" -m streamlit run app.py --server.port 8501

echo.
echo App stopped.
pause
