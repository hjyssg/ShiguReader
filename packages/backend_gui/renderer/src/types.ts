export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface BackendConfig {
  port: number;
  logLevel: LogLevel;
  autoRestart: boolean;
}

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

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  source: 'stdout' | 'stderr' | 'system';
}

export type HealthState = 'unknown' | 'healthy' | 'unhealthy';
