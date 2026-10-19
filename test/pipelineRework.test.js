const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateStoryboardSource,
  readClipboardText,
  INTAKE_STATUS,
} = require('../src/utils/storyboardIntake');
const {
  buildChatGPTWrapper,
  SUPPORTED_ASPECT_RATIOS,
} = require('../src/utils/promptTemplate');
const { parsePromptText } = require('../src/utils/sceneParser');
const {
  formatContinuitySummary,
  validateContinuityContext,
  sanitizeContinuityContext,
} = require('../src/utils/continuityManager');
const {
  composeProductionPrompt,
  evaluatePromptQuality,
  estimateTokenCount,
  checkRulesDuplication,
  detectFormatContradictions,
} = require('../src/utils/promptComposer');
const {
  injectTextToWebview,
  DELIVERY_STATUS,
} = require('../src/utils/webviewInjection');
const {
  applyParsedStoryboardToProject,
  GLOBAL_RULES_STRATEGY,
  createNewProject,
} = require('../src/utils/projectManager');

// Helper to mock global navigator
function setupMockNavigator(mockObj) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    value: mockObj,
    configurable: true,
    writable: true,
  });
  return () => {
    if (original) {
      Object.defineProperty(globalThis, 'navigator', original);
    } else {
      delete globalThis.navigator;
    }
  };
}

// -----------------------------------------------------------------------
// 1. STORYBOARD INTAKE & SOURCE VALIDATION TESTS
// -----------------------------------------------------------------------
test('Storyboard Intake - Source Validation & Lifecycle', async (t) => {
  await t.test('detects empty or whitespace inputs and returns EMPTY status', () => {
    const emptyRes = validateStoryboardSource('');
    assert.strictEqual(emptyRes.valid, false);
    assert.strictEqual(emptyRes.status, INTAKE_STATUS.EMPTY);
    assert.strictEqual(emptyRes.sceneCountEstimate, 0);

    const spaceRes = validateStoryboardSource('   \n\t  ');
    assert.strictEqual(spaceRes.valid, false);
    assert.strictEqual(spaceRes.status, INTAKE_STATUS.EMPTY);
  });

  await t.test('rejects placeholder templates and never treats them as valid', () => {
    const placeholders = [
      '[PASTE YOUR CLAUDE STORYBOARD SCRIPT HERE]',
      '[paste your claude storyboard script here]',
      '[paste your claude storyboard here]',
    ];
    for (const ph of placeholders) {
      const res = validateStoryboardSource(ph);
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.status, INTAKE_STATUS.EMPTY);
      assert.match(res.errors[0], /placeholder/i);
    }
  });

  await t.test('flags unrelated inputs such as source code, JSON, or stack traces', () => {
    const codeSnippet = `import React from 'react';\nexport function Component() {\n  return <div>Code</div>;\n}`;
    const codeRes = validateStoryboardSource(codeSnippet);
    assert.strictEqual(codeRes.valid, false);
    assert.strictEqual(codeRes.status, INTAKE_STATUS.SOURCE_NEEDS_REVIEW);
    assert.match(codeRes.warnings[0], /code, JSON, logs/i);

    const jsonSnippet = `{\n  "status": "error",\n  "code": 500\n}`;
    const jsonRes = validateStoryboardSource(jsonSnippet);
    assert.strictEqual(jsonRes.valid, false);
  });

  await t.test('validates legitimate storyboards and counts scenes accurately', () => {
    const validStoryboard = `Scene 1: Opening Hook
Wide establishing shot of a futuristic Tokyo street drenched in neon reflections and light rain.
Camera tracks slowly behind protagonist walking into alleyway.

Scene 2: The Meeting
Medium shot inside underground bar. Mysterious contact slides an encrypted data drive across the counter.
Voice-over: "They told me the code didn't exist."`;

    const res = validateStoryboardSource(validStoryboard);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.status, INTAKE_STATUS.SOURCE_VALIDATED);
    assert.strictEqual(res.sceneCountEstimate, 2);
    assert.strictEqual(res.hasVoiceOver, true);
    assert.strictEqual(res.errors.length, 0);
  });

  await t.test('handles clipboard read failures and permission rejections gracefully', async () => {
    const restore = setupMockNavigator({
      clipboard: {
        readText: async () => {
          throw new Error('Permission denied by user');
        },
      },
    });

    try {
      const res = await readClipboardText();
      assert.strictEqual(res.success, false);
      assert.match(res.error, /Permission denied/i);
    } finally {
      restore();
    }
  });

  await t.test('handles empty clipboard read gracefully', async () => {
    const restore = setupMockNavigator({
      clipboard: {
        readText: async () => '   \n  ',
      },
    });

    try {
      const res = await readClipboardText();
      assert.strictEqual(res.success, false);
      assert.match(res.error, /Clipboard is empty/i);
    } finally {
      restore();
    }
  });
});

