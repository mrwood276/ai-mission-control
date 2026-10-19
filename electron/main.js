const { app, BrowserWindow, session, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// 1. Hide automation flags via native engine switch
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');

// 2. Disable WebAuthentication features that trigger Windows Security Passkey popups,
// while preserving Site Isolation (do not disable site-per-process or IsolateOrigins)
app.commandLine.appendSwitch(
  'disable-features',
  'WebAuthentication,WebAuthenticationConditionalUI,AdditionOfConfirmationToWebAuthn,OutOfProcessPdf'
);

// 3. Derive clean desktop User-Agent and sec-ch-ua dynamically from actual Chromium version (Chrome 132 in Electron 34)
const chromeVersion = process.versions.chrome || '132.0.0.0';
const majorVersion = chromeVersion.split('.')[0] || '132';

const CLEAN_USER_AGENT =
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;

const PARTITION_NAME = 'persist:clean_chrome_v3';
const stealthPreloadPath = path.join(__dirname, 'preload-stealth.js');

app.userAgentFallback = CLEAN_USER_AGENT;

function setupSession() {
  const targetSessions = [
    session.fromPartition(PARTITION_NAME),
    session.defaultSession,
  ];

  targetSessions.forEach((ses) => {
    ses.setUserAgent(CLEAN_USER_AGENT);

    // Reject bluetooth, hid, and usb permissions to stop Windows Security Passkey prompts
    ses.setPermissionRequestHandler((_webContents, permission, callback) => {
      const blockedPermissions = ['bluetooth', 'hid', 'usb', 'u2f-devices'];
      if (blockedPermissions.includes(permission)) {
        return callback(false);
      }
      callback(true);
    });

    // Intercept headers:
    // - Explicitly set dynamic Chromium version User-Agent & sec-ch-ua
    // - Remove Google app signature (X-Client-Data)
    ses.webRequest.onBeforeSendHeaders((details, callback) => {
      details.requestHeaders['User-Agent'] = CLEAN_USER_AGENT;
      details.requestHeaders['sec-ch-ua'] = `"Google Chrome";v="${majorVersion}", "Chromium";v="${majorVersion}", "Not_A Brand";v="24"`;
      details.requestHeaders['sec-ch-ua-mobile'] = '?0';
      details.requestHeaders['sec-ch-ua-platform'] = '"Windows"';
      delete details.requestHeaders['X-Client-Data'];
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    });
  });

  // ONLY register deep preload-stealth script on the webview partition session
  // NEVER on defaultSession, because defaultSession is used by the main application window (which needs preload.js)
  try {
    const webviewSession = session.fromPartition(PARTITION_NAME);
    if (typeof webviewSession.setPreloads === 'function') {
      webviewSession.setPreloads([stealthPreloadPath]);
    }
    // Ensure defaultSession does not have stealthPreload overriding the mainWindow preload
    session.defaultSession.setPreloads([]);
  } catch (e) {
    console.warn('Could not set preloads on webview partition session:', e.message);
  }

  app.on('web-contents-created', (_event, contents) => {
    // Disable PublicKeyCredential on accounts.google.com to prevent Windows Security Bluetooth/Passkey dialogs
    contents.on('did-start-navigation', (_navEvent, url) => {
      if (url && url.includes('accounts.google.com')) {
        contents.executeJavaScript(`
          try {
            if (typeof window !== 'undefined') {
              window.PublicKeyCredential = undefined;
            }
          } catch(e) {}
        `).catch(() => {});
      }
    });

    if (contents.getType() === 'webview') {
      contents.setWindowOpenHandler(({ url }) => {
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

  // Ensure any newly spawned window has clean user agent
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
    const devUrl = 'http://localhost:5173';
    mainWindow.loadURL(devUrl);
  } else {
    const distPath = path.join(__dirname, '../dist/index.html');
    if (fs.existsSync(distPath)) {
      mainWindow.loadFile(distPath);
    } else {
      mainWindow.loadURL('http://localhost:5173');
    }
  }

  // Standalone Google Auth Popup with sandbox: true & partition persist:clean_chrome_v3
  ipcMain.handle('open-google-login', async () => {
    return new Promise((resolve) => {
      const authWindow = new BrowserWindow({
        width: 650,
        height: 750,
        title: 'Google Account Sign-In (Mission Control Auth)',
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
      authWindow.loadURL('https://accounts.google.com/ServiceLogin?hl=id');

      authWindow.on('closed', () => {
        resolve({ success: true });
      });
    });
  });

  // 100% Guaranteed Fallback: Real Browser Cookie Bridge
  // Injects exported Chrome cookies directly into the Electron session jar
  ipcMain.handle('import-cookies', async (_event, cookiesJson) => {
    try {
      let cookies = [];
      if (typeof cookiesJson === 'string') {
        cookies = JSON.parse(cookiesJson);
      } else if (Array.isArray(cookiesJson)) {
        cookies = cookiesJson;
      }

      if (!Array.isArray(cookies) || cookies.length === 0) {
        return { success: false, error: 'Format JSON cookie tidak valid atau kosong.' };
      }

      const sessionsToInject = [
        session.fromPartition(PARTITION_NAME),
        session.fromPartition('persist:clean_chrome_v2'),
        session.defaultSession,
      ];

      let totalSuccess = 0;
      let totalFailed = 0;

      for (const cookie of cookies) {
        if (!cookie.name || cookie.value === undefined) continue;

        const rawDomain = (cookie.domain || '').trim();
        const cleanDomain = rawDomain.replace(/^\./, '');
        const isSecure = Boolean(cookie.secure);
        const protocol = isSecure ? 'https' : 'http';
        const cookiePath = cookie.path || '/';
        const url = `${protocol}://${cleanDomain || 'google.com'}${cookiePath}`;

        let sameSite = 'unspecified';
        if (cookie.sameSite) {
          const s = String(cookie.sameSite).toLowerCase();
          if (s === 'no_restriction' || s === 'none') sameSite = 'no_restriction';
          else if (s === 'lax') sameSite = 'lax';
          else if (s === 'strict') sameSite = 'strict';
        }

        const cookieDetails = {
          url,
          name: cookie.name,
          value: String(cookie.value),
          path: cookiePath,
          secure: isSecure,
          httpOnly: Boolean(cookie.httpOnly),
          sameSite,
        };

        if (rawDomain) {
          cookieDetails.domain = rawDomain;
        }

        const expiry = cookie.expirationDate || cookie.expiry;
        if (expiry && typeof expiry === 'number') {
          cookieDetails.expirationDate = Math.floor(expiry);
        }

        for (const targetSes of sessionsToInject) {
          try {
            await targetSes.cookies.set(cookieDetails);
            totalSuccess++;
          } catch (firstErr) {
            try {
              const fallbackDetails = { ...cookieDetails };
              delete fallbackDetails.domain;
              await targetSes.cookies.set(fallbackDetails);
              totalSuccess++;
            } catch (secondErr) {
              totalFailed++;
            }
          }
        }
      }

      return {
        success: true,
        count: cookies.length,
        injected: totalSuccess,
        failed: totalFailed,
      };
    } catch (err) {
      console.error('Failed to import cookies:', err);
      return { success: false, error: err.message || 'Gagal memproses JSON cookie.' };
    }
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