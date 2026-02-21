@echo off
chcp 65001 >nul
title ShiguReader

cd /d "%~dp0"

echo [1/2] Building frontend...
cd /d "%~dp0frontend"
call npm run build
if errorlevel 1 (
    echo [ERROR] Frontend build failed!
    pause
    exit /b 1
)

echo [2/2] Starting ShiguReader on http://localhost:8000 ...
cd /d "%~dp0backendnode"

:: Auto-open browser after a short delay
start "" /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:8000"

node --experimental-sqlite src/server.ts
pause
