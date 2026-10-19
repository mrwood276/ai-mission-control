const test = require('node:test');
const assert = require('node:assert/strict');

const { parsePromptText } = require('../src/utils/sceneParser');
const {
  injectTextToWebview,
  injectFreshGemini,
  DELIVERY_STATUS,
} = require('../src/utils/webviewInjection');

test('Scene Parser - Valid Input & Formats', async (t) => {
  await t.test('parses standard Global Rules and sequential Scenes', () => {
    const raw = `Global Rules:
Aspect Ratio 16:9, Unreal Engine 5.4, 8k photorealistic.

Scene 1: Opening Hook
Cinematic wide shot of cybernetic command center with neon holographic screens.

Scene 2: Problem Statement
Medium close-up of developer inspecting AI telemetry.`;

    const res = parsePromptText(raw);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.errors.length, 0);
    assert.strictEqual(
      res.globalRules,
      'Aspect Ratio 16:9, Unreal Engine 5.4, 8k photorealistic.'
    );
    assert.strictEqual(res.scenes.length, 2);
    assert.strictEqual(res.scenes[0].sceneNumber, 1);
    assert.strictEqual(res.scenes[0].title, 'Scene 1: Opening Hook');
    assert.match(res.scenes[0].prompt, /Cinematic wide shot/);
    assert.strictEqual(res.scenes[0].done, false);
    assert.strictEqual(res.scenes[1].sceneNumber, 2);
    assert.strictEqual(res.scenes[1].title, 'Scene 2: Problem Statement');
  });

  await t.test('handles Markdown headings and variations in Global Rules', () => {
    const variations = [
      '# Global Rules:\nLighting: Studio high-key.\n\nScene 1: Shot\nPrompt A',
      '## Global Visual Rules\nAspect: 9:16 vertical.\n\nScene 1: Shot\nPrompt A',
      '### 1. Global Settings:\nOctane render 8k.\n\nScene 1: Shot\nPrompt A',
      '**GLOBAL RULES**:\nVolumetric fog.\n\nScene 1: Shot\nPrompt A',
    ];

    for (const text of variations) {
      const res = parsePromptText(text);
      assert.strictEqual(res.success, true);
      assert.ok(res.globalRules, `Expected rules to be extracted from: ${text}`);
      assert.strictEqual(res.scenes.length, 1);
    }
  });

  await t.test('handles missing Global Rules gracefully', () => {
    const raw = `Scene 1: Intro
Drone shot descending over mountain ridge.

Scene 2: Main Subject
Subject walking through mist.`;

    const res = parsePromptText(raw);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.globalRules, null);
    assert.strictEqual(res.scenes.length, 2);
  });

  await t.test('supports non-sequential scene numbers and scene titles without colons', () => {
    const raw = `## Scene 10 - Climax
Explosive battle sequence.

## Scene 3: Flashback
Peaceful village in sunlight.

Scene 99
Credits rolling against starry sky.`;

    const res = parsePromptText(raw);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.scenes.length, 3);
    assert.strictEqual(res.scenes[0].sceneNumber, 10);
    assert.strictEqual(res.scenes[0].title, 'Scene 10: Climax');
    assert.strictEqual(res.scenes[1].sceneNumber, 3);
    assert.strictEqual(res.scenes[1].title, 'Scene 3: Flashback');
    assert.strictEqual(res.scenes[2].sceneNumber, 99);
    assert.strictEqual(res.scenes[2].title, 'Scene 99');
  });

  await t.test('preserves multiline prompts, blank lines, and strips markdown dividers', () => {
    const raw = `Scene 1: Multi Paragraph
First paragraph of detailed camera direction.

Second paragraph with subject actions:
- Subject enters stage left
- Light shifts to amber

---
Scene 2: Second Scene
Close-up on character eyes.
***`;

    const res = parsePromptText(raw);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.scenes.length, 2);
    assert.match(res.scenes[0].prompt, /First paragraph/);
    assert.match(res.scenes[0].prompt, /Second paragraph/);
    assert.match(res.scenes[0].prompt, /- Subject enters stage left/);
    assert.strictEqual(res.scenes[0].prompt.includes('---'), false);
    assert.strictEqual(res.scenes[1].prompt.includes('***'), false);
  });
});

