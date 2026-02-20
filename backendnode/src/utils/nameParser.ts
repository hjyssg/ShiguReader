/**
 * Parses Japanese doujin/manga filenames into structured metadata.
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

const DATE_RE = /^(\d{4}[-/]\d{2}(?:[-/]\d{2})?)$/;
const MEDIA_TYPES = new Set(["digital", "scan", "web", "dl", "tankoubon", "anthology"]);

function extractBrackets(s: string): { tokens: string[]; rest: string } {
  const tokens: string[] = [];
  let rest = s;
  // Extract all [...] and (...) groups
  const re = /[\[(]([^\])]*)[\])]/g;
  let m: RegExpExecArray | null;
  const ranges: [number, number][] = [];
  while ((m = re.exec(s)) !== null) {
    tokens.push(m[1].trim());
    ranges.push([m.index, m.index + m[0].length]);
  }
  // Remove matched ranges from rest (reverse order)
  for (let i = ranges.length - 1; i >= 0; i--) {
    rest = rest.slice(0, ranges[i][0]) + rest.slice(ranges[i][1]);
  }
  return { tokens, rest: rest.trim() };
}

function splitAuthors(s: string): string[] {
  return s
    .split(/[,、&+×x]/)
    .map(a => a.trim())
    .filter(Boolean);
}

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

  const { tokens, rest } = extractBrackets(base);

  // The remaining text after removing all brackets is likely the title
  if (rest) result.title = rest;

  for (const token of tokens) {
    // Date tag
    if (DATE_RE.test(token)) {
      result.dateTag = token;
      continue;
    }

    // Media type
    if (MEDIA_TYPES.has(token.toLowerCase())) {
      result.mediaType = token.toLowerCase();
      continue;
    }

    // Author pattern: "Group (Author)" or just "Author"
    const groupAuthorMatch = token.match(/^(.+?)\s*\((.+)\)$/);
    if (groupAuthorMatch) {
      result.groupName = groupAuthorMatch[1].trim();
      result.authors = splitAuthors(groupAuthorMatch[2]);
      continue;
    }

    // Event pattern: starts with C\d+ or M\d+ or typical event names
    if (/^(?:C\d+|M\d+|FF\d+|例大祭|コミケ|コミティア|COMIC|Comiket)/i.test(token)) {
      result.event = token;
      continue;
    }

    // Otherwise treat as tag
    result.rawTags.push(token);
  }

  // If no title found, use the first tag as title
  if (!result.title && result.rawTags.length) {
    result.title = result.rawTags.shift() ?? null;
  }

  return result;
}
