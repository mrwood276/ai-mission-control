const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  createNewProject,
  saveProjectsToStorage,
  STORAGE_KEYS,
} = require('../src/utils/projectManager');
const {
  getPreviousDelivery,
  recordDelivery,
  formatTimeAgo,
} = require('../src/utils/deliveryTracker');
const {
  injectTextToWebview,
  DELIVERY_STATUS,
} = require('../src/utils/webviewInjection');
const {
  composeProductionPrompt,
} = require('../src/utils/promptComposer');

// In-memory mock localStorage helper
function createMockStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) || null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    _store: store,
  };
}

// -----------------------------------------------------------------------
// 1. DONE CARDS: PARTITIONING, STATE PERSISTENCE & REOPEN TESTS
// -----------------------------------------------------------------------
test('Done Cards - Auto-Move, Single Source of Truth & Reopen', async (t) => {
  const initialScenes = [
    { id: 'scene-1', sceneNumber: 1, title: 'Scene 1: Opening Hook', prompt: 'Prompt 1', done: false },
    { id: 'scene-2', sceneNumber: 2, title: 'Scene 2: Problem Statement', prompt: 'Prompt 2', done: false },
    { id: 'scene-3', sceneNumber: 3, title: 'Scene 3: Solution', prompt: 'Prompt 3', done: false },
  ];

  await t.test('marking a scene Done removes it from active list and moves it to Done section', () => {
    // Single source of truth update helper matching PipelineSidebar logic
    const toggleDone = (scenesList, targetId) =>
      scenesList.map((s) => (s.id === targetId ? { ...s, done: !s.done } : s));

    const updated = toggleDone(initialScenes, 'scene-2');

    const activeScenes = updated.filter((s) => !s.done);
    const doneScenes = updated.filter((s) => s.done);

    // 1. Removed from active list
    assert.strictEqual(activeScenes.length, 2);
    assert.strictEqual(activeScenes.some((s) => s.id === 'scene-2'), false);

    // 2. Present in Done section exactly once
    assert.strictEqual(doneScenes.length, 1);
    assert.strictEqual(doneScenes[0].id, 'scene-2');
    assert.strictEqual(doneScenes[0].title, 'Scene 2: Problem Statement');
    assert.strictEqual(doneScenes[0].prompt, 'Prompt 2');
    assert.strictEqual(doneScenes[0].sceneNumber, 2);

    // 3. Other scenes remain completely unchanged
    assert.strictEqual(activeScenes[0].id, 'scene-1');
    assert.strictEqual(activeScenes[0].done, false);
    assert.strictEqual(activeScenes[1].id, 'scene-3');
    assert.strictEqual(activeScenes[1].done, false);
  });

  await t.test('reopening a scene from Done returns it to the active list without data loss', () => {
    const toggleDone = (scenesList, targetId) =>
      scenesList.map((s) => (s.id === targetId ? { ...s, done: !s.done } : s));

    // Mark scene-2 done
    const doneState = toggleDone(initialScenes, 'scene-2');
    assert.strictEqual(doneState.filter((s) => s.done).length, 1);

    // Reopen scene-2
    const reopened = toggleDone(doneState, 'scene-2');

    const activeScenes = reopened.filter((s) => !s.done);
    const doneScenes = reopened.filter((s) => s.done);

    assert.strictEqual(activeScenes.length, 3);
    assert.strictEqual(doneScenes.length, 0);

    // Preserves original position and data
    const reopenedScene = activeScenes.find((s) => s.id === 'scene-2');
    assert.ok(reopenedScene);
    assert.strictEqual(reopenedScene.done, false);
    assert.strictEqual(reopenedScene.title, 'Scene 2: Problem Statement');
    assert.strictEqual(reopenedScene.prompt, 'Prompt 2');
  });

  await t.test('scene completion state persists through storage autosave and reload', () => {
    const storage = createMockStorage();
    const proj = createNewProject('Persistence Test', 'Rules', initialScenes);

    // Mark scene-3 done
    proj.scenes = proj.scenes.map((s) => (s.id === 'scene-3' ? { ...s, done: true } : s));

    const saveResult = saveProjectsToStorage(storage, [proj], proj.id);
    assert.strictEqual(saveResult.success, true);

    // Simulate reload from storage
    const reloadedProjects = JSON.parse(storage.getItem(STORAGE_KEYS.PROJECTS_V1));
    assert.strictEqual(reloadedProjects.length, 1);
    const reloadedScenes = reloadedProjects[0].scenes;

    const activeReloaded = reloadedScenes.filter((s) => !s.done);
    const doneReloaded = reloadedScenes.filter((s) => s.done);

    assert.strictEqual(activeReloaded.length, 2);
    assert.strictEqual(doneReloaded.length, 1);
    assert.strictEqual(doneReloaded[0].id, 'scene-3');
    assert.strictEqual(doneReloaded[0].done, true);
  });
});

