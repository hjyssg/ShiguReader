/**
 * Unit tests for reconcileQueue
 *
 * 测试策略：mock getDb，验证队列的去重、批量写入、TTL 逻辑。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── mock DB ──────────────────────────────────────────────────────────────────

const mockRun = vi.fn();
const mockPrepare = vi.fn(() => ({ run: mockRun }));
const mockExec = vi.fn();
const mockDb = { prepare: mockPrepare, exec: mockExec };

vi.mock("../../src/db/client.js", () => ({
  getDb: () => mockDb,
  nowTs: () => Math.floor(Date.now() / 1000),
}));

// ── import after mock ────────────────────────────────────────────────────────

import {
  observeFilePresence,
  flushNow,
  resetQueue,
} from "../../src/services/reconcileQueue.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function clearMocks() {
  mockRun.mockClear();
  mockPrepare.mockClear();
  mockExec.mockClear();
}

// ── tests ────────────────────────────────────────────────────────────────────

describe("reconcileQueue", () => {
  beforeEach(() => {
    resetQueue();
    clearMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("enqueue + flushNow 应该写 DB", () => {
    observeFilePresence("/a/b.zip", true);
    flushNow();

    // 应该开启事务
    expect(mockExec).toHaveBeenCalledWith("BEGIN");
    expect(mockExec).toHaveBeenCalledWith("COMMIT");
    // 应该调用 prepare（present 语句）
    expect(mockPrepare).toHaveBeenCalled();
    expect(mockRun).toHaveBeenCalled();
  });

  it("exists=false 应该走 missing 语句", () => {
    observeFilePresence("/a/gone.zip", false);
    flushNow();

    expect(mockExec).toHaveBeenCalledWith("BEGIN");
    // missing 语句只有 2 个参数（now, filepath）
    const calls = mockRun.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
  });

  it("同一 filepath 在 TTL 内重复 enqueue 应该去重", () => {
    observeFilePresence("/a/b.zip", true);
    flushNow(); // 第一次 flush，记录 lastFlushed

    clearMocks();

    // 立即再次 enqueue，应该被 TTL 过滤
    observeFilePresence("/a/b.zip", true);
    flushNow();

    // 没有新的 DB 写入
    expect(mockExec).not.toHaveBeenCalled();
  });

  it("TTL 过期后应该允许再次写入", () => {
    observeFilePresence("/a/b.zip", true);
    flushNow();
    clearMocks();

    // 推进时间超过 30s TTL
    vi.advanceTimersByTime(31_000);

    observeFilePresence("/a/b.zip", false);
    flushNow();

    expect(mockExec).toHaveBeenCalledWith("BEGIN");
  });

  it("多个不同 filepath 应该批量写入", () => {
    observeFilePresence("/a/1.zip", true);
    observeFilePresence("/a/2.zip", true);
    observeFilePresence("/a/3.zip", false);
    flushNow();

    // 3 次 run 调用（每个 filepath 一次）
    expect(mockRun).toHaveBeenCalledTimes(3);
  });

  it("同一 filepath 多次 enqueue 应该只保留最后一次状态", () => {
    observeFilePresence("/a/b.zip", true);
    observeFilePresence("/a/b.zip", false); // 覆盖前一次
    flushNow();

    // 只有一次 run
    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it("flush 空队列不应该写 DB", () => {
    flushNow();
    expect(mockExec).not.toHaveBeenCalled();
  });

  it("DB 写入失败不应该抛出异常", () => {
    mockExec.mockImplementationOnce(() => { throw new Error("DB error"); });
    observeFilePresence("/a/b.zip", true);
    expect(() => flushNow()).not.toThrow();
  });

  it("200ms 后自动 flush", () => {
    observeFilePresence("/a/b.zip", true);
    expect(mockExec).not.toHaveBeenCalled(); // 还没 flush

    vi.advanceTimersByTime(200);

    expect(mockExec).toHaveBeenCalledWith("BEGIN");
  });
});
