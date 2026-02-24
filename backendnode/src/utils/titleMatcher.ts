/**
 * Title matching utilities for quick-match-batch.
 * Handles Japanese doujin title comparison with noise stripping and volume detection.
 */
import { distance } from "fastest-levenshtein";

// ── Noise tokens to strip before comparison ───────────────────────────────────

const NOISE_TOKENS = [
  "DL版",
  "オリジナル",
  "修正版",
  "別スキャン",
  "デジタル版",
  "電子版",
  "完全版",
  "増補版",
  "再版",
  "新装版",
  "文庫版",
  "English",
  "Chinese",
  "Decensored",
  "Uncensored",
];

const NOISE_RE = new RegExp(
  `[\\[\\(]\\s*(${NOISE_TOKENS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\s*[\\]\\)]`,
  "gi",
);

// ── Volume markers at end of title ────────────────────────────────────────────
// Matches: 1, 2, 01, 02, I, II, III, IV, V, VI, VII, VIII, IX, X,
//          上, 中, 下, 前, 後, 前編, 後編, 第1話, 第2話, etc.

const VOLUME_RE = /[\s\-_　]*(?:第(\d+)[話话巻卷]|([IVXivx]{1,4})|(\d{1,3})|([上中下前後])(?:編|篇)?)$/u;

export interface TitleCompareResult {
  /** 0.0 ~ 1.0, higher = more similar */
  score: number;
  /** true if both have volume markers and they differ */
  differentVolume: boolean;
  reason: string;
}

/**
 * Strip noise tokens and trailing punctuation from a title string.
 */
export function stripNoise(title: string): string {
  return title
    .replace(NOISE_RE, "")
    .replace(/[\s\-_　]+$/u, "")
    .trim();
}

/**
 * Extract volume marker from end of title. Returns null if none found.
 */
export function extractVolume(title: string): string | null {
  const m = VOLUME_RE.exec(title);
  if (!m) {
    return null;
  }
  // Return whichever group matched
  return (m[1] ?? m[2] ?? m[3] ?? m[4] ?? "").toLowerCase();
}

/**
 * Remove volume marker from end of title.
 */
export function stripVolume(title: string): string {
  return title.replace(VOLUME_RE, "").trim();
}

/**
 * Compare two titles and return a similarity score.
 *
 * Rules:
 * 1. Strip noise tokens from both
 * 2. Extract volume markers
 * 3. If stripped+volume-stripped titles are identical:
 *    - If both have volumes and they differ → score=0.1, differentVolume=true
 *    - Otherwise → score=1.0
 * 4. Otherwise use Levenshtein similarity
 */
export function compareTitles(a: string, b: string): TitleCompareResult {
  const cleanA = stripNoise(a);
  const cleanB = stripNoise(b);

  if (!cleanA || !cleanB) {
    return { score: 0, differentVolume: false, reason: "empty title after strip" };
  }

  // Exact match after noise strip
  if (cleanA === cleanB) {
    return { score: 1.0, differentVolume: false, reason: "exact match after noise strip" };
  }

  const volA = extractVolume(cleanA);
  const volB = extractVolume(cleanB);
  const baseA = stripVolume(cleanA);
  const baseB = stripVolume(cleanB);

  // Base titles match (same work, possibly different volumes)
  if (baseA === baseB) {
    if (volA !== null && volB !== null && volA !== volB) {
      return { score: 0.1, differentVolume: true, reason: `same base title, different volume: ${volA} vs ${volB}` };
    }
    // One has volume, other doesn't — treat as same
    return { score: 0.95, differentVolume: false, reason: "same base title, volume ambiguous" };
  }

  // Levenshtein fallback — compare base titles (volumes stripped) to avoid
  // volume-number differences inflating the distance unfairly
  const cmpA = baseA || cleanA;
  const cmpB = baseB || cleanB;
  const maxLen = Math.max(cmpA.length, cmpB.length);
  if (maxLen === 0) {
    return { score: 1.0, differentVolume: false, reason: "both empty" };
  }

  const dist = distance(cmpA, cmpB);
  const similarity = 1 - dist / maxLen;

  return {
    score: Math.max(0, similarity),
    differentVolume: false,
    reason: `levenshtein similarity ${similarity.toFixed(2)} (dist=${dist})`,
  };
}
