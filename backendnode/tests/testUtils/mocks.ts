import { vi } from "vitest";

export const baseTestConfig = {
  config: {
    API_V1_STR: "/api/v1",
    ENVIRONMENT: "local",
    INDEX_SQLITE_PATH: "./data/index.db",
    FS_ROOTS: "",
    FAVORITE_DIR: "",
    ALREADY_READ_DIR: "",
    THUMB_CONCURRENCY: 3,
    EXTRACT_CONCURRENCY: 2,
    THUMB_TIMEOUT_SEC: 10,
    THUMB_HEIGHT: 350,
    THUMB_JPEG_QUALITY: 70,
    THUMB_CACHE_DIR: "../data/thumb_cache",
    EXTRACT_CACHE_DIR: "../data/extract_cache",
  },
  ENV_FILE_PATH: "/fake/.env",
  DB_FILE_PATH: "/fake/db.sqlite",
} as const;

type MockFn = ReturnType<typeof vi.fn>;

export interface RouteMockRepo {
  [key: string]: MockFn;
}

export function createRouteMockRepo(overrides: Record<string, MockFn> = {}): RouteMockRepo {
  return {
    searchFiles: vi.fn(() => []),
    searchByAuthor: vi.fn(() => []),
    searchByCoser: vi.fn(() => []),
    searchByTag: vi.fn(() => []),
    quickMatchCandidates: vi.fn(() => []),

    getParsedMetadata: vi.fn(() => undefined),
    getFileArtists: vi.fn(() => []),
    getFileCosers: vi.fn(() => []),
    getFileTags: vi.fn(() => []),

    countReadHistory: vi.fn(() => 0),
    listReadHistory: vi.fn(() => []),
    recordRead: vi.fn(),

    getFileDataByFolder: vi.fn(() => new Map()),
    getArchiveMetasByFolder: vi.fn(() => new Map()),
    upsertFolder: vi.fn(),
    upsertFile: vi.fn(),
    recordFolderOpen: vi.fn(),
    markMissingInFolder: vi.fn(),
    countFilesByType: vi.fn(() => 0),
    countFolders: vi.fn(() => 0),
    getLibraryOverview: vi.fn(() => ({ archives: 0, videos: 0, images: 0, audio: 0, folders: 0 })),
    listActivityLogs: vi.fn(() => []),
    listActivityLogsSinceLatestStartup: vi.fn(() => []),
    listTopOpenedFolderIds: vi.fn(() => []),
    logActivity: vi.fn(),
    findFilesByFilename: vi.fn(() => []),

    ...overrides,
  };
}
