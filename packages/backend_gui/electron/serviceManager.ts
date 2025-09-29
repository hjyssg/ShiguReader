import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import path from 'path';
import EventEmitter from 'eventemitter3';
import treeKill from 'tree-kill';
import { BackendConfig } from './config';
import { LogEntry, LogWriter } from './logWriter';

export type ServiceState = 'stopped' | 'starting' | 'running' | 'stopping';

export interface ServiceStatus {
  state: ServiceState;
  pid: number | null;
  port: number;
  startedAt: number | null;
  restartCount: number;
  exitCode?: number | null;
  exitSignal?: NodeJS.Signals | null;
}

export interface ServiceError {
  title: string;
  message: string;
  suggestion?: string;
}

export interface LogSubscribers {
  send(log: LogEntry): void;
}

interface StartOptions {
  config: BackendConfig;
}

export declare interface ServiceManager {
  on(event: 'status', listener: (status: ServiceStatus) => void): this;
  on(event: 'log', listener: (entry: LogEntry) => void): this;
  on(event: 'error', listener: (error: ServiceError) => void): this;
}

export class ServiceManager extends EventEmitter {
  private child: ChildProcessWithoutNullStreams | null = null;
  private status: ServiceStatus = {
    state: 'stopped',
    pid: null,
    port: 3000,
    startedAt: null,
    restartCount: 0
  };
  private restartAttempts = 0;
  private readonly logWriter = new LogWriter();
  private restartTimer: NodeJS.Timeout | null = null;

  constructor(private readonly backendRoot: string) {
    super();
  }

  getStatus() {
    return this.status;
  }

  async start(opts: StartOptions) {
    if (this.child || this.status.state === 'starting') {
      return;
    }
    const { config } = opts;

    this.updateStatus({ state: 'starting', port: config.port, restartCount: this.restartAttempts });

    const backendEntry = path.join(this.backendRoot, 'src', 'app.js');
    const child = spawn(process.execPath, [backendEntry], {
      cwd: this.backendRoot,
      env: {
        ...process.env,
        PORT: String(config.port),
        LOG_LEVEL: config.logLevel,
        AUTO_RESTART: String(config.autoRestart)
      }
    });
    this.child = child;

    const onLog = (buffer: Buffer, source: 'stdout' | 'stderr') => {
      const lines = buffer.toString().split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        const entry: LogEntry = parseLogLine(line, source);
        this.emit('log', entry);
        void this.logWriter.append(entry);
      }
    };

    child.stdout.on('data', (buf) => onLog(buf, 'stdout'));
    child.stderr.on('data', (buf) => onLog(buf, 'stderr'));

    child.on('spawn', () => {
      this.updateStatus({
        state: 'running',
        pid: child.pid ?? null,
        startedAt: Date.now(),
        port: config.port,
        exitCode: null,
        exitSignal: null
      });
    });

    child.on('error', (error) => {
      const message = error.message;
      let suggestion = '请确认已经正确安装 Node.js 并且具有访问 backend 的权限。';
      if (message.includes('ENOENT')) {
        suggestion = '请检查 Node.js 是否安装，或路径是否正确。';
      }
      this.emit('error', { title: '启动失败', message, suggestion });
      this.updateStatus({ state: 'stopped', pid: null, startedAt: null });
      this.child = null;
    });

    child.on('exit', (code, signal) => {
      const wasRunning = this.status.state === 'running';
      this.child = null;
      this.updateStatus({
        state: 'stopped',
        pid: null,
        startedAt: null,
        exitCode: code,
        exitSignal: signal ?? null
      });

      const autoRestart = opts.config.autoRestart;
      if (wasRunning && autoRestart && this.restartAttempts < 3) {
        this.restartAttempts += 1;
        const entry: LogEntry = {
          level: 'warn',
          message: `服务异常退出 (code: ${code ?? 'null'}, signal: ${signal ?? 'null'})，将在 3 秒后尝试第 ${this.restartAttempts} 次重启。`,
          source: 'system',
          timestamp: new Date().toISOString()
        };
        this.emit('log', entry);
        void this.logWriter.append(entry);
        this.restartTimer = setTimeout(() => {
          this.start(opts).catch((err) => {
            this.emit('error', {
              title: '自动重启失败',
              message: err.message,
              suggestion: '请手动重新启动服务。'
            });
          });
        }, 3000);
      } else if (wasRunning && !autoRestart) {
        const entry: LogEntry = {
          level: 'info',
          message: '服务已停止。',
          source: 'system',
          timestamp: new Date().toISOString()
        };
        this.emit('log', entry);
        void this.logWriter.append(entry);
      }
    });
  }

  async stop() {
    if (!this.child) {
      return;
    }
    this.restartAttempts = 0;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    const child = this.child;
    this.updateStatus({ state: 'stopping' });

    const killTimeout = setTimeout(() => {
      if (child.pid) {
        treeKill(child.pid, 'SIGKILL');
      }
    }, 5000);

    await new Promise<void>((resolve) => {
      child.once('exit', () => {
        clearTimeout(killTimeout);
        resolve();
      });
      child.kill('SIGINT');
    });
  }

  override removeAllListeners(): this {
    this.logWriter.dispose().catch(() => undefined);
    return super.removeAllListeners();
  }

  private updateStatus(partial: Partial<ServiceStatus>) {
    this.status = { ...this.status, ...partial };
    this.emit('status', this.status);
  }
}

function parseLogLine(line: string, source: 'stdout' | 'stderr'): LogEntry {
  const level = detectLevel(line, source);
  return {
    level,
    message: line,
    source,
    timestamp: new Date().toISOString()
  };
}

function detectLevel(message: string, source: 'stdout' | 'stderr'): LogEntry['level'] {
  if (source === 'stderr') return 'error';
  const lowered = message.toLowerCase();
  if (lowered.includes('error')) return 'error';
  if (lowered.includes('warn')) return 'warn';
  if (lowered.includes('debug')) return 'debug';
  return 'info';
}
