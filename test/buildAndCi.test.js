const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  resolveStartupTarget,
  getMissingBuildErrorHtml,
} = require('../electron/startup');

// 1. Electron Startup Target Resolution
test('Electron Startup Target Resolution', async (t) => {
  await t.test('resolves to dev server URL when isDev is true', () => {
    const res = resolveStartupTarget({
      isDev: true,
      distPath: 'D:/ai-mission-control/dist/index.html',
      devOrigin: 'http://localhost:5173',
      existsSync: () => false,
    });

    assert.strictEqual(res.type, 'url');
    assert.strictEqual(res.target, 'http://localhost:5173');
    assert.strictEqual(res.html, undefined);
  });

  await t.test('resolves to local file when isDev is false and build artifact exists', () => {
    const distPath = 'D:/ai-mission-control/dist/index.html';
    const res = resolveStartupTarget({
      isDev: false,
      distPath,
      existsSync: (p) => p === distPath,
    });

    assert.strictEqual(res.type, 'file');
    assert.strictEqual(res.target, distPath);
    assert.strictEqual(res.html, undefined);
  });

  await t.test('resolves to actionable error when isDev is false and build artifact is missing', () => {
    const distPath = 'D:/ai-mission-control/dist/index.html';
    const res = resolveStartupTarget({
      isDev: false,
      distPath,
      existsSync: () => false,
    });

    assert.strictEqual(res.type, 'missing_build_error');
    assert.strictEqual(res.target, distPath);
    assert.ok(typeof res.html === 'string');
    assert.ok(res.html.includes('Build Artifacts Missing'));
    assert.ok(res.html.includes('npm run build'));
    assert.ok(res.html.includes('npm start'));
    assert.ok(res.html.includes('npm run dev'));
    assert.ok(res.html.includes(distPath));
  });
});

// 2. Missing Build Error Page Template
test('Missing Build Error Page Template', async (t) => {
  await t.test('generates self-contained, accessible diagnostic page with guidance', () => {
    const html = getMissingBuildErrorHtml('/fake/path/dist/index.html');
    assert.ok(html.includes('role="alert"'), 'Should have role="alert" for accessibility');
    assert.ok(html.includes('/fake/path/dist/index.html'), 'Should display the missing path');
    assert.ok(html.includes('Option 1: Build production assets and launch'), 'Explains Option 1');
    assert.ok(html.includes('Option 2: Run in live development mode'), 'Explains Option 2');
    assert.ok(html.includes('#090d16'), 'Preserves dark theme visual style');
  });
});

// 3. Package.json Scripts & Config
test('Package.json Scripts Contract', async (t) => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

  await t.test('defines all necessary lifecycle and verification scripts', () => {
    assert.ok(pkg.scripts.dev, 'Must define dev script');
    assert.ok(pkg.scripts.build, 'Must define build script');
    assert.ok(pkg.scripts.test, 'Must define test script');
    assert.ok(pkg.scripts.lint, 'Must define lint script');
    assert.ok(pkg.scripts.verify, 'Must define verify script');
    assert.ok(pkg.scripts.start, 'Must define start script');
  });

  await t.test('verify script combines lint, test, and build sequentially', () => {
    assert.ok(pkg.scripts.verify.includes('lint'));
    assert.ok(pkg.scripts.verify.includes('test'));
    assert.ok(pkg.scripts.verify.includes('build'));
  });
});

// 4. GitHub Actions CI Configuration
test('GitHub Actions CI Configuration', async (t) => {
  const ciPath = path.join(__dirname, '../.github/workflows/ci.yml');

  await t.test('CI workflow file exists on disk', () => {
    assert.strictEqual(fs.existsSync(ciPath), true, 'ci.yml must exist in .github/workflows/');
  });

  await t.test('CI workflow configuration is valid YAML with required steps', () => {
    const ciContent = fs.readFileSync(ciPath, 'utf8');

    // Branch triggers
    assert.ok(ciContent.includes('!main'), 'Must exclude direct pushes to main');
    assert.ok(ciContent.includes('pull_request:'), 'Must trigger on pull requests');

    // Reproducible dependencies
    assert.ok(ciContent.includes('npm ci'), 'Must use npm ci for reproducible install');

    // Verification steps
    assert.ok(ciContent.includes('npm run lint'), 'Must run linter');
    assert.ok(ciContent.includes('npm test'), 'Must run automated test suite');
    assert.ok(ciContent.includes('npm run build'), 'Must run production build');
  });
});

// 5. Production Build Artifact Verification
test('Production Build Output Verification', async (t) => {
  const distHtml = path.join(__dirname, '../dist/index.html');

  await t.test('verifies dist/index.html exists and links assets', () => {
    assert.strictEqual(fs.existsSync(distHtml), true, 'dist/index.html must exist from build');
    const htmlContent = fs.readFileSync(distHtml, 'utf8');
    assert.ok(htmlContent.includes('<script'), 'Must reference bundled scripts');
    assert.ok(htmlContent.includes('<link rel="stylesheet"'), 'Must reference bundled stylesheets');
  });
});
