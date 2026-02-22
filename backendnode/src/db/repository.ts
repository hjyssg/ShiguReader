import { DatabaseSync } from "node:sqlite";
import { nowTs } from "./client.js";

/**
 * 数据库 schema 与本文件 interface 的关系：
 *   schema.sql 是 SQLite 建表 DDL（source of truth），本文件的 interface 是对应表的 TypeScript 类型映射。
 *   两者字段名和类型一一对应，没有自动生成机制——改了 schema 需要手动同步这里的 interface。
 */

/** `files` 表的行类型，对应磁盘上的单个文件记录 */
export interface FileRow {
  /** 文件绝对路径，主键 */
  filepath: string;
  /** 所在目录的绝对路径，顶层文件可为 null */
  folderpath: string | null;
  /** 文件名（含扩展名） */
  filename: string;
  /** 文件修改时间，Unix 秒时间戳 */
  mtime: number;
  /** 文件大小，字节 */
  filesize: number;
  /** 文件类型：archive / video / image / audio / unknown */
  file_type: string;
  /** 小写扩展名，如 ".zip"，无扩展名时为 null */
  ext: string | null;
  /** 已生成的缩略图在磁盘上的绝对路径，未生成时为 null */
  thumbnail_filepath: string | null;
  /** 推荐分数，由 recService 计算，默认 0.0 */
  rec_score: number;
  /** 1 = 文件已从磁盘消失但保留历史记录；0 = 正常存在 */
  is_missing: number;
  /** 最近一次被扫描到的时间戳，首次插入时设为当前时间 */
  last_seen_at: number | null;
  /** 记录首次创建时间 */
  created_at: number;
  /** 记录最近更新时间 */
  updated_at: number;
}

/** `folders` 表的行类型，对应磁盘上的目录 */
export interface FolderRow {
  /** 目录绝对路径，主键 */
  filepath: string;
  /** 目录名（basename） */
  dirname: string;
  /** 目录修改时间，Unix 秒时间戳，可为 null */
  mtime: number | null;
  /** 最近一次被扫描到的时间戳 */
  last_seen_at: number | null;
  created_at: number;
  updated_at: number;
}

/** `archive_meta` 表的行类型，存储压缩包内容统计信息 */
export interface ArchiveMetaRow {
  /** 压缩包文件路径，主键，外键关联 files.filepath */
  filepath: string;
  /** 压缩包格式，如 "zip" / "7z" / "rar" */
  archive_type: string;
  /** 压缩包内媒体文件总数 */
  entry_count: number;
  /** 压缩包内图片文件数量 */
  image_file_num: number;
  /** 压缩包内视频文件数量 */
  video_file_num: number;
  /** 压缩包内音频文件数量 */
  music_file_num: number;
  /** 最近一次扫描时间戳 */
  scanned_at: number | null;
  /** 版本签名，格式为 "mtime:size"，用于判断是否需要重新索引 */
  version_sig: string | null;
  /** 封面图在压缩包内的路径（第一张图片） */
  cover_entry: string | null;
  /** 索引状态：fresh = 已扫描且最新 */
  index_status: string;
}

/** `read_history` 表的行类型，记录文件打开历史（append log） */
export interface ReadHistoryRow {
  id: number;
  filepath: string;
  opened_at: number;
  /** JOIN files 后附加的展示字段，查询时可能为 null（文件已删除） */
  filename?: string | null;
  file_type?: string | null;
  thumbnail_filepath?: string | null;
}

/** `activity_logs` 表的行类型，记录后台操作日志 */
export interface ActivityLogRow {
  /** 自增主键 */
  id: number;
  /** 操作类型：scan / backfill / move / delete / rename / startup 等 */
  activity_type: string;
  /** 操作状态：started / completed / failed */
  status: string;
  /** 任务唯一键，用于去重或关联，如 "scan:/path/to/dir" */
  task_key: string | null;
  /** 人类可读的操作描述 */
  message: string;
  /** 操作涉及的文件/目录路径 */
  target_path: string | null;
  /** 附加上下文，JSON 字符串 */
  context_json: string | null;
  created_at: number;
}

