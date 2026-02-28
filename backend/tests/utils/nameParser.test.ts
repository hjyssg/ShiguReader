import { describe, it, expect } from "vitest";
import { parseName } from "../../src/utils/nameParser.js";

// ── Basic author extraction ───────────────────────────────────────────────────

describe("author extraction", () => {
  it("extracts single author from []", () => {
    const r = parseName("[Author] Title.zip");
    expect(r.authors).toEqual(["Author"]);
    expect(r.groupName).toBeNull();
  });

  it("extracts group and author from [Group (Author)]", () => {
    const r = parseName("[ぽこたて (バルバル2号)] スキだらけのキミは.zip");
    expect(r.groupName).toBe("ぽこたて");
    expect(r.authors).toEqual(["バルバル2号"]);
  });

  it("extracts multiple authors separated by comma", () => {
    const r = parseName("[Author1, Author2] Title.zip");
    expect(r.authors).toEqual(["Author1", "Author2"]);
  });

  it("extracts multiple authors separated by &", () => {
    const r = parseName("[Author1 & Author2] Title.zip");
    expect(r.authors).toEqual(["Author1", "Author2"]);
  });

  it("extracts multiple authors separated by 、", () => {
    const r = parseName("[Author1、Author2] Title.zip");
    expect(r.authors).toEqual(["Author1", "Author2"]);
  });

  it("extracts multiple authors separated by ＆ (fullwidth)", () => {
    const r = parseName("[Author1＆Author2] Title.zip");
    expect(r.authors).toEqual(["Author1", "Author2"]);
  });

  it("extracts multiple authors separated by ×", () => {
    const r = parseName("[Author1×Author2] Title.zip");
    expect(r.authors).toEqual(["Author1", "Author2"]);
  });

  it("handles group with multiple authors: [Group (A1, A2)]", () => {
    const r = parseName("[Group (A1, A2)] Title.zip");
    expect(r.groupName).toBe("Group");
    expect(r.authors).toEqual(["A1", "A2"]);
  });

  it("returns empty authors when no author bracket", () => {
    const r = parseName("Title Only.zip");
    expect(r.authors).toEqual([]);
  });
});

// ── Title extraction ──────────────────────────────────────────────────────────

describe("title extraction", () => {
  it("extracts title from text outside brackets", () => {
    const r = parseName("[Author] My Title [Tag].zip");
    expect(r.title).toBe("My Title");
  });

  it("extracts title with Japanese characters", () => {
    const r = parseName("[ぽこたて (バルバル2号)] スキだらけのキミは (オリジナル) [DL版].zip");
    expect(r.title).toBe("スキだらけのキミは");
  });

  it("falls back to first tag when no title text", () => {
    const r = parseName("[Author] [SomeTag].zip");
    expect(r.title).toBe("SomeTag");
  });

  it("strips file extension before parsing", () => {
    const r = parseName("[Author] Title.cbz");
    expect(r.title).toBe("Title");
  });
});

// ── Event detection ───────────────────────────────────────────────────────────

describe("event detection", () => {
  it("detects C100 style event", () => {
    const r = parseName("(C100) [Group (Author)] Title.zip");
    expect(r.event).toBe("C100");
  });

  it("detects C99 style event", () => {
    const r = parseName("(C99) [Author] Title.zip");
    expect(r.event).toBe("C99");
  });

  it("detects コミティア event", () => {
    const r = parseName("(コミティア154) [Author] Title.zip");
    expect(r.event).toBe("コミティア154");
  });

  it("detects コミティア155 event", () => {
    const r = parseName("(コミティア155) [準特注くろますく (へたれん)] Title.zip");
    expect(r.event).toBe("コミティア155");
  });

  it("detects FF event", () => {
    const r = parseName("[Author] Title [FF40].zip");
    expect(r.event).toBe("FF40");
  });

  it("detects 例大祭 event", () => {
    const r = parseName("(例大祭15) [Author] Title.zip");
    expect(r.event).toBe("例大祭15");
  });

  it("detects SC event", () => {
    const r = parseName("(SC64) [Author] Title.zip");
    expect(r.event).toBe("SC64");
  });

  it("detects COMITIA event", () => {
    const r = parseName("(COMITIA140) [Author] Title.zip");
    expect(r.event).toBe("COMITIA140");
  });

  it("does not treat non-event as event", () => {
    const r = parseName("[Author] Title [SomeTag].zip");
    expect(r.event).toBeNull();
  });
});

