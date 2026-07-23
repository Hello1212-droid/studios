# Kiosk Isolation Guide: Absolute Lockdown in Electron

This guide outlines the "Nuclear Option" strategy for achieving complete system isolation in Electron applications on Windows, specifically bypassing the persistent behavior of the Windows Key and Taskbar.

## 1. The Challenge
Standard Electron `kiosk: true` and `globalShortcut` registration often fail to block the Windows Key because it is a low-level OS interrupt. When pressed, Windows forces the Taskbar and Start Menu to the foreground, breaking the "isolation" of the kiosk.

## 2. The Solution: Shell-Level Isolation
The most reliable method without writing custom kernel drivers or low-level C++ hooks is to temporarily terminate the Windows Shell (`explorer.exe`).

### Execution Flow:
1.  **Startup**: Terminate `explorer.exe` using `taskkill`.
2.  **Lockdown**: Launch Electron in Kiosk mode with `alwaysOnTop` priority set to `screen-saver` or `status`.
3.  **Cleanup**: Monitor all exit paths (normal quit, crash, window close) and restart `explorer.exe`.

## 3. Implementation Code (Node.js)

```javascript
const { app, BrowserWindow } = require('electron');
const { exec } = require('child_process');

let win;

// The "Nuclear" functions
function killExplorer() {
  exec('taskkill /f /im explorer.exe');
}

function startExplorer() {
  exec('start explorer.exe');
}

function createWindow() {
  win = new BrowserWindow({
    fullscreen: true,
    kiosk: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    frame: false
  });

  // Set priority level higher than the taskbar
  win.setAlwaysOnTop(true, 'screen-saver', 1);

  // Kill the shell immediately
  killExplorer();

  win.loadFile('index.html');

  // Ensure recovery on window close
  win.on('closed', () => {
    startExplorer();
  });
}

// CRITICAL: Ensure recovery on app exit/crash
app.on('will-quit', startExplorer);
app.on('window-all-closed', () => {
  startExplorer();
  app.quit();
});
```

## 4. Key Electron Configuration
To ensure the window remains a true overlay even if system dialogs appear:

| Property | Value | Reason |
| :--- | :--- | :--- |
| `kiosk` | `true` | Standard kiosk mode flags. |
| `alwaysOnTop` | `true` | Prevents other apps from overlapping. |
| `setAlwaysOnTop` | `'screen-saver'` | Level `screen-saver` or `status` is above the taskbar. |
| `skipTaskbar` | `true` | Removes the app from the taskbar. |
| `focusable` | `true` | Required for the app to receive keyboard input. |

## 5. Aggressive Focus Recovery
If the shell is NOT killed, add this "Soft-Lock" loop as a secondary defense:

```javascript
win.on('blur', () => {
  win.focus();
  win.setKiosk(true); 
});

setInterval(() => {
  if (!win.isFocused()) win.focus();
}, 50);
```

## 6. Safety Warnings for Agents
*   **User Notification**: Always inform the user that their taskbar will disappear.
*   **Restoration**: You MUST handle `uncaughtException` and `unhandledRejection` to restart `explorer.exe`.
*   **Testing**: Do not run this in a production environment where other shell-dependent apps are needed.
