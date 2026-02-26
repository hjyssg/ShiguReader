import { isFolder } from "@common/fileTypeUtil"

/** 是否在新标签页打开文件（archive/image/audio） */
export const OPEN_FILE_IN_NEW_TAB = true

/**
 * 根据文件路径返回链接 target 属性值
 * archive/image/audio 在新 tab 打开，其他（folder/video）当前 tab
 */
export function getLinkTarget(filepath: string | null | undefined): "_blank" | undefined {
  if (!OPEN_FILE_IN_NEW_TAB) return undefined
  if (!filepath) return undefined
  return !isFolder(filepath) ? "_blank" : undefined
}
