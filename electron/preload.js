const { contextBridge, ipcRenderer } = require('electron');

const chromeVersion = process.versions.chrome;
const cleanUserAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  chromeVersion,
  userAgent: cleanUserAgent,
  openGoogleLogin: () => ipcRenderer.invoke('open-google-login'),
  reloadApp: () => ipcRenderer.send('app:reload'),
});