test('Scene Parser - Validation Errors & Edge Cases', async (t) => {
  await t.test('rejects empty, null, and whitespace inputs', () => {
    assert.strictEqual(parsePromptText('').success, false);
    assert.strictEqual(parsePromptText('   ').success, false);
    assert.strictEqual(parsePromptText(null).success, false);
    assert.strictEqual(parsePromptText(undefined).success, false);
  });

  await t.test('rejects inputs without any scene headings', () => {
    const raw = 'Just a random paragraph discussing video production ideas without any scene headings.';
    const res = parsePromptText(raw);
    assert.strictEqual(res.success, false);
    assert.match(res.errors[0], /No valid Scene headings found/i);
  });

  await t.test('rejects input where all scenes have empty prompts', () => {
    const raw = `Scene 1: Hook
Scene 2: Problem
Scene 3: Solution`;

    const res = parsePromptText(raw);
    assert.strictEqual(res.success, false);
    assert.match(res.errors[0], /all scenes contained empty prompts/i);
  });
});

test('Prompt Delivery - Injection & Fallback Outcomes', async (t) => {
  const originalDocument = global.document;
  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  function setMockNavigator(mock) {
    Object.defineProperty(globalThis, 'navigator', {
      value: mock,
      configurable: true,
      writable: true,
    });
  }

  function restoreNavigator() {
    if (originalNavigatorDescriptor) {
      Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
    }
  }

  t.afterEach(() => {
    global.document = originalDocument;
    restoreNavigator();
  });

  await t.test('fails when prompt text is empty', async () => {
    const res = await injectTextToWebview('gemini', '');
    assert.strictEqual(res.status, DELIVERY_STATUS.FAILED);
  });

  await t.test('returns COPIED when webview is missing but clipboard succeeds', async () => {
    let copiedText = '';
    global.document = { getElementById: () => null };
    setMockNavigator({
      clipboard: {
        writeText: async (txt) => {
          copiedText = txt;
          return true;
        },
      },
    });

    const res = await injectTextToWebview('missing-webview', 'Test prompt');
    assert.strictEqual(res.status, DELIVERY_STATUS.COPIED);
    assert.strictEqual(copiedText, 'Test prompt');
  });

  await t.test('returns FAILED when webview is missing and clipboard fails', async () => {
    global.document = { getElementById: () => null };
    setMockNavigator({
      clipboard: {
        writeText: async () => {
          throw new Error('Clipboard denied');
        },
      },
    });

    const res = await injectTextToWebview('missing-webview', 'Test prompt');
    assert.strictEqual(res.status, DELIVERY_STATUS.FAILED);
  });

  await t.test('returns INSERTED when executeJavaScript succeeds in populating input', async () => {
    global.document = {
      getElementById: () => ({
        executeJavaScript: async () => ({ injected: true }),
      }),
    };
    setMockNavigator({
      clipboard: { writeText: async () => true },
    });

    const res = await injectTextToWebview('gemini', 'Cinematic prompt');
    assert.strictEqual(res.status, DELIVERY_STATUS.INSERTED);
    assert.strictEqual(res.method, 'dom-injection');
  });

  await t.test('returns COPIED when executeJavaScript cannot find input field', async () => {
    global.document = {
      getElementById: () => ({
        executeJavaScript: async () => ({ injected: false, reason: 'No input element' }),
      }),
    };
    setMockNavigator({
      clipboard: { writeText: async () => true },
    });

    const res = await injectTextToWebview('gemini', 'Cinematic prompt');
    assert.strictEqual(res.status, DELIVERY_STATUS.COPIED);
    assert.match(res.reason, /No input element/i);
  });

  await t.test('handles executeJavaScript timeout and falls back to clipboard', async () => {
    global.document = {
      getElementById: () => ({
        executeJavaScript: () => new Promise(() => {}), // never resolves
      }),
    };
    setMockNavigator({
      clipboard: { writeText: async () => true },
    });

    const res = await injectTextToWebview('gemini', 'Cinematic prompt', 50); // 50ms test timeout
    assert.strictEqual(res.status, DELIVERY_STATUS.COPIED);
    assert.match(res.reason, /timed out/i);
  });
});

