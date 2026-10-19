const { contextBridge, ipcRenderer } = require('electron');

const electronAPI = Object.freeze({
  isElectron: true,
  platform: process.platform,
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  reloadApp: () => ipcRenderer.send('app:reload'),
});

try {
  if (process.contextIsolated) {
    contextBridge.exposeInMainWorld('electronAPI', electronAPI);
  } else {
    window.electronAPI = electronAPI;
  }
} catch (error) {
  console.error('[Electron] Error initializing electronAPI:', error);
}