// -----------------------------------------------------------------------
// 2. PROMPT WRAPPER TEMPLATE GENERATION TESTS
// -----------------------------------------------------------------------
test('Prompt Template - ChatGPT Wrapper Generation', async (t) => {
  const sampleStoryboard = `Scene 1: Sunrise Peak
Camera pans across misty mountain ridge at dawn.
VO: "Every summit begins in silence."

Scene 2: Ascent Begins
Hiker fastens carabiner onto steel cable and climbs upward.`;

  await t.test('embeds source storyboard exactly once without duplication', () => {
    const wrapper = buildChatGPTWrapper({
      storyboardText: sampleStoryboard,
      aspectRatio: '16:9',
      artisticStyle: 'Cinematic 35mm Film',
    });

    // Check count of source occurrence
    const count = (wrapper.match(/Every summit begins in silence/g) || []).length;
    assert.strictEqual(count, 1, 'Storyboard source text must appear exactly once');
    assert.ok(wrapper.includes('--- STORYBOARD SOURCE ---'));
    assert.ok(wrapper.includes('GLOBAL RULES:'));
    assert.ok(wrapper.includes('SCENE 1:'));
  });

  await t.test('supports customized aspect ratios without forcing 16:9', () => {
    assert.ok(SUPPORTED_ASPECT_RATIOS.includes('9:16'));
    assert.ok(SUPPORTED_ASPECT_RATIOS.includes('2.39:1'));

    const verticalWrapper = buildChatGPTWrapper({
      storyboardText: sampleStoryboard,
      aspectRatio: '9:16',
      artisticStyle: 'Vertical Shorts / Reels',
    });

    assert.ok(verticalWrapper.includes('Aspect Ratio: 9:16'));
    assert.ok(verticalWrapper.includes('aspect ratio (9:16)'));
    assert.strictEqual(verticalWrapper.includes('Aspect Ratio: 16:9'), false);
  });

  await t.test('preserves voice-over preservation instructions', () => {
    const wrapper = buildChatGPTWrapper({
      storyboardText: sampleStoryboard,
      preserveVoiceOver: true,
    });
    assert.ok(wrapper.includes('Voice-Over & Narration: Preserve all verbatim voice-over/dialogue'));
  });

  await t.test('allows custom visual requirements and styles', () => {
    const wrapper = buildChatGPTWrapper({
      storyboardText: sampleStoryboard,
      aspectRatio: '21:9',
      artisticStyle: 'Cyberpunk Anime 2D',
      customVisualRequirements: 'Muted teal palette with gold accents',
    });
    assert.ok(wrapper.includes('Cyberpunk Anime 2D'));
    assert.ok(wrapper.includes('Muted teal palette with gold accents'));
  });
});

// -----------------------------------------------------------------------
// 3. CONTINUITY CONTEXT TESTS
// -----------------------------------------------------------------------
test('Continuity Context - Management & Formatting', async (t) => {
  await t.test('returns empty string when all continuity fields are empty', () => {
    assert.strictEqual(formatContinuitySummary(null), '');
    assert.strictEqual(formatContinuitySummary({}), '');
    assert.strictEqual(
      formatContinuitySummary({
        recurringCharacters: '',
        environment: '',
        lightingTimeOfDay: '',
        keyProps: '',
        userNotes: '',
      }),
      ''
    );
  });

  await t.test('formats non-empty continuity fields concisely', () => {
    const summary = formatContinuitySummary({
      recurringCharacters: 'Dr. Evelyn Vance (silver trench coat, glowing visor)',
      environment: 'Orbital Research Station Alpha',
      lightingTimeOfDay: 'Deep space starfield with blue ambient reactor glow',
      keyProps: 'Quantum chronometer pendant',
      userNotes: '',
    });

    assert.ok(summary.startsWith('CONTINUITY CONTEXT:'));
    assert.ok(summary.includes('- Characters: Dr. Evelyn Vance'));
    assert.ok(summary.includes('- Setting/Environment: Orbital Research Station Alpha'));
    assert.ok(summary.includes('- Key Props: Quantum chronometer pendant'));
    assert.strictEqual(summary.includes('Reference Notes:'), false);
  });

  await t.test('validates and sanitizes continuity context', () => {
    const valid = validateContinuityContext({ recurringCharacters: 'Protagonist' });
    assert.strictEqual(valid.valid, true);

    const invalid = validateContinuityContext({ recurringCharacters: 12345 });
    assert.strictEqual(invalid.valid, false);

    const sanitized = sanitizeContinuityContext({ recurringCharacters: '   Neo   ' });
    assert.strictEqual(sanitized.recurringCharacters, 'Neo');
  });
});

