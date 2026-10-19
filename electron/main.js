const { app, BrowserWindow, session, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const { pathToFileURL } = require('url');

// 1. Hide automation flags via native engine switch
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');

// 2. Derive clean desktop User-Agent and sec-ch-ua dynamically from actual Chromium version (Chrome 132 in Electron 34)
const chromeVersion = process.versions.chrome || '132.0.0.0';
const majorVersion = chromeVersion.split('.')[0] || '132';

const CLEAN_USER_AGENT =
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;

const PARTITION_NAME = 'persist:clean_chrome_v3';
const stealthPreloadPath = path.join(__dirname, 'preload-stealth.js');
const stealthPreloadUrl = pathToFileURL(stealthPreloadPath).href;

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

function setupIpcHandlers() {
  ipcMain.on('get-stealth-preload-url', (event) => {
    event.returnValue = stealthPreloadUrl;
  });

  // Standalone Google Auth Popup with sandbox: true & partition persist:clean_chrome_v3
  ipcMain.handle('open-google-login', async () => {
    return new Promise((resolve) => {
      let isResolved = false;
      let loadError = null;

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

      authWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, _validatedURL, isMainFrame) => {
        // Ignore ERR_ABORTED (-3) as it happens normally on redirect
        if (isMainFrame && errorCode !== -3) {
          loadError = `${errorDescription} (${errorCode})`;
        }
      });

      authWindow.loadURL('https://accounts.google.com/ServiceLogin?hl=id');

      authWindow.on('closed', async () => {
        if (isResolved) return;
        isResolved = true;
        try {
          const ses = session.fromPartition(PARTITION_NAME);
          const sidCookies = await ses.cookies.get({ name: 'SID' });
          const loggedIn = Array.isArray(sidCookies) && sidCookies.length > 0;
          if (loadError && !loggedIn) {
            resolve({ success: false, error: loadError, loggedIn: false });
          } else {
            resolve({ success: true, loggedIn });
          }
        } catch (err) {
          resolve({ success: false, error: err.message, loggedIn: false });
        }
      });
    });
  });

  // 100% Guaranteed Fallback: Real Browser Cookie Bridge
  // Injects exported Chrome cookies directly into the Electron session jar
  ipcMain.handle('import-cookies', async (_event, cookiesJson) => {
    try {
      if (typeof cookiesJson === 'string') {
        if (cookiesJson.length > 5 * 1024 * 1024) {
          return { success: false, error: 'Ukuran JSON cookie terlalu besar (maks 5MB).' };
        }
      }

      let cookies = [];
      if (typeof cookiesJson === 'string') {
        try {
          cookies = JSON.parse(cookiesJson);
        } catch (e) {
          return { success: false, error: 'Format JSON tidak valid: ' + e.message };
        }
      } else if (Array.isArray(cookiesJson)) {
        cookies = cookiesJson;
      }

      if (!Array.isArray(cookies) || cookies.length === 0) {
        return { success: false, error: 'Format JSON cookie tidak valid atau kosong (harus berupa array).' };
      }

      const ses = session.fromPartition(PARTITION_NAME);
      const defaultExpirationDate = Math.floor(Date.now() / 1000) + (180 * 24 * 3600); // 180 days default
      const failedCookies = [];
      let injectedCount = 0;

      for (const cookie of cookies) {
        if (!cookie || typeof cookie !== 'object') {
          failedCookies.push({ name: 'unknown', reason: 'Objek cookie tidak valid' });
          continue;
        }

        const name = typeof cookie.name === 'string' ? cookie.name.trim() : '';
        if (!name) {
          failedCookies.push({ name: 'empty', reason: 'Nama cookie kosong atau bukan string' });
          continue;
        }

        let value = '';
        if (typeof cookie.value === 'string') {
          value = cookie.value;
        } else if (cookie.value !== undefined && cookie.value !== null) {
          value = String(cookie.value);
        }

        const rawDomain = typeof cookie.domain === 'string' ? cookie.domain.trim() : '';
        const cleanDomain = rawDomain.replace(/^\./, '');
        const isGoogleOrYoutube = /(^|\.)(google\.[a-z.]+|youtube\.com)$/i.test(cleanDomain) || cleanDomain.includes('google') || cleanDomain.includes('youtube');

        let isSecure = Boolean(cookie.secure);
        if (name.startsWith('__Secure-') || name.startsWith('__Host-')) {
          isSecure = true;
        }

        let protocol = 'https';
        if (!isSecure && !isGoogleOrYoutube) {
          protocol = 'http';
        } else {
          isSecure = true;
        }

        let cookiePath = typeof cookie.path === 'string' && cookie.path.startsWith('/') ? cookie.path : '/';
        if (name.startsWith('__Host-')) {
          cookiePath = '/';
        }

        const urlDomain = cleanDomain || 'google.com';
        const url = `${protocol}://${urlDomain}${cookiePath}`;

        let sameSite = 'unspecified';
        if (cookie.sameSite) {
          const s = String(cookie.sameSite).toLowerCase();
          if (s === 'no_restriction' || s === 'none') sameSite = 'no_restriction';
          else if (s === 'lax') sameSite = 'lax';
          else if (s === 'strict') sameSite = 'strict';
        }

        const cookieDetails = {
          url,
          name,
          value,
          path: cookiePath,
          secure: isSecure,
          httpOnly: Boolean(cookie.httpOnly),
          sameSite,
        };

        const isHostOnly = Boolean(cookie.hostOnly) || name.startsWith('__Host-');
        if (!isHostOnly && rawDomain) {
          cookieDetails.domain = rawDomain;
        }

        const expiry = cookie.expirationDate || cookie.expiry;
        if (expiry && typeof expiry === 'number' && !isNaN(expiry) && expiry > 0) {
          cookieDetails.expirationDate = Math.floor(expiry);
        } else {
          cookieDetails.expirationDate = defaultExpirationDate;
        }

        try {
          await ses.cookies.set(cookieDetails);
          injectedCount++;
        } catch (firstErr) {
          if (cookieDetails.domain) {
            try {
              const fallbackDetails = { ...cookieDetails };
              delete fallbackDetails.domain;
              await ses.cookies.set(fallbackDetails);
              injectedCount++;
              continue;
            } catch (secondErr) {
              failedCookies.push({ name, reason: secondErr.message || firstErr.message });
              continue;
            }
          }
          failedCookies.push({ name, reason: firstErr.message });
        }
      }

      try {
        await ses.cookies.flushStore();
      } catch (flushErr) {
        console.warn('[Session] cookies.flushStore error:', flushErr);
      }

      let googleLoginDetected = false;
      try {
        const googleCookies = await ses.cookies.get({ domain: '.google.com' });
        googleLoginDetected = googleCookies.some(c => c.name === 'SID' || c.name === '__Secure-1PSID');
        if (!googleLoginDetected) {
          const allCookies = await ses.cookies.get({});
          googleLoginDetected = allCookies.some(
            c => (c.name === 'SID' || c.name === '__Secure-1PSID') && c.domain && c.domain.includes('google')
          );
        }
      } catch (checkErr) {
        console.warn('[Session] Could not verify Google login cookies:', checkErr);
      }

      return {
        success: true,
        count: cookies.length,
        injected: injectedCount,
        failed: failedCookies.length,
        failedCookies,
        googleLoginDetected,
      };
    } catch (err) {
      console.error('Failed to import cookies:', err);
      return { success: false, error: err.message || 'Gagal memproses JSON cookie.' };
    }
  });

  ipcMain.handle('check-google-auth', async () => {
    try {
      const ses = session.fromPartition(PARTITION_NAME);
      const googleCookies = await ses.cookies.get({ domain: '.google.com' });
      const hasSid = googleCookies.some(c => c.name === 'SID' || c.name === '__Secure-1PSID');
      if (hasSid) return { loggedIn: true };

      const allCookies = await ses.cookies.get({});
      const hasAny = allCookies.some(
        c => (c.name === 'SID' || c.name === '__Secure-1PSID') && c.domain && c.domain.includes('google')
      );
      return { loggedIn: hasAny };
    } catch (e) {
      return { loggedIn: false, error: e.message };
    }
  });

  ipcMain.on('app:reload', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.reload();
    }
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
}

app.whenReady().then(() => {
  setupSession();
  setupIpcHandlers();
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