/** `parsed_metadata` 表的行类型，存储从文件名解析出的元数据 */
export interface ParsedMetaRow {
  /** 文件路径，主键 */
  filepath: string;
  /** 解析出的作品标题 */
  title: string | null;
  /** 社团/出版社名称 */
  group_name: string | null;
  /** 发布活动/展会名称，如 "C102" */
  event: string | null;
  /** 日期标签，如 "20230415" */
  date_tag: string | null;
  /** 媒体类型，如 "同人誌" / "同人CG" */
  media_type: string | null;
  /** 解析时间戳 */
  parsed_at: number;
}

/** upsertFile 的输入类型，file_type 和 ext 可选（有默认值） */
export interface UpsertFileInput {
  filepath: string;
  folderpath?: string | null;
  filename: string;
  mtime: number;
  filesize: number;
  file_type?: string;
  ext?: string | null;
}

/** upsertFolder 的输入类型 */
export interface UpsertFolderInput {
  filepath: string;
  dirname: string;
  mtime?: number | null;
}

/** node:sqlite 返回的是 unknown，这个辅助函数做类型断言 */
function rows<T>(result: unknown): T[] {
  return result as T[];
}

export class IndexRepository {
  constructor(private db: DatabaseSync) {}

  /** 插入或更新一条文件记录（upsert by filepath）。重新出现的文件会自动清除 is_missing 标记 */
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

  /** 批量 upsert 文件，包裹在单个事务中提升性能 */
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

  /** 按 filepath 查询单条文件记录 */
  getFile(filepath: string): FileRow | undefined {
    return this.db.prepare("SELECT * FROM files WHERE filepath = ?").get(filepath) as FileRow | undefined;
  }

