import { DatabaseSync } from "node:sqlite";
import { nowTs } from "./client.js";

export interface FileRow {
  filepath: string; folderpath: string | null; filename: string;
  mtime: number; filesize: number; file_type: string; ext: string | null;
  thumbnail_filepath: string | null; fingerprint: string; content_hash: string | null;
  rec_score: number; scan_state: number; watch_state: number;
  first_seen_at: number | null; last_seen_at: number | null; last_scanned_at: number | null;
  created_at: number; updated_at: number;
}
export interface FolderRow {
  filepath: string; dirname: string; mtime: number | null;
  scan_state: number; watch_state: number;
  first_seen_at: number | null; last_seen_at: number | null; last_scanned_at: number | null;
  created_at: number; updated_at: number;
}
export interface ArchiveMetaRow {
  filepath: string; archive_type: string; entry_count: number;
  image_file_num: number; video_file_num: number; music_file_num: number; scanned_at: number | null;
}
export interface ProgressRow {
  filepath: string; filename: string | null; file_type: string | null;
  filesize: number | null; mtime: number | null; thumbnail_url: string | null;
  last_opened_at: number; total_time_sec: number;
  page_current: number | null; page_total: number | null;
  position_sec: number | null; duration_sec: number | null; updated_at: number;
}
export interface ActivityLogRow {
  id: number; activity_type: string; status: string; task_key: string | null;
  message: string; target_path: string | null; context_json: string | null; created_at: number;
}
export interface ParsedMetaRow {
  filepath: string; title: string | null; group_name: string | null;
  event: string | null; date_tag: string | null; media_type: string | null; parsed_at: number;
}
export interface UpsertFileInput {
  filepath: string; folderpath?: string | null; filename: string;
  mtime: number; filesize: number; file_type?: string; ext?: string | null;
  fingerprint: string; scan_state?: number; watch_state?: number;
}
export interface UpsertFolderInput {
  filepath: string; dirname: string; mtime?: number | null;
  scan_state?: number; watch_state?: number; scanned?: boolean;
}

export class IndexRepository {
  constructor(private db: DatabaseSync) {}

