"""Runtime launcher used by PyInstaller exe.

职责：
1) 启动内嵌 FastAPI 后端（同时托管已打包前端静态资源）
2) 自动打开浏览器到前端入口页
"""

from __future__ import annotations

import socket
import threading
import time
import webbrowser

import uvicorn
from app.main import app


HOST = "127.0.0.1"
PORT = 8000


def _wait_port_ready(host: str, port: int, timeout_sec: float = 20.0) -> bool:
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.5)
            if sock.connect_ex((host, port)) == 0:
                return True
        time.sleep(0.2)
    return False


def _run_server() -> None:
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")


def main() -> None:
    print("=" * 60)
    print("ShiguReader EXE Launcher")
    print("=" * 60)
    print(f"Starting backend on http://{HOST}:{PORT} ...")

    server_thread = threading.Thread(target=_run_server, daemon=True)
    server_thread.start()

    if _wait_port_ready(HOST, PORT):
        url = f"http://{HOST}:{PORT}"
        print(f"Opening browser: {url}")
        webbrowser.open(url)
    else:
        print("Warning: backend did not become ready in time, browser will not auto-open.")

    print("Press Ctrl+C to exit.")
    try:
        while server_thread.is_alive():
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nStopping ShiguReader...")


if __name__ == "__main__":
    main()
