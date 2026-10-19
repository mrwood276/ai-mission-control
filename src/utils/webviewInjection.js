/**
 * Webview DOM Injection Utility for Gemini & Google Flow
 * Injects prompt text directly into webview DOM inputs with instant clipboard fallback.
 */

export async function copyToClipboard(text) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('[Clipboard] Failed to copy text:', err);
  }
  return false;
}

/**
 * Injects text into active prompt input of specified webview.
 * @param {string} webviewId - DOM id of the target webview (e.g. 'gemini', 'googleFlow')
 * @param {string} textToInject - Text to insert into input field
 * @returns {Promise<{ success: boolean, method: string, error?: string }>}
 */
export async function injectTextToWebview(webviewId, textToInject) {
  // Always copy to clipboard as 100% reliable fallback
  await copyToClipboard(textToInject);

  const webview = document.getElementById(webviewId);
  if (!webview) {
    return {
      success: true,
      method: 'clipboard-fallback',
      error: `Webview '${webviewId}' element not found in DOM`,
    };
  }

  // Code to execute inside webview guest page
  const injectionCode = `
    (function(text) {
      try {
        // Find prompt input candidates for Gemini or Flow
        const target = 
          document.querySelector('div[contenteditable="true"][role="textbox"]') ||
          document.querySelector('div[contenteditable="true"].ql-editor') ||
          document.querySelector('rich-textarea div[contenteditable="true"]') ||
          document.querySelector('div[contenteditable="true"]') ||
          document.querySelector('textarea') ||
          document.querySelector('input[type="text"]');

        if (!target) {
          return { injected: false, reason: 'Target prompt input element not found' };
        }

        target.focus();

        if (target.isContentEditable) {
          // Contenteditable (Gemini)
          target.innerText = text;
          target.dispatchEvent(new Event('input', { bubbles: true }));
          target.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          // Standard textarea or input
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
    if (typeof webview.executeJavaScript === 'function') {
      const result = await webview.executeJavaScript(injectionCode);
      if (result && result.injected) {
        return { success: true, method: 'dom-injection' };
      }
    }
  } catch (err) {
    console.warn(`[WebviewInjection ${webviewId}] executeJavaScript error:`, err);
  }

  return { success: true, method: 'clipboard-fallback' };
}

/**
 * Triggers Gemini fresh chat navigation, waits for did-finish-load, and injects combined prompt.
 * @param {string} webviewId - Webview ID ('gemini')
 * @param {string} fullPrompt - Combined Global Rules + Scene Prompt
 * @returns {Promise<{ success: boolean, method: string }>}
 */
export async function injectFreshGemini(webviewId, fullPrompt) {
  // Always copy to clipboard immediately as instant fallback
  await copyToClipboard(fullPrompt);

  const webview = document.getElementById(webviewId);
  if (!webview) {
    return { success: true, method: 'clipboard-fallback' };
  }

  return new Promise((resolve) => {
    let resolved = false;

    const cleanup = () => {
      if (webview.removeEventListener) {
        webview.removeEventListener('did-finish-load', handleFinishLoad);
      }
    };

    const handleFinishLoad = async () => {
      if (resolved) return;
      cleanup();

      // Wait a short delay for React / Angular prompt input to mount on fresh page
      setTimeout(async () => {
        const res = await injectTextToWebview(webviewId, fullPrompt);
        resolved = true;
        resolve(res);
      }, 900);
    };

    // Safety timeout: if page load takes too long, resolve with clipboard fallback
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve({ success: true, method: 'clipboard-fallback' });
      }
    }, 10000);

    try {
      webview.addEventListener('did-finish-load', handleFinishLoad);
      webview.loadURL('https://gemini.google.com/app');
    } catch (err) {
      clearTimeout(timer);
      cleanup();
      resolve({ success: true, method: 'clipboard-fallback' });
    }
  });
}
