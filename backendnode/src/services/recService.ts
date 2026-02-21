/**
 * 推荐分数服务 - 基于 favorite 目录的 author/tag 频率计算 rec_score
 * 公式：score = log(1+Fa) + max_tag(log(1+Ft) / sqrt(Nt))
 */
import { getDb } from "../db/client.js";
import { IndexRepository } from "../db/repository.js";
import { config } from "../config.js";

// 内存缓存
let _authorFreq: Map<string, number> = new Map();
let _tagFreq: Map<string, number> = new Map();
let _tagTotal: Map<string, number> = new Map();
let _initialized = false;

function computeScore(authors: string[], tags: string[]): number {
  const fa = authors.reduce((max, a) => Math.max(max, _authorFreq.get(a) ?? 0), 0);
  const authorScore = Math.log1p(fa);

  let tagScore = 0;
  for (const tag of tags) {
    const ft = _tagFreq.get(tag) ?? 0;
    const nt = Math.max(_tagTotal.get(tag) ?? 0, 1);
    const s = Math.log1p(ft) / Math.sqrt(nt);
    if (s > tagScore) tagScore = s;
  }

  return Math.round((authorScore + tagScore) * 1e6) / 1e6;
}

export function refreshRecCache(): void {
  const favoriteDir = (config.FAVORITE_DIR || "").trim();
  if (!favoriteDir) return;

  try {
    const repo = new IndexRepository(getDb());
    _authorFreq = repo.getFavoriteAuthorFrequencies(favoriteDir);
    _tagFreq = repo.getFavoriteTagFrequencies(favoriteDir);
    _tagTotal = repo.getTagTotalCounts();
    _initialized = true;
  } catch {
    // ignore
  }
}

export function refreshAllRecScores(): void {
  refreshRecCache();
  if (!_initialized) return;
  if (!_authorFreq.size && !_tagFreq.size) return;

  try {
    const repo = new IndexRepository(getDb());
    // 获取所有有 meta 的文件
    const allFps = new Set<string>();
    const db = getDb();
    const artistFps = db.prepare("SELECT DISTINCT filepath FROM file_artists").all() as { filepath: string }[];
    const tagFps = db.prepare("SELECT DISTINCT filepath FROM file_tags").all() as { filepath: string }[];
    for (const r of artistFps) allFps.add(r.filepath);
    for (const r of tagFps) allFps.add(r.filepath);

    const fpList = [...allFps];
    const batchSize = 500;
    for (let i = 0; i < fpList.length; i += batchSize) {
      const batch = fpList.slice(i, i + batchSize);
      const artistsByFile = repo.getArtistsByFilepaths(batch);
      const tagsByFile = repo.getTagsByFilepaths(batch);
      const scores = new Map<string, number>();
      for (const fp of batch) {
        scores.set(fp, computeScore(artistsByFile.get(fp) ?? [], tagsByFile.get(fp) ?? []));
      }
      repo.batchUpdateRecScores(scores);
    }
  } catch {
    // ignore
  }
}

export function updateRecScoresForFiles(filepaths: string[]): void {
  if (!_initialized || !filepaths.length) return;
  try {
    const repo = new IndexRepository(getDb());
    const artistsByFile = repo.getArtistsByFilepaths(filepaths);
    const tagsByFile = repo.getTagsByFilepaths(filepaths);
    const scores = new Map<string, number>();
    for (const fp of filepaths) {
      scores.set(fp, computeScore(artistsByFile.get(fp) ?? [], tagsByFile.get(fp) ?? []));
    }
    repo.batchUpdateRecScores(scores);
  } catch {
    // ignore
  }
}
