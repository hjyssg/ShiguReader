/**
 * Read 模块共享类型定义
 */

/** 图片条目 — 来自 useArchiveExtract */
export interface ImageEntry {
  name: string
  filePath?: string
  entryPath?: string
}

/** 音频轨道 — 来自 useArchiveExtract */
export interface AudioTrack {
  name: string
  url: string
  sourcePath: string
}

/** Read 页面的 mode 类型 */
export type ReadMode = "gallery" | "audio" | "waterfall"
