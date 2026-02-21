import { DatabaseSync } from "node:sqlite";
import { nowTs } from "./client.js";

export interface FileRow {
  filepath: string; folderpath: string | null; filename: string;
  mtime: number; filesize: number; file_type: string; ext: string | null;
  thumbnail_filepath: string | null;
  rec_score: number; is_missing: number;
  last_seen_at: number | null;
  created_at: number; updated_at: number;
}
export interface FolderRow {
  filepath: string; dirname: string; mtime: number | null;
  last_seen_at: number | null;
  created_at: number; updated_at: number;
}
export interface ArchiveMetaRow {
  filepath: string; archive_type: string; entry_count: number;
  image_file_num: number; video_file_num: number; music_file_num: number; scanned_at: number | null;
  version_sig: string | null; cover_entry: string | null; index_status: string;
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
}
export interface UpsertFolderInput {
  filepath: string; dirname: string; mtime?: number | null;
}

function rows<T>(result: unknown): T[] {
  return result as T[];
}

export class IndexRepository {
  constructor(private db: DatabaseSync) {}

  upsertFile(data: UpsertFileInput): void {
    const now = nowTs();
    this.db.prepare(`
      INSERT INTO files (filepath,folderpath,filename,mtime,filesize,file_type,ext,is_missing,last_seen_at,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,0,?,?,?)
      ON CONFLICT(filepath) DO UPDATE SET
        folderpath=excluded.folderpath, filename=excluded.filename, mtime=excluded.mtime,
        filesize=excluded.filesize, file_type=excluded.file_type, ext=excluded.ext,
        is_missing=0, last_seen_at=excluded.last_seen_at, updated_at=excluded.updated_at
    `).run(
      data.filepath, data.folderpath ?? null, data.filename, data.mtime, data.filesize,
      data.file_type ?? "unknown", data.ext ?? null, now, now, now,
    );
  }

