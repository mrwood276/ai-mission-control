const { contextBridge, ipcRenderer } = require('electron');
const chromeVersion = process.versions.chrome;
const cleanUserAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
const stealthPreloadUrl = ipcRenderer.sendSync('get-stealth-preload-url');

const electronAPI = {
  platform: process.platform,
  isElectron: true,
  chromeVersion,
  userAgent: cleanUserAgent,
  stealthPreloadUrl,
  openGoogleLogin: () => ipcRenderer.invoke('open-google-login'),
  importCookies: (cookiesJson) => ipcRenderer.invoke('import-cookies', cookiesJson),
  reloadApp: () => ipcRenderer.send('app:reload'),
};

try {
  if (process.contextIsolated) {
    contextBridge.exposeInMainWorld('electronAPI', electronAPI);
  } else {
    window.electronAPI = electronAPI;
  }
  console.log('[Electron] electronAPI bridge successfully initialized');
} catch (error) {
  console.error('[Electron] Error initializing electronAPI:', error);
}
