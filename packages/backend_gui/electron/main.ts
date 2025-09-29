import path from 'path';
import { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } from 'electron';
import { loadConfig, saveConfig, restoreDefaults, BackendConfig } from './config';
import { ServiceManager, ServiceStatus } from './serviceManager';
import { LogEntry } from './logWriter';
import fs from 'fs';
import net from 'net';

const isDev = process.env.NODE_ENV === 'development';
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const backendRoot = resolveBackendRoot();
const serviceManager = new ServiceManager(backendRoot);
let currentConfig: BackendConfig;
let healthState: 'unknown' | 'healthy' | 'unhealthy' = 'unknown';
let healthTimer: NodeJS.Timeout | null = null;

function resolveBackendRoot() {
  if (isDev) {
    return path.resolve(__dirname, '..', '..', 'backend');
  }
  return path.join(process.resourcesPath, 'backend');
}

async function createWindow() {
  currentConfig = await loadConfig();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'ShiguReader Backend 控制台',
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, '..', 'preload.js'),
      nodeIntegration: false
    }
  });

  if (isDev) {
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(__dirname, '..', 'renderer', 'index.html');
    await mainWindow.loadFile(indexPath);
  }

  buildTray();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  setupListeners();
  broadcastStatus(serviceManager.getStatus());
}

function setupListeners() {
  ipcMain.handle('config:get', async () => currentConfig);

  ipcMain.handle('config:set', async (_event, cfg: BackendConfig) => {
    currentConfig = cfg;
    await saveConfig(cfg);
    return currentConfig;
  });

  ipcMain.handle('config:restore', async () => {
    currentConfig = restoreDefaults();
    await saveConfig(currentConfig);
    return currentConfig;
  });

  ipcMain.handle('service:start', async (event, args?: { autoPort?: boolean }) => {
    const status = serviceManager.getStatus();
    if (status.state === 'running' || status.state === 'starting') {
      return status;
    }

    const portCheck = await ensurePortAvailable(currentConfig.port);
    if (!portCheck.available) {
      event.sender.send('service:port-conflict', portCheck);
      throw new Error(`端口 ${currentConfig.port} 已被占用。`);
    }

    await serviceManager.start({ config: currentConfig });
    startHealthChecks();
    return serviceManager.getStatus();
  });

  ipcMain.handle('service:stop', async () => {
    await serviceManager.stop();
    stopHealthChecks();
    return serviceManager.getStatus();
  });

  ipcMain.handle('service:status', async () => serviceManager.getStatus());

  ipcMain.handle('service:auto-port', async () => {
    const suggestions = await suggestPorts(currentConfig.port);
    return suggestions;
  });

  ipcMain.on('logs:subscribe', (event) => {
    const webContents = event.sender;
    const logListener = (entry: LogEntry) => {
      if (!webContents.isDestroyed()) {
        webContents.send('logs:push', entry);
      }
    };
    const statusListener = (status: ServiceStatus) => {
      if (!webContents.isDestroyed()) {
        webContents.send('service:status-updated', status);
      }
    };
    const errorListener = (error: any) => {
      if (!webContents.isDestroyed()) {
        webContents.send('service:error', error);
      }
    };

    serviceManager.on('log', logListener);
    serviceManager.on('status', statusListener);
    serviceManager.on('error', errorListener);

    webContents.once('destroyed', () => {
      serviceManager.off('log', logListener);
      serviceManager.off('status', statusListener);
      serviceManager.off('error', errorListener);
    });
  });

  serviceManager.on('status', (status) => {
    broadcastStatus(status);
  });

  serviceManager.on('error', (error) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('service:error', error);
    }
  });

  serviceManager.on('log', (entry) => {
    if (entry.message.includes('EADDRINUSE')) {
      mainWindow?.webContents.send('service:port-conflict', {
        port: currentConfig.port,
        available: false
      });
    }
  });
}

function startHealthChecks() {
  if (healthTimer) return;
  healthTimer = setInterval(async () => {
    const status = serviceManager.getStatus();
    if (status.state !== 'running' || !status.port) {
      setHealthState('unknown');
      return;
    }
    try {
      const response = await fetch(`http://127.0.0.1:${status.port}/health`, {
        method: 'GET',
        cache: 'no-store'
      });
      if (response.ok) {
        setHealthState('healthy');
      } else {
        setHealthState('unhealthy');
      }
    } catch (err) {
      setHealthState('unhealthy');
    }
  }, 5000);
}

function stopHealthChecks() {
  if (healthTimer) {
    clearInterval(healthTimer);
    healthTimer = null;
  }
  setHealthState('unknown');
}

function setHealthState(state: typeof healthState) {
  healthState = state;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('service:health', state);
  }
  updateTray(state);
}

function broadcastStatus(status: ServiceStatus) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('service:status-updated', status);
  }
  updateTray(healthState, status);
}

function buildTray() {
  if (tray) return;
    const trayIconPath = path.join(__dirname, 'icons', 'trayTemplate.png');
  const icon = fs.existsSync(trayIconPath) ? nativeImage.createFromPath(trayIconPath) : nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('ShiguReader Backend');
  tray.on('double-click', () => {
    if (!mainWindow) {
      void createWindow();
      return;
    }
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  });
  updateTray('unknown');
}

function updateTray(state: typeof healthState, status?: ServiceStatus) {
  if (!tray) return;
  const statusLabel = status?.state === 'running' ? '运行中' : status?.state === 'starting' ? '启动中' : '已停止';
  tray.setToolTip(`ShiguReader Backend\n状态: ${statusLabel}\n健康: ${state}`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: '打开控制台',
        click: () => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
          } else {
            void createWindow();
          }
        }
      },
      { type: 'separator' },
      {
        label: status?.state === 'running' ? '停止服务' : '启动服务',
        click: () => {
          if (status?.state === 'running') {
            void serviceManager.stop();
          } else {
            void serviceManager.start({ config: currentConfig });
          }
        }
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          stopHealthChecks();
          app.quit();
        }
      }
    ])
  );
}

async function ensurePortAvailable(port: number) {
  const available = await checkPort(port);
  if (available) {
    return { available: true, port };
  }
  return { available: false, port, suggestions: await suggestPorts(port) };
}

async function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once('error', () => resolve(false))
      .once('listening', () => tester.close(() => resolve(true)))
      .listen(port, '0.0.0.0');
  });
}

async function suggestPorts(port: number) {
  const candidates = [port + 1, port + 10, port + 100];
  const available: number[] = [];
  for (const candidate of candidates) {
    if (await checkPort(candidate)) {
      available.push(candidate);
    }
  }
  return available;
}

app.whenReady().then(async () => {
  await createWindow();
  if (process.platform === 'darwin') {
    const iconPath = path.join(__dirname, 'icons', 'app.png');
    if (fs.existsSync(iconPath)) {
      app.dock.setIcon(iconPath);
    }
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopHealthChecks();
    app.quit();
  }
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught error', error);
  dialog.showErrorBox('应用异常', error.message);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled rejection', reason);
});
