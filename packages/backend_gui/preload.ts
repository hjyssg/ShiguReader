import { contextBridge, ipcRenderer } from 'electron';
import type { BackendConfig } from './electron/config';
import type { ServiceStatus } from './electron/serviceManager';
import type { LogEntry } from './electron/logWriter';

type HealthState = 'unknown' | 'healthy' | 'unhealthy';

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

const listeners: Array<() => void> = [];

contextBridge.exposeInMainWorld('backend', {
  async getConfig() {
    return ipcRenderer.invoke('config:get');
  },
  async setConfig(config: BackendConfig) {
    return ipcRenderer.invoke('config:set', config);
  },
  async restoreDefaults() {
    return ipcRenderer.invoke('config:restore');
  },
  async startService() {
    return ipcRenderer.invoke('service:start');
  },
  async stopService() {
    return ipcRenderer.invoke('service:stop');
  },
  async getStatus() {
    return ipcRenderer.invoke('service:status');
  },
  async getPortSuggestions() {
    return ipcRenderer.invoke('service:auto-port');
  },
  onLog(callback: (entry: LogEntry) => void) {
    ipcRenderer.send('logs:subscribe');
    ipcRenderer.on('logs:push', (_event, entry: LogEntry) => callback(entry));
    const remove = () => ipcRenderer.removeAllListeners('logs:push');
    listeners.push(remove);
    return remove;
  },
  onStatus(callback: (status: ServiceStatus) => void) {
    ipcRenderer.on('service:status-updated', (_event, status: ServiceStatus) => callback(status));
    const remove = () => ipcRenderer.removeAllListeners('service:status-updated');
    listeners.push(remove);
    return remove;
  },
  onError(callback: (error: any) => void) {
    ipcRenderer.on('service:error', (_event, error: any) => callback(error));
    const remove = () => ipcRenderer.removeAllListeners('service:error');
    listeners.push(remove);
    return remove;
  },
  onHealth(callback: (state: HealthState) => void) {
    ipcRenderer.on('service:health', (_event, state: HealthState) => callback(state));
    const remove = () => ipcRenderer.removeAllListeners('service:health');
    listeners.push(remove);
    return remove;
  },
  onPortConflict(callback: (payload: { port: number; suggestions?: number[] }) => void) {
    ipcRenderer.on('service:port-conflict', (_event, payload) => callback(payload));
    const remove = () => ipcRenderer.removeAllListeners('service:port-conflict');
    listeners.push(remove);
    return remove;
  }
});

globalThis.addEventListener('unload', () => {
  for (const remove of listeners) {
    remove();
  }
  listeners.length = 0;
});
