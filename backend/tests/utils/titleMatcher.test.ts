import { describe, it, expect } from "vitest";
import { compareTitles, stripNoise, extractVolume, stripVolume } from "../../src/utils/titleMatcher.js";

describe("stripNoise", () => {
  it("removes [DL版]", () => {
    expect(stripNoise("勇者レベルアップ [DL版]")).toBe("勇者レベルアップ");
  });
  it("removes (オリジナル)", () => {
    expect(stripNoise("タイトル (オリジナル)")).toBe("タイトル");
  });
  it("removes multiple noise tokens", () => {
    expect(stripNoise("タイトル (オリジナル) [DL版]")).toBe("タイトル");
  });
  it("leaves clean title unchanged", () => {
    expect(stripNoise("勇者レベルアップでシスターから祝福をII")).toBe("勇者レベルアップでシスターから祝福をII");
  });
});

describe("extractVolume", () => {
  it("extracts trailing arabic number", () => {
    expect(extractVolume("タイトル1")).toBe("1");
    expect(extractVolume("タイトル2")).toBe("2");
  });
  it("extracts roman numerals", () => {
    expect(extractVolume("タイトルII")).toBe("ii");
    expect(extractVolume("タイトルIII")).toBe("iii");
  });
  it("extracts 上/下", () => {
    expect(extractVolume("タイトル上")).toBe("上");
    expect(extractVolume("タイトル下")).toBe("下");
  });
  it("returns null when no volume", () => {
    expect(extractVolume("タイトル")).toBeNull();
  });
});

describe("stripVolume", () => {
  it("removes trailing number", () => {
    expect(stripVolume("タイトル1")).toBe("タイトル");
  });
  it("removes roman numeral", () => {
    expect(stripVolume("勇者レベルアップでシスターから祝福をII")).toBe("勇者レベルアップでシスターから祝福を");
  });
});

describe("compareTitles — key scenarios", () => {
  it("same title with DL版 noise → score=1.0 (same book)", () => {
    const a = "勇者レベルアップでシスターから祝福をII (オリジナル) [DL版]";
    const b = "勇者レベルアップでシスターから祝福をII";
    const r = compareTitles(a, b);
    expect(r.score).toBeGreaterThanOrEqual(0.9);
    expect(r.differentVolume).toBe(false);
  });

  it("different volume numbers → differentVolume=true, score low", () => {
    const a = "勇者レベルアップでシスターから祝福を1 (オリジナル) [DL版]";
    const b = "勇者レベルアップでシスターから祝福を2 (オリジナル) [DL版]";
    const r = compareTitles(a, b);
    expect(r.differentVolume).toBe(true);
    expect(r.score).toBeLessThan(0.5);
  });

  it("completely different titles → low score", () => {
    const a = "魔法少女まどか☆マギカ";
    const b = "進撃の巨人";
    const r = compareTitles(a, b);
    expect(r.score).toBeLessThan(0.5);
  });

  it("identical titles → score=1.0", () => {
    const r = compareTitles("タイトルA", "タイトルA");
    expect(r.score).toBe(1.0);
  });

  it("same base, roman numeral volumes differ → differentVolume=true", () => {
    const a = "タイトルI";
    const b = "タイトルII";
    const r = compareTitles(a, b);
    expect(r.differentVolume).toBe(true);
  });
});
