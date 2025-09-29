import type { BackendConfig, HealthState, LogEntry, ServiceStatus } from './types';

declare global {
  interface Window {
    backend: {
      getConfig(): Promise<BackendConfig>;
      setConfig(config: BackendConfig): Promise<BackendConfig>;
      restoreDefaults(): Promise<BackendConfig>;
      startService(): Promise<ServiceStatus>;
      stopService(): Promise<ServiceStatus>;
      getStatus(): Promise<ServiceStatus>;
      getPortSuggestions(): Promise<number[]>;
      onLog(callback: (entry: LogEntry) => void): () => void;
      onStatus(callback: (status: ServiceStatus) => void): () => void;
      onError(callback: (error: any) => void): () => void;
      onHealth(callback: (state: HealthState) => void): () => void;
      onPortConflict(callback: (payload: { port: number; suggestions?: number[] }) => void): () => void;
    };
  }
}

export {};