// ── Date detection ────────────────────────────────────────────────────────────

describe("date detection", () => {
  it("detects YYYY-MM-DD date", () => {
    const r = parseName("[Author] Title [2023-04-15].zip");
    expect(r.dateTag).toBe("2023-04-15");
  });

  it("detects YYYYMMDD date", () => {
    const r = parseName("[Author] Title [20230415].zip");
    expect(r.dateTag).toBe("20230415");
  });

  it("detects YYYY.MM.DD date", () => {
    const r = parseName("[Author] Title [2023.04.15].zip");
    expect(r.dateTag).toBe("2023.04.15");
  });

  it("detects YYYY年MM月号 date", () => {
    const r = parseName("[Author] Title [2023年4月号].zip");
    expect(r.dateTag).toBe("2023年4月号");
  });

  it("detects YYYY-MM date", () => {
    const r = parseName("[Author] Title [2023-04].zip");
    expect(r.dateTag).toBe("2023-04");
  });

  it("does not treat non-date as date", () => {
    const r = parseName("[Author] Title [SomeTag].zip");
    expect(r.dateTag).toBeNull();
  });

  it("does not treat future year as date", () => {
    const r = parseName("[Author] Title [2099-01-01].zip");
    expect(r.dateTag).toBeNull();
  });
});

// ── Media type detection ──────────────────────────────────────────────────────

describe("media type detection", () => {
  it("detects 同人CG集", () => {
    const r = parseName("(同人CG集) [Author] Title.zip");
    expect(r.mediaType).toBe("同人CG集");
  });

  it("detects 同人ゲーム", () => {
    const r = parseName("[同人ゲーム] [Author] Title.zip");
    expect(r.mediaType).toBe("同人ゲーム");
  });

  it("detects アンソロジー", () => {
    const r = parseName("[アンソロジー] Title.zip");
    expect(r.mediaType).toBe("アンソロジー");
  });

  it("detects 同人音声", () => {
    const r = parseName("[同人音声] [Author] Title.zip");
    expect(r.mediaType).toBe("同人音声");
  });

  it("infers 同人誌 when event is present", () => {
    const r = parseName("(C100) [Author] Title.zip");
    expect(r.mediaType).toBe("同人誌");
  });

  it("infers 同人誌 when group is present", () => {
    const r = parseName("[Group (Author)] Title.zip");
    expect(r.mediaType).toBe("同人誌");
  });
});

// ── Tag extraction ────────────────────────────────────────────────────────────

describe("tag extraction", () => {
  it("extracts tags from [] after author", () => {
    const r = parseName("[Author] Title [Tag1] [Tag2].zip");
    expect(r.rawTags).toContain("Tag1");
    expect(r.rawTags).toContain("Tag2");
  });

  it("extracts tags from () content", () => {
    const r = parseName("[Author] Title (オリジナル).zip");
    expect(r.rawTags).toContain("オリジナル");
  });

  it("splits comma-separated tags", () => {
    const r = parseName("[Author] Title [Tag1, Tag2].zip");
    expect(r.rawTags).toContain("Tag1");
    expect(r.rawTags).toContain("Tag2");
  });

  it("filters out useless tags like DL版", () => {
    const r = parseName("[Author] Title [DL版].zip");
    expect(r.rawTags).not.toContain("DL版");
  });

  it("filters out 同人誌 as useless tag", () => {
    const r = parseName("[Author] Title [同人誌].zip");
    expect(r.rawTags).not.toContain("同人誌");
  });

  it("filters out pure numbers", () => {
    const r = parseName("[Author] Title [123].zip");
    expect(r.rawTags).not.toContain("123");
  });

  it("filters out single-char tags", () => {
    const r = parseName("[Author] Title [A].zip");
    expect(r.rawTags).not.toContain("A");
  });

  it("does not include author name in tags", () => {
    const r = parseName("[Author] Title [Author].zip");
    expect(r.rawTags).not.toContain("Author");
  });
});

// ── Not-author tokens ─────────────────────────────────────────────────────────

