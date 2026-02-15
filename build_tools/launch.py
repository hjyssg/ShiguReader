"""
Launch script for ShiguReader application.
This script starts both backend and frontend servers.
"""

import os
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
FRONTEND_DIR = PROJECT_ROOT / "frontend"


def check_dependencies():
    """Check if required dependencies are installed."""
    print("Checking dependencies...")
    
    # Check Python
    try:
        import uvicorn
        import fastapi
        print("✓ Backend dependencies found")
    except ImportError:
        print("✗ Backend dependencies missing. Run: cd backend && uv sync")
        return False
    
    # Check Node modules
    if not (FRONTEND_DIR / "node_modules").exists():
        print("✗ Frontend dependencies missing. Run: cd frontend && npm install")
        return False
    
    print("✓ Frontend dependencies found")
    return True


def start_backend():
    """Start the FastAPI backend server."""
    print("\n" + "=" * 60)
    print("Starting Backend Server...")
    print("=" * 60)
    
    cmd = [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
    
    backend_process = subprocess.Popen(
        cmd,
        cwd=BACKEND_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )
    
    print(f"Backend starting at http://localhost:8000")
    return backend_process


def start_frontend():
    """Start the Vite frontend dev server."""
    print("\n" + "=" * 60)
    print("Starting Frontend Dev Server...")
    print("=" * 60)
    
    cmd = ["npm", "run", "dev"]
    
    frontend_process = subprocess.Popen(
        cmd,
        cwd=FRONTEND_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )
    
    print(f"Frontend starting at http://localhost:5173")
    return frontend_process


def main():
    """Main entry point."""
    print("\n" + "=" * 60)
    print("ShiguReader Launcher")
    print("=" * 60)
    
    if not check_dependencies():
        print("\n✗ Please install dependencies first.")
        sys.exit(1)
    
    try:
        # Start backend
        backend_process = start_backend()
        time.sleep(2)  # Wait for backend to start
        
        # Start frontend
        frontend_process = start_frontend()
        time.sleep(3)  # Wait for frontend to start
        
        # Open browser
        print("\n" + "=" * 60)
        print("Opening browser...")
        print("=" * 60)
        webbrowser.open("http://localhost:5173")
        
        print("\n✓ Application started successfully!")
        print("\nBackend:  http://localhost:8000")
        print("Frontend: http://localhost:5173")
        print("API Docs: http://localhost:8000/docs")
        print("\nPress Ctrl+C to stop all servers...")
        
        # Keep running and show output
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n\nStopping servers...")
        backend_process.terminate()
        frontend_process.terminate()
        backend_process.wait()
        frontend_process.wait()
        print("✓ All servers stopped.")
    except Exception as e:
        print(f"\n✗ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()