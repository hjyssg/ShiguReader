@echo off
chcp 65001 >nul
title ShiguReader Backend

cd /d "%~dp0"

echo [1/2] Building frontend...
cd /d "%~dp0frontend"
call npm run build
if errorlevel 1 (
    echo Frontend build failed!
    pause
    exit /b 1
)

echo [2/2] Starting backend on http://127.0.0.1:8000 ...
cd /d "%~dp0backendnode"
node --experimental-sqlite src/server.ts
pause
