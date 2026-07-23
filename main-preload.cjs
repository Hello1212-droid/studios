const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  send: (channel, data) => {
    const validChannels = ['set-brightness', 'set-volume', 'exit-app', 'enter-kiosk', 'exit-kiosk'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  invoke: async (channel, data) => {
    const validChannels = ['open-file-dialog', 'open-in-browser'];
    if (validChannels.includes(channel)) {
      return await ipcRenderer.invoke(channel, data);
    }
  },
  on: (channel, callback) => {
    const validChannels = ['kiosk-state-changed'];
    if (validChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },
  getPreloadPath: () => {
    const filePath = path.join(__dirname, 'preload.cjs');
    // Convert backslashes to forward slashes for proper file:/// URL on Windows
    return 'file:///' + filePath.replace(/\\/g, '/');
  },
  onNewTab: (callback) => {
    ipcRenderer.removeAllListeners('webview-new-window');
    ipcRenderer.on('webview-new-window', (event, url) => {
      callback(url);
    });
  }
});
