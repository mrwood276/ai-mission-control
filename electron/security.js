/**
 * Security policy and validation helpers for AI Mission Control.
 * Enforces origin validation, least-privilege permissions, and safe external navigation.
 */

// Allowlist of trusted domains for external navigation and service webviews
const ALLOWED_SERVICE_DOMAINS = [
  'youtube.com',
  'google.com',
  'claude.ai',
  'anthropic.com',
  'chatgpt.com',
  'openai.com',
  'labs.google',
  'tiktok.com',
];

// Domains permitted for microphone / media input (e.g. voice dictation in chat)
const ALLOWED_MEDIA_DOMAINS = [
  'gemini.google.com',
  'chatgpt.com',
  'studio.youtube.com',
];

const MAX_URL_LENGTH = 2048;

/**
 * Checks if a hostname matches an allowed base domain or its subdomains.
 * @param {string} hostname
 * @param {string[]} domainList
 * @returns {boolean}
 */
function isDomainAllowed(hostname, domainList) {
  if (!hostname || typeof hostname !== 'string') return false;
  const lowerHost = hostname.toLowerCase();
  return domainList.some((domain) => {
    const lowerDomain = domain.toLowerCase();
    return lowerHost === lowerDomain || lowerHost.endsWith('.' + lowerDomain);
  });
}

/**
 * Validates whether a target URL is safe for external browser opening.
 * @param {string} rawUrl
 * @returns {{ ok: boolean, error?: string, url?: string }}
 */
function validateExternalUrl(rawUrl) {
  if (typeof rawUrl !== 'string') {
    return { ok: false, error: 'URL must be a string' };
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { ok: false, error: 'URL cannot be empty' };
  }

  if (trimmed.length > MAX_URL_LENGTH) {
    return { ok: false, error: `URL exceeds maximum length of ${MAX_URL_LENGTH} characters` };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: 'Malformed URL' };
  }

  // Strictly enforce http/https protocols (no javascript:, file:, data:, blob:, custom schemes)
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, error: `Disallowed protocol: ${parsed.protocol}` };
  }

  // Reject URLs containing userinfo (credentials)
  if (parsed.username || parsed.password) {
    return { ok: false, error: 'URLs with embedded credentials are not allowed' };
  }

  // Require domain to match our explicit allowlist
  if (!isDomainAllowed(parsed.hostname, ALLOWED_SERVICE_DOMAINS)) {
    return { ok: false, error: `Destination domain is not permitted: ${parsed.hostname}` };
  }

  return { ok: true, url: parsed.toString() };
}

/**
 * Verifies that an IPC sender originated from our trusted mainWindow.
 * @param {Electron.WebContents} senderWebContents
 * @param {Electron.WebContents} trustedWebContents
 * @returns {boolean}
 */
function isTrustedSender(senderWebContents, trustedWebContents) {
  if (!senderWebContents || !trustedWebContents) return false;
  if (senderWebContents.isDestroyed() || trustedWebContents.isDestroyed()) return false;
  return senderWebContents.id === trustedWebContents.id;
}

/**
 * Least-privilege permission evaluator.
 * Evaluates whether a requested permission should be granted to a specific origin.
 * @param {string} permission
 * @param {string} requestingUrl
 * @returns {boolean}
 */
function isAllowedPermission(permission, requestingUrl = '') {
  // Safe write-only clipboard operations
  if (permission === 'clipboard-sanitized-write') {
    return true;
  }

  // Fullscreen for video / display expand
  if (permission === 'fullscreen') {
    return true;
  }

  // Parse requesting origin for sensitive permissions
  let hostname = '';
  try {
    if (requestingUrl) {
      hostname = new URL(requestingUrl).hostname;
    }
  } catch {
    return false;
  }

  // Media (microphone for voice prompts) restricted to approved domains
  if (permission === 'media') {
    return isDomainAllowed(hostname, ALLOWED_MEDIA_DOMAINS);
  }

  // Deny all other permissions by default (geolocation, clipboard-read, notifications, etc.)
  return false;
}

module.exports = {
  ALLOWED_SERVICE_DOMAINS,
  ALLOWED_MEDIA_DOMAINS,
  MAX_URL_LENGTH,
  isDomainAllowed,
  validateExternalUrl,
  isTrustedSender,
  isAllowedPermission,
};
