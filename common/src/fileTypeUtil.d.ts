export declare const IMAGE_SUFFIXES: string[]
export declare const VIDEO_SUFFIXES: string[]
export declare const ARCHIVE_SUFFIXES: string[]
export declare const AUDIO_SUFFIXES: string[]

export type FileType = "image" | "video" | "archive" | "audio" | "folder" | "unknown"

export declare function getFileType(filepath: string): FileType
export declare const isImage: (p: string) => boolean
export declare const isVideo: (p: string) => boolean
export declare const isArchive: (p: string) => boolean
export declare const isAudio: (p: string) => boolean
export declare const isFolder: (p: string) => boolean

/**
 * 按文件名排序的比较函数 — 使用 numeric localeCompare，使 "2.jpg" 排在 "10.jpg" 前面
 * 前后端共用，替代裸 localeCompare(b.name)
 */
export declare function sortFileByName(a: { name: string }, b: { name: string }): number
