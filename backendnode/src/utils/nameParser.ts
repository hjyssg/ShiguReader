/**
 * Parses Japanese doujin/manga filenames into structured metadata.
 * Ported from backend/app/file_processing/name_parser/parser.py
 *
 * Common patterns:
 *   [Group (Author)] Title [Event] [Tags]
 *   (Event) [Group (Author)] Title [Tags]
 */

export interface ParsedName {
  title: string | null;
  authors: string[];
  cosers: string[];
  groupName: string | null;
  rawTags: string[];
  event: string | null;
  dateTag: string | null;
  mediaType: string | null;
}

// ── Not-author tokens (look like authors but are tags/noise) ─────────────────

const NOT_AUTHOR_BUT_TAG = new Set([
  "同人音声", "同人誌", "アンソロジー", "DL版", "よろず",
  "成年コミック", "Pixiv", "アーティスト", "雑誌", "English", "Chinese", "320K",
]);

function isNotAuthor(text: string): boolean {
  const lower = text.toLowerCase();
  for (const t of NOT_AUTHOR_BUT_TAG) {
    if (lower.endsWith(t.toLowerCase())) return true;
  }
  return false;
}

// ── Useless tags ─────────────────────────────────────────────────────────────

const USELESS_TAG_RE = /DL版|同人誌|別スキャン|修正版|^エロ|^digital$|^JPG$|^PNG$|ページ補足|進行中|別版|Various/i;

function isUselessTag(text: string): boolean {
  return USELESS_TAG_RE.test(text);
}

// ── Media types ───────────────────────────────────────────────────────────────

const MEDIA_TYPES = [
  "同人音声", "同人催眠音声", "同人ソフト", "同人CG集", "同人CG",
  "同人ゲーム", "同人GAME", "成年コミック", "一般コミック", "一般漫画",
  "ゲームCG", "イラスト集", "アンソロジー", "画集", "雑誌",
  "18禁ゲーム", "GAME", "CG", "同人誌", "DOUJINSHI",
];

const MEDIA_TYPE_RE = new RegExp(
  MEDIA_TYPES.map(t => `(${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`).join("|"),
  "i"
);

function isMediaType(text: string): boolean {
  return MEDIA_TYPE_RE.test(text);
}

function getMediaType(text: string): string | null {
  const m = MEDIA_TYPE_RE.exec(text);
  return m ? m[0] : null;
}

// ── Event patterns ────────────────────────────────────────────────────────────

const EVENT_PATTERNS = [
  /C1\d{2}/i,
  /^C\d{2}$/i,
  /^エアコミケ\d{1}$/i,
  /^COMIC1☆\d{1,2}$/i,
  /^僕らのラブライブ!/i,
  /^コミティア.*\d/,
  /^サンクリ.*\d+/,
  /^例大祭.*\d+/,
  /^とら祭り.*\d+/,
  /^こみトレ.*\d+/,
  /みみけっと.*\d+/,
  /コミトレ.*\d+/,
  /FF\d+/,
  /iDOL SURVIVAL.*\d/i,
  /SC\d+/,
  /コミコミ.*\d/,
  /ふたけっと.*\d/,
  /ファータグランデ騎空祭/,
  /歌姫庭園/,
  /紅楼夢/,
  /CSP\d/,
  /CC大阪\d/,
  /COMITIA\d/i,
  // Legacy patterns from original Node.js version
  /^M\d+$/i,
];

function belongsToEvent(text: string): boolean {
  return EVENT_PATTERNS.some(p => p.test(text));
}

// ── Date detection ────────────────────────────────────────────────────────────

const DATE_PATTERNS = [
  /^(\d{4})(\d{2})(\d{2})$/,           // 20230415
  /^(\d{2})(\d{2})(\d{2})$/,           // 230415
  /^(\d{2})-(\d{2})-(\d{2})$/,         // 23-04-15
  /^(\d{4})-(\d{1,2})-(\d{1,2})$/,     // 2023-4-15
  /^(\d{4})年(\d{1,2})月号$/,           // 2023年4月号
  /^(\d{4})年(\d{1,2})月(\d{1,2})日$/, // 2023年4月15日
  /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/,   // 2023.4.15
  /^(\d{4})[-/](\d{2})(?:[-/](\d{2}))?$/, // 2023-04 or 2023/04/15
];

const CURRENT_YEAR = new Date().getFullYear();

function convertYear(yStr: string): number {
  const y = parseInt(yStr, 10);
  if (yStr.length === 2) return y > 70 ? 1900 + y : 2000 + y;
  return y;
}

