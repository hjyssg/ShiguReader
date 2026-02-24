/**
 * ReconcileQueue — 异步批量校准 DB 状态
 *
 * 解决的问题：读文件/下载文件等接口已经做了 stat/access，
 * 但结果没有沉淀到 DB。这里提供一个轻量队列，把"顺手观测到的事实"
 * 延迟批量写入 DB，避免每次请求都立即写库。
 *
 * 策略：
 * - 同一 filepath 30s 内只写一次（TTL 去重）
 * - 攒 200ms 窗口后批量 flush（事务内 UPDATE）
 */

import { getDb, nowTs } from "../db/client.js";
import { IndexRepository } from "../db/repository.js";

// ── 类型 ──────────────────────────────────────────────────────────────────────

interface PresenceEvent {
  filepath: string;
  exists: boolean;
  observedAt: number; // unix seconds
}

// ── 内部状态 ──────────────────────────────────────────────────────────────────

/** 待 flush 的事件，key = filepath */
const pending = new Map<string, PresenceEvent>();

/** 上次成功 flush 的时间戳，key = filepath，用于 TTL 去重 */
const lastFlushed = new Map<string, number>();

const DEDUP_TTL_SEC = 30;
const FLUSH_DELAY_MS = 200;

let flushTimer: ReturnType<typeof setTimeout> | null = null;

// ── 公开 API ──────────────────────────────────────────────────────────────────

/**
 * 观测到文件存在性事实，入队等待写 DB。
 * 同一 filepath 在 DEDUP_TTL_SEC 内重复调用会被忽略。
 */
export function observeFilePresence(filepath: string, exists: boolean): void {
  const now = nowTs();
  const last = lastFlushed.get(filepath);
  if (last !== undefined && now - last < DEDUP_TTL_SEC) return;

  pending.set(filepath, { filepath, exists, observedAt: now });

  if (!flushTimer) {
    flushTimer = setTimeout(flush, FLUSH_DELAY_MS);
  }
}

/** 立即 flush（测试用） */
export function flushNow(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  flush();
}

/** 清空内部状态（测试用） */
export function resetQueue(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  pending.clear();
  lastFlushed.clear();
}

// ── 内部 flush ────────────────────────────────────────────────────────────────

function flush(): void {
  flushTimer = null;
  if (!pending.size) return;

  const events = [...pending.values()];
  pending.clear();

  try {
    new IndexRepository(getDb()).batchReconcilePresence(events);
    for (const ev of events) lastFlushed.set(ev.filepath, ev.observedAt);
  } catch {
    // DB 写失败不影响主流程，静默忽略
  }
}
