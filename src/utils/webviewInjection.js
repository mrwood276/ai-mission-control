/**
 * Webview DOM Injection Utility for Gemini & Google Flow
 * Provides robust delivery status tracking, bounded timeouts, and strict listener cleanup.
 */

export const DELIVERY_STATUS = {
  INSERTED: 'inserted', // Input was located and populated in the webview DOM
  COPIED: 'copied',     // Input could not be populated directly; copied to clipboard as fallback
  FAILED: 'failed',     // Neither DOM insertion nor clipboard copy succeeded
  UNKNOWN: 'unknown',   // Outcome could not be verified
};

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
 * Injects text into active prompt input of specified webview.
 * @param {string} webviewId - DOM id of the target webview (e.g. 'gemini', 'googleFlow')
 * @param {string} textToInject - Text to insert into input field
 * @param {number} [timeoutMs=4000] - Timeout for DOM execution
 * @returns {Promise<{ status: string, method?: string, error?: string, reason?: string }>}
 */
export async function injectTextToWebview(webviewId, textToInject, timeoutMs = 4000) {
  if (typeof textToInject !== 'string' || !textToInject.trim()) {
    return {
      status: DELIVERY_STATUS.FAILED,
      error: 'Prompt text is empty or invalid.',
    };
  }

  const webview = typeof document !== 'undefined' ? document.getElementById(webviewId) : null;
  if (!webview) {
    const copied = await copyToClipboard(textToInject);
    return {
      status: copied ? DELIVERY_STATUS.COPIED : DELIVERY_STATUS.FAILED,
      error: `Webview '${webviewId}' element not found in DOM`,
      reason: copied ? 'Webview element not found; prompt copied to clipboard' : 'Webview missing and clipboard copy failed',
    };
  }

  // Script to execute inside webview guest page
  const injectionScript = `
    (function(text) {
      try {
        const target = 
          document.querySelector('div[contenteditable="true"][role="textbox"]') ||
          document.querySelector('div[contenteditable="true"].ql-editor') ||
          document.querySelector('rich-textarea div[contenteditable="true"]') ||
          document.querySelector('div[contenteditable="true"]') ||
          document.querySelector('textarea') ||
          document.querySelector('input[type="text"]');

        if (!target) {
          return { injected: false, reason: 'Target prompt input element not found in DOM' };
        }

        target.focus();

        if (target.isContentEditable) {
          target.innerText = text;
          target.dispatchEvent(new Event('input', { bubbles: true }));
          target.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          target.value = text;
          target.dispatchEvent(new Event('input', { bubbles: true }));
          target.dispatchEvent(new Event('change', { bubbles: true }));
        }

        return { injected: true };
      } catch (e) {
        return { injected: false, reason: e.message };
      }
    })(${JSON.stringify(textToInject)});
  `;

  try {
    if (typeof webview.executeJavaScript !== 'function') {
      const copied = await copyToClipboard(textToInject);
      return {
        status: copied ? DELIVERY_STATUS.COPIED : DELIVERY_STATUS.FAILED,
        reason: 'executeJavaScript is not available on webview element',
      };
    }

    // Execute with a bounded timeout
    const result = await Promise.race([
      webview.executeJavaScript(injectionScript),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('executeJavaScript timed out')), timeoutMs)
      ),
    ]);

    if (result && result.injected) {
      return {
        status: DELIVERY_STATUS.INSERTED,
        method: 'dom-injection',
      };
    }

    // DOM target was not found in guest page; fallback to clipboard
    const copied = await copyToClipboard(textToInject);
    return {
      status: copied ? DELIVERY_STATUS.COPIED : DELIVERY_STATUS.FAILED,
      reason: result?.reason || 'Prompt input element could not be located in webview',
    };
  } catch (err) {
    console.warn(`[WebviewInjection ${webviewId}] DOM injection failed:`, err.message);
    const copied = await copyToClipboard(textToInject);
    return {
      status: copied ? DELIVERY_STATUS.COPIED : DELIVERY_STATUS.FAILED,
      reason: `DOM injection error: ${err.message}`,
      error: err.message,
    };
  }
}

/**
 * Triggers Gemini fresh chat navigation, waits for did-finish-load with bounded wait,
 * and attempts injection with clean fallback and timer cleanup.
 * @param {string} webviewId - Webview ID ('gemini')
 * @param {string} fullPrompt - Combined Global Rules + Scene Prompt
 * @param {number} [timeoutMs=8000]
 * @returns {Promise<{ status: string, method?: string, error?: string, reason?: string }>}
 */
export async function injectFreshGemini(webviewId, fullPrompt, timeoutMs = 8000) {
  if (typeof fullPrompt !== 'string' || !fullPrompt.trim()) {
    return {
      status: DELIVERY_STATUS.FAILED,
      error: 'Prompt text is empty or invalid.',
    };
  }

  const webview = typeof document !== 'undefined' ? document.getElementById(webviewId) : null;
  if (!webview) {
    const copied = await copyToClipboard(fullPrompt);
    return {
      status: copied ? DELIVERY_STATUS.COPIED : DELIVERY_STATUS.FAILED,
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
            error: 'webview.loadURL is not a function',
          });
        });
      }
    } catch (err) {
      copyToClipboard(fullPrompt).then((copied) => {
        settle({
          status: copied ? DELIVERY_STATUS.COPIED : DELIVERY_STATUS.FAILED,
          error: err.message,
        });
      });
    }
  });
}
