/**
 * Webview DOM Injection Utility for Gemini & Google Flow
 * Provides robust delivery status tracking, readback verification,
 * bounded timeouts, strict listener cleanup, and safe clipboard fallback.
 */

export const DELIVERY_STATUS = {
  INSERTED: 'inserted', // Backwards-compatible status
  COPIED: 'copied',     // Backwards-compatible status
  FAILED: 'failed',     // Backwards-compatible status
  UNKNOWN: 'unknown',   // Backwards-compatible status
  // Extended truthful statuses
  PREPARING: 'preparing',
  VALIDATING: 'validating',
  INSERTED_VERIFIED: 'inserted-verified',
  COPIED_MANUAL: 'copied-manual',
};

// In-flight concurrency lock per webview ID
const inFlightDeliveries = new Set();

/**
 * Copies text to system clipboard.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  if (typeof text !== 'string') return false;
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('[Clipboard] Failed to write text:', err.message);
  }
  return false;
}

/**
 * Injects text into active prompt input of specified webview with real readback verification.
 *
 * @param {string} webviewId - DOM id of the target webview (e.g. 'gemini', 'googleFlow')
 * @param {string} textToInject - Text to insert into input field
 * @param {number} [timeoutMs=4000] - Timeout for DOM execution
 * @returns {Promise<{
 *   status: string,
 *   detailedStatus: string,
 *   verified?: boolean,
 *   method?: string,
 *   error?: string,
 *   reason?: string
 * }>}
 */
