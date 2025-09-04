const { contextBridge, ipcRenderer } = require('electron');
const portConfig = require('../backend/src/config/port-config');

contextBridge.exposeInMainWorld('serverLauncher', {
  defaultPort: portConfig.default_http_port,
  startServer: (port, skipScan) => ipcRenderer.invoke('start-server', { port, skipScan })
});
