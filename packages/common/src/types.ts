export interface FileInfo {
    size: number;
    mtimeMs: number;
    thumbnailFilePath: string;
    pageNum?: number;
    musicNum?: number;
    videoNum?: number;
    totalNum?: number;
    totalImgSize?: number;
    pageAvgSize?: number;
}

export interface ImgFolderInfo {
    mtimeMs: number;
    size: number;
    totalImgSize: number;
    pageNum: number;
    musicNum: number;
    videoNum: number;
    thumbnail: string;
}

export interface FileHistory {
    fileName: string;
    time: number;
    count: number;
}

export interface NameParseResult {
    title?: string;
    author?: string;
    tags?: string[];
    event?: string;
    dateTag?: string;
    [key: string]: any;
}

export interface KeyVal {
    key: string;
    value: any;
}

export interface ListDirResponse {
    failed?: boolean;
    reason?: string;
    path: string;
    dirs: string[];
    fileInfos: Record<string, FileInfo>;
    imgFolderInfo: Record<string, ImgFolderInfo>;
    fileHistory: FileHistory[];
    nameParseCache: Record<string, NameParseResult>;
    mode?: string;
    tag?: string;
    author?: string;
}

export interface SearchFileResponse {
    failed?: boolean;
    reason?: string;
    tag?: string;
    author?: string;
    dirs: string[];
    fileInfos: Record<string, FileInfo>;
    imgFolderInfo: Record<string, ImgFolderInfo>;
    fileHistory: FileHistory[];
    nameParseCache: Record<string, NameParseResult>;
}

export interface BaseResponse {
    failed: boolean;
    reason?: string;
}

export interface ThumbnailResponse extends BaseResponse {
    url?: string;
    useVideoPreviewForFolder?: boolean;
    dirThumbnails?: Record<string, string>;
    debug?: string;
}

export interface HistoryRecord {
    filePath: string;
    dirPath: string;
    fileName: string;
    time: number;
}

export interface HistoryResponse extends BaseResponse {
    rows: HistoryRecord[];
    count: number;
}

export interface TagInfo {
    tag: string;
    type: 'tag' | 'author' | 'group';
    subtype: 'comiket' | 'name' | 'parody' | 'author' | 'group';
    maxTime: number;
    count: number;
    thumbnailFileName?: string;
    thumbnail?: string;
    rank?: number;
}

export interface TagResponse extends BaseResponse {
    tag_rows: TagInfo[];
}

export interface AuthorResponse extends BaseResponse {
    author_rows: TagInfo[];
}

export interface GoodAuthorNamesResponse extends BaseResponse {
    authorInfo: any[]; // These are from tag_table, might need more specific types later
    tagInfo: any[];
}

export interface ApiResponse<T> {
    status: number;
    json: T & BaseResponse;
    isFailed(): boolean;
}

export interface BookOverviewResponse extends BaseResponse {
    zipInfo?: any;
    path?: string;
    stat?: any;
    imageFiles: string[];
    musicFiles: string[];
    readmeFile?: string;
}
