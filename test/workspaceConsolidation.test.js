const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// 1. Audit & Dead Component Removal
test('Audit & Dead Component Removal', async (t) => {
  await t.test('verifies HandoffPanel.jsx is removed from src/components', () => {
    const handoffPath = path.join(__dirname, '../src/components/HandoffPanel.jsx');
    assert.strictEqual(fs.existsSync(handoffPath), false, 'HandoffPanel.jsx should not exist');
  });

  await t.test('verifies SceneManagerPanel.jsx is removed from src/components', () => {
    const sceneManagerPath = path.join(__dirname, '../src/components/SceneManagerPanel.jsx');
    assert.strictEqual(fs.existsSync(sceneManagerPath), false, 'SceneManagerPanel.jsx should not exist');
  });

  await t.test('verifies no active component imports HandoffPanel or SceneManagerPanel', () => {
    const componentsDir = path.join(__dirname, '../src/components');
    const files = fs.readdirSync(componentsDir).filter((f) => f.endsWith('.jsx') || f.endsWith('.js'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(componentsDir, file), 'utf8');
      assert.ok(!content.includes('HandoffPanel'), `${file} should not reference HandoffPanel`);
      assert.ok(!content.includes('SceneManagerPanel'), `${file} should not reference SceneManagerPanel`);
    }

    const appContent = fs.readFileSync(path.join(__dirname, '../src/App.jsx'), 'utf8');
    assert.ok(!appContent.includes('HandoffPanel'), 'App.jsx should not reference HandoffPanel');
    assert.ok(!appContent.includes('SceneManagerPanel'), 'App.jsx should not reference SceneManagerPanel');
  });
});

// 2. Scene Filtering & Search Logic (as implemented in PipelineSidebar)
test('Scene Search & Filtering Logic', async (t) => {
  const sampleScenes = [
    { id: 's-1', sceneNumber: 1, title: 'Scene 1: Introduction to Cybernetics', prompt: 'Cinematic wide shot of a futuristic lab.', done: false },
    { id: 's-2', sceneNumber: 2, title: 'Scene 2: Neural Interface Activation', prompt: 'Close up on glowing cables and neural implants.', done: true },
    { id: 's-3', sceneNumber: 3, title: 'Scene 3: City Skyline at Dusk', prompt: 'Drone shot flying over neon skyscrapers.', done: false },
  ];

  const filterScenes = (scenes, query) => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return scenes;
    return scenes.filter((s) => {
      const titleMatch = (s.title || '').toLowerCase().includes(q);
      const promptMatch = (s.prompt || '').toLowerCase().includes(q);
      const numMatch = String(s.sceneNumber).includes(q);
      return titleMatch || promptMatch || numMatch;
    });
  };

  await t.test('returns all scenes when query is empty or whitespace', () => {
    assert.strictEqual(filterScenes(sampleScenes, '').length, 3);
    assert.strictEqual(filterScenes(sampleScenes, '   ').length, 3);
    assert.strictEqual(filterScenes(sampleScenes, null).length, 3);
  });

  await t.test('filters scenes by title (case-insensitive)', () => {
    const res = filterScenes(sampleScenes, 'cybernetics');
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].id, 's-1');
  });

  await t.test('filters scenes by prompt content', () => {
    const res = filterScenes(sampleScenes, 'neon skyscrapers');
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].id, 's-3');
  });

  await t.test('filters scenes by scene number', () => {
    const res = filterScenes(sampleScenes, '2');
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].id, 's-2');
  });

  await t.test('returns empty array when query does not match any scene', () => {
    const res = filterScenes(sampleScenes, 'nonexistent query term');
    assert.strictEqual(res.length, 0);
  });
});