  batchUpsertFiles(list: UpsertFileInput[]): void {
    if (!list.length) return;
    this.db.exec("BEGIN");
    try {
      for (const item of list) this.upsertFile(item);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  getFile(filepath: string): FileRow | undefined {
    return this.db.prepare("SELECT * FROM files WHERE filepath = ?").get(filepath) as FileRow | undefined;
  }

  deleteFile(filepath: string): void {
    this.db.prepare("DELETE FROM files WHERE filepath = ?").run(filepath);
    this._pruneOrphans();
  }

  /** Mark a file as missing (deleted from disk). Keeps the record for history. */
  markFileDeleted(filepath: string): void {
    const now = nowTs();
    this.db.prepare("UPDATE files SET is_missing=1, updated_at=? WHERE filepath=?").run(now, filepath);
  }

  /** After listing a folder, mark DB entries not present on disk as missing. */
  markMissingInFolder(folderpath: string, presentPaths: string[]): void {
    const now = nowTs();
    if (!presentPaths.length) {
      this.db.prepare("UPDATE files SET is_missing=1, updated_at=? WHERE folderpath=?").run(now, folderpath);
      return;
    }
    const placeholders = presentPaths.map(() => "?").join(",");
    this.db.prepare(
      `UPDATE files SET is_missing=1, updated_at=? WHERE folderpath=? AND filepath NOT IN (${placeholders})`
    ).run(now, folderpath, ...presentPaths);
  }

  /** Relocate a single file in all tables (rename / move). */
  relocateFile(oldPath: string, newPath: string, newFolderPath?: string): void {
    const now = nowTs();
    this.db.exec("BEGIN");
    try {
      const fp = newFolderPath ?? null;
      // files
      this.db.prepare("UPDATE files SET filepath=?, folderpath=COALESCE(?,folderpath), updated_at=? WHERE filepath=?").run(newPath, fp, now, oldPath);
      // dependent tables
      for (const tbl of ["archive_meta", "video_meta", "progress", "parsed_metadata"]) {
        this.db.prepare(`UPDATE ${tbl} SET filepath=? WHERE filepath=?`).run(newPath, oldPath);
      }
      this.db.prepare("UPDATE file_tags SET filepath=? WHERE filepath=?").run(newPath, oldPath);
      this.db.prepare("UPDATE file_artists SET filepath=? WHERE filepath=?").run(newPath, oldPath);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  /** Relocate all files under a folder prefix (folder move). */
  relocateFolder(oldPrefix: string, newPrefix: string): void {
    const now = nowTs();
    // Normalize: ensure trailing separator for safety
    const oldPfx = oldPrefix.endsWith("/") || oldPrefix.endsWith("\\") ? oldPrefix : oldPrefix;
    this.db.exec("BEGIN");
    try {
      // folders table
      this.db.prepare("UPDATE folders SET filepath=REPLACE(filepath,?,?), updated_at=? WHERE filepath LIKE ?").run(oldPfx, newPrefix, now, oldPfx + "%");
      // files table
      this.db.prepare("UPDATE files SET filepath=REPLACE(filepath,?,?), folderpath=REPLACE(folderpath,?,?), updated_at=? WHERE filepath LIKE ?").run(oldPfx, newPrefix, oldPfx, newPrefix, now, oldPfx + "%");
      // dependent tables
      for (const tbl of ["archive_meta", "video_meta", "progress", "parsed_metadata"]) {
        this.db.prepare(`UPDATE ${tbl} SET filepath=REPLACE(filepath,?,?) WHERE filepath LIKE ?`).run(oldPfx, newPrefix, oldPfx + "%");
      }
      this.db.prepare("UPDATE file_tags SET filepath=REPLACE(filepath,?,?) WHERE filepath LIKE ?").run(oldPfx, newPrefix, oldPfx + "%");
      this.db.prepare("UPDATE file_artists SET filepath=REPLACE(filepath,?,?) WHERE filepath LIKE ?").run(oldPfx, newPrefix, oldPfx + "%");
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  deleteByPrefix(prefix: string): void {
    this.db.prepare("DELETE FROM files WHERE filepath LIKE ?").run(prefix + "%");
    this.db.prepare("DELETE FROM folders WHERE filepath LIKE ?").run(prefix + "%");
    this._pruneOrphans();
  }

  findFilesByFilename(filename: string, excludePath = "", limit = 10): FileRow[] {
    const result = rows<FileRow>(this.db.prepare("SELECT * FROM files WHERE filename = ? AND is_missing = 0 ORDER BY last_seen_at DESC LIMIT ?").all(filename, limit));
    return excludePath ? result.filter(r => r.filepath !== excludePath) : result;
  }

  countFilesByType(fileType: string): number {
    return (this.db.prepare("SELECT COUNT(*) as n FROM files WHERE file_type = ? AND is_missing = 0").get(fileType) as { n: number }).n;
  }

  updateFileThumbnail(filepath: string, thumbPath: string): void {
    this.db.prepare("UPDATE files SET thumbnail_filepath = ? WHERE filepath = ?").run(thumbPath, filepath);
  }

  // ─── search ───────────────────────────────────────────────────────────────

  private _presenceClause(filter: string): string {
    if (filter === "all") return "";
    if (filter === "watched") return " AND filepath IN (SELECT filepath FROM progress)";
    if (filter === "scanned_recent") return ` AND is_missing = 0 AND last_seen_at >= ${nowTs() - 600}`;
    return " AND is_missing = 0"; // default: present
  }

  searchFiles(q: string, presenceFilter = "present"): FileRow[] {
    const p = `%${q}%`;
    return rows<FileRow>(this.db.prepare("SELECT * FROM files WHERE (filename LIKE ? OR filepath LIKE ?)" + this._presenceClause(presenceFilter)).all(p, p));
  }

  searchByAuthor(q: string, presenceFilter = "present"): FileRow[] {
    const artists = rows<{ artist_name: string }>(this.db.prepare("SELECT artist_name FROM artists WHERE artist_name LIKE ?").all(`%${q}%`));
    if (!artists.length) return [];
    const names = artists.map(a => a.artist_name);
    const fps = rows<{ filepath: string }>(this.db.prepare(`SELECT filepath FROM file_artists WHERE artist_name IN (${names.map(() => "?").join(",")}) AND role = ''`).all(...names));
    if (!fps.length) return [];
    const paths = fps.map(f => f.filepath);
    return rows<FileRow>(this.db.prepare(`SELECT * FROM files WHERE filepath IN (${paths.map(() => "?").join(",")})` + this._presenceClause(presenceFilter)).all(...paths));
  }

  searchByCoser(q: string, presenceFilter = "present"): FileRow[] {
    const artists = rows<{ artist_name: string }>(this.db.prepare("SELECT artist_name FROM artists WHERE artist_name LIKE ?").all(`%${q}%`));
    if (!artists.length) return [];
    const names = artists.map(a => a.artist_name);
    const fps = rows<{ filepath: string }>(this.db.prepare(`SELECT filepath FROM file_artists WHERE artist_name IN (${names.map(() => "?").join(",")}) AND role = 'coser'`).all(...names));
    if (!fps.length) return [];
    const paths = fps.map(f => f.filepath);
    return rows<FileRow>(this.db.prepare(`SELECT * FROM files WHERE filepath IN (${paths.map(() => "?").join(",")})` + this._presenceClause(presenceFilter)).all(...paths));
  }

  searchByTag(q: string, presenceFilter = "present"): FileRow[] {
    const tags = rows<{ tag_name: string }>(this.db.prepare("SELECT tag_name FROM tags WHERE tag_name LIKE ?").all(`%${q}%`));
    if (!tags.length) return [];
    const names = tags.map(t => t.tag_name);
    const fps = rows<{ filepath: string }>(this.db.prepare(`SELECT filepath FROM file_tags WHERE tag_name IN (${names.map(() => "?").join(",")})`).all(...names));
    if (!fps.length) return [];
    const paths = fps.map(f => f.filepath);
    return rows<FileRow>(this.db.prepare(`SELECT * FROM files WHERE filepath IN (${paths.map(() => "?").join(",")})` + this._presenceClause(presenceFilter)).all(...paths));
  }

  // ─── folders ──────────────────────────────────────────────────────────────

  upsertFolder(data: UpsertFolderInput): void {
    const now = nowTs();
    this.db.prepare(`
      INSERT INTO folders (filepath,dirname,mtime,last_seen_at,created_at,updated_at)
      VALUES (?,?,?,?,?,?)
      ON CONFLICT(filepath) DO UPDATE SET
        dirname=excluded.dirname, mtime=excluded.mtime,
        last_seen_at=excluded.last_seen_at, updated_at=excluded.updated_at
    `).run(data.filepath, data.dirname, data.mtime ?? null, now, now, now);
  }

  batchUpsertFolders(list: UpsertFolderInput[]): void {
    if (!list.length) return;
    this.db.exec("BEGIN");
    try {
      for (const item of list) this.upsertFolder(item);
      this.db.exec("COMMIT");
    } catch (e) { this.db.exec("ROLLBACK"); throw e; }
  }

  countFolders(): number {
    return (this.db.prepare("SELECT COUNT(*) as n FROM folders").get() as { n: number }).n;
  }

  // ─── archive meta ─────────────────────────────────────────────────────────

  upsertArchiveMeta(
    filepath: string,
    archiveType: string,
    entryCount: number,
    imageNum: number,
    videoNum: number,
    musicNum: number,
    versionSig?: string | null,
    coverEntry?: string | null,
  ): void {
    const now = nowTs();
    this.db.prepare(`
      INSERT INTO archive_meta
        (filepath,archive_type,entry_count,image_file_num,video_file_num,music_file_num,scanned_at,version_sig,cover_entry,index_status)
      VALUES (?,?,?,?,?,?,?,?,?,'fresh')
      ON CONFLICT(filepath) DO UPDATE SET
        archive_type=excluded.archive_type,
        entry_count=excluded.entry_count,
        image_file_num=excluded.image_file_num,
        video_file_num=excluded.video_file_num,
        music_file_num=excluded.music_file_num,
        scanned_at=excluded.scanned_at,
        version_sig=excluded.version_sig,
        cover_entry=excluded.cover_entry,
        index_status='fresh'
    `).run(filepath, archiveType, entryCount, imageNum, videoNum, musicNum, now, versionSig ?? null, coverEntry ?? null);
  }

  /** 快速获取 version_sig，用于判断 archive 是否需要重新索引 */
  getArchiveVersionSig(filepath: string): string | null {
    const row = this.db.prepare("SELECT version_sig FROM archive_meta WHERE filepath = ?").get(filepath) as { version_sig: string | null } | undefined;
    return row?.version_sig ?? null;
  }

  getArchiveMeta(filepath: string): ArchiveMetaRow | undefined {
    return this.db.prepare("SELECT * FROM archive_meta WHERE filepath = ?").get(filepath) as ArchiveMetaRow | undefined;
  }

  getArchiveMetasByFolder(folderpath: string): Map<string, ArchiveMetaRow> {
    const result = rows<ArchiveMetaRow>(this.db.prepare(`
      SELECT am.* FROM archive_meta am JOIN files f ON f.filepath = am.filepath
      WHERE f.folderpath = ? AND f.file_type = 'archive'
    `).all(folderpath));
    return new Map(result.map(r => [r.filepath, r]));
  }

  // ─── progress ─────────────────────────────────────────────────────────────

  upsertProgress(data: Partial<ProgressRow> & { filepath: string }): void {
    const now = nowTs();
    this.db.prepare(`
      INSERT INTO progress (filepath,filename,file_type,filesize,mtime,thumbnail_url,last_opened_at,page_current,page_total,position_sec,duration_sec,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(filepath) DO UPDATE SET
        filename=COALESCE(excluded.filename,filename), file_type=COALESCE(excluded.file_type,file_type),
        filesize=COALESCE(excluded.filesize,filesize), mtime=COALESCE(excluded.mtime,mtime),
        thumbnail_url=COALESCE(excluded.thumbnail_url,thumbnail_url),
        last_opened_at=excluded.last_opened_at, page_current=excluded.page_current,
        page_total=excluded.page_total, position_sec=excluded.position_sec,
        duration_sec=excluded.duration_sec, updated_at=excluded.updated_at
    `).run(
      data.filepath, data.filename ?? null, data.file_type ?? null, data.filesize ?? null,
      data.mtime ?? null, data.thumbnail_url ?? null, now,
      data.page_current ?? null, data.page_total ?? null,
      data.position_sec ?? null, data.duration_sec ?? null, now,
    );
  }

  listProgressHistory(offset: number, limit: number, sortOrder = "desc"): ProgressRow[] {
    const order = sortOrder === "asc" ? "ASC" : "DESC";
    return rows<ProgressRow>(this.db.prepare(`SELECT * FROM progress ORDER BY last_opened_at ${order} LIMIT ? OFFSET ?`).all(limit, offset));
  }

  countProgressHistory(): number {
    return (this.db.prepare("SELECT COUNT(*) as n FROM progress").get() as { n: number }).n;
  }

  // ─── activity logs ────────────────────────────────────────────────────────

  logActivity(activityType: string, message: string, status = "completed", taskKey?: string, targetPath?: string, context?: object): void {
    const now = nowTs();
    this.db.prepare("INSERT INTO activity_logs (activity_type,status,task_key,message,target_path,context_json,created_at) VALUES (?,?,?,?,?,?,?)").run(activityType, status, taskKey ?? null, message, targetPath ?? null, context ? JSON.stringify(context) : null, now);
    this.db.prepare("DELETE FROM activity_logs WHERE id NOT IN (SELECT id FROM activity_logs ORDER BY created_at DESC, id DESC LIMIT 500)").run();
  }

  listActivityLogs(limit = 200): ActivityLogRow[] {
    return rows<ActivityLogRow>(this.db.prepare("SELECT * FROM activity_logs ORDER BY created_at DESC, id DESC LIMIT ?").all(limit));
  }

  listActivityLogsSinceLatestStartup(limit = 200): ActivityLogRow[] {
    const row = this.db.prepare("SELECT id FROM activity_logs WHERE activity_type = 'startup' AND status = 'started' ORDER BY created_at DESC, id DESC LIMIT 1").get() as { id: number } | undefined;
    if (!row) return this.listActivityLogs(limit);
    return rows<ActivityLogRow>(this.db.prepare("SELECT * FROM activity_logs WHERE id >= ? ORDER BY created_at DESC, id DESC LIMIT ?").all(row.id, limit));
  }

  // ─── folder open history ──────────────────────────────────────────────────

  recordFolderOpen(folderpath: string): void {
    const now = nowTs();
    this.db.prepare("INSERT INTO folder_open_history (folderpath,last_opened_at,open_count,updated_at) VALUES (?,?,1,?) ON CONFLICT(folderpath) DO UPDATE SET last_opened_at=excluded.last_opened_at,open_count=open_count+1,updated_at=excluded.updated_at").run(folderpath, now, now);
  }

  listTopOpenedFolderIds(limit = 5): string[] {
    const now = nowTs();
    const cutoff = now - 90 * 86400;
    const tau = 14 * 86400;
    const result = rows<{ folder_id: string }>(this.db.prepare(`
      WITH folder_scores AS (
        SELECT h.folderpath AS folder_id, h.open_count * exp(-((?-h.last_opened_at)*1.0)/?) AS score
        FROM folder_open_history h WHERE h.last_opened_at >= ?
      ),
      progress_scores AS (
        SELECT f.folderpath AS folder_id, exp(-((?-p.last_opened_at)*1.0)/?) AS score
        FROM progress p JOIN files f ON f.filepath = p.filepath
        WHERE p.last_opened_at >= ? AND f.folderpath IS NOT NULL
      ),
      combined AS (SELECT * FROM folder_scores UNION ALL SELECT * FROM progress_scores)
      SELECT folder_id FROM combined GROUP BY folder_id ORDER BY SUM(score) DESC LIMIT ?
    `).all(now, tau, cutoff, now, tau, cutoff, limit));
    return result.map(r => r.folder_id);
  }

  // ─── parsed metadata ──────────────────────────────────────────────────────

  saveParsedMetadata(filepath: string, data: { title?: string; authors?: string[]; cosers?: string[]; groupName?: string; rawTags?: string[]; event?: string; dateTag?: string; mediaType?: string }): void {
    const now = nowTs();
    const cosers = data.cosers ?? [];
    const authors = cosers.length ? [] : (data.authors ?? []);
    const stmtMeta = this.db.prepare("INSERT INTO parsed_metadata (filepath,title,group_name,event,date_tag,media_type,parsed_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(filepath) DO UPDATE SET title=excluded.title,group_name=excluded.group_name,event=excluded.event,date_tag=excluded.date_tag,media_type=excluded.media_type,parsed_at=excluded.parsed_at");
    const stmtArtist = this.db.prepare("INSERT OR IGNORE INTO artists (artist_name) VALUES (?)");
    const stmtFileArtist = this.db.prepare("INSERT OR IGNORE INTO file_artists (filepath,artist_name,role) VALUES (?,?,?)");
    const stmtTag = this.db.prepare("INSERT OR IGNORE INTO tags (tag_name) VALUES (?)");
    const stmtFileTag = this.db.prepare("INSERT OR IGNORE INTO file_tags (filepath,tag_name) VALUES (?,?)");
    this.db.exec("BEGIN");
    try {
      stmtMeta.run(filepath, data.title ?? null, data.groupName ?? null, data.event ?? null, data.dateTag ?? null, data.mediaType ?? null, now);
      for (const name of authors) { stmtArtist.run(name); stmtFileArtist.run(filepath, name, ""); }
      for (const name of cosers) { stmtArtist.run(name); stmtFileArtist.run(filepath, name, "coser"); }
      for (const tag of (data.rawTags ?? [])) { stmtTag.run(tag); stmtFileTag.run(filepath, tag); }
      this.db.exec("COMMIT");
    } catch (e) { this.db.exec("ROLLBACK"); throw e; }
  }

  getParsedMetadata(filepath: string): ParsedMetaRow | undefined {
    return this.db.prepare("SELECT * FROM parsed_metadata WHERE filepath = ?").get(filepath) as ParsedMetaRow | undefined;
  }

  getFileArtists(filepath: string): string[] {
    return rows<{ artist_name: string }>(this.db.prepare("SELECT artist_name FROM file_artists WHERE filepath = ? AND role = ''").all(filepath)).map(r => r.artist_name);
  }

  getFileCosers(filepath: string): string[] {
    return rows<{ artist_name: string }>(this.db.prepare("SELECT artist_name FROM file_artists WHERE filepath = ? AND role = 'coser'").all(filepath)).map(r => r.artist_name);
  }

  getFileTags(filepath: string): string[] {
    return rows<{ tag_name: string }>(this.db.prepare("SELECT tag_name FROM file_tags WHERE filepath = ?").all(filepath)).map(r => r.tag_name);
  }

  getArtistsByFilepaths(filepaths: string[]): Map<string, string[]> {
    if (!filepaths.length) return new Map();
    const result = rows<{ filepath: string; artist_name: string }>(this.db.prepare(`SELECT filepath,artist_name FROM file_artists WHERE filepath IN (${filepaths.map(() => "?").join(",")}) AND role = ''`).all(...filepaths));
    const map = new Map<string, string[]>();
    for (const r of result) { const arr = map.get(r.filepath) ?? []; arr.push(r.artist_name); map.set(r.filepath, arr); }
    return map;
  }

  getParsedMetadataByFilepaths(filepaths: string[]): Map<string, ParsedMetaRow> {
    if (!filepaths.length) return new Map();
    const result = rows<ParsedMetaRow>(this.db.prepare(`SELECT * FROM parsed_metadata WHERE filepath IN (${filepaths.map(() => "?").join(",")})`).all(...filepaths));
    return new Map(result.map(r => [r.filepath, r]));
  }

  getFileDataByFolder(folderpath: string): Map<string, { rec_score: number; last_read_at: number | null }> {
    const result = rows<{ filepath: string; rec_score: number; last_opened_at: number | null }>(this.db.prepare("SELECT f.filepath, f.rec_score, p.last_opened_at FROM files f LEFT JOIN progress p ON p.filepath = f.filepath WHERE f.folderpath = ?").all(folderpath));
    return new Map(result.map(r => [r.filepath, { rec_score: r.rec_score, last_read_at: r.last_opened_at }]));
  }

  // ─── tags / artists listing ───────────────────────────────────────────────

  listTagsWithCounts(offset: number, limit: number, sortBy = "count", sortOrder = "desc"): { tag_name: string; file_count: number; avg_rec_score: number }[] {
    const col = sortBy === "name" ? "tag_name" : sortBy === "recommendation" ? "avg_rec_score" : "file_count";
    const dir = sortOrder === "asc" ? "ASC" : "DESC";
    return rows<{ tag_name: string; file_count: number; avg_rec_score: number }>(this.db.prepare(`SELECT t.tag_name, COUNT(ft.filepath) as file_count, AVG(COALESCE(f.rec_score,0)) as avg_rec_score FROM tags t LEFT JOIN file_tags ft ON ft.tag_name = t.tag_name LEFT JOIN files f ON f.filepath = ft.filepath GROUP BY t.tag_name ORDER BY ${col} ${dir}, t.tag_name ASC LIMIT ? OFFSET ?`).all(limit, offset));
  }

  countTags(): number {
    return (this.db.prepare("SELECT COUNT(*) as n FROM tags").get() as { n: number }).n;
  }

  listArtistsWithCounts(offset: number, limit: number, role = "", sortBy = "count", sortOrder = "desc"): { artist_name: string; file_count: number; avg_rec_score: number }[] {
    const col = sortBy === "name" ? "artist_name" : sortBy === "recommendation" ? "avg_rec_score" : "file_count";
    const dir = sortOrder === "asc" ? "ASC" : "DESC";
    return rows<{ artist_name: string; file_count: number; avg_rec_score: number }>(this.db.prepare(`SELECT a.artist_name, COUNT(fa.filepath) as file_count, AVG(COALESCE(f.rec_score,0)) as avg_rec_score FROM artists a LEFT JOIN file_artists fa ON fa.artist_name = a.artist_name AND fa.role = ? LEFT JOIN files f ON f.filepath = fa.filepath GROUP BY a.artist_name ORDER BY ${col} ${dir}, a.artist_name ASC LIMIT ? OFFSET ?`).all(role, limit, offset));
  }

  countArtists(role = ""): number {
    return (this.db.prepare("SELECT COUNT(DISTINCT artist_name) as n FROM file_artists WHERE role = ?").get(role) as { n: number }).n;
  }

  batchUpdateRecScores(scores: Map<string, number>): void {
    if (!scores.size) return;
    const stmt = this.db.prepare("UPDATE files SET rec_score = ? WHERE filepath = ?");
    this.db.exec("BEGIN");
    try {
      for (const [fp, score] of scores) stmt.run(score, fp);
      this.db.exec("COMMIT");
    } catch (e) { this.db.exec("ROLLBACK"); throw e; }
  }

  getLibraryOverview(): { archives: number; videos: number; images: number; audio: number; folders: number } {
    const row = this.db.prepare(`
      SELECT
        SUM(CASE WHEN file_type = 'archive' THEN 1 ELSE 0 END) as archives,
        SUM(CASE WHEN file_type = 'video'   THEN 1 ELSE 0 END) as videos,
        SUM(CASE WHEN file_type = 'image'   THEN 1 ELSE 0 END) as images,
        SUM(CASE WHEN file_type = 'audio'   THEN 1 ELSE 0 END) as audio
      FROM files WHERE is_missing = 0
    `).get() as { archives: number; videos: number; images: number; audio: number };
    return { archives: row.archives ?? 0, videos: row.videos ?? 0, images: row.images ?? 0, audio: row.audio ?? 0, folders: this.countFolders() };
  }

  getTagTotalCounts(): Map<string, number> {
    const result = rows<{ tag_name: string; cnt: number }>(this.db.prepare("SELECT ft.tag_name, COUNT(ft.filepath) as cnt FROM file_tags ft GROUP BY ft.tag_name").all());
    return new Map(result.map(r => [r.tag_name, r.cnt]));
  }

  getTagsByFilepaths(filepaths: string[]): Map<string, string[]> {
    if (!filepaths.length) return new Map();
    const result = rows<{ filepath: string; tag_name: string }>(this.db.prepare(`SELECT filepath,tag_name FROM file_tags WHERE filepath IN (${filepaths.map(() => "?").join(",")})`).all(...filepaths));
    const map = new Map<string, string[]>();
    for (const r of result) { const arr = map.get(r.filepath) ?? []; arr.push(r.tag_name); map.set(r.filepath, arr); }
    return map;
  }

  getArtistThumbCandidates(names: string[], role: string, limit = 3): Map<string, string[]> {
    if (!names.length) return new Map();
    const placeholders = names.map(() => "?").join(",");
    const result = rows<{ artist_name: string; filepath: string }>(this.db.prepare(`
      SELECT artist_name, filepath FROM (
        SELECT fa.artist_name, f.filepath, f.mtime,
               ROW_NUMBER() OVER (PARTITION BY fa.artist_name ORDER BY f.mtime DESC) as rn
        FROM file_artists fa JOIN files f ON f.filepath = fa.filepath
        WHERE fa.role = ? AND fa.artist_name IN (${placeholders}) AND f.is_missing = 0
      ) WHERE rn <= ?
    `).all(role, ...names, limit));
    const map = new Map<string, string[]>();
    for (const r of result) { const arr = map.get(r.artist_name) ?? []; arr.push(r.filepath); map.set(r.artist_name, arr); }
    return map;
  }

  getTagThumbCandidates(names: string[], limit = 3): Map<string, string[]> {
    if (!names.length) return new Map();
    const placeholders = names.map(() => "?").join(",");
    const result = rows<{ tag_name: string; filepath: string }>(this.db.prepare(`
      SELECT tag_name, filepath FROM (
        SELECT ft.tag_name, f.filepath, f.mtime,
               ROW_NUMBER() OVER (PARTITION BY ft.tag_name ORDER BY f.mtime DESC) as rn
        FROM file_tags ft JOIN files f ON f.filepath = ft.filepath
        WHERE ft.tag_name IN (${placeholders}) AND f.is_missing = 0
      ) WHERE rn <= ?
    `).all(...names, limit));
    const map = new Map<string, string[]>();
    for (const r of result) { const arr = map.get(r.tag_name) ?? []; arr.push(r.filepath); map.set(r.tag_name, arr); }
    return map;
  }

  getArtistThumbnailPaths(names: string[], role: string): Map<string, string> {
    if (!names.length) return new Map();
    const placeholders = names.map(() => "?").join(",");
    const result = rows<{ artist_name: string; thumbnail_filepath: string }>(this.db.prepare(`
      SELECT fa.artist_name, f.thumbnail_filepath FROM file_artists fa
      JOIN files f ON f.filepath = fa.filepath
      WHERE fa.role = ? AND fa.artist_name IN (${placeholders})
        AND f.thumbnail_filepath IS NOT NULL AND f.is_missing = 0
      GROUP BY fa.artist_name
    `).all(role, ...names));
    return new Map(result.map(r => [r.artist_name, r.thumbnail_filepath]));
  }

  getTagThumbnailPaths(names: string[]): Map<string, string> {
    if (!names.length) return new Map();
    const placeholders = names.map(() => "?").join(",");
    const result = rows<{ tag_name: string; thumbnail_filepath: string }>(this.db.prepare(`
      SELECT ft.tag_name, f.thumbnail_filepath FROM file_tags ft
      JOIN files f ON f.filepath = ft.filepath
      WHERE ft.tag_name IN (${placeholders})
        AND f.thumbnail_filepath IS NOT NULL AND f.is_missing = 0
      GROUP BY ft.tag_name
    `).all(...names));
    return new Map(result.map(r => [r.tag_name, r.thumbnail_filepath]));
  }

  getFavoriteAuthorFrequencies(favoriteDir: string): Map<string, number> {
    const result = rows<{ artist_name: string; cnt: number }>(this.db.prepare("SELECT fa.artist_name, COUNT(fa.filepath) as cnt FROM file_artists fa JOIN files f ON f.filepath = fa.filepath WHERE fa.role = '' AND f.filepath LIKE ? GROUP BY fa.artist_name").all(favoriteDir + "%"));
    return new Map(result.map(r => [r.artist_name, r.cnt]));
  }

  getFavoriteTagFrequencies(favoriteDir: string): Map<string, number> {
    const result = rows<{ tag_name: string; cnt: number }>(this.db.prepare("SELECT ft.tag_name, COUNT(ft.filepath) as cnt FROM file_tags ft JOIN files f ON f.filepath = ft.filepath WHERE f.filepath LIKE ? GROUP BY ft.tag_name").all(favoriteDir + "%"));
    return new Map(result.map(r => [r.tag_name, r.cnt]));
  }

  private _pruneOrphans(): void {
    this.db.prepare("DELETE FROM tags WHERE tag_name NOT IN (SELECT DISTINCT tag_name FROM file_tags)").run();
    this.db.prepare("DELETE FROM artists WHERE artist_name NOT IN (SELECT DISTINCT artist_name FROM file_artists)").run();
  }
}
