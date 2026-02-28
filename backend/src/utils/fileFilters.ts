import path from "node:path";

/** 是否隐藏文件：basename 以 "." 开头（如 ._2.jpg / .DS_Store） */
export function isHiddenFile(filePath: string): boolean {
  const base = path.basename(filePath);
  return Boolean(base) && base.startsWith(".");
}
