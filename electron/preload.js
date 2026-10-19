const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

const chromeVersion = process.versions.chrome;
const cleanUserAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
const stealthPreloadPath = path.join(__dirname, 'preload-stealth.js');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  chromeVersion,
  userAgent: cleanUserAgent,
  stealthPreloadPath,
  openGoogleLogin: () => ipcRenderer.invoke('open-google-login'),
  importCookies: (cookiesJson) => ipcRenderer.invoke('import-cookies', cookiesJson),
  reloadApp: () => ipcRenderer.send('app:reload'),
});
