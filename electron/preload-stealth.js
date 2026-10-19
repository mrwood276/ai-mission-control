// Preload stealth script: Executes before any web page scripts run
const { contextBridge } = require('electron');

function applyStealthPatches(config = {}) {
  const chromeFullVersion = config.chromeFullVersion || '132.0.0.0';
  const chromeMajorVersion = config.chromeMajorVersion || '132';

  try {
    // 1. Delete navigator.webdriver or undefine it
    try {
      delete Object.getPrototypeOf(navigator).webdriver;
    } catch (e) {}

    try {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true,
        enumerable: false,
      });
    } catch (e) {}

    // 2. Ensure window.chrome exists with realistic Chrome runtime stubs
    if (typeof window !== 'undefined') {
      window.chrome = {
        runtime: {},
        loadTimes: function () {
          return {
            requestTime: Date.now() / 1000 - 0.5,
            startLoadTime: Date.now() / 1000 - 0.4,
            commitLoadTime: Date.now() / 1000 - 0.2,
            finishDocumentLoadTime: Date.now() / 1000,
            finishLoadTime: Date.now() / 1000 + 0.1,
            firstPaintTime: Date.now() / 1000 - 0.1,
            firstPaintAfterLoadTime: 0,
            navigationType: 'Other',
            wasFetchedViaSpdy: true,
            wasNpnNegotiated: true,
            npnNegotiatedProtocol: 'h2',
            wasAlternateProtocolAvailable: false,
            connectionInfo: 'h2',
          };
        },
        csi: function () {
          return {
            startE: Date.now() - 500,
            onloadT: Date.now(),
            pageT: 500,
            tran: 15,
          };
        },
        app: {
          isInstalled: false,
          InstallState: {
            DISABLED: 'disabled',
            INSTALLED: 'installed',
            NOT_INSTALLED: 'not_installed',
          },
          RunningState: {
            CANNOT_RUN: 'cannot_run',
            READY_TO_RUN: 'ready_to_run',
            RUNNING: 'running',
          },
        },
      };
    }

    // 3. Deep override of navigator.userAgentData to strip 'Electron' completely
    if (typeof navigator !== 'undefined') {
      const brands = [
        { brand: 'Not_A Brand', version: '24' },
        { brand: 'Chromium', version: chromeMajorVersion },
        { brand: 'Google Chrome', version: chromeMajorVersion },
      ];

      const highEntropyValues = {
        architecture: 'x86',
        bitness: '64',
        brands: brands,
        fullVersionList: [
          { brand: 'Not_A Brand', version: '24.0.0.0' },
          { brand: 'Chromium', version: chromeFullVersion },
          { brand: 'Google Chrome', version: chromeFullVersion },
        ],
        mobile: false,
        model: '',
        platform: 'Windows',
        platformVersion: '15.0.0',
        uaFullVersion: chromeFullVersion,
      };

      const userAgentDataMock = {
        brands: brands,
        mobile: false,
        platform: 'Windows',
        getHighEntropyValues: function (hints) {
          return Promise.resolve(highEntropyValues);
        },
        toJSON: function () {
          return {
            brands: brands,
            mobile: false,
            platform: 'Windows',
          };
        },
      };

      try {
        Object.defineProperty(navigator, 'userAgentData', {
          get: () => userAgentDataMock,
          enumerable: true,
          configurable: true,
        });
      } catch (e) {
        try {
          navigator.userAgentData = userAgentDataMock;
        } catch (err) {}
      }
    }
  } catch (err) {
    // Silent fail safe
  }
}

const chromeFullVersion = (typeof process !== 'undefined' && process.versions && process.versions.chrome) || '132.0.0.0';
const chromeMajorVersion = chromeFullVersion.split('.')[0] || '132';
const versionConfig = { chromeFullVersion, chromeMajorVersion };

try {
  if (contextBridge && typeof contextBridge.executeInMainWorld === 'function') {
    contextBridge.executeInMainWorld({
      func: applyStealthPatches,
      args: [versionConfig],
    });
  } else {
    applyStealthPatches(versionConfig);
  }
} catch (outerError) {
  applyStealthPatches(versionConfig);
}