// -----------------------------------------------------------------------
// 4. PROMPT COMPOSITION & QUALITY GATE TESTS
// -----------------------------------------------------------------------
test('Prompt Composition & Quality Gate', async (t) => {
  const scene = {
    id: 's-1',
    sceneNumber: 1,
    title: 'Scene 1: Introduction',
    prompt: 'Wide shot of cybernetic command center with neon holographic displays.',
  };
  const globalRules = 'Aspect Ratio 16:9, Unreal Engine 5.4, volumetric fog.';

  await t.test('composes canonical prompt with Global Rules and Scene Prompt', () => {
    const res = composeProductionPrompt({
      scene,
      globalRules,
      includeGlobalRules: true,
    });

    assert.ok(res.composedPrompt.startsWith(globalRules));
    assert.ok(res.composedPrompt.endsWith(scene.prompt));
    assert.strictEqual(res.charCount, res.composedPrompt.length);
    assert.strictEqual(res.tokenEstimate, estimateTokenCount(res.composedPrompt));
    assert.strictEqual(res.isDuplicatedRules, false);
  });

  await t.test('detects when scene prompt already contains global rules to prevent duplication', () => {
    const sceneWithRules = {
      id: 's-2',
      sceneNumber: 2,
      title: 'Scene 2: Duplicated',
      prompt: `${globalRules}\n\nClose up on command console.`,
    };

    assert.strictEqual(checkRulesDuplication(sceneWithRules.prompt, globalRules), true);

    const res = composeProductionPrompt({
      scene: sceneWithRules,
      globalRules,
      includeGlobalRules: true,
    });

    // Should NOT prepend rules again
    assert.strictEqual(res.isDuplicatedRules, true);
    assert.strictEqual(res.hasGlobalRules, false);
  });

  await t.test('detects conflicting aspect ratio directives in quality gate', () => {
    const conflictingPrompt = 'Aspect Ratio 16:9 widescreen format, framed for 9:16 vertical TikTok.';
    const warnings = detectFormatContradictions(conflictingPrompt);
    assert.ok(warnings.length > 0);
    assert.match(warnings[0], /Conflicting aspect ratio indicators/i);
  });

  await t.test('quality gate passes valid scene and fails empty scene', () => {
    const validQuality = evaluatePromptQuality({
      scene,
      composedPrompt: `${globalRules}\n\n${scene.prompt}`,
      globalRules,
    });
    assert.strictEqual(validQuality.passed, true);
    assert.strictEqual(validQuality.errors.length, 0);

    const emptyQuality = evaluatePromptQuality({
      scene: { id: 's-3', sceneNumber: 3, title: 'Scene 3', prompt: '' },
      composedPrompt: '',
      globalRules: '',
    });
    assert.strictEqual(emptyQuality.passed, false);
    assert.ok(emptyQuality.errors.length > 0);
  });
});

// -----------------------------------------------------------------------
// 5. PARSER UNPARSED CONTENT & ADVANCED VALIDATION TESTS
// -----------------------------------------------------------------------
test('Scene Parser - Unparsed Content & Heading Anomalies', async (t) => {
  await t.test('captures preamble text before Scene 1 into unparsedContent', () => {
    const raw = `Here is your requested video production script based on the creative brief:
Some notes on camera direction and lighting setup.

GLOBAL RULES:
Aspect Ratio 16:9, Octane render 8k.

Scene 1: Opening Shot
Cinematic drone shot over cityscape.

Scene 2: Street Level
Low angle shot of protagonist stepping out of vehicle.`;

    const res = parsePromptText(raw);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.scenes.length, 2);
    assert.ok(res.unparsedContent.length > 0, 'Preamble text should be stored in unparsedContent');
    assert.ok(res.unparsedContent[0].includes('requested video production script'));
  });

  await t.test('detects duplicate scene numbers and non-chronological order with warnings', () => {
    const raw = `Scene 2: Shot B
Middle scene description.

Scene 1: Shot A
First scene description.

Scene 2: Shot B Duplicate
Repeated scene number description.`;

    const res = parsePromptText(raw);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.scenes.length, 3);
    assert.ok(res.warnings.some((w) => w.includes('Duplicate scene number 2')));
    assert.ok(res.warnings.some((w) => w.includes('non-chronological scene ordering')));
  });

  await t.test('flags unnumbered malformed scene headings with warnings', () => {
    const raw = `Scene 1: First Shot
Camera moves forward.

Scene: Malformed Unnumbered Heading
Camera stays static.`;

    const res = parsePromptText(raw);
    assert.strictEqual(res.success, true);
    assert.ok(res.warnings.some((w) => w.includes('unnumbered "Scene:" heading')));
  });
});

