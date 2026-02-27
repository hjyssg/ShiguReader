import { Type, type TSchema } from "@sinclair/typebox";

// ── 基础可复用类型 ─────────────────────────────────────────────────────────────

export const Nullable = <T extends TSchema>(t: T) =>
  Type.Union([t, Type.Null()]);

// ── 文件系统 ───────────────────────────────────────────────────────────────────

export const FileSystemItem = Type.Object(
  {
    name: Type.String(),
    path: Type.String(),
    item_type: Type.Union([Type.Literal("folder"), Type.Literal("file")]),
    file_type: Type.Optional(
      Nullable(Type.Union([Type.Literal("image"), Type.Literal("video"), Type.Literal("archive"), Type.Literal("audio"), Type.Literal("unknown")])),
    ),
    filesize: Type.Optional(Nullable(Type.Integer())),
    mtime: Type.Optional(Nullable(Type.Integer())),
    thumbnail_url: Type.Optional(Nullable(Type.String())),
    likeScore: Type.Optional(Type.Number({ default: 0 })),
    is_missing: Type.Optional(Type.Integer({ default: 0 })),
    image_count: Type.Optional(Nullable(Type.Integer())),
    video_count: Type.Optional(Nullable(Type.Integer())),
    audio_count: Type.Optional(Nullable(Type.Integer())),
    avg_image_size: Type.Optional(Nullable(Type.Integer())),
    last_read_at: Type.Optional(Nullable(Type.Integer())),
  },
  { $id: "FileSystemItem", title: "FileSystemItem" },
);

export const ListResponse = Type.Object(
  { items: Type.Array(Type.Ref(FileSystemItem)) },
  { $id: "ListResponse", title: "ListResponse" },
);

export const RootItem = Type.Object(
  {
    path: Type.String(),
    dirname: Type.String(),
  },
  { $id: "RootItem", title: "RootItem" },
);

export const PathOperationResponse = Type.Object(
  {
    status: Type.Literal("ok"),
    message: Type.String(),
    path: Type.String(),
    dest_path: Type.Optional(Nullable(Type.String())),
  },
  { $id: "PathOperationResponse", title: "PathOperationResponse" },
);

// ── 历史 ───────────────────────────────────────────────────────────────────────

export const HistoryItem = Type.Object(
  {
    id: Type.Optional(Type.Integer()),
    filepath: Type.String(),
    filename: Type.Optional(Nullable(Type.String())),
    file_type: Type.Optional(Nullable(Type.String())),
    thumbnail_url: Type.Optional(Nullable(Type.String())),
    opened_at: Type.Integer(),
  },
  { $id: "HistoryItem", title: "HistoryItem" },
);

export const HistoryListResponse = Type.Object(
  {
    items: Type.Array(Type.Ref(HistoryItem)),
    page: Type.Integer(),
    page_size: Type.Integer(),
    total: Type.Integer(),
    total_pages: Type.Integer(),
  },
  { $id: "HistoryListResponse", title: "HistoryListResponse" },
);

export const HistoryRecordRequest = Type.Object(
  { filepath: Type.String() },
  { $id: "HistoryRecordRequest", title: "HistoryRecordRequest" },
);

export const HistoryRecordResponse = Type.Object(
  {
    status: Type.Union([Type.Literal("ok"), Type.Literal("skipped")]),
    reason: Type.Optional(Nullable(Type.String())),
  },
  { $id: "HistoryRecordResponse", title: "HistoryRecordResponse" },
);

// ── 搜索 ───────────────────────────────────────────────────────────────────────

export const SearchRequest = Type.Object(
  {
    q: Type.Optional(Type.String({ default: "" })),
    scopes: Type.Optional(
      Type.Array(Type.Union([Type.Literal("file"), Type.Literal("author"), Type.Literal("coser"), Type.Literal("tag")])),
    ),
    mode: Type.Optional(
      Type.Union([Type.Literal("exact"), Type.Literal("fuzzy"), Type.Literal("local-check")], { default: "fuzzy" }),
    ),
    presence_filter: Type.Optional(
      Type.Union([Type.Literal("all"), Type.Literal("watched"), Type.Literal("scanned_recent")], { default: "all" }),
    ),
    limit: Type.Optional(Type.Integer({ default: 200 })),
    offset: Type.Optional(Type.Integer({ default: 0 })),
  },
  { $id: "SearchRequest", title: "SearchRequest" },
);

