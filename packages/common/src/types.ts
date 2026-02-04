
export interface FileInfo {
    size: number;
    mtimeMs: number;
    thumbnailFilePath?: string;
    pageNum?: number;
    musicNum?: number;
    videoNum?: number;
    totalNum?: number;
    totalImgSize?: number;
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