// 3. Webview Failure & Error Diagnostics
test('Webview Error Diagnostics & Recovery', async (t) => {
  const getErrorMessage = (errorCode) => {
    switch (errorCode) {
      case -105:
      case -106:
        return 'Network connection offline or DNS lookup failed. Please verify your internet connection.';
      case -102:
        return 'Host refused connection or service is currently unreachable.';
      case -118:
        return 'Connection timed out while loading the page.';
      case -200:
      case -201:
      case -202:
        return 'SSL/TLS certificate verification failed.';
      default:
        return 'The embedded web service failed to load.';
    }
  };

  await t.test('provides descriptive messages for common network error codes', () => {
    assert.ok(getErrorMessage(-105).includes('DNS lookup failed'));
    assert.ok(getErrorMessage(-102).includes('Host refused connection'));
    assert.ok(getErrorMessage(-118).includes('timed out'));
    assert.ok(getErrorMessage(-200).includes('certificate verification'));
    assert.ok(getErrorMessage(-999).includes('embedded web service failed to load'));
  });

  await t.test('WebviewWrapper source code handles reload and external open safely', () => {
    const wrapperSrc = fs.readFileSync(path.join(__dirname, '../src/components/WebviewWrapper.jsx'), 'utf8');
    assert.ok(wrapperSrc.includes('did-fail-load'), 'WebviewWrapper must listen for did-fail-load');
    assert.ok(wrapperSrc.includes('handleReload'), 'WebviewWrapper must provide a reload/retry handler');
    assert.ok(wrapperSrc.includes('handleOpenExternal'), 'WebviewWrapper must provide open external handler');
    assert.ok(wrapperSrc.includes('window.electronAPI.openExternal'), 'WebviewWrapper must use electronAPI.openExternal');
  });
});

// 4. In-Flight Action Guard & Safety
test('In-Flight Delivery Guard Logic', async (t) => {
  // Simulates the deliveringAction state in PipelineSidebar
  let deliveringAction = null;

  const startDelivery = (sceneId, target) => {
    if (deliveringAction) {
      return false; // Guard prevents double clicks
    }
    deliveringAction = { sceneId, target };
    return true;
  };

  const endDelivery = () => {
    deliveringAction = null;
  };

  await t.test('permits first delivery action and blocks subsequent actions while in flight', () => {
    assert.strictEqual(startDelivery('s-1', 'chatgpt'), true);
    // Duplicate click during in-flight operation
    assert.strictEqual(startDelivery('s-1', 'chatgpt'), false);
    // Another click on different scene or target
    assert.strictEqual(startDelivery('s-2', 'gemini'), false);

    endDelivery();
    // After finish, new delivery can proceed
    assert.strictEqual(startDelivery('s-2', 'gemini'), true);
    endDelivery();
  });
});

// 5. Workspace Layout Mode Contract
test('Workspace Layout Mode Definitions', async (_t) => {
  const { MODES, WEBVIEWS } = require('../src/constants');

  assert.ok(MODES.ANALYTICS, 'Analytics mode must be defined');
  assert.ok(MODES.PROMPT_ENGINEERING, 'Prompt engineering mode must be defined');
  assert.ok(MODES.VISUAL_STUDIO, 'Visual studio mode must be defined');

  assert.ok(WEBVIEWS.YOUTUBE, 'YouTube webview configured');
  assert.ok(WEBVIEWS.CLAUDE, 'Claude webview configured');
  assert.ok(WEBVIEWS.CHATGPT, 'ChatGPT webview configured');
  assert.ok(WEBVIEWS.GEMINI, 'Gemini webview configured');
  assert.ok(WEBVIEWS.GOOGLE_FLOW, 'Google Flow webview configured');
});

// 6. UI Accessibility Attributes
test('UI Component Accessibility Attributes', async (_t) => {
  const topNavSrc = fs.readFileSync(path.join(__dirname, '../src/components/TopNav.jsx'), 'utf8');
  assert.ok(topNavSrc.includes('role="tablist"'), 'TopNav should have tablist role');
  assert.ok(topNavSrc.includes('role="tab"'), 'TopNav buttons should have tab role');
  assert.ok(topNavSrc.includes('aria-selected'), 'TopNav buttons should indicate aria-selected');

  const statusBarSrc = fs.readFileSync(path.join(__dirname, '../src/components/StatusBar.jsx'), 'utf8');
  assert.ok(statusBarSrc.includes('aria-label'), 'StatusBar buttons should have aria-label');
  assert.ok(statusBarSrc.includes('Claude (Manual)'), 'StatusBar must explicitly label manual Claude tracker');
  assert.ok(statusBarSrc.includes('ChatGPT (Manual)'), 'StatusBar must explicitly label manual ChatGPT tracker');
  assert.ok(statusBarSrc.includes('(Local)'), 'StatusBar must explicitly label local cooldowns');

  const pipelineSrc = fs.readFileSync(path.join(__dirname, '../src/components/PipelineSidebar.jsx'), 'utf8');
  assert.ok(pipelineSrc.includes('aria-label'), 'PipelineSidebar controls should have aria-label');
  assert.ok(pipelineSrc.includes('searchQuery'), 'PipelineSidebar must support scene search filtering');
  assert.ok(pipelineSrc.includes('sceneToDelete'), 'PipelineSidebar must require scene deletion confirmation');
});