export const SearchResponse = Type.Object(
  {
    items: Type.Array(Type.Ref(FileSystemItem)),
    total: Type.Integer(),
  },
  { $id: "SearchResponse", title: "SearchResponse" },
);

export const LocalCheckHit = Type.Object(
  {
    name: Type.String(),
    path: Type.String(),
    thumbnail_url: Nullable(Type.String()),
    match_level: Type.Union([
      Type.Literal("downloaded"),
      Type.Literal("likely"),
      Type.Literal("same_author"),
      Type.Literal("different"),
    ]),
    confidence: Type.Number(),
  },
  { $id: "LocalCheckHit", title: "LocalCheckHit" },
);

export const LocalCheckResult = Type.Object(
  {
    q: Type.String(),
    match_level: Type.Union([
      Type.Literal("downloaded"),
      Type.Literal("likely"),
      Type.Literal("same_author"),
      Type.Literal("different"),
    ]),
    confidence: Type.Number(),
    reason: Type.String(),
    hits: Type.Array(Type.Ref(LocalCheckHit)),
  },
  { $id: "LocalCheckResult", title: "LocalCheckResult" },
);

export const LocalCheckBatchRequest = Type.Object(
  {
    queries: Type.Optional(Type.Array(Type.String())),
    limit: Type.Optional(Type.Integer({ default: 5 })),
    presence_filter: Type.Optional(
      Type.Union([Type.Literal("all"), Type.Literal("watched"), Type.Literal("scanned_recent")], { default: "all" }),
    ),
  },
  { $id: "LocalCheckBatchRequest", title: "LocalCheckBatchRequest" },
);

export const LocalCheckBatchResponse = Type.Object(
  { results: Type.Array(Type.Ref(LocalCheckResult)) },
  { $id: "LocalCheckBatchResponse", title: "LocalCheckBatchResponse" },
);

// ── 设置 ───────────────────────────────────────────────────────────────────────

export const SettingsResponse = Type.Object(
  {
    favorite_dir: Type.String(),
    fs_roots: Type.String(),
    already_read_dir: Type.String(),
    move_place_dir: Type.String(),
    env_file_path: Type.String(),
    db_file_path: Type.String(),
  },
  { $id: "SettingsResponse", title: "SettingsResponse" },
);

export const SettingsUpdate = Type.Object(
  {
    favorite_dir: Type.Optional(Nullable(Type.String())),
    fs_roots: Type.Optional(Nullable(Type.String())),
    already_read_dir: Type.Optional(Nullable(Type.String())),
    move_place_dir: Type.Optional(Nullable(Type.String())),
  },
  { $id: "SettingsUpdate", title: "SettingsUpdate" },
);

// ── 解析 ───────────────────────────────────────────────────────────────────────

export const ParseResponse = Type.Object(
  {
    title: Type.String(),
    authors: Type.Array(Type.String()),
    cosers: Type.Optional(Type.Array(Type.String())),
    group: Type.Optional(Nullable(Type.String())),
    raw_tags: Type.Array(Type.String()),
    event: Type.Optional(Nullable(Type.String())),
    date_tag: Type.Optional(Nullable(Type.String())),
    type: Type.String(),
    pack_kind: Type.Optional(Type.String({ default: "manga" })),
  },
  { $id: "ParseResponse", title: "ParseResponse" },
);

export const StoredParseResponse = Type.Object(
  {
    filepath: Type.String(),
    title: Type.Optional(Nullable(Type.String())),
    authors: Type.Optional(Type.Array(Type.String())),
    cosers: Type.Optional(Type.Array(Type.String())),
    group_name: Type.Optional(Nullable(Type.String())),
    raw_tags: Type.Optional(Type.Array(Type.String())),
    event: Type.Optional(Nullable(Type.String())),
    date_tag: Type.Optional(Nullable(Type.String())),
    media_type: Type.Optional(Nullable(Type.String())),
  },
  { $id: "StoredParseResponse", title: "StoredParseResponse" },
);

export const BatchParseItem = Type.Object(
  {
    filepath: Type.String(),
    result: Type.Optional(Nullable(Type.Ref(ParseResponse))),
  },
  { $id: "BatchParseItem", title: "BatchParseItem" },
);

