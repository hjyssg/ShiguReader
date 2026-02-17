from __future__ import annotations

"""SQLite 卡死应急脚本：一键解锁、修复并可选拉起后端。

使用场景：
- 出现 "database is locked"，接口请求整体卡住。
- 需要先清理端口占用，再统一修复 index/user 两个 sqlite 库。

典型用法：
- 修复并启动后端：
  python backend/scripts/sqlite_rescue_and_run.py --kill-port --port 8000
- 仅修复数据库：
  python backend/scripts/sqlite_rescue_and_run.py --repair-only
"""

import argparse
import os
from pathlib import Path
import sqlite3
import subprocess
import time


def sqlite_url_to_path(sqlite_url: str, base_dir: Path) -> Path | None:
    """将 sqlite URL（sqlite:///...）解析为本地绝对路径。"""
    if not sqlite_url.startswith("sqlite:///"):
        return None
    raw = sqlite_url.removeprefix("sqlite:///")
    if raw in {"", ":memory:"}:
        return None

    p = Path(raw)
    if not p.is_absolute():
        p = (base_dir / p).resolve()
    return p


def collect_sqlite_paths(base_dir: Path) -> list[Path]:
    """收集需要修复的 SQLite 文件路径（index + user），并去重。"""
    urls = [
        os.getenv("INDEX_SQLITE_URL", "sqlite:///../data/index.db"),
        os.getenv("USER_SQLITE_URL", "sqlite:///../data/user.db"),
    ]
    paths: list[Path] = []
    for url in urls:
        p = sqlite_url_to_path(url, base_dir)
        if p is not None and p not in paths:
            paths.append(p)
    return paths


def pids_on_port(port: int) -> set[int]:
    """通过 netstat 查找占用指定 TCP 端口的 PID 集合。"""
    try:
        proc = subprocess.run(
            ["netstat", "-ano", "-p", "tcp"],
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
        )
    except Exception:
        return set()

    pids: set[int] = set()
    marker = f":{port}"
    for line in proc.stdout.splitlines():
        line = line.strip()
        if marker not in line:
            continue
        parts = line.split()
        if len(parts) < 5:
            continue
        if parts[0].upper() != "TCP":
            continue
        local_addr = parts[1]
        state = parts[3].upper()
        pid_text = parts[4]
        if not local_addr.endswith(marker):
            continue
        if state not in {"LISTENING", "ESTABLISHED", "CLOSE_WAIT", "TIME_WAIT"}:
            continue
        if pid_text.isdigit():
            pids.add(int(pid_text))
    return pids


def kill_pids(pids: set[int]) -> None:
    """强制结束指定 PID（跳过当前脚本进程）。"""
    for pid in sorted(pids):
        if pid == os.getpid():
            continue
        print(f"[sqlite-rescue] 结束占用进程 PID={pid}")
        subprocess.run(
            ["taskkill", "/PID", str(pid), "/F"],
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
        )


def repair_one_db(db_path: Path, retries: int = 10, retry_wait: float = 0.5) -> bool:
    """修复单个 SQLite 库并设置并发友好的 PRAGMA。

    返回：
    - True: 修复成功
    - False: 修复失败（含多次重试后仍锁住）
    """
    db_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"[sqlite-rescue] 修复数据库: {db_path}")

    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        conn: sqlite3.Connection | None = None
        try:
            # timeout + busy_timeout 双保险：尽量等待锁释放，避免立刻失败。
            conn = sqlite3.connect(db_path, timeout=30)
            # 与应用运行时保持一致的稳定参数。
            conn.execute("PRAGMA foreign_keys = ON")
            conn.execute("PRAGMA journal_mode = WAL")
            conn.execute("PRAGMA synchronous = NORMAL")
            conn.execute("PRAGMA busy_timeout = 30000")
            # 清理/压缩 WAL，降低残留锁竞争概率。
            conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
            # 快速完整性检查，确认 DB 基本健康。
            check_row = conn.execute("PRAGMA quick_check").fetchone()
            conn.commit()
            check_text = check_row[0] if check_row else "unknown"
            print(f"[sqlite-rescue] quick_check={check_text}")
            return True
        except sqlite3.OperationalError as e:
            last_error = e
            # 典型锁冲突：自动重试，提高一次成功率。
            if "locked" in str(e).lower() and attempt < retries:
                print(
                    f"[sqlite-rescue] 第 {attempt}/{retries} 次遇到锁，{retry_wait}s 后重试..."
                )
                time.sleep(retry_wait)
                continue
            break
        finally:
            if conn is not None:
                conn.close()

    print(f"[sqlite-rescue] 修复失败: {db_path}")
    if last_error is not None:
        print(f"[sqlite-rescue] 错误详情: {last_error}")
    return False


def start_backend(port: int, reload: bool) -> None:
    """修复完成后启动 FastAPI（uvicorn）。"""
    print(f"[sqlite-rescue] 启动后端: http://127.0.0.1:{port}")
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=port,
        reload=reload,
        log_level="info",
    )


def parse_args() -> argparse.Namespace:
    """解析命令行参数。"""
    parser = argparse.ArgumentParser(
        description="一键处理 SQLite 锁问题（可选启动后端）"
    )
    parser.add_argument("--port", type=int, default=8000, help="后端端口")
    parser.add_argument(
        "--kill-port",
        action="store_true",
        default=True,
        help="先结束占用后端端口的进程（默认开启）",
    )
    parser.add_argument(
        "--no-kill-port",
        action="store_false",
        dest="kill_port",
        help="不结束端口占用进程",
    )
    parser.add_argument(
        "--repair-only",
        action="store_true",
        help="只做数据库修复，不启动后端",
    )
    parser.add_argument("--reload", action="store_true", help="以热重载模式启动后端")
    return parser.parse_args()


def main() -> int:
    """主流程：可选杀端口进程 -> 修复 DB -> 可选启动后端。"""
    args = parse_args()
    backend_dir = Path(__file__).resolve().parents[1]

    if args.kill_port:
        # 先处理端口占用，避免旧进程持续占库。
        pids = pids_on_port(args.port)
        if pids:
            kill_pids(pids)
            time.sleep(0.5)

    # 从环境变量（.env）推导 sqlite 文件路径。
    db_paths = collect_sqlite_paths(backend_dir)
    if not db_paths:
        print("[sqlite-rescue] 未发现 sqlite:/// URL，跳过数据库修复")

    ok = True
    for db_path in db_paths:
        ok = repair_one_db(db_path) and ok

    if not ok:
        return 2

    # 默认修完直接启动后端，减少人工步骤。
    if not args.repair_only:
        start_backend(port=args.port, reload=args.reload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
