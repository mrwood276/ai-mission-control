const fs = require('fs');

/**
 * Generates an actionable, styled HTML error document to display
 * when production build artifacts are missing.
 *
 * @param {string} distPath - The expected file path to dist/index.html
 * @returns {string} HTML string
 */
function getMissingBuildErrorHtml(distPath) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Build Artifacts Missing — AI Mission Control</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background-color: #090d16;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #f1f5f9;
      box-sizing: border-box;
    }
    .card {
      max-width: 640px;
      margin: 2rem;
      padding: 2.5rem;
      background-color: #0f172a;
      border: 1px solid #334155;
      border-radius: 0.75rem;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.6);
    }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      background-color: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.35);
      border-radius: 9999px;
      margin-bottom: 1.25rem;
    }
    h1 {
      margin: 0 0 1rem 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: #f8fafc;
    }
    p {
      color: #94a3b8;
      line-height: 1.6;
      margin: 0 0 1.25rem 0;
      font-size: 0.95rem;
    }
    .path {
      word-break: break-all;
      background-color: #1e293b;
      padding: 0.35rem 0.6rem;
      border-radius: 0.375rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color: #cbd5e1;
      font-size: 0.85rem;
      display: inline-block;
      margin-top: 0.35rem;
      border: 1px solid #334155;
    }
    .steps {
      background-color: #1e293b;
      border: 1px solid #334155;
      border-radius: 0.5rem;
      padding: 1.25rem;
      margin-bottom: 1.5rem;
    }
    .steps h2 {
      margin: 0 0 0.85rem 0;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #94a3b8;
    }
    .instruction-group {
      margin-bottom: 1rem;
    }
    .instruction-group:last-child {
      margin-bottom: 0;
    }
    .instruction-label {
      font-size: 0.875rem;
      font-weight: 600;
      color: #e2e8f0;
      margin-bottom: 0.35rem;
    }
    pre {
      margin: 0.25rem 0 0 0;
      background-color: #090d16;
      border: 1px solid #334155;
      padding: 0.65rem 0.85rem;
      border-radius: 0.375rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color: #38bdf8;
      font-size: 0.875rem;
      overflow-x: auto;
    }
    .note {
      font-size: 0.8rem;
      color: #64748b;
      line-height: 1.4;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="card" role="alert" aria-live="assertive">
    <div class="badge">Production Startup Error</div>
    <h1>Build Artifacts Missing</h1>
    <p>
      AI Mission Control was started in production mode (<code>npm start</code>), but the compiled web application bundle was not found at:<br>
      <span class="path">${distPath}</span>
    </p>
    <div class="steps">
      <h2>How to Resolve</h2>
      <div class="instruction-group">
        <div class="instruction-label">Option 1: Build production assets and launch</div>
        <pre>npm run build&#10;npm start</pre>
      </div>
      <div class="instruction-group" style="margin-top: 1rem;">
        <div class="instruction-label">Option 2: Run in live development mode</div>
        <pre>npm run dev</pre>
      </div>
    </div>
    <p class="note">
      This diagnostic screen prevents silent blank windows or failed connections to an inactive local development server.
    </p>
  </div>
</body>
</html>`;
}

/**
 * Determines the target URL/file for Electron main window startup.
 *
 * @param {object} options
 * @param {boolean} options.isDev - True if running in development mode
 * @param {string} options.distPath - Absolute path to expected dist/index.html
 * @param {string} [options.devOrigin] - Development server URL (default: http://localhost:5173)
 * @param {function} [options.existsSync] - File existence check function (defaults to fs.existsSync)
 * @returns {{ type: 'url'|'file'|'missing_build_error', target: string, html?: string }}
 */
function resolveStartupTarget({
  isDev,
  distPath,
  devOrigin = 'http://localhost:5173',
  existsSync = fs.existsSync,
}) {
  if (isDev) {
    return {
      type: 'url',
      target: devOrigin,
    };
  }

  if (existsSync(distPath)) {
    return {
      type: 'file',
      target: distPath,
    };
  }

  return {
    type: 'missing_build_error',
    target: distPath,
    html: getMissingBuildErrorHtml(distPath),
  };
}

module.exports = {
  getMissingBuildErrorHtml,
  resolveStartupTarget,
};
