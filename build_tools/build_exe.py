"""Build script to package ShiguReader as a standalone Windows executable."""

import json
import subprocess
import sys
from pathlib import Path

# Get project root (parent of build_tools directory)
PROJECT_ROOT = Path(__file__).parent.parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"
DIST_DIR = PROJECT_ROOT / "dist"


def run_command(cmd, cwd=None):
    """Run a shell command and check for errors."""
    print(f"\n>>> Running: {cmd}")
    result = subprocess.run(
        cmd,
        shell=True,
        cwd=cwd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore",
    )
    if result.returncode != 0:
        print(f"Error: {result.stderr}")
        sys.exit(1)
    print(result.stdout)
    return result


def build_frontend():
    """Build frontend bundle for exe packaging."""
    print("\n" + "=" * 60)
    print("Building Frontend...")
    print("=" * 60)
    
    # Install dependencies if needed
    if not (FRONTEND_DIR / "node_modules").exists():
        print("Installing frontend dependencies...")
        run_command("npm install", cwd=FRONTEND_DIR)
    
    # Build frontend: prefer build:exe (no tsc blocking), fallback to vite build
    print("Building frontend production bundle...")
    package_json = json.loads((FRONTEND_DIR / "package.json").read_text(encoding="utf-8"))
    scripts = package_json.get("scripts", {})
    if "build:exe" in scripts:
        run_command("npm run build:exe", cwd=FRONTEND_DIR)
    else:
        run_command("npx vite build", cwd=FRONTEND_DIR)
    
    # Verify build output
    frontend_dist = FRONTEND_DIR / "dist"
    if not frontend_dist.exists():
        print("Error: Frontend build failed - dist directory not found")
        sys.exit(1)
    
    print(f"✓ Frontend built successfully at {frontend_dist}")
    return frontend_dist


def create_pyinstaller_spec():
    """Create PyInstaller spec file."""
    print("\n" + "=" * 60)
    print("Creating PyInstaller spec...")
    print("=" * 60)
    
    spec_content = """# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['build_tools/exe_launcher.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('frontend/dist', 'frontend/dist'),
        ('backend/app', 'app'),
        ('.env.example', '.'),
    ],
    hiddenimports=[
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'sqlalchemy.sql.default_comparator',
        'sqlmodel',
        'pydantic',
        'fastapi',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='ShiguReader',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)
"""
    
    spec_file = PROJECT_ROOT / "shigureader.spec"
    spec_file.write_text(spec_content)
    print(f"✓ Created spec file: {spec_file}")
    return spec_file


def build_exe():
    """Build executable with PyInstaller."""
    print("\n" + "=" * 60)
    print("Building Executable...")
    print("=" * 60)
    
    # Check if PyInstaller is installed
    try:
        import PyInstaller
    except ImportError:
        print("PyInstaller not found. Installing...")
        # Use uv to install PyInstaller
        run_command("uv pip install pyinstaller", cwd=PROJECT_ROOT)
    
    # Create spec file
    spec_file = create_pyinstaller_spec()
    
    # Run PyInstaller
    print("Running PyInstaller...")
    run_command(f"{sys.executable} -m PyInstaller --clean --noconfirm {spec_file}")
    
    # Check output
    exe_path = DIST_DIR / "ShiguReader.exe"
    if not exe_path.exists():
        print("Error: Executable not found after build")
        sys.exit(1)
    
    print(f"\n✓ Executable built successfully: {exe_path}")
    print(f"  Size: {exe_path.stat().st_size / (1024*1024):.1f} MB")

    # Ensure dist/.env exists for release handoff (copy exe template if missing)
    dist_env = DIST_DIR / ".env"
    env_exe = PROJECT_ROOT / "build_tools" / ".env.exe"
    env_example = PROJECT_ROOT / ".env.example"
    env_source = env_exe if env_exe.exists() else env_example
    if not dist_env.exists() and env_source.exists():
        dist_env.write_text(env_source.read_text(encoding="utf-8"), encoding="utf-8")
        print(f"✓ Generated env template for release: {dist_env}")

    # Ensure dist/data directories exist for exe runtime
    (DIST_DIR / "data").mkdir(parents=True, exist_ok=True)
    (DIST_DIR / "data" / "thumb_cache").mkdir(parents=True, exist_ok=True)
    (DIST_DIR / "data" / "extract_cache").mkdir(parents=True, exist_ok=True)

    return exe_path


def main():
    """Main build process."""
    print("\n" + "=" * 60)
    print("ShiguReader Build Script")
    print("=" * 60)
    
    # Step 1: Build frontend
    build_frontend()
    
    # Step 2: Build executable
    exe_path = build_exe()
    
    print("\n" + "=" * 60)
    print("Build Complete!")
    print("=" * 60)
    print(f"\nExecutable: {exe_path}")
    print("\nTo run the application:")
    print(f"  {exe_path}")
    print("\nNote: Optional .env can be placed next to exe; defaults allow quick start.")


if __name__ == "__main__":
    main()
