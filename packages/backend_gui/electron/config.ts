import path from 'path';
import fs from 'fs-extra';
import { app } from 'electron';
import dotenv from 'dotenv';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface BackendConfig {
  port: number;
  logLevel: LogLevel;
  autoRestart: boolean;
}

const DEFAULT_CONFIG: BackendConfig = {
  port: 3000,
  logLevel: 'info',
  autoRestart: true
};

const CONFIG_FILE = 'config.json';

export async function loadConfig(): Promise<BackendConfig> {
  const dir = app.getPath('userData');
  const filePath = path.join(dir, CONFIG_FILE);

  if (!(await fs.pathExists(dir))) {
    await fs.mkdirp(dir);
  }

  if (await fs.pathExists(filePath)) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      return normalizeConfig(parsed);
    } catch (err) {
      console.warn('[config] Failed to read persisted config, falling back to defaults', err);
    }
  }

  const envPath = path.join(process.cwd(), '..', 'backend', '.env');
  let envDefaults: Partial<BackendConfig> = {};
  if (await fs.pathExists(envPath)) {
    const env = dotenv.parse(await fs.readFile(envPath));
    envDefaults = {
      port: env.PORT ? Number(env.PORT) : undefined,
      logLevel: env.LOG_LEVEL as LogLevel | undefined
    } as Partial<BackendConfig>;
  }

  return { ...DEFAULT_CONFIG, ...cleanUndefined(envDefaults) };
}

export async function saveConfig(cfg: BackendConfig): Promise<void> {
  const dir = app.getPath('userData');
  await fs.mkdirp(dir);
  const data = JSON.stringify(normalizeConfig(cfg), null, 2);
  await fs.writeFile(path.join(dir, CONFIG_FILE), data, 'utf-8');
}

export function restoreDefaults(): BackendConfig {
  return { ...DEFAULT_CONFIG };
}

function cleanUndefined<T extends Record<string, any>>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  );
}

function normalizeConfig(raw: any): BackendConfig {
  const normalized: BackendConfig = {
    port: Number(raw.port) || DEFAULT_CONFIG.port,
    logLevel: ['info', 'warn', 'error', 'debug'].includes(raw.logLevel)
      ? raw.logLevel
      : DEFAULT_CONFIG.logLevel,
    autoRestart: typeof raw.autoRestart === 'boolean' ? raw.autoRestart : DEFAULT_CONFIG.autoRestart
  };
  return normalized;
}