export async function injectTextToWebview(webviewId, textToInject, timeoutMs = 4000) {
  // Step 1: Validate input
  if (typeof textToInject !== 'string' || !textToInject.trim()) {
    return {
      status: DELIVERY_STATUS.FAILED,
      detailedStatus: DELIVERY_STATUS.FAILED,
      error: 'Prompt text is empty or invalid.',
      reason: 'Prompt text is empty or invalid.',
    };
  }

  // Step 2: Concurrency guard
  if (inFlightDeliveries.has(webviewId)) {
    return {
      status: DELIVERY_STATUS.FAILED,
      detailedStatus: DELIVERY_STATUS.FAILED,
      error: `Delivery to '${webviewId}' is already in flight.`,
      reason: 'Concurrent delivery prevented by in-flight guard.',
    };
  }

  inFlightDeliveries.add(webviewId);

  try {
    // Step 3: Locate webview in host DOM
    const webview = typeof document !== 'undefined' ? document.getElementById(webviewId) : null;
    if (!webview) {
      const copied = await copyToClipboard(textToInject);
      return {
        status: copied ? DELIVERY_STATUS.COPIED : DELIVERY_STATUS.FAILED,
        detailedStatus: copied ? DELIVERY_STATUS.COPIED_MANUAL : DELIVERY_STATUS.FAILED,
        error: `Webview '${webviewId}' element not found in DOM`,
        reason: copied
          ? 'Webview element not found; prompt copied to clipboard for manual paste'
          : 'Webview missing and clipboard copy failed',
      };
    }

    // Step 4: Verify executeJavaScript availability
    if (typeof webview.executeJavaScript !== 'function') {
      const copied = await copyToClipboard(textToInject);
      return {
        status: copied ? DELIVERY_STATUS.COPIED : DELIVERY_STATUS.FAILED,
        detailedStatus: copied ? DELIVERY_STATUS.COPIED_MANUAL : DELIVERY_STATUS.FAILED,
        error: 'executeJavaScript is not available on webview element',
        reason: copied
          ? 'executeJavaScript unavailable; prompt copied to clipboard for manual paste'
          : 'executeJavaScript unavailable and clipboard copy failed',
      };
    }

    // Step 5: Construct guest script with evidence-based selectors and readback verification
    const injectionScript = `
      (function(text) {
        try {
          // Priority selectors for AI prompt inputs (Google Flow, Gemini, and standard editors)
          const candidates = [
            document.querySelector('div[contenteditable="true"][aria-label*="prompt" i]'),
            document.querySelector('div[contenteditable="true"][data-placeholder*="prompt" i]'),
            document.querySelector('textarea[aria-label*="prompt" i]'),
            document.querySelector('textarea[placeholder*="prompt" i]'),
            document.querySelector('div[contenteditable="true"][role="textbox"]'),
            document.querySelector('div[contenteditable="true"].ql-editor'),
            document.querySelector('rich-textarea div[contenteditable="true"]'),
            document.querySelector('div[contenteditable="true"]'),
            document.querySelector('textarea'),
            document.querySelector('input[type="text"]')
          ].filter(Boolean);

          if (candidates.length === 0) {
            return { injected: false, reason: 'Target prompt input element not found in DOM' };
          }

          // Use the most specific candidate
          const target = candidates[0];
          target.focus();

          if (target.isContentEditable) {
            target.innerText = text;
            target.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            target.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            
            // Readback verification: check if innerText retained the text
            const readback = (target.innerText || '').trim();
            const expected = text.trim();
            if (!readback.includes(expected.slice(0, Math.min(50, expected.length)))) {
              return {
                injected: false,
                verified: false,
                reason: 'Field rejected or overwrote inserted text during readback verification'
              };
            }
          } else {
            target.value = text;
            target.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            target.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            
            // Readback verification: check if value retained the text
            const readback = (target.value || '').trim();
            const expected = text.trim();
            if (!readback.includes(expected.slice(0, Math.min(50, expected.length)))) {
              return {
                injected: false,
                verified: false,
                reason: 'Field rejected or overwrote inserted text during readback verification'
              };
            }
          }

          return { injected: true, verified: true };
        } catch (e) {
          return { injected: false, reason: e.message };
        }
      })(${JSON.stringify(textToInject)});
    `;

    // Step 6: Execute with bounded timeout
    let timerId = null;
    const timeoutPromise = new Promise((_, reject) => {
      timerId = setTimeout(() => reject(new Error('executeJavaScript timed out')), timeoutMs);
    });

    let result;
    try {
      result = await Promise.race([webview.executeJavaScript(injectionScript), timeoutPromise]);
    } finally {
      if (timerId) clearTimeout(timerId);
    }

    // Step 7: Evaluate readback outcome
    if (result && result.injected && result.verified !== false) {
      return {
        status: DELIVERY_STATUS.INSERTED,
        detailedStatus: DELIVERY_STATUS.INSERTED_VERIFIED,
        verified: result.verified !== false,
        method: 'dom-injection',
      };
    }

    // DOM target was missing or failed readback; fallback to clipboard
    const copied = await copyToClipboard(textToInject);
    return {
      status: copied ? DELIVERY_STATUS.COPIED : DELIVERY_STATUS.FAILED,
      detailedStatus: copied ? DELIVERY_STATUS.COPIED_MANUAL : DELIVERY_STATUS.FAILED,
      reason: result?.reason || 'Prompt input could not be verified in webview; copied to clipboard',
    };
  } catch (err) {
    console.warn(`[WebviewInjection ${webviewId}] DOM injection failed:`, err.message);
    const copied = await copyToClipboard(textToInject);
    return {
      status: copied ? DELIVERY_STATUS.COPIED : DELIVERY_STATUS.FAILED,
      detailedStatus: copied ? DELIVERY_STATUS.COPIED_MANUAL : DELIVERY_STATUS.FAILED,
      reason: `DOM injection error: ${err.message}`,
      error: err.message,
    };
  } finally {
    inFlightDeliveries.delete(webviewId);
  }
}

/**
 * Triggers Gemini fresh chat navigation, waits for did-finish-load with bounded wait,
 * and attempts injection with clean fallback and timer cleanup.
 *
 * @param {string} webviewId - Webview ID ('gemini')
 * @param {string} fullPrompt - Combined Global Rules + Scene Prompt
 * @param {number} [timeoutMs=8000]
 * @returns {Promise<{
 *   status: string,
 *   detailedStatus: string,
 *   method?: string,
 *   error?: string,
 *   reason?: string
 * }>}
 */
