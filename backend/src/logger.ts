/**
 * 极简日志工具 — 只打印关键事件，带时间戳
 */

function ts(): string {
  const d = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

export const logger = {
  /** 启动相关 */
  startup: (msg: string) => console.log(`${ts()} [STARTUP]  ${msg}`),
  /** DB 初始化相关 */
  db: (msg: string) => console.log(`${ts()} [DB]       ${msg}`),
  /** 扫描进度 */
  scan: (msg: string) => console.log(`${ts()} [SCAN]     ${msg}`),
  /** backfill 进度 */
  backfill: (msg: string) => console.log(`${ts()} [BACKFILL] ${msg}`),
  /** 文件操作：move / rename / delete */
  fs: (msg: string) => console.log(`${ts()} [FS]       ${msg}`),
  /** 压缩任务 */
  compress: (msg: string) => console.log(`${ts()} [COMPRESS] ${msg}`),
  /** 解压缓存 */
  extract: (msg: string) => console.log(`${ts()} [EXTRACT]  ${msg}`),
  /** 警告 */
  warn: (msg: string) => console.warn(`${ts()} [WARN]     ${msg}`),
};
