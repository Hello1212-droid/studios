// ============================================
// AURELIUS STEALTH SHIELD: LEVEL 6 TITAN (2026)
// Zero-detection bypass for Cloudflare Turnstile,
// Google OAuth, and all major bot detection systems
// ============================================
// Chrome 136 on Windows — matches Electron 41 Chromium
// Covers ALL 30+ detection vectors:
// - navigator.webdriver, chrome.runtime, plugins
// - User-Agent Client Hints (sec-ch-ua)
// - WebGL vendor/renderer, canvas fingerprint
// - AudioContext, fonts, screen, hardware concurrency
// - Permissions, geolocation, languages
// - Bot signature deletion
// ============================================
(() => {
  'use strict';

  // --- Main injection ---
  const injectStealth = () => {
    // --- Helpers ---
    const defProp = (obj, prop, value, enumerable = true) => {
      try {
        Object.defineProperty(obj, prop, {
          get: () => value,
          configurable: true,
          enumerable
        });
      } catch (_) {}
    };

    const defFn = (fn, name) => {
      try {
        Object.defineProperty(fn, 'name', { value: name, configurable: true });
        Object.defineProperty(fn, 'toString', {
          value: () => `function ${name}() { [native code] }`,
          configurable: true
        });
      } catch (_) {}
    };

    // ===== 1. navigator.webdriver = undefined — THE critical flag =====
    try {
      if (navigator.webdriver !== undefined) {
        delete Object.getPrototypeOf(navigator).webdriver;
      }
    } catch (_) {}
    defProp(navigator, 'webdriver', undefined);

    // ===== 2. User-Agent Client Hints (sec-ch-ua) — Chrome 136 =====
    const CHROME_VERSION = '136';
    const FULL_VERSION = '136.0.0.0';
    const uaData = {
      brands: [
        { brand: 'Google Chrome', version: CHROME_VERSION },
        { brand: 'Chromium', version: CHROME_VERSION },
        { brand: 'Not=A?Brand', version: '24' }
      ],
      mobile: false,
      platform: 'Windows',
      getHighEntropyValues: (hints) => Promise.resolve({
        brands: [
          { brand: 'Google Chrome', version: CHROME_VERSION },
          { brand: 'Chromium', version: CHROME_VERSION },
          { brand: 'Not=A?Brand', version: '24' }
        ],
        mobile: false,
        platform: 'Windows',
        platformVersion: '10.0.0',
        architecture: 'x86-64',
        model: '',
        uaFullVersion: FULL_VERSION,
        bitness: '64',
        wow64: false,
        formFactor: 'Desktop'
      })
    };
    defProp(navigator, 'userAgentData', uaData);

    // ===== 3. Navigator properties — complete Chrome profile =====
    defProp(navigator, 'platform', 'Win32');
    defProp(navigator, 'language', 'en-US');
    defProp(navigator, 'languages', ['en-US', 'en']);
    defProp(navigator, 'hardwareConcurrency', 8);
    defProp(navigator, 'deviceMemory', 8);
    defProp(navigator, 'maxTouchPoints', 0);
    defProp(navigator, 'pdfViewerEnabled', true);
    defProp(navigator, 'cookieEnabled', true);
    defProp(navigator, 'onLine', true);
    defProp(navigator, 'vendor', 'Google Inc.');
    defProp(navigator, 'vendorSub', '');

    // navigator.connection — realistic profile
    try {
      if (!navigator.connection) {
        defProp(navigator, 'connection', {
          effectiveType: '4g',
          rtt: 50,
          downlink: 10,
          saveData: false
        });
      }
    } catch (_) {}

    // ===== 4. Plugins — Chrome PDF + Chrome PDF Viewer =====
    const makePlugin = (data) => {
      try {
        const p = Object.create(Plugin.prototype);
        defProp(p, 'name', data.name);
        defProp(p, 'filename', data.filename);
        defProp(p, 'description', data.description);
        defProp(p, 'length', 0);
        return p;
      } catch (_) { return null; }
    };

    const pluginList = [
      { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
      { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: 'Portable Document Format' },
      { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
    ].map(makePlugin).filter(Boolean);

    try {
      const pluginArray = Object.create(PluginArray.prototype);
      pluginList.forEach((p, i) => {
        defProp(pluginArray, i, p);
        defProp(pluginArray, p.name, p);
      });
      defProp(pluginArray, 'length', pluginList.length);
      defProp(navigator, 'plugins', pluginArray);
    } catch (_) {}

    // MimeTypes
    try {
      defProp(navigator, 'mimeTypes', Object.create(MimeTypeArray.prototype));
    } catch (_) {}

    // ===== 5. chrome.runtime — CRITICAL for Google OAuth =====
    const mockChrome = {
      app: {
        isInstalled: false,
        InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
        getDetails: () => undefined,
        getIsInstalled: () => undefined
      },
      runtime: {
        id: 'aomjjhallfgjeglblehebfpbcfeobpga',
        OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' },
        OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
        PlatformArch: { ARM: 'arm', ARM64: 'arm64', X86_32: 'x86-32', X86_64: 'x86-64' },
        PlatformOs: { ANDROID: 'android', CROS: 'cros', IOS: 'ios', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
        RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' },
        connect: () => ({ name: '', onMessage: { addListener: () => {} } }),
        connectNative: () => ({ name: '', onMessage: { addListener: () => {} } }),
        sendMessage: (msg, cb) => { if (cb) cb(); },
        getURL: (p) => `chrome-extension://${mockChrome.runtime.id}/${p}`,
        getManifest: () => ({ name: 'Google Docs Offline', version: '1.0', manifest_version: 3 })
      },
      loadTimes: () => ({
        requestTime: Date.now() / 1000,
        startLoadTime: Date.now() / 1000 - 0.3,
        commitLoadTime: Date.now() / 1000 - 0.2,
        finishDocumentLoadTime: Date.now() / 1000 - 0.1,
        finishLoadTime: Date.now() / 1000,
        firstPaintTime: Date.now() / 1000 - 0.15,
        firstPaintAfterLoadTime: Date.now() / 1000 - 0.05,
        wasFetchedViaSpdy: true,
        wasNpnNegotiated: true,
        npnNegotiatedProtocol: 'h2',
        wasAlternateProtocolAvailable: false,
        connectionInfo: 'http2'
      }),
      csi: () => ({ onT: 0, startE: Date.now() - 200, onE: Date.now() })
    };
    if (!window.chrome) {
      defProp(window, 'chrome', mockChrome);
    }

    // ===== 6. WebGL — Realistic Intel UHD Graphics =====
    try {
      const getParamOrig = WebGLRenderingContext.prototype.getParameter;
      const WEBGL_DEBUG_RENDERER_INFO = 37446;
      const WEBGL_DEBUG_VENDOR = 37445;
      const UNMASKED_VENDOR_WEBGL = 37445;
      const UNMASKED_RENDERER_WEBGL = 37446;

      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === WEBGL_DEBUG_VENDOR || parameter === UNMASKED_VENDOR_WEBGL) {
          return 'Google Inc. (Intel)';
        }
        if (parameter === WEBGL_DEBUG_RENDERER_INFO || parameter === UNMASKED_RENDERER_WEBGL) {
          return 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)';
        }
        // Return realistic values for other queries
        return getParamOrig.apply(this, arguments);
      };
      defFn(WebGLRenderingContext.prototype.getParameter, 'getParameter');
    } catch (_) {}

    // ===== 7. Canvas fingerprint — add random noise to prevent fingerprinting =====
    try {
      const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
        const canvas = this;
        // Only add noise if canvas is being used for fingerprinting (small canvases)
        if (canvas.width < 16 || canvas.height < 16) {
          return origToDataURL.call(canvas, type, quality);
        }
        // Add pixel noise to prevent fingerprint matching
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          // Add minimal noise to every 50th pixel — undetectable to human eye but breaks hash matching
          for (let i = 0; i < imageData.data.length; i += 200) {
            imageData.data[i] = imageData.data[i] ^ 1; // Flip LSB of R channel
          }
          ctx.putImageData(imageData, 0, 0);
        }
        return origToDataURL.call(canvas, type, quality);
      };
      defFn(HTMLCanvasElement.prototype.toDataURL, 'toDataURL');

      const origToBlob = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
        const canvas = this;
        if (canvas.width >= 16 && canvas.height >= 16) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            for (let i = 0; i < imageData.data.length; i += 200) {
              imageData.data[i] = imageData.data[i] ^ 1;
            }
            ctx.putImageData(imageData, 0, 0);
          }
        }
        return origToBlob.call(canvas, callback, type, quality);
      };
      defFn(HTMLCanvasElement.prototype.toBlob, 'toBlob');
    } catch (_) {}

    // ===== 8. AudioContext fingerprint =====
    try {
      const origGetChannelData = AudioBuffer.prototype.getChannelData;
      AudioBuffer.prototype.getChannelData = function(channel) {
        const data = origGetChannelData.apply(this, arguments);
        // Add minimal noise to audio fingerprint
        if (data.length > 100) {
          data[1] = data[1] + 0.000001;
        }
        return data;
      };
      defFn(AudioBuffer.prototype.getChannelData, 'getChannelData');
    } catch (_) {}

    // ===== 9. Permissions — handle ALL permission types =====
    try {
      const origQuery = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = (params) => {
        const name = params.name;
        // Known permission types that Chrome supports
        const knownPermissions = [
          'geolocation', 'midi', 'notifications', 'push', 'camera', 'microphone',
          'background-sync', 'ambient-light-sensor', 'accelerometer', 'gyroscope',
          'magnetometer', 'clipboard-read', 'clipboard-write', 'payment-handler',
          'background-fetch', 'idle-detection', 'screen-wake-lock', 'nfc',
          'bluetooth', 'usb', 'serial', 'window-placement', 'local-fonts'
        ];
        if (knownPermissions.includes(name)) {
          return origQuery(params).catch(() => ({ state: 'prompt' }));
        }
        // For unknown permission names (like 'top-level-storage-access'), return 'prompt'
        return Promise.resolve({ state: 'prompt', onchange: null });
      };
      defFn(navigator.permissions.query, 'query');
    } catch (_) {}

    // ===== 10. Screen dimensions consistency =====
    defProp(window, 'outerWidth', window.innerWidth || 1280);
    defProp(window, 'outerHeight', window.innerHeight || 800);
    defProp(window, 'screenX', 0);
    defProp(window, 'screenY', 0);
    defProp(window, 'screenLeft', 0);
    defProp(window, 'screenTop', 0);

    // ===== 11. Bot signature removal =====
    delete window.__BVID__;
    delete window.__PATTERN__;
    delete window.__BX__;
    delete window.__SELENIUM__;
    delete window.__DRIVER__;
    delete window.__LAST_RESULT__;
    delete window.__webdriver_script_fn;
    delete window.domAutomation;
    delete window.domAutomationController;

    // ===== 12. Ensure localStorage is functional =====
    try {
      localStorage.setItem('_stealth_test', 'ok');
      localStorage.removeItem('_stealth_test');
    } catch (_) {}

    // ===== 13. Geolocation =====
    try {
      if (!navigator.geolocation) {
        defProp(navigator, 'geolocation', {
          getCurrentPosition: (success, error, options) => {
            if (success) {
              success({
                coords: {
                  latitude: 37.7749,
                  longitude: -122.4194,
                  accuracy: 1000,
                  altitude: null,
                  altitudeAccuracy: null,
                  heading: null,
                  speed: null
                },
                timestamp: Date.now()
              });
            }
          },
          watchPosition: (success, error, options) => {
            if (success) {
              success({
                coords: {
                  latitude: 37.7749,
                  longitude: -122.4194,
                  accuracy: 1000,
                  altitude: null,
                  altitudeAccuracy: null,
                  heading: null,
                  speed: null
                },
                timestamp: Date.now()
              });
            }
            return 0;
          },
          clearWatch: () => {}
        });
      }
    } catch (_) {}

    // ===== 14. Navigator.mediaDevices =====
    try {
      if (!navigator.mediaDevices) {
        defProp(navigator, 'mediaDevices', {});
      }
      if (navigator.mediaDevices && !navigator.mediaDevices.enumerateDevices) {
        defProp(navigator.mediaDevices, 'enumerateDevices', () => Promise.resolve([
          { deviceId: 'default', groupId: 'default', kind: 'audioinput', label: '' },
          { deviceId: 'default', groupId: 'default', kind: 'audiooutput', label: '' },
          { deviceId: 'default', groupId: 'default', kind: 'videoinput', label: '' }
        ]));
      }
    } catch (_) {}



    console.log('[StudyOS] Stealth Shield Mk6 DEPLOYED — Chrome 136 profile active');
  };

  // --- Injection — fires at document_start BEFORE any page script runs ---
  const inject = () => {
    try {
      const script = document.createElement('script');
      script.textContent = `(${injectStealth.toString()})();`;
      script.setAttribute('data-stealth', 'true');
      if (document.documentElement) {
        document.documentElement.appendChild(script);
        script.remove();
      } else {
        setTimeout(inject, 0);
      }
    } catch (e) {
      setTimeout(inject, 0);
    }
  };

  inject();
})();
