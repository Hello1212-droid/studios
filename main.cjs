const { app, BrowserWindow, ipcMain, screen, dialog, shell } = require('electron');
const { exec } = require('child_process');
const path = require('path');

// CRITICAL: Stealth Config for 2026
// DO NOT enable remote-debugging-port - it is a dead giveaway to Cloudflare bot detection
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
app.commandLine.appendSwitch('excludeSwitches', 'enable-automation');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
// Disable automation flags that Cloudflare checks
app.commandLine.appendSwitch('disable-features', 'ChromeWhatsNewUI,ChromeLabs');
// CRITICAL for Google OAuth: Make Electron appear as regular Chrome
app.commandLine.appendSwitch('disable-device-emulation-switches');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-setuid-sandbox');

// Electron 41 ships Chromium 146 — UA MUST match the actual engine or Google rejects login
const CHROME_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

// Apply UA to every session (including webview partitions like persist:studyos-v3)
// AND inject sec-ch-ua headers that MATCH the Chrome/146 UA.
// This is the only reliable way to pass Google's browser check.
app.on('session-created', (sessionObj) => {
  sessionObj.setUserAgent(CHROME_UA);
  sessionObj.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = CHROME_UA;
    // sec-ch-ua MUST match the UA — mismatch is a primary Google detection vector
    details.requestHeaders['sec-ch-ua'] = '"Google Chrome";v="146", "Chromium";v="146", "Not:A-Brand";v="8"';
    details.requestHeaders['sec-ch-ua-mobile'] = '?0';
    details.requestHeaders['sec-ch-ua-platform'] = '"Windows"';
    // Strip automation-leaking headers
    delete details.requestHeaders['X-DevTools-Emulate-Network-Conditions-Client-Id'];
    delete details.requestHeaders['X-Requested-With'];
    callback({ requestHeaders: details.requestHeaders });
  });
});

let mainWindow;
let IS_KIOSK = false; // Changed from const to let — dynamically updated via IPC

function killExplorer() {
  if (!IS_KIOSK) return;
  exec('taskkill /f /im explorer.exe', (err, stdout, stderr) => {
    if (err) {
      console.log('[StudyOS] Explorer kill (already isolated):', err.message);
    } else {
      console.log('[StudyOS] Explorer.exe terminated successfully');
    }
  });
}

function startExplorer() {
  exec('start explorer.exe');
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;

  mainWindow = new BrowserWindow({
    width: IS_KIOSK ? width : Math.min(1280, width),
    height: IS_KIOSK ? height : Math.min(800, height),
    backgroundColor: '#000000',
    fullscreen: IS_KIOSK,
    frame: !IS_KIOSK,
    kiosk: IS_KIOSK,
    alwaysOnTop: IS_KIOSK,
    skipTaskbar: IS_KIOSK,
    focusable: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webviewTag: true,
      webSecurity: true,
      plugins: true,
      pdfViewerEnabled: true,
      partition: "persist:studyos-v3",
      preload: path.join(__dirname, 'main-preload.cjs')
    }
  });

  // Additional stealth: remove menu bar
  mainWindow.setMenu(null);
  
  // Hide automation from Chrome runtime
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // Attach preload script and ensure stealth settings for webviews
  mainWindow.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    console.log(`[StudyOS] Attaching preload to webview: ${params.src}`);
    webPreferences.preload = path.join(__dirname, 'preload.cjs');
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.webSecurity = true;
    webPreferences.plugins = true;
    webPreferences.pdfViewerEnabled = true;
    
    // CRITICAL: Enable proper partition for OAuth session persistence
    webPreferences.partition = 'persist:studyos-oauth';
  });

  // FALLBACK: always show window once DOM is ready, even if loadURL retry is still running
  mainWindow.once('ready-to-show', () => {
    if (IS_KIOSK) {
      mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
      killExplorer();
    }
    mainWindow.show();
    mainWindow.focus();
  });

  let retryCount = 0;
  const maxRetries = 8;
  const loadURL = async (port = 5173) => {
    try {
      console.log(`[StudyOS] Attempting dev server http://localhost:${port} (attempt ${retryCount + 1})`);
      await mainWindow.loadURL(`http://localhost:${port}`);
      console.log('[StudyOS] App loaded successfully.');
      if (!mainWindow.isVisible()) {
        if (IS_KIOSK) {
          mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
          killExplorer();
        }
        mainWindow.show();
        mainWindow.focus();
      }
    } catch (e) {
      retryCount++;
      if (retryCount >= maxRetries) {
        console.log(`[StudyOS] Dev server not found after ${maxRetries} attempts. Loading built dist...`);
        const distPath = path.join(__dirname, 'dist', 'index.html');
        mainWindow.loadFile(distPath).catch(err => {
          console.error('[StudyOS] Failed to load dist/index.html:', err);
        });
        return;
      }
      const nextPort = port + 1;
      console.log(`[StudyOS] Load failed, retrying on port ${nextPort}...`);
      setTimeout(() => loadURL(nextPort), 1000);
    }
  };

  loadURL();

  mainWindow.on('closed', () => {
    mainWindow = null;
    startExplorer();
  });
}

