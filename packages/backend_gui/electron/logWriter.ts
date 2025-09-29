import fs from 'fs-extra';
import path from 'path';
import { app } from 'electron';

export type LogEntryLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  timestamp: string;
  level: LogEntryLevel;
  message: string;
  source: 'stdout' | 'stderr' | 'system';
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 10;

export class LogWriter {
  private currentDate = '';
  private stream: fs.WriteStream | null = null;

  async append(entry: LogEntry) {
    const date = entry.timestamp.slice(0, 10);
    if (date !== this.currentDate) {
      await this.rotate(date);
    } else if (this.stream && (await this.getSize(this.stream.path as string)) > MAX_FILE_SIZE) {
      await this.rotate(date, true);
    }

    if (!this.stream) {
      await this.rotate(date);
    }

    this.stream!.write(`${entry.timestamp} [${entry.level.toUpperCase()}] (${entry.source}) ${entry.message}\n`);
  }

  async dispose() {
    await this.closeStream();
  }

  private async rotate(date: string, increment = false) {
    await this.closeStream();
    this.currentDate = date;
    const logDir = path.join(app.getPath('userData'), 'logs');
    await fs.mkdirp(logDir);
    const baseName = `${date}.log`;

    let filePath = path.join(logDir, baseName);
    if (increment) {
      let idx = 1;
      while (await fs.pathExists(filePath) && (await this.getSize(filePath)) > MAX_FILE_SIZE) {
        idx += 1;
        filePath = path.join(logDir, `${date}-${idx}.log`);
      }
    }

    this.stream = fs.createWriteStream(filePath, { flags: 'a' });
    await this.enforceRetention(logDir);
  }

  private async enforceRetention(dir: string) {
    const files = (await fs.readdir(dir))
      .filter((f) => f.endsWith('.log'))
      .map((f) => ({
        file: f,
        fullPath: path.join(dir, f)
      }));

    files.sort((a, b) => (a.file > b.file ? -1 : 1));
    while (files.length > MAX_FILES) {
      const removed = files.pop();
      if (removed) {
        await fs.remove(removed.fullPath);
      }
    }
  }

  private async closeStream() {
    if (this.stream) {
      await new Promise((resolve) => {
        this.stream!.once('finish', resolve);
        this.stream!.end();
      });
      this.stream = null;
    }
  }

  private async getSize(filePath: string) {
    try {
      const stat = await fs.stat(filePath);
      return stat.size;
    } catch {
      return 0;
    }
  }
}