  /** 物理删除文件记录，并清理孤立的 tags/artists */
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
      for (const tbl of ["archive_meta", "video_meta", "read_history", "parsed_metadata"]) {
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
      for (const tbl of ["archive_meta", "video_meta", "read_history", "parsed_metadata"]) {
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

  /** 删除指定路径前缀下的所有文件和目录记录（用于目录整体删除） */
  deleteByPrefix(prefix: string): void {
    this.db.prepare("DELETE FROM files WHERE filepath LIKE ?").run(prefix + "%");
    this.db.prepare("DELETE FROM folders WHERE filepath LIKE ?").run(prefix + "%");
    this._pruneOrphans();
  }

  /** 按文件名精确匹配，返回最近扫描到的记录，可排除自身路径（用于查找重复文件） */
  findFilesByFilename(filename: string, excludePath = "", limit = 10): FileRow[] {
    const result = rows<FileRow>(this.db.prepare("SELECT * FROM files WHERE filename = ? AND is_missing = 0 ORDER BY last_seen_at DESC LIMIT ?").all(filename, limit));
    return excludePath ? result.filter(r => r.filepath !== excludePath) : result;
  }

  /** 统计指定类型的非缺失文件数量 */
  countFilesByType(fileType: string): number {
    return (this.db.prepare("SELECT COUNT(*) as n FROM files WHERE file_type = ? AND is_missing = 0").get(fileType) as { n: number }).n;
  }

  /** 更新文件的缩略图路径 */
  updateFileThumbnail(filepath: string, thumbPath: string): void {
    this.db.prepare("UPDATE files SET thumbnail_filepath = ? WHERE filepath = ?").run(thumbPath, filepath);
  }

  // ─── search ───────────────────────────────────────────────────────────────

  private _presenceClause(filter: string): string {
    if (filter === "all") return "";
    if (filter === "watched") return " AND filepath IN (SELECT filepath FROM read_history)";
    if (filter === "scanned_recent") return ` AND is_missing = 0 AND last_seen_at >= ${nowTs() - 600}`;
    return " AND is_missing = 0"; // default: present
  }

  /** 按文件名/路径模糊搜索 */
  searchFiles(q: string, presenceFilter = "present"): FileRow[] {
    const p = `%${q}%`;
    return rows<FileRow>(this.db.prepare("SELECT * FROM files WHERE (filename LIKE ? OR filepath LIKE ?)" + this._presenceClause(presenceFilter)).all(p, p));
  }

  /** 按作者名模糊搜索，返回关联文件列表 */
  searchByAuthor(q: string, presenceFilter = "present"): FileRow[] {
    const artists = rows<{ artist_name: string }>(this.db.prepare("SELECT artist_name FROM artists WHERE artist_name LIKE ?").all(`%${q}%`));
    if (!artists.length) return [];
    const names = artists.map(a => a.artist_name);
    const fps = rows<{ filepath: string }>(this.db.prepare(`SELECT filepath FROM file_artists WHERE artist_name IN (${names.map(() => "?").join(",")}) AND role = ''`).all(...names));
    if (!fps.length) return [];
    const paths = fps.map(f => f.filepath);
    return rows<FileRow>(this.db.prepare(`SELECT * FROM files WHERE filepath IN (${paths.map(() => "?").join(",")})` + this._presenceClause(presenceFilter)).all(...paths));
  }

  /** 按 coser 名模糊搜索，返回关联文件列表 */
  searchByCoser(q: string, presenceFilter = "present"): FileRow[] {
    const artists = rows<{ artist_name: string }>(this.db.prepare("SELECT artist_name FROM artists WHERE artist_name LIKE ?").all(`%${q}%`));
    if (!artists.length) return [];
    const names = artists.map(a => a.artist_name);
    const fps = rows<{ filepath: string }>(this.db.prepare(`SELECT filepath FROM file_artists WHERE artist_name IN (${names.map(() => "?").join(",")}) AND role = 'coser'`).all(...names));
    if (!fps.length) return [];
    const paths = fps.map(f => f.filepath);
    return rows<FileRow>(this.db.prepare(`SELECT * FROM files WHERE filepath IN (${paths.map(() => "?").join(",")})` + this._presenceClause(presenceFilter)).all(...paths));
  }

  /** 按 tag 名模糊搜索，返回关联文件列表 */
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

  /** 插入或更新目录记录 */
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

  /** 批量 upsert 目录，包裹在单个事务中 */
  batchUpsertFolders(list: UpsertFolderInput[]): void {
    if (!list.length) return;
    this.db.exec("BEGIN");
    try {
      for (const item of list) this.upsertFolder(item);
      this.db.exec("COMMIT");
    } catch (e) { this.db.exec("ROLLBACK"); throw e; }
  }

  /** 返回 folders 表总行数 */
  countFolders(): number {
    return (this.db.prepare("SELECT COUNT(*) as n FROM folders").get() as { n: number }).n;
  }

  // ─── archive meta ─────────────────────────────────────────────────────────

  /** 插入或更新压缩包元数据，同时将 index_status 置为 'fresh' */
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

  /** 获取单条压缩包元数据 */
  getArchiveMeta(filepath: string): ArchiveMetaRow | undefined {
    return this.db.prepare("SELECT * FROM archive_meta WHERE filepath = ?").get(filepath) as ArchiveMetaRow | undefined;
  }

  /** 批量获取某目录下所有压缩包的元数据，返回 filepath → ArchiveMetaRow 的 Map */
  getArchiveMetasByFolder(folderpath: string): Map<string, ArchiveMetaRow> {
    const result = rows<ArchiveMetaRow>(this.db.prepare(`
      SELECT am.* FROM archive_meta am JOIN files f ON f.filepath = am.filepath
      WHERE f.folderpath = ? AND f.file_type = 'archive'
    `).all(folderpath));
    return new Map(result.map(r => [r.filepath, r]));
  }

  // ─── read history ─────────────────────────────────────────────────────────

  /** 记录文件被打开一次（append log） */
  recordRead(filepath: string): void {
    const now = nowTs();
    this.db.prepare("INSERT INTO read_history (filepath, opened_at) VALUES (?, ?)").run(filepath, now);
  }

  /** 分页查询阅读历史，JOIN files 获取展示字段，按 opened_at 排序 */
  listReadHistory(offset: number, limit: number, sortOrder = "desc"): ReadHistoryRow[] {
    const order = sortOrder === "asc" ? "ASC" : "DESC";
    return rows<ReadHistoryRow>(this.db.prepare(`
      SELECT h.id, h.filepath, h.opened_at,
             f.filename, f.file_type, f.thumbnail_filepath
      FROM read_history h
      LEFT JOIN files f ON f.filepath = h.filepath
      ORDER BY h.opened_at ${order}
      LIMIT ? OFFSET ?
    `).all(limit, offset));
  }

  /** 返回 read_history 表总行数 */
  countReadHistory(): number {
    return (this.db.prepare("SELECT COUNT(*) as n FROM read_history").get() as { n: number }).n;
  }

  // ─── activity logs ────────────────────────────────────────────────────────

  /** 写入一条操作日志，并自动裁剪超出 500 条的旧记录 */
  logActivity(activityType: string, message: string, status = "completed", taskKey?: string, targetPath?: string, context?: object): void {
    const now = nowTs();
    this.db.prepare("INSERT INTO activity_logs (activity_type,status,task_key,message,target_path,context_json,created_at) VALUES (?,?,?,?,?,?,?)").run(activityType, status, taskKey ?? null, message, targetPath ?? null, context ? JSON.stringify(context) : null, now);
    this.db.prepare("DELETE FROM activity_logs WHERE id NOT IN (SELECT id FROM activity_logs ORDER BY created_at DESC, id DESC LIMIT 500)").run();
  }

  /** 查询最近 N 条操作日志 */
  listActivityLogs(limit = 200): ActivityLogRow[] {
    return rows<ActivityLogRow>(this.db.prepare("SELECT * FROM activity_logs ORDER BY created_at DESC, id DESC LIMIT ?").all(limit));
  }

  /** 查询最近一次 startup 日志之后的所有操作日志，若无 startup 则返回全部 */
  listActivityLogsSinceLatestStartup(limit = 200): ActivityLogRow[] {
    const row = this.db.prepare("SELECT id FROM activity_logs WHERE activity_type = 'startup' AND status = 'started' ORDER BY created_at DESC, id DESC LIMIT 1").get() as { id: number } | undefined;
    if (!row) return this.listActivityLogs(limit);
    return rows<ActivityLogRow>(this.db.prepare("SELECT * FROM activity_logs WHERE id >= ? ORDER BY created_at DESC, id DESC LIMIT ?").all(row.id, limit));
  }

  // ─── folder open history ──────────────────────────────────────────────────

  /** 记录目录被打开一次，累加 open_count 并更新 last_opened_at */
  recordFolderOpen(folderpath: string): void {
    const now = nowTs();
    this.db.prepare("INSERT INTO folder_open_history (folderpath,last_opened_at,open_count,updated_at) VALUES (?,?,1,?) ON CONFLICT(folderpath) DO UPDATE SET last_opened_at=excluded.last_opened_at,open_count=open_count+1,updated_at=excluded.updated_at").run(folderpath, now, now);
  }

  /** 按时间衰减加权算法，返回最近常用的 top N 目录 ID */
  listTopOpenedFolderIds(limit = 5): string[] {
    const now = nowTs();
    const cutoff = now - 90 * 86400;
    const tau = 14 * 86400;
    const result = rows<{ folder_id: string }>(this.db.prepare(`
      WITH folder_scores AS (
        SELECT h.folderpath AS folder_id, h.open_count * exp(-((?-h.last_opened_at)*1.0)/?) AS score
        FROM folder_open_history h WHERE h.last_opened_at >= ?
      ),
      read_scores AS (
        SELECT f.folderpath AS folder_id, exp(-((?-h.opened_at)*1.0)/?) AS score
        FROM read_history h JOIN files f ON f.filepath = h.filepath
        WHERE h.opened_at >= ? AND f.folderpath IS NOT NULL
      ),
      combined AS (SELECT * FROM folder_scores UNION ALL SELECT * FROM read_scores)
      SELECT folder_id FROM combined GROUP BY folder_id ORDER BY SUM(score) DESC LIMIT ?
    `).all(now, tau, cutoff, now, tau, cutoff, limit));
    return result.map(r => r.folder_id);
  }

  // ─── parsed metadata ──────────────────────────────────────────────────────

  /** 保存从文件名解析出的元数据，同时写入 artists / cosers / tags 关联表 */
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

  /** 获取单条解析元数据 */
  getParsedMetadata(filepath: string): ParsedMetaRow | undefined {
    return this.db.prepare("SELECT * FROM parsed_metadata WHERE filepath = ?").get(filepath) as ParsedMetaRow | undefined;
  }

  /** 获取文件关联的作者名列表（role = ''） */
  getFileArtists(filepath: string): string[] {
    return rows<{ artist_name: string }>(this.db.prepare("SELECT artist_name FROM file_artists WHERE filepath = ? AND role = ''").all(filepath)).map(r => r.artist_name);
  }

  /** 获取文件关联的 coser 名列表（role = 'coser'） */
  getFileCosers(filepath: string): string[] {
    return rows<{ artist_name: string }>(this.db.prepare("SELECT artist_name FROM file_artists WHERE filepath = ? AND role = 'coser'").all(filepath)).map(r => r.artist_name);
  }

  /** 获取文件关联的 tag 列表 */
  getFileTags(filepath: string): string[] {
    return rows<{ tag_name: string }>(this.db.prepare("SELECT tag_name FROM file_tags WHERE filepath = ?").all(filepath)).map(r => r.tag_name);
  }

  /** 批量获取多个文件的作者列表，返回 filepath → string[] 的 Map */
  getArtistsByFilepaths(filepaths: string[]): Map<string, string[]> {
    if (!filepaths.length) return new Map();
    const result = rows<{ filepath: string; artist_name: string }>(this.db.prepare(`SELECT filepath,artist_name FROM file_artists WHERE filepath IN (${filepaths.map(() => "?").join(",")}) AND role = ''`).all(...filepaths));
    const map = new Map<string, string[]>();
    for (const r of result) { const arr = map.get(r.filepath) ?? []; arr.push(r.artist_name); map.set(r.filepath, arr); }
    return map;
  }

  /** 批量获取多个文件的解析元数据，返回 filepath → ParsedMetaRow 的 Map */
  getParsedMetadataByFilepaths(filepaths: string[]): Map<string, ParsedMetaRow> {
    if (!filepaths.length) return new Map();
    const result = rows<ParsedMetaRow>(this.db.prepare(`SELECT * FROM parsed_metadata WHERE filepath IN (${filepaths.map(() => "?").join(",")})`).all(...filepaths));
    return new Map(result.map(r => [r.filepath, r]));
  }

  /** 批量获取某目录下所有文件的 rec_score 和最近阅读时间，用于列表排序 */
  getFileDataByFolder(folderpath: string): Map<string, { rec_score: number; last_read_at: number | null }> {
    const result = rows<{ filepath: string; rec_score: number; last_read_at: number | null }>(this.db.prepare(`
      SELECT f.filepath, f.rec_score,
             (SELECT MAX(h.opened_at) FROM read_history h WHERE h.filepath = f.filepath) AS last_read_at
      FROM files f WHERE f.folderpath = ?
    `).all(folderpath));
    return new Map(result.map(r => [r.filepath, { rec_score: r.rec_score, last_read_at: r.last_read_at }]));
  }

  // ─── quick match ──────────────────────────────────────────────────────────

  /**
   * 搜索 quick-match 候选文件。
   * 按 author 名精确匹配 + 按 title 关键词模糊搜索，合并去重后返回。
   * presenceFilter: "all" | "present"
   */
  quickMatchCandidates(
    authorName: string | null,
    titleKeyword: string | null,
    presenceFilter = "all",
    limit = 30,
  ): FileRow[] {
    const presence = this._presenceClause(presenceFilter);
    const byPath = new Map<string, FileRow>();

    if (authorName) {
      const artists = rows<{ artist_name: string }>(
        this.db.prepare("SELECT artist_name FROM artists WHERE artist_name LIKE ?").all(`%${authorName}%`)
      );
      if (artists.length) {
        const names = artists.map(a => a.artist_name);
        const fps = rows<{ filepath: string }>(
          this.db.prepare(`SELECT filepath FROM file_artists WHERE artist_name IN (${names.map(() => "?").join(",")}) AND role = ''`).all(...names)
        );
        if (fps.length) {
          const paths = fps.map(f => f.filepath);
          const fileRows = rows<FileRow>(
            this.db.prepare(`SELECT * FROM files WHERE filepath IN (${paths.map(() => "?").join(",")})${presence} LIMIT ?`).all(...paths, limit)
          );
          for (const r of fileRows) byPath.set(r.filepath, r);
        }
      }
    }

    if (titleKeyword && byPath.size < limit) {
      const p = `%${titleKeyword}%`;
      const fileRows = rows<FileRow>(
        this.db.prepare(`SELECT * FROM files WHERE filename LIKE ?${presence} LIMIT ?`).all(p, limit)
      );
      for (const r of fileRows) byPath.set(r.filepath, r);
    }

    return [...byPath.values()].slice(0, limit);
  }

  // ─── tags / artists listing ───────────────────────────────────────────────

  /** 分页列出所有 tag 及其关联文件数和平均推荐分 */
  listTagsWithCounts(offset: number, limit: number, sortBy = "count", sortOrder = "desc"): { tag_name: string; file_count: number; avg_rec_score: number }[] {
    const col = sortBy === "name" ? "tag_name" : sortBy === "recommendation" ? "avg_rec_score" : "file_count";
    const dir = sortOrder === "asc" ? "ASC" : "DESC";
    return rows<{ tag_name: string; file_count: number; avg_rec_score: number }>(this.db.prepare(`SELECT t.tag_name, COUNT(ft.filepath) as file_count, AVG(COALESCE(f.rec_score,0)) as avg_rec_score FROM tags t LEFT JOIN file_tags ft ON ft.tag_name = t.tag_name LEFT JOIN files f ON f.filepath = ft.filepath GROUP BY t.tag_name ORDER BY ${col} ${dir}, t.tag_name ASC LIMIT ? OFFSET ?`).all(limit, offset));
  }

  /** 返回 tags 表总行数 */
  countTags(): number {
    return (this.db.prepare("SELECT COUNT(*) as n FROM tags").get() as { n: number }).n;
  }

  /** 分页列出所有 artist（可按 role 过滤）及其关联文件数和平均推荐分 */
  listArtistsWithCounts(offset: number, limit: number, role = "", sortBy = "count", sortOrder = "desc"): { artist_name: string; file_count: number; avg_rec_score: number }[] {
    const col = sortBy === "name" ? "artist_name" : sortBy === "recommendation" ? "avg_rec_score" : "file_count";
    const dir = sortOrder === "asc" ? "ASC" : "DESC";
    return rows<{ artist_name: string; file_count: number; avg_rec_score: number }>(this.db.prepare(`SELECT a.artist_name, COUNT(fa.filepath) as file_count, AVG(COALESCE(f.rec_score,0)) as avg_rec_score FROM artists a LEFT JOIN file_artists fa ON fa.artist_name = a.artist_name AND fa.role = ? LEFT JOIN files f ON f.filepath = fa.filepath GROUP BY a.artist_name ORDER BY ${col} ${dir}, a.artist_name ASC LIMIT ? OFFSET ?`).all(role, limit, offset));
  }

  /** 返回指定 role 的 artist 去重总数 */
  countArtists(role = ""): number {
    return (this.db.prepare("SELECT COUNT(DISTINCT artist_name) as n FROM file_artists WHERE role = ?").get(role) as { n: number }).n;
  }

  /** 批量更新文件推荐分，包裹在单个事务中 */
  batchUpdateRecScores(scores: Map<string, number>): void {
    if (!scores.size) return;
    const stmt = this.db.prepare("UPDATE files SET rec_score = ? WHERE filepath = ?");
    this.db.exec("BEGIN");
    try {
      for (const [fp, score] of scores) stmt.run(score, fp);
      this.db.exec("COMMIT");
    } catch (e) { this.db.exec("ROLLBACK"); throw e; }
  }

  /** 返回媒体库各类型文件数量概览 */
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

  /** 返回所有 tag 的文件关联数，用于推荐分计算 */
  getTagTotalCounts(): Map<string, number> {
    const result = rows<{ tag_name: string; cnt: number }>(this.db.prepare("SELECT ft.tag_name, COUNT(ft.filepath) as cnt FROM file_tags ft GROUP BY ft.tag_name").all());
    return new Map(result.map(r => [r.tag_name, r.cnt]));
  }

  /** 批量获取多个文件的 tag 列表，返回 filepath → string[] 的 Map */
  getTagsByFilepaths(filepaths: string[]): Map<string, string[]> {
    if (!filepaths.length) return new Map();
    const result = rows<{ filepath: string; tag_name: string }>(this.db.prepare(`SELECT filepath,tag_name FROM file_tags WHERE filepath IN (${filepaths.map(() => "?").join(",")})`).all(...filepaths));
    const map = new Map<string, string[]>();
    for (const r of result) { const arr = map.get(r.filepath) ?? []; arr.push(r.tag_name); map.set(r.filepath, arr); }
    return map;
  }

  /** 为一批 artist 各取最近 N 个文件路径，用于封面候选 */
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

  /** 为一批 tag 各取最近 N 个文件路径，用于封面候选 */
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

  /** 批量获取 artist 已生成的缩略图路径，返回 artist_name → thumbnail_filepath 的 Map */
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

  /** 批量获取 tag 已生成的缩略图路径，返回 tag_name → thumbnail_filepath 的 Map */
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

  /** 统计收藏目录下各作者的文件数，用于推荐分计算 */
  getFavoriteAuthorFrequencies(favoriteDir: string): Map<string, number> {
    const result = rows<{ artist_name: string; cnt: number }>(this.db.prepare("SELECT fa.artist_name, COUNT(fa.filepath) as cnt FROM file_artists fa JOIN files f ON f.filepath = fa.filepath WHERE fa.role = '' AND f.filepath LIKE ? GROUP BY fa.artist_name").all(favoriteDir + "%"));
    return new Map(result.map(r => [r.artist_name, r.cnt]));
  }

  /** 统计收藏目录下各 tag 的文件数，用于推荐分计算 */
  getFavoriteTagFrequencies(favoriteDir: string): Map<string, number> {
    const result = rows<{ tag_name: string; cnt: number }>(this.db.prepare("SELECT ft.tag_name, COUNT(ft.filepath) as cnt FROM file_tags ft JOIN files f ON f.filepath = ft.filepath WHERE f.filepath LIKE ? GROUP BY ft.tag_name").all(favoriteDir + "%"));
    return new Map(result.map(r => [r.tag_name, r.cnt]));
  }

  private _pruneOrphans(): void {
    this.db.prepare("DELETE FROM tags WHERE tag_name NOT IN (SELECT DISTINCT tag_name FROM file_tags)").run();
    this.db.prepare("DELETE FROM artists WHERE artist_name NOT IN (SELECT DISTINCT artist_name FROM file_artists)").run();
  }
}
