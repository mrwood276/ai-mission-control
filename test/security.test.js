const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  validateExternalUrl,
  isDomainAllowed,
  isTrustedSender,
  isAllowedPermission,
  ALLOWED_SERVICE_DOMAINS,
  ALLOWED_MEDIA_DOMAINS,
  MAX_URL_LENGTH,
} = require('../electron/security');

test('Security Module - Domain Allowlist Checker', async (t) => {
  await t.test('allows exact domain matches', () => {
    assert.strictEqual(isDomainAllowed('google.com', ALLOWED_SERVICE_DOMAINS), true);
    assert.strictEqual(isDomainAllowed('claude.ai', ALLOWED_SERVICE_DOMAINS), true);
    assert.strictEqual(isDomainAllowed('chatgpt.com', ALLOWED_SERVICE_DOMAINS), true);
    assert.ok(ALLOWED_MEDIA_DOMAINS.includes('gemini.google.com'));
  });

  await t.test('allows valid subdomains of allowed services', () => {
    assert.strictEqual(isDomainAllowed('studio.youtube.com', ALLOWED_SERVICE_DOMAINS), true);
    assert.strictEqual(isDomainAllowed('gemini.google.com', ALLOWED_SERVICE_DOMAINS), true);
    assert.strictEqual(isDomainAllowed('sub.sub.labs.google', ALLOWED_SERVICE_DOMAINS), true);
  });

  await t.test('rejects unauthorized or lookalike domains', () => {
    assert.strictEqual(isDomainAllowed('evil-google.com', ALLOWED_SERVICE_DOMAINS), false);
    assert.strictEqual(isDomainAllowed('google.com.attacker.com', ALLOWED_SERVICE_DOMAINS), false);
    assert.strictEqual(isDomainAllowed('claude.ai.phishing.net', ALLOWED_SERVICE_DOMAINS), false);
    assert.strictEqual(isDomainAllowed('localhost.evil.com', ALLOWED_SERVICE_DOMAINS), false);
    assert.strictEqual(isDomainAllowed('', ALLOWED_SERVICE_DOMAINS), false);
    assert.strictEqual(isDomainAllowed(null, ALLOWED_SERVICE_DOMAINS), false);
  });
});

test('Security Module - External URL Validation', async (t) => {
  await t.test('rejects non-string or empty inputs', () => {
    assert.strictEqual(validateExternalUrl(null).ok, false);
    assert.strictEqual(validateExternalUrl(undefined).ok, false);
    assert.strictEqual(validateExternalUrl(12345).ok, false);
    assert.strictEqual(validateExternalUrl({}).ok, false);
    assert.strictEqual(validateExternalUrl('').ok, false);
    assert.strictEqual(validateExternalUrl('   ').ok, false);
  });

  await t.test('rejects URLs exceeding max length', () => {
    const longUrl = 'https://google.com/' + 'a'.repeat(MAX_URL_LENGTH + 1);
    const res = validateExternalUrl(longUrl);
    assert.strictEqual(res.ok, false);
    assert.match(res.error, /exceeds maximum length/i);
  });

  await t.test('rejects malformed URLs', () => {
    const res = validateExternalUrl('http:///malformed domain');
    assert.strictEqual(res.ok, false);
  });

  await t.test('rejects dangerous and non-http(s) protocols', () => {
    const dangerousUrls = [
      'javascript:alert(document.cookie)',
      'file:///C:/Windows/System32/calc.exe',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox("test")',
      'blob:https://example.com/uuid',
      'shell:personal',
      'powershell:Start-Process',
    ];

    for (const url of dangerousUrls) {
      const res = validateExternalUrl(url);
      assert.strictEqual(res.ok, false, `Expected ${url} to be rejected`);
      assert.match(res.error, /protocol/i);
    }
  });

  await t.test('rejects URLs with embedded credentials', () => {
    const res = validateExternalUrl('https://admin:secretpass@google.com/search');
    assert.strictEqual(res.ok, false);
    assert.match(res.error, /credentials/i);
  });

  await t.test('allows legitimate service destinations', () => {
    const validUrls = [
      'https://studio.youtube.com',
      'https://youtube.com/watch?v=dQw4w9WgXcQ',
      'https://claude.ai/chat',
      'https://chatgpt.com',
      'https://gemini.google.com/app',
      'https://labs.google/fx/tools/flow',
    ];

    for (const url of validUrls) {
      const res = validateExternalUrl(url);
      assert.strictEqual(res.ok, true, `Expected ${url} to be valid`);
      assert.ok(res.url);
    }
  });

  await t.test('rejects destinations outside the allowlist', () => {
    const disallowed = [
      'https://malicious-site.com',
      'https://pastebin.com/raw/secret',
      'https://attacker-domain.org',
    ];

    for (const url of disallowed) {
      const res = validateExternalUrl(url);
      assert.strictEqual(res.ok, false, `Expected ${url} to be rejected`);
      assert.match(res.error, /not permitted/i);
    }
  });
});

