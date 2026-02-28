#!/usr/bin/env python3
"""
将旧版 ShiguReader 的 history_table 导入到当前项目 read_history。

默认是 dry-run（只检查与统计，不写入）。
要真正执行，请加 --execute。
"""

from __future__ import annotations

import argparse
import datetime as dt
import shutil
import sqlite3
from pathlib import Path


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Import legacy history_table into read_history")
    p.add_argument(
        "--target-db",
        default="data/index_node.db",
        help="目标数据库（新项目）",
    )
    p.add_argument(
        "--source-db",
        default=r"D:/Git/ShiguReader/packages/backend/workspace/shigureader_internal_db.sqlite",
        help="源数据库（旧项目）",
    )
    p.add_argument(
        "--report",
        default="docs/history-import-report.md",
        help="导入报告 md 路径",
    )
    p.add_argument(
        "--backup-dir",
        default="data",
        help="备份文件输出目录",
    )
    p.add_argument(
        "--source-time-unit",
        choices=["auto", "ms", "s"],
        default="auto",
        help="旧库 history_table.time 的单位：auto/ms/s（默认 auto）",
    )
    p.add_argument(
        "--execute",
        action="store_true",
        help="执行写入（清空 read_history + 导入）",
    )
    return p.parse_args()


def source_time_to_seconds_sql(unit: str, column: str = "time") -> str:
    """
    生成把源时间转换为秒级 Unix 时间戳的 SQL 表达式。
    - ms: 毫秒 -> 秒
    - s:  秒 -> 秒
    - auto: > 9999999999 视为毫秒，否则视为秒
    """
    if unit == "ms":
        return f"CAST({column} / 1000 AS INTEGER)"
    if unit == "s":
        return f"CAST({column} AS INTEGER)"
    return f"CASE WHEN {column} > 9999999999 THEN CAST({column} / 1000 AS INTEGER) ELSE CAST({column} AS INTEGER) END"


def ensure_table_exists(cur: sqlite3.Cursor, table: str, db_alias: str = "main") -> None:
    row = cur.execute(
        f"SELECT name FROM {db_alias}.sqlite_master WHERE type='table' AND name=?",
        (table,),
    ).fetchone()
    if row is None:
        raise RuntimeError(f"数据库 {db_alias} 中缺少表: {table}")


def write_report(
    report_path: Path,
    now: dt.datetime,
    target_db: Path,
    source_db: Path,
    backup_db: Path | None,
    execute: bool,
    source_time_unit: str,
    before_count: int,
    source_total_count: int,
    source_valid_count: int,
    after_count: int,
    sample_rows: list[tuple[int, str, int]],
) -> None:
    success = (not execute) or (after_count == source_valid_count)
    status = "成功" if success else "异常（请检查）"
    mode = "execute" if execute else "dry-run"

    sample_lines = [
        f"- id={rid}, opened_at={opened_at}, filepath={filepath}"
        for rid, filepath, opened_at in sample_rows
    ]
    if not sample_lines:
        sample_lines = ["- （无样本记录）"]

    backup_line = f"`{backup_db}`" if backup_db else "（dry-run 未生成备份）"

    report = f"""# History 导入报告

- 执行时间：{now.strftime('%Y-%m-%d %H:%M:%S')}
- 模式：{mode}
- 源时间单位：{source_time_unit}
- 状态：{status}

## 数据库路径

- 目标库（新）：`{target_db.as_posix()}`
- 源库（旧）：`{source_db.as_posix()}`
- 目标库备份：{backup_line}

## 映射规则

- `history_table.filePath` -> `read_history.filepath`
- `history_table.time` -> `read_history.opened_at`

## 数量校验

- 目标库导入前 `read_history` 条数：**{before_count}**
- 源库 `history_table` 总条数：**{source_total_count}**
- 源库有效可导入条数（filePath/time 非空）：**{source_valid_count}**
- 目标库导入后 `read_history` 条数：**{after_count}**
- 导入条数一致性：**{'通过' if success else '未通过'}**

## 样本（目标 read_history 按 opened_at 倒序 Top 5）

{chr(10).join(sample_lines)}
"""
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(report, encoding="utf-8")


def main() -> None:
    args = parse_args()
    now = dt.datetime.now()

    target_db = Path(args.target_db).resolve()
    source_db = Path(args.source_db).resolve()
    report_path = Path(args.report).resolve()
    backup_dir = Path(args.backup_dir).resolve()

    if not target_db.exists():
        raise SystemExit(f"目标数据库不存在: {target_db}")
    if not source_db.exists():
        raise SystemExit(f"源数据库不存在: {source_db}")

    conn = sqlite3.connect(str(target_db))
    backup_db: Path | None = None
    try:
        cur = conn.cursor()
        ensure_table_exists(cur, "read_history", "main")

        before_count = cur.execute("SELECT COUNT(*) FROM read_history").fetchone()[0]

        cur.execute("ATTACH DATABASE ? AS olddb", (str(source_db),))
        ensure_table_exists(cur, "history_table", "olddb")

        source_total_count = cur.execute("SELECT COUNT(*) FROM olddb.history_table").fetchone()[0]
        source_valid_count = cur.execute(
            "SELECT COUNT(*) FROM olddb.history_table WHERE filePath IS NOT NULL AND time IS NOT NULL"
        ).fetchone()[0]
        opened_at_expr = source_time_to_seconds_sql(args.source_time_unit, "time")

        if args.execute:
            backup_dir.mkdir(parents=True, exist_ok=True)
            backup_db = backup_dir / f"index_node.backup-{now.strftime('%Y%m%d-%H%M%S')}.db"
            shutil.copy2(target_db, backup_db)

            cur.execute("BEGIN")
            try:
                cur.execute("DELETE FROM read_history")
                cur.execute(
                    f"""
                    INSERT INTO read_history (filepath, opened_at)
                    SELECT filePath, {opened_at_expr}
                    FROM olddb.history_table
                    WHERE filePath IS NOT NULL AND time IS NOT NULL
                    """
                )
                cur.execute("COMMIT")
            except Exception:
                cur.execute("ROLLBACK")
                raise

        after_count = cur.execute("SELECT COUNT(*) FROM read_history").fetchone()[0]
        sample_rows = cur.execute(
            "SELECT id, filepath, opened_at FROM read_history ORDER BY opened_at DESC, id DESC LIMIT 5"
        ).fetchall()

        cur.execute("DETACH DATABASE olddb")
    finally:
        conn.close()

    write_report(
        report_path=report_path,
        now=now,
        target_db=target_db,
        source_db=source_db,
        backup_db=backup_db,
        execute=args.execute,
        source_time_unit=args.source_time_unit,
        before_count=before_count,
        source_total_count=source_total_count,
        source_valid_count=source_valid_count,
        after_count=after_count,
        sample_rows=sample_rows,
    )

    print("完成")
    print(f"模式: {'execute' if args.execute else 'dry-run'}")
    print(f"目标库: {target_db}")
    print(f"源库: {source_db}")
    if backup_db:
        print(f"备份: {backup_db}")
    print(f"导入前: {before_count}")
    print(f"源总数: {source_total_count}")
    print(f"源有效: {source_valid_count}")
    print(f"导入后: {after_count}")
    print(f"报告: {report_path}")


if __name__ == "__main__":
    main()
