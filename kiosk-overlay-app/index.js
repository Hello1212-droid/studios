const { app, BrowserWindow, ipcMain, globalShortcut, screen } = require('electron');
const path = require('path');
const { exec } = require('child_process');

app.commandLine.appendSwitch('kiosk');

let win;

function killExplorer() {
  exec('taskkill /f /im explorer.exe', (err) => {
    if (err) console.error('Failed to kill explorer:', err);
  });
}

function startExplorer() {
  exec('start explorer.exe', (err) => {
    if (err) console.error('Failed to start explorer:', err);
  });
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;

  win = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
    backgroundColor: '#0f172a',
    fullscreen: true,
    frame: false,
    kiosk: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.setAlwaysOnTop(true, 'screen-saver', 1);
  win.setMenu(null);
  
  // Kill explorer to ensure absolute isolation
  killExplorer();

  win.on('closed', () => {
    win = null;
    startExplorer();
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  startExplorer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  startExplorer();
});

ipcMain.on('exit-app', () => {
  startExplorer();
  setTimeout(() => {
    app.quit();
  }, 500);
});
