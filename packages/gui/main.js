const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');

function createWindow() {
  const win = new BrowserWindow({
    width: 400,
    height: 200,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('start-server', (event, { port, skipScan }) => {
  const serverPath = path.join(__dirname, '../backend/src/server/index.js');
  const args = [serverPath, '--port', String(port)];
  if (skipScan) {
    args.push('--skip-scan');
  }
  spawn('node', args, { stdio: 'inherit' });
});