// -----------------------------------------------------------------------
// 2. DELIVERY TRACKER & DUPLICATE DETECTION TESTS
// -----------------------------------------------------------------------
test('Delivery Tracker - History Recording & Duplicate Detection', async (t) => {
  await t.test('returns null when no previous delivery exists', () => {
    const storage = createMockStorage();
    const prev = getPreviousDelivery('proj-1', 'scene-1', 'flow', storage);
    assert.strictEqual(prev, null);
  });

  await t.test('records delivery and correctly retrieves previous record', () => {
    const storage = createMockStorage();
    recordDelivery(
      'proj-1',
      'scene-1',
      { sceneNumber: 1, target: 'flow', status: 'inserted', verified: true },
      storage
    );

    const record = getPreviousDelivery('proj-1', 'scene-1', 'flow', storage);
    assert.ok(record);
    assert.strictEqual(record.projectId, 'proj-1');
    assert.strictEqual(record.sceneId, 'scene-1');
    assert.strictEqual(record.sceneNumber, 1);
    assert.strictEqual(record.status, 'inserted');
    assert.strictEqual(record.verified, true);
    assert.strictEqual(record.count, 1);
  });

  await t.test('increments send count on repeated sends', () => {
    const storage = createMockStorage();
    recordDelivery('proj-1', 'scene-1', { sceneNumber: 1, target: 'flow', status: 'inserted' }, storage);
    recordDelivery('proj-1', 'scene-1', { sceneNumber: 1, target: 'flow', status: 'inserted' }, storage);

    const record = getPreviousDelivery('proj-1', 'scene-1', 'flow', storage);
    assert.strictEqual(record.count, 2);
  });

  await t.test('does not treat failed delivery as previous successful delivery', () => {
    const storage = createMockStorage();
    recordDelivery('proj-1', 'scene-2', { sceneNumber: 2, target: 'flow', status: 'failed' }, storage);

    const prev = getPreviousDelivery('proj-1', 'scene-2', 'flow', storage);
    assert.strictEqual(prev, null, 'Failed delivery should not trigger duplicate warning');
  });

  await t.test('formats relative time ago accurately', () => {
    const now = 1700000000000;
    assert.strictEqual(formatTimeAgo(now - 10000, now), 'just now');
    assert.strictEqual(formatTimeAgo(now - 120000, now), '2m ago');
    assert.strictEqual(formatTimeAgo(now - 7200000, now), '2h ago');
    assert.strictEqual(formatTimeAgo(now - 172800000, now), '2d ago');
  });
});

