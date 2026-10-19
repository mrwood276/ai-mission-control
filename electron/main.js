const { app, BrowserWindow, session, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const {
  validateExternalUrl,
  isTrustedSender,
  isAllowedPermission,
} = require('./security');

const PARTITION_NAME = 'persist:clean_chrome_v3';

let mainWindow = null;

function setupSession() {
  const targetSessions = [
    session.fromPartition(PARTITION_NAME),
    session.defaultSession,
  ];

  targetSessions.forEach((ses) => {
    // Apply least-privilege permission policy with origin validation
    ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
      const requestingUrl = details?.requestingUrl || webContents?.getURL() || '';
      callback(isAllowedPermission(permission, requestingUrl));
    });

    ses.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
      const url = requestingOrigin || webContents?.getURL() || '';
      return isAllowedPermission(permission, url);
    });
  });

  // Ensure default and webview partitions do not have unexpected preloads
  try {
    session.defaultSession.setPreloads([]);
    const webviewSession = session.fromPartition(PARTITION_NAME);
    webviewSession.setPreloads([]);
  } catch (e) {
    console.warn('[Session] Warning setting preloads:', e.message);
  }
}

function setupIpcHandlers() {
  // Hardened open-external handler: validates sender trust, URL syntax, and destination allowlist
  ipcMain.handle('open-external', async (event, targetUrl) => {
    if (!mainWindow || !isTrustedSender(event.sender, mainWindow.webContents)) {
      return { success: false, error: 'Unauthorized IPC sender' };
    }

    const validation = validateExternalUrl(targetUrl);
    if (!validation.ok) {
      return { success: false, error: validation.error };
    }

    try {
      await shell.openExternal(validation.url);
      return { success: true };
    } catch (err) {
      console.error('[IPC] Failed to open external URL:', err.message);
      return { success: false, error: 'Failed to launch external browser' };
    }
  });

  // Hardened app reload: strictly authorized to trusted main window
  ipcMain.on('app:reload', (event) => {
    if (mainWindow && isTrustedSender(event.sender, mainWindow.webContents)) {
      mainWindow.reload();
    }
  });
}

function setupWebContentsSecurity() {
  app.on('web-contents-created', (_event, contents) => {
    // Intercept webview attachment to strictly enforce secure webPreferences
    contents.on('will-attach-webview', (webviewEvent, webPreferences) => {
      // Strip any preload script attached by renderer to prevent untrusted script injection
      delete webPreferences.preload;
      delete webPreferences.preloadURL;

      // Enforce strict isolation and sandboxing
      webPreferences.nodeIntegration = false;
      webPreferences.nodeIntegrationInSubFrames = false;
      webPreferences.contextIsolation = true;
      webPreferences.sandbox = true;
      webPreferences.webSecurity = true;
      webPreferences.allowRunningInsecureContent = false;
    });

    if (contents.getType() === 'webview') {
      // Prevent webviews from navigating to dangerous non-web protocols (file:, javascript:, data:)
      contents.on('will-navigate', (navEvent, navigationUrl) => {
        try {
          const parsed = new URL(navigationUrl);
          if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
            navEvent.preventDefault();
          }
        } catch {
          navEvent.preventDefault();
        }
      });

      // Secure popup handling for webviews
      contents.setWindowOpenHandler(({ url }) => {
        const validation = validateExternalUrl(url);
        if (validation.ok) {
          // Open allowed destinations in external browser rather than unconstrained Electron windows
          shell.openExternal(validation.url).catch((err) => {
            console.warn('[Webview] Failed to open external popup:', err.message);
          });
        }
        return { action: 'deny' };
      });
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
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
      sandbox: true,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
  const expectedDevOrigin = 'http://localhost:5173';

  // Prevent main window from navigating away from the local application
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    if (isDev) {
      if (!navigationUrl.startsWith(expectedDevOrigin)) {
        event.preventDefault();
      }
    } else {
      if (!navigationUrl.startsWith('file:')) {
        event.preventDefault();
      }
    }
  });

  // Deny arbitrary new windows from main application window
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL(expectedDevOrigin);
  } else {
    const distPath = path.join(__dirname, '../dist/index.html');
    if (fs.existsSync(distPath)) {
      mainWindow.loadFile(distPath);
    } else {
      mainWindow.loadURL(expectedDevOrigin);
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  setupSession();
  setupIpcHandlers();
  setupWebContentsSecurity();
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