test('Prompt Delivery - Fresh Gemini Session Navigation & Listener Cleanup', async (t) => {
  const originalDocument = global.document;
  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  function setMockNavigator(mock) {
    Object.defineProperty(globalThis, 'navigator', {
      value: mock,
      configurable: true,
      writable: true,
    });
  }

  function restoreNavigator() {
    if (originalNavigatorDescriptor) {
      Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
    }
  }

  t.afterEach(() => {
    global.document = originalDocument;
    restoreNavigator();
  });

  await t.test('cleans up event listeners and timers on navigation failure', async () => {
    const listeners = new Map();
    const mockWebview = {
      addEventListener: (evt, fn) => listeners.set(evt, fn),
      removeEventListener: (evt) => listeners.delete(evt),
      loadURL: () => {
        // Trigger failure asynchronously
        setImmediate(() => {
          const failHandler = listeners.get('did-fail-load');
          if (failHandler) failHandler({ errorCode: -105 });
        });
      },
    };

    global.document = { getElementById: () => mockWebview };
    setMockNavigator({ clipboard: { writeText: async () => true } });

    const res = await injectFreshGemini('gemini', 'Fresh prompt', 500);
    assert.strictEqual(res.status, DELIVERY_STATUS.COPIED);
    assert.strictEqual(listeners.size, 0, 'Expected event listeners to be removed upon exit');
  });

  await t.test('cleans up event listeners when navigation safety timeout fires', async () => {
    const listeners = new Map();
    const mockWebview = {
      addEventListener: (evt, fn) => listeners.set(evt, fn),
      removeEventListener: (evt) => listeners.delete(evt),
      loadURL: () => {}, // Hangs without finishing
    };

    global.document = { getElementById: () => mockWebview };
    setMockNavigator({ clipboard: { writeText: async () => true } });

    const res = await injectFreshGemini('gemini', 'Fresh prompt', 50);
    assert.strictEqual(res.status, DELIVERY_STATUS.COPIED);
    assert.match(res.error, /timed out/i);
    assert.strictEqual(listeners.size, 0, 'Expected listeners to be cleaned up after timeout');
  });
});

test('State Resilience & Counter Normalization', async () => {
  const normalize = (val) => {
    const num = parseInt(val, 10);
    return isNaN(num) ? 0 : Math.max(0, Math.min(4, num));
  };

  // Normalization boundaries
  assert.strictEqual(normalize('0'), 0);
  assert.strictEqual(normalize('3'), 3);
  assert.strictEqual(normalize('4'), 4);
  assert.strictEqual(normalize('10'), 4, 'Clamps values > 4 to 4');
  assert.strictEqual(normalize('-5'), 0, 'Clamps negative values to 0');
  assert.strictEqual(normalize('corrupted_string'), 0, 'Corrupted string defaults to 0');
  assert.strictEqual(normalize(null), 0);
  assert.strictEqual(normalize(undefined), 0);

  // Corrupted JSON storage resilience
  const parseSavedScenes = (rawJson, fallback) => {
    try {
      if (!rawJson) return fallback;
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.filter(
          (s) => s && typeof s === 'object' && typeof s.id === 'string' && typeof s.prompt === 'string'
        );
        return valid.length > 0 ? valid : fallback;
      }
      return fallback;
    } catch {
      return fallback;
    }
  };

  const defaultScenes = [{ id: '1', prompt: 'test' }];
  assert.deepStrictEqual(parseSavedScenes('{ corrupt json', defaultScenes), defaultScenes);
  assert.deepStrictEqual(parseSavedScenes('{"notAnArray": true}', defaultScenes), defaultScenes);
  assert.deepStrictEqual(parseSavedScenes('[]', defaultScenes), defaultScenes);
  assert.deepStrictEqual(parseSavedScenes('[{"invalid": 123}]', defaultScenes), defaultScenes);
});