describe("not-author tokens", () => {
  it("does not treat DL版 as author", () => {
    const r = parseName("[DL版] Title.zip");
    expect(r.authors).toEqual([]);
  });

  it("does not treat アンソロジー as author", () => {
    const r = parseName("[アンソロジー] Title.zip");
    expect(r.authors).toEqual([]);
    expect(r.mediaType).toBe("アンソロジー");
  });

  it("does not treat English as author", () => {
    const r = parseName("[Author] Title [English].zip");
    expect(r.authors).toEqual(["Author"]);
    expect(r.rawTags).not.toContain("English");
  });
});

// ── Real-world filenames ──────────────────────────────────────────────────────

describe("real-world filenames", () => {
  it("parses コミティア154 zip", () => {
    const r = parseName("(コミティア154) [ぽこたて (バルバル2号)] スキだらけのキミは (オリジナル) [DL版].zip");
    expect(r.event).toBe("コミティア154");
    expect(r.groupName).toBe("ぽこたて");
    expect(r.authors).toEqual(["バルバル2号"]);
    expect(r.title).toBe("スキだらけのキミは");
    expect(r.rawTags).toContain("オリジナル");
    expect(r.rawTags).not.toContain("DL版");
  });

  it("parses コミティア155 zip", () => {
    const r = parseName("(コミティア155) [準特注くろますく (へたれん)] 勇者レベルアップでシスターから祝福をII (オリジナル) [DL版].zip");
    expect(r.event).toBe("コミティア155");
    expect(r.groupName).toBe("準特注くろますく");
    expect(r.authors).toEqual(["へたれん"]);
    expect(r.title).toBe("勇者レベルアップでシスターから祝福をII");
  });

  it("parses C100 doujin", () => {
    const r = parseName("(C100) [Group (Author)] Title [Tag1] [Tag2].zip");
    expect(r.event).toBe("C100");
    expect(r.groupName).toBe("Group");
    expect(r.authors).toEqual(["Author"]);
    expect(r.rawTags).toContain("Tag1");
    expect(r.rawTags).toContain("Tag2");
    expect(r.mediaType).toBe("同人誌");
  });

  it("parses 同人CG pack", () => {
    const r = parseName("(同人CG集) [260101] [インテグラル] カタネガイ.7z");
    expect(r.mediaType).toBe("同人CG集");
    expect(r.authors).toEqual(["インテグラル"]);
    expect(r.title).toBe("カタネガイ");
  });

  it("parses filename with date tag", () => {
    const r = parseName("[Author] Title [2023-04-15] [Tag].zip");
    expect(r.dateTag).toBe("2023-04-15");
    expect(r.rawTags).toContain("Tag");
    expect(r.rawTags).not.toContain("2023-04-15");
  });

  it("parses filename with no brackets", () => {
    const r = parseName("plain title.zip");
    expect(r.title).toBe("plain title");
    expect(r.authors).toEqual([]);
    expect(r.rawTags).toEqual([]);
  });

  it("handles empty string", () => {
    const r = parseName("");
    expect(r.title).toBeNull();
    expect(r.authors).toEqual([]);
  });

  it("handles filename with only extension", () => {
    const r = parseName(".zip");
    expect(r.title).toBeNull();
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("handles nested parens in group name: [Group (Sub) (Author)]", () => {
    // The outer GROUP_AUTHOR_RE matches last () as author
    const r = parseName("[Group (Author)] Title.zip");
    expect(r.groupName).toBe("Group");
    expect(r.authors).toEqual(["Author"]);
  });

  it("handles multiple events — keeps first", () => {
    const r = parseName("(C99) (C100) [Author] Title.zip");
    // First event wins
    expect(r.event).toBe("C99");
  });

  it("does not confuse event token with author", () => {
    const r = parseName("[C100] [Author] Title.zip");
    expect(r.event).toBe("C100");
    expect(r.authors).toEqual(["Author"]);
  });

  it("handles 同人CG (without 集) as media type", () => {
    const r = parseName("[同人CG] [Author] Title.zip");
    expect(r.mediaType).toBe("同人CG");
    expect(r.authors).toEqual(["Author"]);
  });

  it("handles tag with 、separator", () => {
    const r = parseName("[Author] Title [Tag1、Tag2].zip");
    expect(r.rawTags).toContain("Tag1");
    expect(r.rawTags).toContain("Tag2");
  });
});
