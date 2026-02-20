@echo off
chcp 65001 >nul
title ShiguReader Backend

cd /d "%~dp0"

echo [1/2] Building frontend...
node_modules\.bin\vite.exe build frontend
if errorlevel 1 (
    echo Frontend build failed!
    pause
    exit /b 1
)

echo [2/2] Starting backend on http://127.0.0.1:8000 ...
cd /d "%~dp0backend"
python -m fastapi run --host 0.0.0.0 --port 8000 app/main.py
pause
