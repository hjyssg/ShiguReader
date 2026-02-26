/** good_YYYY_MM_01 — 当月第一天格式的子文件夹名 */
export function monthlySubfolder(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  return `good_${y}_${m}_01`
}
