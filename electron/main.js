const { app, BrowserWindow, session, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// 1. Sembunyikan flag otomasi & matikan WebAuthn agar Windows Security (Passkey/Bluetooth) tidak muncul
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
app.commandLine.appendSwitch(
  'disable-features',
  'WebAuthentication,WebAuthenticationConditionalUI,AdditionOfConfirmationToWebAuthn,OutOfProcessPdf'
);

// 2. Buat User-Agent Chrome yang 100% cocok dengan versi Chromium asli di Electron ini
const chromeVersion = process.versions.chrome || '132.0.0.0';
const majorChromeVersion = chromeVersion.split('.')[0];
const CLEAN_USER_AGENT = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;

// Gunakan partisi baru (v3) agar sisa cache/cookie gagal login sebelumnya bersih total
const PARTITION_NAME = 'persist:clean_chrome_v3';

app.userAgentFallback = CLEAN_USER_AGENT;

function setupSession() {
  const targetSessions = [
    session.fromPartition(PARTITION_NAME),
    session.defaultSession,
  ];

  targetSessions.forEach((ses) => {
    ses.setUserAgent(CLEAN_USER_AGENT);

    // Tolak otomatis izin WebAuthn / MIDI / Hid yang memicu pop-up hardware Windows Security
    ses.setPermissionRequestHandler((_webContents, permission, callback) => {
      if (['hid', 'usb', 'serial', 'bluetooth', 'bluetoothScanning'].includes(permission)) {
        return callback(false);
      }
      callback(true);
    });

    // Sesuaikan Client Hints secara dinamis dengan versi Chromium asli Electron
    ses.webRequest.onBeforeSendHeaders((details, callback) => {
      details.requestHeaders['User-Agent'] = CLEAN_USER_AGENT;
      details.requestHeaders['sec-ch-ua'] = `"Not A(Brand";v="8", "Chromium";v="${majorChromeVersion}", "Google Chrome";v="${majorChromeVersion}"`;
      details.requestHeaders['sec-ch-ua-mobile'] = '?0';
      details.requestHeaders['sec-ch-ua-platform'] = '"Windows"';
      delete details.requestHeaders['X-Client-Data'];
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    });
  });

  app.on('web-contents-created', (_event, contents) => {
    // Matikan navigator.credentials (Passkey prompt) hanya di halaman login Google agar tidak memicu Windows Security
    contents.on('did-start-navigation', (_e, url) => {
      if (url.includes('accounts.google.com')) {
        contents.executeJavaScript(`
          if (window.PublicKeyCredential) {
            window.PublicKeyCredential = undefined;
          }
          if (navigator.credentials && navigator.credentials.get) {
            navigator.credentials.get = () => Promise.reject(new DOMException('NotAllowedError', 'NotAllowedError'));
          }
        `).catch(() => {});
      }
    });

    if (contents.getType() === 'webview') {
      contents.setWindowOpenHandler(() => {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 650,
            height: 750,
            autoHideMenuBar: true,
            webPreferences: {
              partition: PARTITION_NAME,
              nodeIntegration: false,
              contextIsolation: true,
              sandbox: true,
            },
          },
        };
      });
    }
  });

  app.on('browser-window-created', (_event, win) => {
    win.webContents.setUserAgent(CLEAN_USER_AGENT);
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#090d16',
    title: 'Creator AI Command Center',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    const distPath = path.join(__dirname, '../dist/index.html');
    if (fs.existsSync(distPath)) {
      mainWindow.loadFile(distPath);
    } else {
      mainWindow.loadURL('http://localhost:5173');
    }
  }

  // Jendela khusus Login Google dengan Sandbox aktif & tanpa suntikan navigator.webdriver palsu
  ipcMain.handle('open-google-login', async () => {
    return new Promise((resolve) => {
      const authWindow = new BrowserWindow({
        width: 550,
        height: 720,
        title: 'Google Account Sign-In',
        autoHideMenuBar: true,
        backgroundColor: '#ffffff',
        webPreferences: {
          partition: PARTITION_NAME,
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });

      authWindow.webContents.setUserAgent(CLEAN_USER_AGENT);
      // Gunakan URL login yang langsung mengarah ke pengisian password standar
      authWindow.loadURL('https://accounts.google.com/ServiceLogin?service=youtube&passive=true&continue=https%3A%2F%2Fwww.youtube.com%2Fsignin%3Faction_handle_signin%3Dtrue%26next%3Dhttps%253A%252F%252Fstudio.youtube.com%252F&hl=id');

      authWindow.on('closed', () => {
        resolve({ success: true });
      });
    });
  });

  ipcMain.on('app:reload', () => {
    mainWindow.reload();
  });
}

app.whenReady().then(() => {
  setupSession();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});