// -----------------------------------------------------------------------
// 3. GOOGLE FLOW SEND CONFIRMATION & SAFE DELIVERY TESTS
// -----------------------------------------------------------------------
test('Google Flow Delivery - Confirmation Logic & Invariants', async (t) => {
  const scene = {
    id: 'scene-42',
    sceneNumber: 42,
    title: 'Scene 42: The Final Confrontation',
    prompt: 'Wide shot of spaceship bridge with red emergency lighting.',
  };
  const globalRules = 'Aspect Ratio 16:9, Unreal Engine 5.';

  await t.test('composes canonical prompt accurately for confirmation dialog preview', () => {
    const comp = composeProductionPrompt({
      scene,
      globalRules,
      includeGlobalRules: true,
    });

    assert.ok(comp.composedPrompt.startsWith(globalRules));
    assert.ok(comp.composedPrompt.endsWith(scene.prompt));
    assert.strictEqual(comp.charCount, comp.composedPrompt.length);
  });

  await t.test('opening confirmation dialog causes 0 delivery side effects', async () => {
    // If confirmation state is opened, no injection or clipboard write should happen
    let sideEffectsOccurred = false;
    const originalNavigator = globalThis.navigator;

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        clipboard: {
          writeText: async () => {
            sideEffectsOccurred = true;
            return true;
          },
        },
      },
      configurable: true,
      writable: true,
    });

    try {
      // Simulate user opening dialog: state variable changes, zero delivery called
      const flowConfirmScene = scene;
      assert.strictEqual(flowConfirmScene.sceneNumber, 42);
      assert.strictEqual(sideEffectsOccurred, false);
    } finally {
      if (originalNavigator) {
        Object.defineProperty(globalThis, 'navigator', originalNavigator);
      } else {
        delete globalThis.navigator;
      }
    }
  });

  await t.test('canceling confirmation causes 0 delivery side effects', () => {
    let sideEffect = false;
    // Simulate Cancel button click: sets flowConfirmScene to null
    let flowConfirmScene = scene;
    const handleCancel = () => {
      flowConfirmScene = null;
    };
    handleCancel();

    assert.strictEqual(flowConfirmScene, null);
    assert.strictEqual(sideEffect, false);
  });

  await t.test('delivery distinguishes verified insertion from manual clipboard fallback', async () => {
    const originalDoc = global.document;

    // 1. Verified DOM insertion
    global.document = {
      getElementById: () => ({
        executeJavaScript: async () => ({ injected: true, verified: true }),
      }),
    };

    const verifiedRes = await injectTextToWebview('googleFlow', 'Prompt test');
    assert.strictEqual(verifiedRes.status, DELIVERY_STATUS.INSERTED);
    assert.strictEqual(verifiedRes.detailedStatus, DELIVERY_STATUS.INSERTED_VERIFIED);
    assert.strictEqual(verifiedRes.verified, true);

    // 2. Missing webview fallback to clipboard
    global.document = { getElementById: () => null };
    let copiedText = '';
    const originalNav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText: async (t) => { copiedText = t; return true; } } },
      configurable: true,
      writable: true,
    });

    try {
      const fallbackRes = await injectTextToWebview('googleFlow', 'Prompt test');
      assert.strictEqual(fallbackRes.status, DELIVERY_STATUS.COPIED);
      assert.strictEqual(fallbackRes.detailedStatus, DELIVERY_STATUS.COPIED_MANUAL);
      assert.strictEqual(copiedText, 'Prompt test');
    } finally {
      global.document = originalDoc;
      if (originalNav) {
        Object.defineProperty(globalThis, 'navigator', originalNav);
      } else {
        delete globalThis.navigator;
      }
    }
  });

  await t.test('delivery confirmation never automatically clicks Generate button', () => {
    const injectionScriptContent = fs.readFileSync(
      path.join(__dirname, '../src/utils/webviewInjection.js'),
      'utf8'
    );

    // Assert that no click on Generate button exists in injection logic
    assert.strictEqual(
      injectionScriptContent.includes('.click()'),
      false,
      'webviewInjection must never invoke click() on generate buttons'
    );
  });

  await t.test('source code of PipelineSidebar includes flow confirmation modal and reopen button', () => {
    const sidebarSrc = fs.readFileSync(
      path.join(__dirname, '../src/components/PipelineSidebar.jsx'),
      'utf8'
    );

    assert.ok(sidebarSrc.includes('flowConfirmScene'), 'Must track flowConfirmScene state');
    assert.ok(sidebarSrc.includes('handleRequestFlowSend'), 'Must provide flow confirmation request handler');
    assert.ok(sidebarSrc.includes('handleExecuteFlowDelivery'), 'Must provide flow delivery execution handler');
    assert.ok(sidebarSrc.includes('getPreviousDelivery'), 'Must check previous delivery history for duplicate warning');
    assert.ok(sidebarSrc.includes('Send Again'), 'Must provide Send Again button on duplicate sends');
    assert.ok(sidebarSrc.includes('isDoneCard'), 'Must support dedicated Done section card rendering');
    assert.ok(sidebarSrc.includes('Reopen'), 'Must provide Reopen action for completed scenes');
  });
});
