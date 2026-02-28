@echo off
chcp 65001 >nul
title ShiguReader Dev

cd /d "%~dp0"

echo Starting ShiguReader in development mode...
echo  - Frontend: http://localhost:5173 (Vite HMR)
echo  - Backend:  http://localhost:8000
echo.

:: Install frontend dependencies if needed
if not exist "%~dp0frontend\node_modules" (
    echo [Setup] Installing frontend dependencies...
    cd /d "%~dp0frontend"
    call npm install
)

:: Install backend dependencies if needed
if not exist "%~dp0backend\node_modules" (
    echo [Setup] Installing backend dependencies...
    cd /d "%~dp0backend"
    call npm install
)

:: Start frontend dev server in a new window
start "ShiguReader Frontend" cmd /k "chcp 65001 >nul && cd /d "%~dp0frontend" && npm run dev"

:: Start backend with tsx watch in a new window
start "ShiguReader Backend" cmd /k "chcp 65001 >nul && cd /d "%~dp0backend" && npx tsx watch src/server.ts"

:: Open browser after a short delay
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo Both servers started. Close the terminal windows to stop.