function isStrDate(text: string): boolean {
  for (const re of DATE_PATTERNS) {
    const m = re.exec(text);
    if (!m) continue;
    const groups = m.slice(1).filter(g => g !== undefined);
    if (groups.length < 2) continue;
    try {
      const y = convertYear(groups[0]);
      const month = parseInt(groups[1], 10);
      const day = groups[2] ? parseInt(groups[2], 10) : 1;
      if (y < 1970 || y > CURRENT_YEAR + 2) continue;
      if (month < 1 || month > 12) continue;
      if (day < 1 || day > 31) continue;
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

// ── Author/tag separators ─────────────────────────────────────────────────────

const AUTHOR_SEPARATOR = /[,、&＆+×x]/;
const TAG_SEPARATOR = /[,、]/;

function splitAuthors(s: string): string[] {
  return s.split(AUTHOR_SEPARATOR).map(a => a.trim()).filter(Boolean);
}

// ── Bracket extraction ────────────────────────────────────────────────────────

interface BracketResult {
  bTokens: string[];  // content inside []
  pTokens: string[];  // content inside ()
  rest: string;       // text with all brackets removed
}

function extractBrackets(s: string): BracketResult {
  const bTokens: string[] = [];
  const pTokens: string[] = [];

  // Collect [] ranges and their content
  const bRe = /\[([^\]]*)\]/g;
  let m: RegExpExecArray | null;
  const bRanges: [number, number][] = [];
  while ((m = bRe.exec(s)) !== null) {
    bTokens.push(m[1].trim());
    bRanges.push([m.index, m.index + m[0].length]);
  }

  // Collect () tokens — skip those that are inside a [] range
  const pRe = /\(([^)]*)\)/g;
  const pRanges: [number, number][] = [];
  while ((m = pRe.exec(s)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    const insideBracket = bRanges.some(([bs, be]) => start >= bs && end <= be);
    if (!insideBracket) {
      pTokens.push(m[1].trim());
      pRanges.push([start, end]);
    }
  }

  // Build rest: remove [] blocks first, then () blocks from the result
  // Apply in reverse order to preserve indices
  const allRanges = [...bRanges, ...pRanges].sort((a, b) => b[0] - a[0]);
  let rest = s;
  for (const [start, end] of allRanges) {
    rest = rest.slice(0, start) + rest.slice(end);
  }

  return { bTokens, pTokens, rest: rest.trim() };
}

// ── Group+Author pattern: "Group (Author)" ────────────────────────────────────

const GROUP_AUTHOR_RE = /^(.+?)\s*\((.+)\)$/;

function getGroupAndName(token: string): { group: string | null; name: string } {
  const m = GROUP_AUTHOR_RE.exec(token);
  if (m) {
    return { group: m[1].trim() || null, name: m[2].trim() };
  }
  return { group: null, name: token.trim() };
}

// ── Classify a token ──────────────────────────────────────────────────────────

interface ClassifyResult {
  kind: "event" | "date" | "mediaType" | "useless" | "notAuthor" | "unknown";
  value?: string;
}

function classifyToken(token: string): ClassifyResult {
  if (isMediaType(token)) return { kind: "mediaType", value: getMediaType(token) ?? token };
  if (belongsToEvent(token)) return { kind: "event" };
  if (isStrDate(token)) return { kind: "date" };
  if (isUselessTag(token)) return { kind: "useless" };
  if (isNotAuthor(token)) return { kind: "notAuthor" };
  return { kind: "unknown" };
}

// ── Main parse function ───────────────────────────────────────────────────────

export function parseName(filename: string): ParsedName {
  // Strip extension
  const base = filename.replace(/\.[^.]+$/, "").trim();

  const result: ParsedName = {
    title: null,
    authors: [],
    cosers: [],
    groupName: null,
    rawTags: [],
    event: null,
    dateTag: null,
    mediaType: null,
  };

  const { bTokens, pTokens, rest } = extractBrackets(base);

  // Title = text outside all brackets
  if (rest) result.title = rest;

  // Process [] tokens — first unclassified one is the author
  let authorFound = false;
  const tags: string[] = [];

  for (const token of bTokens) {
    if (!token) continue;
    const cls = classifyToken(token);

    if (cls.kind === "mediaType") {
      result.mediaType = cls.value ?? token;
      continue;
    }
    if (cls.kind === "event") {
      if (!result.event) result.event = token;  // first event wins
      continue;
    }
    if (cls.kind === "date") {
      if (!result.dateTag) result.dateTag = token;
      continue;
    }
    if (cls.kind === "useless") {
      continue;
    }
    if (cls.kind === "notAuthor") {
      // notAuthor tokens are noise — skip entirely (don't add to tags)
      continue;
    }

    // unknown → try as author first
    if (!authorFound) {
      const { group, name } = getGroupAndName(token);
      if (name && !isNotAuthor(name.toLowerCase())) {
        result.authors = splitAuthors(name);
        result.groupName = group;
        authorFound = true;
      } else {
        tags.push(token);
      }
    } else {
      tags.push(token);
    }
  }

  // Process () tokens — all go to tags
  for (const token of pTokens) {
    if (!token) continue;
    const cls = classifyToken(token);
    if (cls.kind === "mediaType") {
      result.mediaType = cls.value ?? token;
    } else if (cls.kind === "event") {
      if (!result.event) result.event = token;  // first event wins
    } else if (cls.kind === "date") {
      if (!result.dateTag) result.dateTag = token;
    } else if (cls.kind !== "useless" && cls.kind !== "notAuthor") {
      tags.push(token);
    }
  }

  // Split tags by separator and clean up
  const splitTags: string[] = [];
  for (const t of tags) {
    splitTags.push(...t.split(TAG_SEPARATOR).map(s => s.trim()).filter(Boolean));
  }

  const authorSet = new Set(result.authors);
  result.rawTags = splitTags.filter(t =>
    t.length > 1 &&
    !isUselessTag(t) &&
    !isMediaType(t) &&
    !authorSet.has(t) &&
    !t.match(/^\d+$/)
  );

  // Fallback: if no title found, use first tag
  if (!result.title && result.rawTags.length) {
    result.title = result.rawTags.shift() ?? null;
  }

  // Infer mediaType if not set
  if (!result.mediaType) {
    if (result.event || result.groupName) {
      result.mediaType = "同人誌";
    }
  }

  return result;
}