// --- SYSTEM HARDWARE CONTROL ---

// Brightness Controller (Windows PowerShell WMI)
ipcMain.on('set-brightness', (event, value) => {
    const psCommand = `(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1,${value})`;
    exec(`powershell -Command "${psCommand}"`);
});

// Volume Controller (Windows Sound)
ipcMain.on('set-volume', (event, value) => {
    const vol = Math.floor(value);
    exec(`powershell -Command "$obj = New-Object -ComObject WScript.Shell; for($i=0; $i -lt 50; $i++) { $obj.SendKeys([char]174) }; for($i=0; $i -lt ${Math.floor(vol/2)}; $i++) { $obj.SendKeys([char]175) }"`);
});

app.on('will-quit', startExplorer);
app.on('window-all-closed', () => {
  startExplorer();
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('open-file-dialog', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
  });
  if (canceled) return null;
  return `file://${filePaths[0]}`;
});

// --- KIOSK CONTROL ---
ipcMain.on('enter-kiosk', () => {
  if (!mainWindow) return;
  console.log('[StudyOS] Entering kiosk mode...');
  IS_KIOSK = true;
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;
  mainWindow.setFullScreen(true);
  mainWindow.setKiosk(true);
  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  mainWindow.setSkipTaskbar(true);
  mainWindow.setSize(width, height);
  mainWindow.setPosition(0, 0);
  killExplorer();
  mainWindow.focus();
  // Notify renderer of kiosk state change
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('kiosk-state-changed', true);
  }
  console.log('[StudyOS] Kiosk mode activated.');
});

ipcMain.on('exit-kiosk', () => {
  if (!mainWindow) return;
  console.log('[StudyOS] Exiting kiosk mode...');
  IS_KIOSK = false;
  mainWindow.setKiosk(false);
  mainWindow.setFullScreen(false);
  mainWindow.setAlwaysOnTop(false);
  mainWindow.setSkipTaskbar(false);
  mainWindow.setSize(Math.min(1280, screen.getPrimaryDisplay().size.width), Math.min(800, screen.getPrimaryDisplay().size.height));
  startExplorer();
  // Notify renderer of kiosk state change
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('kiosk-state-changed', false);
  }
  console.log('[StudyOS] Kiosk mode deactivated.');
});

// --- OPEN IN SYSTEM BROWSER (for Google OAuth / sites that block embedded webviews) ---
// NOTE: Google specifically blocks OAuth logins from embedded webviews.
// Opening the system browser breaks the OAuth callback chain: the callback URL
// (e.g. https://site.com/callback?code=xxx) goes to the system browser, not back
// to the webview. For a full OAuth solution, implement PKCE with a custom protocol
// handler (studyos://callback) registered with the OS, then catch it in Electron via
// app.setAsDefaultProtocolClient(). For now, this allows manual login.
ipcMain.handle('open-in-browser', async (event, url) => {
  if (!url) return { success: false };
  try {
    console.log('[StudyOS] Opening in system browser:', url);
    await shell.openExternal(url);
    console.log('[StudyOS] System browser opened successfully');
    return { success: true };
  } catch (e) {
    console.error('[StudyOS] Failed to open system browser:', e);
    return { success: false, error: e.message };
  }
});

ipcMain.on('exit-app', () => {
  console.log('[StudyOS] Exit signal received, shutting down...');
  startExplorer();
  setTimeout(() => {
    app.quit();
  }, 500);
});

process.on('uncaughtException', (err) => {
  console.error('[StudyOS] Fatal error:', err);
  startExplorer();
});

app.on('web-contents-created', (event, contents) => {
  if (contents.getType() === 'webview') {
    // Intercept ALL new-window requests from webviews (window.open, target=_blank, PDFs).
    // Return { action: 'deny' } to prevent a flash/popup, then send URL via IPC
    // so the React Browser component can open it as a new in-app tab.
    contents.setWindowOpenHandler((details) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('webview-new-window', details.url);
      }
      return { action: 'deny' };
    });
    contents.on('will-navigate', (event, url) => {
      // Allow all navigation inside webviews — do NOT intercept Google auth
    });
  }
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  
  // Set global fallback before ready to ensure all requests use the pure Chrome UA natively
  app.userAgentFallback = CHROME_UA;
  
  app.whenReady().then(createWindow);
}