export const BatchParseRequest = Type.Object(
  { filepaths: Type.Array(Type.String()) },
  { $id: "BatchParseRequest", title: "BatchParseRequest" },
);

export const BatchParseResponse = Type.Object(
  {
    items: Type.Array(Type.Ref(BatchParseItem)),
    parsed_count: Type.Integer(),
    total_count: Type.Integer(),
  },
  { $id: "BatchParseResponse", title: "BatchParseResponse" },
);

// ── 压缩包 ─────────────────────────────────────────────────────────────────────

export const ArchiveEntry = Type.Object(
  {
    name: Type.String(),
    entry_path: Type.String(),
    file_type: Type.Union([
      Type.Literal("image"),
      Type.Literal("video"),
      Type.Literal("audio"),
      Type.Literal("unknown"),
    ]),
    index: Type.Integer(),
  },
  { $id: "ArchiveEntry", title: "ArchiveEntry" },
);

export const ArchiveListResponse = Type.Object(
  {
    entries: Type.Array(Type.Ref(ArchiveEntry)),
    total: Type.Integer(),
  },
  { $id: "ArchiveListResponse", title: "ArchiveListResponse" },
);

export const ExtractStatus = Type.Object(
  {
    status: Type.Union([Type.Literal("extracting"), Type.Literal("completed"), Type.Literal("error")]),
    extracted_count: Type.Integer(),
    total_count: Type.Integer(),
    cache_dir: Type.String(),
    entries: Type.Optional(Nullable(Type.Array(Type.Ref(ArchiveEntry)))),
    mtime: Type.Optional(Nullable(Type.Integer())),
    filesize: Type.Optional(Nullable(Type.Integer())),
  },
  { $id: "ExtractStatus", title: "ExtractStatus" },
);

export const CompressImagesRequest = Type.Object(
  {
    archive_path: Type.String(),
    output_mode: Type.Optional(Nullable(Type.Union([Type.Literal("new"), Type.Literal("replace")]))),
    max_height: Type.Optional(Nullable(Type.Integer({ default: 1600 }))),
    quality: Type.Optional(Nullable(Type.Integer({ default: 85 }))),
    min_size: Type.Optional(Nullable(Type.Integer())),
  },
  { $id: "CompressImagesRequest", title: "CompressImagesRequest" },
);

export const CompressImagesResponse = Type.Object(
  {
    success: Type.Boolean(),
    original_path: Type.String(),
    output_path: Type.String(),
    original_size: Type.Integer(),
    compressed_size: Type.Integer(),
    compression_ratio: Type.Number(),
    processed_images: Type.Integer(),
    skipped_images: Type.Integer(),
    validation_passed: Type.Boolean(),
    error_message: Type.Optional(Type.String({ default: "" })),
  },
  { $id: "CompressImagesResponse", title: "CompressImagesResponse" },
);

// ── 扫描 ───────────────────────────────────────────────────────────────────────

export const ScanRequest = Type.Object(
  {
    path: Type.String(),
    recursive: Type.Optional(Type.Boolean({ default: true })),
  },
  { $id: "ScanRequest", title: "ScanRequest" },
);

export const ScanStartResponse = Type.Object(
  {
    status: Type.Literal("started"),
    message: Type.String(),
    path: Type.String(),
  },
  { $id: "ScanStartResponse", title: "ScanStartResponse" },
);

export const ScanStatusItem = Type.Object(
  {
    path: Type.String(),
    status: Type.Union([Type.Literal("running"), Type.Literal("completed"), Type.Literal("error")]),
    message: Type.Optional(Nullable(Type.String())),
    recursive: Type.Optional(Type.Boolean({ default: true })),
    scanned_folders: Type.Optional(Type.Integer({ default: 0 })),
    scanned_files: Type.Optional(Type.Integer({ default: 0 })),
    parsed_files: Type.Optional(Type.Integer({ default: 0 })),
    watcher_active: Type.Optional(Type.Boolean({ default: false })),
    started_at: Type.Optional(Nullable(Type.Integer())),
    finished_at: Type.Optional(Nullable(Type.Integer())),
  },
  { $id: "ScanStatusItem", title: "ScanStatusItem" },
);

export const BackfillRequest = Type.Object(
  {
    path: Type.String(),
    recursive: Type.Optional(Type.Boolean({ default: true })),
    fill_thumbnail: Type.Optional(Type.Boolean({ default: true })),
    fill_meta: Type.Optional(Type.Boolean({ default: true })),
  },
  { $id: "BackfillRequest", title: "BackfillRequest" },
);