test('Security Module - IPC Sender Verification', async (t) => {
  await t.test('validates sender matching main window webContents', () => {
    const trusted = { id: 1, isDestroyed: () => false };
    const validSender = { id: 1, isDestroyed: () => false };
    const invalidSender = { id: 99, isDestroyed: () => false };

    assert.strictEqual(isTrustedSender(validSender, trusted), true);
    assert.strictEqual(isTrustedSender(invalidSender, trusted), false);
  });

  await t.test('rejects null or destroyed webContents', () => {
    const trusted = { id: 1, isDestroyed: () => false };
    const destroyedSender = { id: 1, isDestroyed: () => true };

    assert.strictEqual(isTrustedSender(null, trusted), false);
    assert.strictEqual(isTrustedSender(destroyedSender, trusted), false);
    assert.strictEqual(isTrustedSender({ id: 1, isDestroyed: () => false }, null), false);
  });
});

test('Security Module - Least-Privilege Permissions', async (t) => {
  await t.test('permits safe write-only clipboard and fullscreen', () => {
    assert.strictEqual(isAllowedPermission('clipboard-sanitized-write'), true);
    assert.strictEqual(isAllowedPermission('fullscreen'), true);
  });

  await t.test('restricts media permissions to allowed AI voice dictation origins', () => {
    assert.strictEqual(
      isAllowedPermission('media', 'https://gemini.google.com/app'),
      true
    );
    assert.strictEqual(
      isAllowedPermission('media', 'https://chatgpt.com/chat'),
      true
    );
    assert.strictEqual(
      isAllowedPermission('media', 'https://evil.com/listen'),
      false
    );
    assert.strictEqual(
      isAllowedPermission('media', 'javascript:alert(1)'),
      false
    );
  });

  await t.test('strictly denies broad, sensitive permissions', () => {
    const deniedPermissions = [
      'clipboard-read',
      'geolocation',
      'notifications',
      'display-capture',
      'pointerLock',
      'midi',
      'openExternal',
    ];

    for (const perm of deniedPermissions) {
      assert.strictEqual(
        isAllowedPermission(perm, 'https://gemini.google.com'),
        false,
        `Expected ${perm} to be denied`
      );
    }
  });
});

test('Acceptance Criteria - Dead Code & Stealth Removal', async (t) => {
  await t.test('verifies preload-stealth.js is removed from repo', () => {
    const stealthPath = path.join(__dirname, '../electron/preload-stealth.js');
    assert.strictEqual(fs.existsSync(stealthPath), false);
  });

  await t.test('verifies CookieImportModal.jsx is removed from repo', () => {
    const modalPath = path.join(__dirname, '../src/components/CookieImportModal.jsx');
    assert.strictEqual(fs.existsSync(modalPath), false);
  });

  await t.test('verifies electron/preload.js does not expose unsafe methods', () => {
    const preloadContent = fs.readFileSync(path.join(__dirname, '../electron/preload.js'), 'utf8');
    assert.strictEqual(preloadContent.includes('importCookies'), false);
    assert.strictEqual(preloadContent.includes('stealthPreloadUrl'), false);
    assert.strictEqual(preloadContent.includes('checkGoogleAuth'), false);
    assert.strictEqual(preloadContent.includes('openGoogleLogin'), false);
  });

  await t.test('verifies electron/main.js does not contain spoofing or cookie handlers', () => {
    const mainContent = fs.readFileSync(path.join(__dirname, '../electron/main.js'), 'utf8');
    assert.strictEqual(mainContent.includes('AutomationControlled'), false);
    assert.strictEqual(mainContent.includes('import-cookies'), false);
    assert.strictEqual(mainContent.includes('check-google-auth'), false);
    assert.strictEqual(mainContent.includes('open-google-login'), false);
    assert.strictEqual(mainContent.includes('preload-stealth'), false);
  });

  await t.test('verifies src/constants.js does not contain user agent spoofing', () => {
    const constantsContent = fs.readFileSync(path.join(__dirname, '../src/constants.js'), 'utf8');
    assert.strictEqual(constantsContent.includes('CHROME_USER_AGENT'), false);
    assert.strictEqual(constantsContent.includes('replace(/Electron/'), false);
  });
});