  upsertFile(data: UpsertFileInput): void {
    const now = nowTs();
    const existing = this.db.prepare("SELECT filepath FROM files WHERE filepath = ?").get(data.filepath);
    if (!existing) {
      this.db.prepare("INSERT INTO files (filepath,folderpath,filename,mtime,filesize,file_type,ext,fingerprint,scan_state,watch_state,first_seen_at,last_seen_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(data.filepath, data.folderpath ?? null, data.filename, data.mtime, data.filesize, data.file_type ?? "unknown", data.ext ?? null, data.fingerprint, data.scan_state ?? 1, data.watch_state ?? 0, now, now, now, now);
    } else {
      this.db.prepare("UPDATE files SET folderpath=?,filename=?,mtime=?,filesize=?,file_type=?,ext=?,fingerprint=?,scan_state=?,last_seen_at=?,updated_at=? WHERE filepath=?").run(data.folderpath ?? null, data.filename, data.mtime, data.filesize, data.file_type ?? "unknown", data.ext ?? null, data.fingerprint, data.scan_state ?? 1, now, now, data.filepath);
    }
  }

  batchUpsertFiles(list: UpsertFileInput[]): void {
    for (const item of list) this.upsertFile(item);
  }

  getFile(filepath: string): FileRow | undefined {
    return this.db.prepare("SELECT * FROM files WHERE filepath = ?").get(filepath) as FileRow | undefined;
  }

  deleteFile(filepath: string): void {
    this.db.prepare("DELETE FROM files WHERE filepath = ?").run(filepath);
    this._pruneOrphans();
  }

  deleteByPrefix(prefix: string): void {
    this.db.prepare("DELETE FROM files WHERE filepath LIKE ?").run(prefix + "%");
    this.db.prepare("DELETE FROM folders WHERE filepath LIKE ?").run(prefix + "%");
    this._pruneOrphans();
  }

  findFilesByFilename(filename: string, excludePath = "", limit = 10): FileRow[] {
    const rows = this.db.prepare("SELECT * FROM files WHERE filename = ? AND scan_state = 1 ORDER BY last_seen_at DESC LIMIT ?").all(filename, limit) as FileRow[];
    return excludePath ? rows.filter(r => r.filepath !== excludePath) : rows;
  }

  countFilesByType(fileType: string): number {
    return (this.db.prepare("SELECT COUNT(*) as n FROM files WHERE file_type = ? AND scan_state = 1").get(fileType) as { n: number }).n;
  }

  updateFileThumbnail(filepath: string, thumbPath: string): void {
    this.db.prepare("UPDATE files SET thumbnail_filepath = ? WHERE filepath = ?").run(thumbPath, filepath);
  }

  searchFiles(q: string, presenceFilter = "all"): FileRow[] {
    const p = `%${q}%`;
    return this.db.prepare("SELECT * FROM files WHERE (filename LIKE ? OR filepath LIKE ?)" + this._presenceClause(presenceFilter)).all(p, p) as FileRow[];
  }

  searchByAuthor(q: string, presenceFilter = "all"): FileRow[] {
    const artists = this.db.prepare("SELECT artist_name FROM artists WHERE artist_name LIKE ?").all(`%${q}%`) as { artist_name: string }[];
    if (!artists.length) return [];
    const names = artists.map(a => a.artist_name);
    const fps = this.db.prepare(`SELECT filepath FROM file_artists WHERE artist_name IN (${names.map(() => "?").join(",")}) AND role = ''`).all(...names) as { filepath: string }[];
    if (!fps.length) return [];
    const paths = fps.map(f => f.filepath);
    return this.db.prepare(`SELECT * FROM files WHERE filepath IN (${paths.map(() => "?").join(",")})` + this._presenceClause(presenceFilter)).all(...paths) as FileRow[];
  }

  searchByCoser(q: string, presenceFilter = "all"): FileRow[] {
    const artists = this.db.prepare("SELECT artist_name FROM artists WHERE artist_name LIKE ?").all(`%${q}%`) as { artist_name: string }[];
    if (!artists.length) return [];
    const names = artists.map(a => a.artist_name);
    const fps = this.db.prepare(`SELECT filepath FROM file_artists WHERE artist_name IN (${names.map(() => "?").join(",")}) AND role = 'coser'`).all(...names) as { filepath: string }[];
    if (!fps.length) return [];
    const paths = fps.map(f => f.filepath);
    return this.db.prepare(`SELECT * FROM files WHERE filepath IN (${paths.map(() => "?").join(",")})` + this._presenceClause(presenceFilter)).all(...paths) as FileRow[];
  }

  searchByTag(q: string, presenceFilter = "all"): FileRow[] {
    const tags = this.db.prepare("SELECT tag_name FROM tags WHERE tag_name LIKE ?").all(`%${q}%`) as { tag_name: string }[];
    if (!tags.length) return [];
    const names = tags.map(t => t.tag_name);
    const fps = this.db.prepare(`SELECT filepath FROM file_tags WHERE tag_name IN (${names.map(() => "?").join(",")})`).all(...names) as { filepath: string }[];
    if (!fps.length) return [];
    const paths = fps.map(f => f.filepath);
    return this.db.prepare(`SELECT * FROM files WHERE filepath IN (${paths.map(() => "?").join(",")})` + this._presenceClause(presenceFilter)).all(...paths) as FileRow[];
  }

  private _presenceClause(filter: string): string {
    if (filter === "watched") return " AND watch_state = 1";
    if (filter === "scanned_recent") return ` AND scan_state = 1 AND last_seen_at >= ${nowTs() - 86400 * 30}`;
    return "";
  }

  upsertFolder(data: UpsertFolderInput): void {
    const now = nowTs();
    const existing = this.db.prepare("SELECT filepath FROM folders WHERE filepath = ?").get(data.filepath);
    if (!existing) {
      this.db.prepare("INSERT INTO folders (filepath,dirname,mtime,scan_state,watch_state,first_seen_at,last_seen_at,last_scanned_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run(data.filepath, data.dirname, data.mtime ?? null, data.scan_state ?? 1, data.watch_state ?? 0, now, now, data.scanned ? now : null, now, now);
    } else {
      this.db.prepare("UPDATE folders SET dirname=?,mtime=?,scan_state=?,last_seen_at=?,last_scanned_at=?,updated_at=? WHERE filepath=?").run(data.dirname, data.mtime ?? null, data.scan_state ?? 1, now, data.scanned ? now : null, now, data.filepath);
    }
  }

  batchUpsertFolders(list: UpsertFolderInput[]): void {
    for (const item of list) this.upsertFolder(item);
  }

  countFolders(): number {
    return (this.db.prepare("SELECT COUNT(*) as n FROM folders WHERE scan_state = 1").get() as { n: number }).n;
  }

  upsertArchiveMeta(filepath: string, archiveType: string, entryCount: number, imageNum: number, videoNum: number, musicNum: number): void {
    const now = nowTs();
    this.db.prepare("INSERT INTO archive_meta (filepath,archive_type,entry_count,image_file_num,video_file_num,music_file_num,scanned_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(filepath) DO UPDATE SET archive_type=excluded.archive_type,entry_count=excluded.entry_count,image_file_num=excluded.image_file_num,video_file_num=excluded.video_file_num,music_file_num=excluded.music_file_num,scanned_at=excluded.scanned_at").run(filepath, archiveType, entryCount, imageNum, videoNum, musicNum, now);
  }

  getArchiveMeta(filepath: string): ArchiveMetaRow | undefined {
    return this.db.prepare("SELECT * FROM archive_meta WHERE filepath = ?").get(filepath) as ArchiveMetaRow | undefined;
  }

  getArchiveMetasByFolder(folderpath: string): Map<string, ArchiveMetaRow> {
    const fps = this.db.prepare("SELECT filepath FROM files WHERE folderpath = ? AND file_type = 'archive'").all(folderpath) as { filepath: string }[];
    if (!fps.length) return new Map();
    const paths = fps.map(f => f.filepath);
    const rows = this.db.prepare(`SELECT * FROM archive_meta WHERE filepath IN (${paths.map(() => "?").join(",")})`).all(...paths) as ArchiveMetaRow[];
    return new Map(rows.map(r => [r.filepath, r]));
  }

  upsertProgress(data: Partial<ProgressRow> & { filepath: string }): void {
    const now = nowTs();
    const existing = this.db.prepare("SELECT filepath FROM progress WHERE filepath = ?").get(data.filepath);
    if (!existing) {
      this.db.prepare("INSERT INTO progress (filepath,filename,file_type,filesize,mtime,thumbnail_url,last_opened_at,page_current,page_total,position_sec,duration_sec,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(data.filepath, data.filename ?? null, data.file_type ?? null, data.filesize ?? null, data.mtime ?? null, data.thumbnail_url ?? null, now, data.page_current ?? null, data.page_total ?? null, data.position_sec ?? null, data.duration_sec ?? null, now);
    } else {
      this.db.prepare("UPDATE progress SET filename=COALESCE(?,filename),file_type=COALESCE(?,file_type),filesize=COALESCE(?,filesize),mtime=COALESCE(?,mtime),thumbnail_url=COALESCE(?,thumbnail_url),last_opened_at=?,page_current=?,page_total=?,position_sec=?,duration_sec=?,updated_at=? WHERE filepath=?").run(data.filename ?? null, data.file_type ?? null, data.filesize ?? null, data.mtime ?? null, data.thumbnail_url ?? null, now, data.page_current ?? null, data.page_total ?? null, data.position_sec ?? null, data.duration_sec ?? null, now, data.filepath);
    }
  }

  listProgressHistory(offset: number, limit: number, sortOrder = "desc"): ProgressRow[] {
    const order = sortOrder === "asc" ? "ASC" : "DESC";
    return this.db.prepare(`SELECT * FROM progress ORDER BY last_opened_at ${order} LIMIT ? OFFSET ?`).all(limit, offset) as ProgressRow[];
  }

  countProgressHistory(): number {
    return (this.db.prepare("SELECT COUNT(*) as n FROM progress").get() as { n: number }).n;
  }

  logActivity(activityType: string, message: string, status = "completed", taskKey?: string, targetPath?: string, context?: object): void {
    const now = nowTs();
    this.db.prepare("INSERT INTO activity_logs (activity_type,status,task_key,message,target_path,context_json,created_at) VALUES (?,?,?,?,?,?,?)").run(activityType, status, taskKey ?? null, message, targetPath ?? null, context ? JSON.stringify(context) : null, now);
    this.db.prepare("DELETE FROM activity_logs WHERE id NOT IN (SELECT id FROM activity_logs ORDER BY created_at DESC, id DESC LIMIT 500)").run();
  }

  listActivityLogs(limit = 200): ActivityLogRow[] {
    return this.db.prepare("SELECT * FROM activity_logs ORDER BY created_at DESC, id DESC LIMIT ?").all(limit) as ActivityLogRow[];
  }

  listActivityLogsSinceLatestStartup(limit = 200): ActivityLogRow[] {
    const row = this.db.prepare("SELECT id FROM activity_logs WHERE activity_type = 'startup' AND status = 'started' ORDER BY created_at DESC, id DESC LIMIT 1").get() as { id: number } | undefined;
    if (!row) return this.listActivityLogs(limit);
    return this.db.prepare("SELECT * FROM activity_logs WHERE id >= ? ORDER BY created_at DESC, id DESC LIMIT ?").all(row.id, limit) as ActivityLogRow[];
  }

  recordFolderOpen(folderpath: string): void {
    const now = nowTs();
    this.db.prepare("INSERT INTO folder_open_history (folderpath,last_opened_at,open_count,updated_at) VALUES (?,?,1,?) ON CONFLICT(folderpath) DO UPDATE SET last_opened_at=excluded.last_opened_at,open_count=open_count+1,updated_at=excluded.updated_at").run(folderpath, now, now);
  }

  listTopOpenedFolderIds(limit = 5): string[] {
    const now = nowTs();
    const cutoff = now - 90 * 86400;
    const tau = 14 * 86400;
    // open_count used as weight so repeated opens rank higher even at same timestamp
    const rows = this.db.prepare(`
      WITH folder_scores AS (
        SELECT h.folderpath AS folder_id,
               h.open_count * exp(-((?-h.last_opened_at)*1.0)/?) AS score
        FROM folder_open_history h WHERE h.last_opened_at >= ?
      ),
      progress_scores AS (
        SELECT f.folderpath AS folder_id,
               exp(-((?-p.last_opened_at)*1.0)/?) AS score
        FROM progress p JOIN files f ON f.filepath = p.filepath
        WHERE p.last_opened_at >= ? AND f.folderpath IS NOT NULL
      ),
      combined AS (SELECT * FROM folder_scores UNION ALL SELECT * FROM progress_scores)
      SELECT folder_id FROM combined GROUP BY folder_id
      ORDER BY SUM(score) DESC LIMIT ?
    `).all(now, tau, cutoff, now, tau, cutoff, limit) as { folder_id: string }[];
    return rows.map(r => r.folder_id);
  }

  saveParsedMetadata(filepath: string, data: { title?: string; authors?: string[]; cosers?: string[]; groupName?: string; rawTags?: string[]; event?: string; dateTag?: string; mediaType?: string }): void {
    const now = nowTs();
    const cosers = data.cosers ?? [];
    const authors = cosers.length ? [] : (data.authors ?? []);
    this.db.prepare("INSERT INTO parsed_metadata (filepath,title,group_name,event,date_tag,media_type,parsed_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(filepath) DO UPDATE SET title=excluded.title,group_name=excluded.group_name,event=excluded.event,date_tag=excluded.date_tag,media_type=excluded.media_type,parsed_at=excluded.parsed_at").run(filepath, data.title ?? null, data.groupName ?? null, data.event ?? null, data.dateTag ?? null, data.mediaType ?? null, now);
    for (const name of authors) {
      this.db.prepare("INSERT OR IGNORE INTO artists (artist_name) VALUES (?)").run(name);
      this.db.prepare("INSERT OR IGNORE INTO file_artists (filepath,artist_name,role) VALUES (?,?,'')").run(filepath, name);
    }
    for (const name of cosers) {
      this.db.prepare("INSERT OR IGNORE INTO artists (artist_name) VALUES (?)").run(name);
      this.db.prepare("INSERT OR IGNORE INTO file_artists (filepath,artist_name,role) VALUES (?,?,'coser')").run(filepath, name);
    }
    for (const tag of (data.rawTags ?? [])) {
      this.db.prepare("INSERT OR IGNORE INTO tags (tag_name) VALUES (?)").run(tag);
      this.db.prepare("INSERT OR IGNORE INTO file_tags (filepath,tag_name) VALUES (?,?)").run(filepath, tag);
    }
  }

  getParsedMetadata(filepath: string): ParsedMetaRow | undefined {
    return this.db.prepare("SELECT * FROM parsed_metadata WHERE filepath = ?").get(filepath) as ParsedMetaRow | undefined;
  }

  getFileArtists(filepath: string): string[] {
    return (this.db.prepare("SELECT artist_name FROM file_artists WHERE filepath = ? AND role = ''").all(filepath) as { artist_name: string }[]).map(r => r.artist_name);
  }

  getFileCosers(filepath: string): string[] {
    return (this.db.prepare("SELECT artist_name FROM file_artists WHERE filepath = ? AND role = 'coser'").all(filepath) as { artist_name: string }[]).map(r => r.artist_name);
  }

  getFileTags(filepath: string): string[] {
    return (this.db.prepare("SELECT tag_name FROM file_tags WHERE filepath = ?").all(filepath) as { tag_name: string }[]).map(r => r.tag_name);
  }

  getArtistsByFilepaths(filepaths: string[]): Map<string, string[]> {
    if (!filepaths.length) return new Map();
    const rows = this.db.prepare(`SELECT filepath,artist_name FROM file_artists WHERE filepath IN (${filepaths.map(() => "?").join(",")}) AND role = ''`).all(...filepaths) as { filepath: string; artist_name: string }[];
    const map = new Map<string, string[]>();
    for (const r of rows) { const arr = map.get(r.filepath) ?? []; arr.push(r.artist_name); map.set(r.filepath, arr); }
    return map;
  }

  getParsedMetadataByFilepaths(filepaths: string[]): Map<string, ParsedMetaRow> {
    if (!filepaths.length) return new Map();
    const rows = this.db.prepare(`SELECT * FROM parsed_metadata WHERE filepath IN (${filepaths.map(() => "?").join(",")})`).all(...filepaths) as unknown as ParsedMetaRow[];
    return new Map(rows.map(r => [r.filepath, r]));
  }

  getFileDataByFolder(folderpath: string): Map<string, { rec_score: number; last_read_at: number | null }> {
    const rows = this.db.prepare("SELECT f.filepath, f.rec_score, p.last_opened_at FROM files f LEFT JOIN progress p ON p.filepath = f.filepath WHERE f.folderpath = ?").all(folderpath) as { filepath: string; rec_score: number; last_opened_at: number | null }[];
    return new Map(rows.map(r => [r.filepath, { rec_score: r.rec_score, last_read_at: r.last_opened_at }]));
  }

  listTagsWithCounts(offset: number, limit: number, sortBy = "count", sortOrder = "desc"): { tag_name: string; file_count: number; avg_rec_score: number }[] {
    const col = sortBy === "name" ? "tag_name" : sortBy === "recommendation" ? "avg_rec_score" : "file_count";
    const dir = sortOrder === "asc" ? "ASC" : "DESC";
    return this.db.prepare(`SELECT t.tag_name, COUNT(ft.filepath) as file_count, AVG(COALESCE(f.rec_score,0)) as avg_rec_score FROM tags t LEFT JOIN file_tags ft ON ft.tag_name = t.tag_name LEFT JOIN files f ON f.filepath = ft.filepath GROUP BY t.tag_name ORDER BY ${col} ${dir}, t.tag_name ASC LIMIT ? OFFSET ?`).all(limit, offset) as { tag_name: string; file_count: number; avg_rec_score: number }[];
  }

  countTags(): number {
    return (this.db.prepare("SELECT COUNT(*) as n FROM tags").get() as { n: number }).n;
  }

  listArtistsWithCounts(offset: number, limit: number, role = "", sortBy = "count", sortOrder = "desc"): { artist_name: string; file_count: number; avg_rec_score: number }[] {
    const col = sortBy === "name" ? "artist_name" : sortBy === "recommendation" ? "avg_rec_score" : "file_count";
    const dir = sortOrder === "asc" ? "ASC" : "DESC";
    return this.db.prepare(`SELECT a.artist_name, COUNT(fa.filepath) as file_count, AVG(COALESCE(f.rec_score,0)) as avg_rec_score FROM artists a LEFT JOIN file_artists fa ON fa.artist_name = a.artist_name AND fa.role = ? LEFT JOIN files f ON f.filepath = fa.filepath GROUP BY a.artist_name ORDER BY ${col} ${dir}, a.artist_name ASC LIMIT ? OFFSET ?`).all(role, limit, offset) as { artist_name: string; file_count: number; avg_rec_score: number }[];
  }

  countArtists(role = ""): number {
    return (this.db.prepare("SELECT COUNT(DISTINCT artist_name) as n FROM file_artists WHERE role = ?").get(role) as { n: number }).n;
  }

  batchUpdateRecScores(scores: Map<string, number>): void {
    if (!scores.size) return;
    const stmt = this.db.prepare("UPDATE files SET rec_score = ? WHERE filepath = ?");
    for (const [fp, score] of scores) stmt.run(score, fp);
  }

  getFavoriteAuthorFrequencies(favoriteDir: string): Map<string, number> {
    const rows = this.db.prepare("SELECT fa.artist_name, COUNT(fa.filepath) as cnt FROM file_artists fa JOIN files f ON f.filepath = fa.filepath WHERE fa.role = '' AND f.filepath LIKE ? GROUP BY fa.artist_name").all(favoriteDir + "%") as { artist_name: string; cnt: number }[];
    return new Map(rows.map(r => [r.artist_name, r.cnt]));
  }

  getFavoriteTagFrequencies(favoriteDir: string): Map<string, number> {
    const rows = this.db.prepare("SELECT ft.tag_name, COUNT(ft.filepath) as cnt FROM file_tags ft JOIN files f ON f.filepath = ft.filepath WHERE f.filepath LIKE ? GROUP BY ft.tag_name").all(favoriteDir + "%") as { tag_name: string; cnt: number }[];
    return new Map(rows.map(r => [r.tag_name, r.cnt]));
  }

  private _pruneOrphans(): void {
    this.db.prepare("DELETE FROM tags WHERE tag_name NOT IN (SELECT DISTINCT tag_name FROM file_tags)").run();
    this.db.prepare("DELETE FROM artists WHERE artist_name NOT IN (SELECT DISTINCT artist_name FROM file_artists)").run();
  }
}