// -----------------------------------------------------------------------
// 6. SAFE IMPORT & PROJECT STATE TESTS
// -----------------------------------------------------------------------
test('Project State - Safe Storyboard Application Strategies', async (t) => {
  const initialProject = createNewProject('Active Test Project', 'Initial Active Rules 16:9', [
    { id: 's-old-1', sceneNumber: 1, title: 'Old 1', prompt: 'Old prompt', done: false },
  ]);

  await t.test('applies parsed storyboard replacing scenes and updating rules when imported', () => {
    const parsed = {
      globalRules: 'New Imported Rules 21:9',
      scenes: [
        { id: 's-new-1', sceneNumber: 1, title: 'New 1', prompt: 'New prompt 1', done: false },
        { id: 's-new-2', sceneNumber: 2, title: 'New 2', prompt: 'New prompt 2', done: false },
      ],
    };

    const updated = applyParsedStoryboardToProject(initialProject, parsed, {
      globalRulesStrategy: GLOBAL_RULES_STRATEGY.USE_IMPORTED,
      mode: 'replace',
    });

    assert.strictEqual(updated.scenes.length, 2);
    assert.strictEqual(updated.globalRules, 'New Imported Rules 21:9');
    assert.strictEqual(updated.scenes[0].id, 's-new-1');
  });

  await t.test('preserves active project rules when imported storyboard has no rules and strategy is KEEP_ACTIVE', () => {
    const parsedNoRules = {
      globalRules: null,
      scenes: [{ id: 's-new-1', sceneNumber: 1, title: 'New 1', prompt: 'New prompt 1', done: false }],
    };

    const updated = applyParsedStoryboardToProject(initialProject, parsedNoRules, {
      globalRulesStrategy: GLOBAL_RULES_STRATEGY.KEEP_ACTIVE,
      mode: 'replace',
    });

    assert.strictEqual(updated.globalRules, 'Initial Active Rules 16:9');
  });

  await t.test('clears rules when strategy is CLEAR and imported storyboard has no rules', () => {
    const parsedNoRules = {
      globalRules: null,
      scenes: [{ id: 's-new-1', sceneNumber: 1, title: 'New 1', prompt: 'New prompt 1', done: false }],
    };

    const updated = applyParsedStoryboardToProject(initialProject, parsedNoRules, {
      globalRulesStrategy: GLOBAL_RULES_STRATEGY.CLEAR,
      mode: 'replace',
    });

    assert.strictEqual(updated.globalRules, '');
  });

  await t.test('supports append mode without discarding existing scenes', () => {
    const parsed = {
      globalRules: null,
      scenes: [{ id: 's-append-2', sceneNumber: 2, title: 'Appended 2', prompt: 'Appended prompt', done: false }],
    };

    const updated = applyParsedStoryboardToProject(initialProject, parsed, {
      globalRulesStrategy: GLOBAL_RULES_STRATEGY.KEEP_ACTIVE,
      mode: 'append',
    });

    assert.strictEqual(updated.scenes.length, 2);
    assert.strictEqual(updated.scenes[0].id, 's-old-1');
    assert.strictEqual(updated.scenes[1].id, 's-append-2');
  });
});

// -----------------------------------------------------------------------
// 7. WEBVIEW DELIVERY & VERIFICATION TESTS
// -----------------------------------------------------------------------
test('Webview Delivery - Readback Verification & Concurrency Guard', async (t) => {
  const originalDoc = global.document;

  t.afterEach(() => {
    global.document = originalDoc;
  });

  await t.test('returns INSERTED_VERIFIED when guest script confirms readback verification', async () => {
    global.document = {
      getElementById: () => ({
        executeJavaScript: async () => ({ injected: true, verified: true }),
      }),
    };

    const res = await injectTextToWebview('googleFlow', 'Verified production prompt');
    assert.strictEqual(res.status, DELIVERY_STATUS.INSERTED);
    assert.strictEqual(res.detailedStatus, DELIVERY_STATUS.INSERTED_VERIFIED);
    assert.strictEqual(res.verified, true);
  });

  await t.test('falls back to COPIED_MANUAL when readback verification fails', async () => {
    const restore = setupMockNavigator({
      clipboard: { writeText: async () => true },
    });

    global.document = {
      getElementById: () => ({
        executeJavaScript: async () => ({
          injected: false,
          verified: false,
          reason: 'Field rejected or overwrote inserted text during readback verification',
        }),
      }),
    };

    try {
      const res = await injectTextToWebview('googleFlow', 'Test prompt for failed readback');
      assert.strictEqual(res.status, DELIVERY_STATUS.COPIED);
      assert.strictEqual(res.detailedStatus, DELIVERY_STATUS.COPIED_MANUAL);
      assert.match(res.reason, /readback verification/i);
    } finally {
      restore();
    }
  });
});