export const BackfillResponse = Type.Object(
  {
    status: Type.Literal("ok"),
    scanned_files: Type.Integer(),
    backfilled_thumbnails: Type.Integer(),
    backfilled_meta: Type.Integer(),
    message: Type.String(),
  },
  { $id: "BackfillResponse", title: "BackfillResponse" },
);

export const ClearCacheResponse = Type.Object(
  {
    status: Type.Literal("ok"),
    message: Type.String(),
    deleted_files: Type.Integer(),
    freed_bytes: Type.Integer(),
    freed_size_readable: Type.String(),
  },
  { $id: "ClearCacheResponse", title: "ClearCacheResponse" },
);

// ── 文件操作 ───────────────────────────────────────────────────────────────────

export const MovePathRequest = Type.Object(
  {
    source_path: Type.String(),
    dest_path: Type.String(),
  },
  { $id: "MovePathRequest", title: "MovePathRequest" },
);

export const DeletePathRequest = Type.Object(
  {
    path: Type.String(),
    permanently: Type.Optional(Type.Boolean({ default: false })),
  },
  { $id: "DeletePathRequest", title: "DeletePathRequest" },
);

export const ZipFolderRequest = Type.Object(
  {
    folder_path: Type.String(),
    output_path: Type.Optional(Nullable(Type.String())),
  },
  { $id: "ZipFolderRequest", title: "ZipFolderRequest" },
);

export const RenameRequest = Type.Object(
  {
    path: Type.String(),
    new_name: Type.String(),
  },
  { $id: "RenameRequest", title: "RenameRequest" },
);

export const UnzipRequest = Type.Object(
  {
    archive_path: Type.String(),
    output_dir: Type.Optional(Nullable(Type.String())),
  },
  { $id: "UnzipRequest", title: "UnzipRequest" },
);

export const MkdirRequest = Type.Object(
  { path: Type.String() },
  { $id: "MkdirRequest", title: "MkdirRequest" },
);

export const ResolvePathResponse = Type.Object(
  {
    path: Type.String(),
    exists: Type.Boolean(),
    is_dir: Type.Boolean(),
  },
  { $id: "ResolvePathResponse", title: "ResolvePathResponse" },
);

// ── 实体（tags / authors / cosers）─────────────────────────────────────────────

export const EntityListItem = (id: string) =>
  Type.Object(
    {
      name: Type.String(),
      thumbnail: Type.Optional(Nullable(Type.String())),
      file_count: Type.Integer(),
      recommendation_score: Type.Optional(Nullable(Type.Number())),
    },
    { $id: id, title: id },
  );

export const TagListItem = EntityListItem("TagListItem");
export const AuthorListItem = EntityListItem("AuthorListItem");
export const CoserListItem = EntityListItem("CoserListItem");

const EntityPageQuery = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  page_size: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 24 })),
  sort_by: Type.Optional(Type.Union([Type.Literal("count"), Type.Literal("name")], { default: "count" })),
  sort_order: Type.Optional(Type.Union([Type.Literal("asc"), Type.Literal("desc")], { default: "desc" })),
});

export const TagsQuery = Type.Object({ ...EntityPageQuery.properties }, { $id: "TagsQuery", title: "TagsQuery" });
export const AuthorsQuery = Type.Object({ ...EntityPageQuery.properties }, { $id: "AuthorsQuery", title: "AuthorsQuery" });
export const CosersQuery = Type.Object({ ...EntityPageQuery.properties }, { $id: "CosersQuery", title: "CosersQuery" });

const EntityPageResponse = (itemRef: ReturnType<typeof Type.Ref>, id: string) =>
  Type.Object(
    {
      items: Type.Array(itemRef),
      page: Type.Integer(),
      page_size: Type.Integer(),
      total: Type.Integer(),
    },
    { $id: id, title: id },
  );

export const TagsResponse = EntityPageResponse(Type.Ref(TagListItem), "TagsResponse");
export const AuthorsResponse = EntityPageResponse(Type.Ref(AuthorListItem), "AuthorsResponse");
export const CosersResponse = EntityPageResponse(Type.Ref(CoserListItem), "CosersResponse");

// ── Querystring schemas ────────────────────────────────────────────────────────