export async function injectFreshGemini(webviewId, fullPrompt, timeoutMs = 8000) {
  if (typeof fullPrompt !== 'string' || !fullPrompt.trim()) {
    return {
      status: DELIVERY_STATUS.FAILED,
      detailedStatus: DELIVERY_STATUS.FAILED,
      error: 'Prompt text is empty or invalid.',
    };
  }

  const webview = typeof document !== 'undefined' ? document.getElementById(webviewId) : null;
  if (!webview) {
    const copied = await copyToClipboard(fullPrompt);
    return {
      status: copied ? DELIVERY_STATUS.COPIED : DELIVERY_STATUS.FAILED,
      detailedStatus: copied ? DELIVERY_STATUS.COPIED_MANUAL : DELIVERY_STATUS.FAILED,
      error: `Webview '${webviewId}' element not found in DOM`,
    };
  }

  return new Promise((resolve) => {
    let settled = false;
    let finishLoadTimer = null;
    let safetyTimer = null;

    const cleanup = () => {
      if (safetyTimer) {
        clearTimeout(safetyTimer);
        safetyTimer = null;
      }
      if (finishLoadTimer) {
        clearTimeout(finishLoadTimer);
        finishLoadTimer = null;
      }
      if (webview.removeEventListener) {
        webview.removeEventListener('did-finish-load', handleFinishLoad);
        webview.removeEventListener('did-fail-load', handleFailLoad);
      }
    };

    const settle = (result) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const handleFailLoad = async (event) => {
      console.warn('[Webview fresh] did-fail-load event:', event);
      const copied = await copyToClipboard(fullPrompt);
      settle({
        status: copied ? DELIVERY_STATUS.COPIED : DELIVERY_STATUS.FAILED,
        detailedStatus: copied ? DELIVERY_STATUS.COPIED_MANUAL : DELIVERY_STATUS.FAILED,
        error: 'Fresh page navigation failed',
        reason: 'Page failed to load; prompt was copied to clipboard',
      });
    };

    const handleFinishLoad = () => {
      // Allow a brief delay for client-side rendering of input, then attempt insertion
      finishLoadTimer = setTimeout(async () => {
        try {
          const injectResult = await injectTextToWebview(webviewId, fullPrompt, 3000);
          settle(injectResult);
        } catch (err) {
          const copied = await copyToClipboard(fullPrompt);
          settle({
            status: copied ? DELIVERY_STATUS.COPIED : DELIVERY_STATUS.FAILED,
            detailedStatus: copied ? DELIVERY_STATUS.COPIED_MANUAL : DELIVERY_STATUS.FAILED,
            error: err.message,
          });
        }
      }, 800);
    };

    safetyTimer = setTimeout(async () => {
      console.warn('[Webview fresh] Navigation safety timeout reached.');
      const copied = await copyToClipboard(fullPrompt);
      settle({
        status: copied ? DELIVERY_STATUS.COPIED : DELIVERY_STATUS.FAILED,
        detailedStatus: copied ? DELIVERY_STATUS.COPIED_MANUAL : DELIVERY_STATUS.FAILED,
        error: 'Navigation timed out',
        reason: 'Page load timed out; prompt copied to clipboard for manual paste',
      });
    }, timeoutMs);

    try {
      if (webview.addEventListener) {
        webview.addEventListener('did-finish-load', handleFinishLoad);
        webview.addEventListener('did-fail-load', handleFailLoad);
      }
      if (typeof webview.loadURL === 'function') {
        webview.loadURL('https://gemini.google.com/app');
      } else {
        copyToClipboard(fullPrompt).then((copied) => {
          settle({
            status: copied ? DELIVERY_STATUS.COPIED : DELIVERY_STATUS.FAILED,
            detailedStatus: copied ? DELIVERY_STATUS.COPIED_MANUAL : DELIVERY_STATUS.FAILED,
            error: 'webview.loadURL is not a function',
          });
        });
      }
    } catch (err) {
      copyToClipboard(fullPrompt).then((copied) => {
        settle({
          status: copied ? DELIVERY_STATUS.COPIED : DELIVERY_STATUS.FAILED,
          detailedStatus: copied ? DELIVERY_STATUS.COPIED_MANUAL : DELIVERY_STATUS.FAILED,
          error: err.message,
        });
      });
    }
  });
}