export const ListDirQuery = Type.Object({
  path: Type.String(),
  sort_by: Type.Optional(Type.String()),
  sort_order: Type.Optional(Type.Union([Type.Literal("asc"), Type.Literal("desc")])),
  has_video: Type.Optional(Type.String()),
  has_audio: Type.Optional(Type.String()),
});

export const RecentActivityQuery = Type.Object({
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500, default: 200 })),
  since_latest_startup: Type.Optional(Type.String()),
});

export const TopFoldersQuery = Type.Object({
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 20, default: 5 })),
});

export const ScanStatusQuery = Type.Object({
  path: Type.Optional(Type.String()),
});

export const PathQuery = Type.Object({ path: Type.String() });

export const ArchiveFileQuery = Type.Object({
  path: Type.String(),
  entry: Type.String(),
});

export const ExtractQuery = Type.Object({
  path: Type.String(),
  page: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
});

export const EntityPageQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  page_size: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 24 })),
  sort_by: Type.Optional(Type.String()),
  sort_order: Type.Optional(Type.Union([Type.Literal("asc"), Type.Literal("desc")])),
});

export const ThumbnailQuerySchema = Type.Object({
  type: Type.Optional(Type.Union([Type.Literal("tag"), Type.Literal("author"), Type.Literal("coser")])),
  name: Type.Optional(Type.String()),
});

// ── 文件系统附加响应 ────────────────────────────────────────────────────────────

export const LibraryOverviewResponse = Type.Object(
  {
    archives: Type.Integer(),
    videos: Type.Integer(),
    images: Type.Integer(),
    audio: Type.Integer(),
    folders: Type.Integer(),
  },
  { $id: "LibraryOverviewResponse", title: "LibraryOverviewResponse" },
);

export const ActivityItem = Type.Object(
  {
    id: Type.Optional(Nullable(Type.Integer())),
    activity_type: Type.String(),
    status: Type.String(),
    task_key: Type.Optional(Nullable(Type.String())),
    message: Type.Optional(Nullable(Type.String())),
    target_path: Type.Optional(Nullable(Type.String())),
    context: Type.Optional(Nullable(Type.Unknown())),
    created_at: Type.Integer(),
  },
  { $id: "ActivityItem", title: "ActivityItem" },
);

export const RecentActivityResponse = Type.Object(
  { items: Type.Array(Type.Ref(ActivityItem)) },
  { $id: "RecentActivityResponse", title: "RecentActivityResponse" },
);

export const TopFoldersResponse = Type.Object(
  { folder_ids: Type.Array(Type.Integer()) },
  { $id: "TopFoldersResponse", title: "TopFoldersResponse" },
);

export const MkdirResponse = Type.Object(
  { status: Type.Literal("ok") },
  { $id: "MkdirResponse", title: "MkdirResponse" },
);

// ── 所有 schema 列表（用于 app.addSchema 批量注册）─────────────────────────────

export const ALL_SCHEMAS = [
  FileSystemItem,
  ListResponse,
  RootItem,
  PathOperationResponse,
  HistoryItem,
  HistoryListResponse,
  HistoryRecordRequest,
  HistoryRecordResponse,
  SearchRequest,
  SearchResponse,
  LocalCheckHit,
  LocalCheckResult,
  LocalCheckBatchRequest,
  LocalCheckBatchResponse,
  SettingsResponse,
  SettingsUpdate,
  ParseResponse,
  StoredParseResponse,
  BatchParseItem,
  BatchParseRequest,
  BatchParseResponse,
  ArchiveEntry,
  ArchiveListResponse,
  ExtractStatus,
  CompressImagesRequest,
  CompressImagesResponse,
  ScanRequest,
  ScanStartResponse,
  ScanStatusItem,
  BackfillRequest,
  BackfillResponse,
  ClearCacheResponse,
  MovePathRequest,
  DeletePathRequest,
  ZipFolderRequest,
  RenameRequest,
  UnzipRequest,
  MkdirRequest,
  ResolvePathResponse,
  TagListItem,
  AuthorListItem,
  CoserListItem,
  TagsQuery,
  AuthorsQuery,
  CosersQuery,
  TagsResponse,
  AuthorsResponse,
  CosersResponse,
  LibraryOverviewResponse,
  ActivityItem,
  RecentActivityResponse,
  TopFoldersResponse,
  MkdirResponse,
];
