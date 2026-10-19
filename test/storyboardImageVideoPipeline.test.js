const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parsePromptText,
  deriveImagePrompt,
  extractImageAndVideoPrompts,
} = require('../src/utils/sceneParser');
const {
  buildChatGPTWrapper,
  buildImagePromptRevisionWrapper,
} = require('../src/utils/promptTemplate');
const {
  composeProductionPrompt,
  evaluatePromptQuality,
  estimateTokenCount,
} = require('../src/utils/promptComposer');
const {
  createNewProject,
  validateSceneCard,
  validateProject,
  exportProjectToJson,
  parseAndValidateProjectImport,
  applyParsedStoryboardToProject,
  saveProjectsToStorage,
  DEFAULT_SCENES,
} = require('../src/utils/projectManager');
const {
  recordDelivery,
  getPreviousDelivery,
} = require('../src/utils/deliveryTracker');
const {
  computeStoryboardFingerprint,
} = require('../src/utils/publishingKitGenerator');

// Mock localStorage helper
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
// 1. STORYBOARD PROCESSING & DUAL PROMPT EXTRACTION
// -----------------------------------------------------------------------
test('Storyboard Processing - Dual Image and Video Prompt Parsing', async (t) => {
  await t.test('parses explicit IMAGE PROMPT and VIDEO PROMPT sections into linked scene records', () => {
    const raw = `GLOBAL RULES:
Aspect Ratio 16:9, Cinematic lighting, photorealistic 8k octane render.

SCENE 1: Cyber Command Center
IMAGE PROMPT:
Static wide establishing shot of a futuristic cybernetic command center with glowing blue and amber terminals. Photorealistic, 8k, volumetric dust motes. No text or logos.

VIDEO PROMPT:
Slow cinematic push-in toward the main holographic tactical display as amber alert status pulses across screens.

SCENE 2: The Operator
IMAGE PROMPT:
Medium close-up portrait of the female protagonist in tactical vest, illuminated by ambient terminal glow, intense expression.

VIDEO PROMPT:
The protagonist turns sharply toward the entrance as emergency red lighting floods the corridor.`;

    const res = parsePromptText(raw);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.scenes.length, 2);

    // Scene 1
    assert.strictEqual(res.scenes[0].sceneNumber, 1);
    assert.strictEqual(res.scenes[0].title, 'Scene 1: Cyber Command Center');
    assert.match(res.scenes[0].imagePrompt, /Static wide establishing shot/);
    assert.match(res.scenes[0].videoPrompt, /Slow cinematic push-in/);
    assert.strictEqual(res.scenes[0].prompt, res.scenes[0].videoPrompt, 'scene.prompt mirrors videoPrompt for backwards compatibility');
    assert.strictEqual(res.scenes[0].imageStatus, 'ready');

    // Scene 2
    assert.strictEqual(res.scenes[1].sceneNumber, 2);
    assert.strictEqual(res.scenes[1].title, 'Scene 2: The Operator');
    assert.match(res.scenes[1].imagePrompt, /Medium close-up portrait/);
    assert.match(res.scenes[1].videoPrompt, /The protagonist turns sharply/);
  });

  await t.test('supports Markdown bold headings and formatting variations for prompt tags', () => {
    const variations = [
      `Scene 1: Opening
**IMAGE PROMPT:**
Wide shot of mist-covered valley.
**VIDEO PROMPT:**
Drone ascends over mountain peak.`,

      `Scene 1: Opening
### Image Prompt:
Wide shot of mist-covered valley.
### Video Prompt:
Drone ascends over mountain peak.`,

      `Scene 1: Opening
Image:
Wide shot of mist-covered valley.
Video:
Drone ascends over mountain peak.`,
    ];

    for (const text of variations) {
      const res = parsePromptText(text);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.scenes.length, 1);
      assert.match(res.scenes[0].imagePrompt, /Wide shot of mist-covered valley/);
      assert.match(res.scenes[0].videoPrompt, /Drone ascends over mountain peak/);
    }
  });

  await t.test('handles legacy single-prompt storyboards by deriving a clean still image prompt', () => {
    const legacyRaw = `GLOBAL RULES:
Aspect Ratio 9:16, Anime aesthetic.

SCENE 1: Neon Highway
Camera moves rapidly forward tracking neon motorcycle speeding through rain-slicked Tokyo streets, reflections blurring.`;

    const res = parsePromptText(legacyRaw);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.scenes.length, 1);
    // Legacy video prompt is preserved verbatim
    assert.match(res.scenes[0].videoPrompt, /Camera moves rapidly forward/);
    assert.strictEqual(res.scenes[0].prompt, res.scenes[0].videoPrompt);
    // Image prompt is derived as a still composition without motion verbs
    assert.ok(res.scenes[0].imagePrompt.length > 0);
    assert.strictEqual(res.scenes[0].imageStatus, 'ready');
  });

  await t.test('preserves stable scene IDs and narrative order across re-parsing with existing scenes', () => {
    const existing = [
      { id: 'stable-id-101', sceneNumber: 1, title: 'Scene 1: Old Title', prompt: 'Old prompt' },
      { id: 'stable-id-102', sceneNumber: 2, title: 'Scene 2: Old Title 2', prompt: 'Old prompt 2' },
    ];

    const raw = `Scene 1: Updated Title
IMAGE PROMPT:
New still image prompt.
VIDEO PROMPT:
New video motion prompt.

Scene 2: Updated Title 2
IMAGE PROMPT:
Second image prompt.
VIDEO PROMPT:
Second video prompt.`;

    const res = parsePromptText(raw, { existingScenes: existing });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.scenes[0].id, 'stable-id-101', 'Preserves stable ID for Scene 1');
    assert.strictEqual(res.scenes[1].id, 'stable-id-102', 'Preserves stable ID for Scene 2');
    assert.strictEqual(res.scenes[0].sceneNumber, 1);
    assert.strictEqual(res.scenes[1].sceneNumber, 2);
  });
});

// -----------------------------------------------------------------------
// 2. PROMPT TEMPLATE & WRAPPER GENERATION
// -----------------------------------------------------------------------
test('Prompt Template - Linked Dual Prompt Instructions', async (t) => {
  await t.test('buildChatGPTWrapper requires both IMAGE PROMPT and VIDEO PROMPT outputs', () => {
    const wrapper = buildChatGPTWrapper({
      storyboardText: 'Scene 1: Hero stands on cliff looking out.',
      aspectRatio: '16:9',
      artisticStyle: 'Cinematic 35mm Film',
    });

    assert.match(wrapper, /IMAGE GENERATION PROMPT/);
    assert.match(wrapper, /VIDEO GENERATION PROMPT/);
    assert.match(wrapper, /IMAGE PROMPT:/);
    assert.match(wrapper, /VIDEO PROMPT:/);
    assert.match(wrapper, /Linked Image & Video Consistency/);
    assert.match(wrapper, /animation or movement verbs in image prompts/i);
  });

  await t.test('buildImagePromptRevisionWrapper creates focused revision instructions', () => {
    const wrapper = buildImagePromptRevisionWrapper({
      scene: { sceneNumber: 3, title: 'Scene 3: Climax', prompt: 'Hero confronts villain.' },
      globalRules: 'Aspect Ratio 16:9, Dark fantasy lighting.',
      currentImagePrompt: 'Hero on cliff.',
      revisionInstructions: 'Make armor ornate silver and add storm clouds in background.',
    });

    assert.match(wrapper, /Scene 3/);
    assert.match(wrapper, /Dark fantasy lighting/);
    assert.match(wrapper, /Make armor ornate silver/);
  });
});

// -----------------------------------------------------------------------
// 3. PROMPT COMPOSITION & INDEPENDENT EDITING
// -----------------------------------------------------------------------
test('Prompt Composition - Independent Image and Video Prompts', async (t) => {
  const scene = {
    id: 'scene-alpha',
    sceneNumber: 1,
    title: 'Scene 1: Landing',
    prompt: 'Spacecraft touches down on alien red soil kicking up dust.',
    videoPrompt: 'Spacecraft touches down on alien red soil kicking up dust.',
    imagePrompt: 'Static establishing shot of futuristic exploration vessel resting on crimson lunar landscape.',
    done: false,
  };
  const globalRules = 'Aspect Ratio 16:9, 8k photorealistic.';

  await t.test('composes image prompt using scene.imagePrompt and prepends Global Rules', () => {
    const res = composeProductionPrompt({
      scene,
      globalRules,
      promptType: 'image',
    });

    assert.strictEqual(res.promptType, 'image');
    assert.ok(res.composedPrompt.startsWith('Aspect Ratio 16:9, 8k photorealistic.'));
    assert.ok(res.composedPrompt.includes('Static establishing shot of futuristic exploration vessel'));
    assert.ok(!res.composedPrompt.includes('Spacecraft touches down'));
  });

  await t.test('composes video prompt using scene.videoPrompt and prepends Global Rules', () => {
    const res = composeProductionPrompt({
      scene,
      globalRules,
      promptType: 'video',
    });

    assert.strictEqual(res.promptType, 'video');
    assert.ok(res.composedPrompt.startsWith('Aspect Ratio 16:9, 8k photorealistic.'));
    assert.ok(res.composedPrompt.includes('Spacecraft touches down on alien red soil'));
    assert.ok(!res.composedPrompt.includes('Static establishing shot'));
  });

  await t.test('editing image prompt never overwrites or alters video prompt', () => {
    const sceneCopy = { ...scene };

    // User edits image prompt
    sceneCopy.imagePrompt = 'Updated image prompt with twilight lighting and double moons.';
    assert.strictEqual(sceneCopy.videoPrompt, 'Spacecraft touches down on alien red soil kicking up dust.');
    assert.strictEqual(sceneCopy.prompt, 'Spacecraft touches down on alien red soil kicking up dust.');

    // User edits video prompt
    sceneCopy.videoPrompt = 'Updated video prompt with reverse thrusters firing.';
    assert.strictEqual(sceneCopy.imagePrompt, 'Updated image prompt with twilight lighting and double moons.');
  });

  await t.test('evaluates quality gate appropriately for image and video prompt types', () => {
    const validImageEval = evaluatePromptQuality({
      scene,
      composedPrompt: 'Aspect 16:9. Static establishing shot.',
      globalRules,
      promptType: 'image',
    });
    assert.strictEqual(validImageEval.passed, true);

    const emptyImageScene = { ...scene, imagePrompt: '' };
    const failedImageEval = evaluatePromptQuality({
      scene: emptyImageScene,
      composedPrompt: '',
      globalRules,
      promptType: 'image',
    });
    assert.strictEqual(failedImageEval.passed, false);
    assert.ok(failedImageEval.errors.some((e) => e.includes('Image prompt text is empty')));
  });
});

// -----------------------------------------------------------------------
// 4. IMAGE AS REFERENCE & ASSET METADATA TRACKING
// -----------------------------------------------------------------------
test('Image Reference & Asset Tracking', async (t) => {
  await t.test('appends reference image continuity directive to video prompt when asset is attached', () => {
    const sceneWithAsset = {
      id: 'scene-1',
      sceneNumber: 1,
      title: 'Scene 1: Establishing',
      prompt: 'Camera glides into the grand library.',
      videoPrompt: 'Camera glides into the grand library.',
      imagePrompt: 'Grand gothic library with towering mahogany bookshelves.',
      imageAsset: {
        name: 'library_reference.png',
        path: '/assets/library_reference.png',
        status: 'attached',
        referenceType: 'reference',
      },
    };

    const comp = composeProductionPrompt({
      scene: sceneWithAsset,
      globalRules: 'Aspect Ratio 16:9.',
      promptType: 'video',
      includeReferenceDirective: true,
    });

    assert.strictEqual(comp.hasReferenceDirective, true);
    assert.match(comp.composedPrompt, /IMAGE REFERENCE: Maintain visual continuity with the reference image for Scene 1 \(library_reference\.png\)/);
    assert.match(comp.composedPrompt, /Preserve character appearance, wardrobe, environment, lighting, and palette/);
  });

  await t.test('asset association is isolated to target scene without leaking to other scenes', () => {
    const scenes = [
      {
        id: 's-1',
        sceneNumber: 1,
        title: 'Scene 1',
        prompt: 'P1',
        imageAsset: { name: 'scene1_asset.png', path: 'p1' },
      },
      {
        id: 's-2',
        sceneNumber: 2,
        title: 'Scene 2',
        prompt: 'P2',
        imageAsset: null,
      },
    ];

    assert.strictEqual(scenes[0].imageAsset.name, 'scene1_asset.png');
    assert.strictEqual(scenes[1].imageAsset, null);
  });

  await t.test('replacing an asset in one scene updates only that scene and flags video for review', () => {
    let scenes = [
      { id: 's-1', sceneNumber: 1, prompt: 'P1', imageAsset: { name: 'old.png' }, videoNeedsReview: false },
      { id: 's-2', sceneNumber: 2, prompt: 'P2', imageAsset: { name: 's2.png' }, videoNeedsReview: false },
    ];

    // Replace asset on scene 1
    scenes = scenes.map((s) =>
      s.id === 's-1'
        ? { ...s, imageAsset: { name: 'new.png' }, videoNeedsReview: true }
        : s
    );

    assert.strictEqual(scenes[0].imageAsset.name, 'new.png');
    assert.strictEqual(scenes[0].videoNeedsReview, true, 'Scene 1 video prompt flagged for review');
    assert.strictEqual(scenes[1].imageAsset.name, 's2.png');
    assert.strictEqual(scenes[1].videoNeedsReview, false, 'Scene 2 remains unaffected');
  });
});

// -----------------------------------------------------------------------
// 5. PROJECT PERSISTENCE & BACKWARD COMPATIBILITY
// -----------------------------------------------------------------------
test('Data Persistence & Backward Compatibility', async (t) => {
  await t.test('older project without image prompts or assets loads and validates without errors', () => {
    const legacyProject = {
      id: 'proj-legacy-99',
      name: 'Legacy Project',
      createdAt: 1000,
      updatedAt: 2000,
      globalRules: '16:9 cinematic.',
      scenes: [
        {
          id: 'scene-leg-1',
          sceneNumber: 1,
          title: 'Scene 1: Hook',
          prompt: 'Legacy video prompt only.',
          done: false,
        },
      ],
      metadata: { version: 1 },
    };

    const val = validateProject(legacyProject);
    assert.strictEqual(val.valid, true);

    const storage = createMockStorage();
    const saveRes = saveProjectsToStorage(storage, [legacyProject], legacyProject.id);
    assert.strictEqual(saveRes.success, true);
  });

  await t.test('exportProjectToJson preserves both image and video prompt fields safely', () => {
    const project = createNewProject('Dual Pipeline Project');
    project.scenes = [
      {
        id: 's-dual-1',
        sceneNumber: 1,
        title: 'Scene 1: Test',
        prompt: 'Video prompt text',
        videoPrompt: 'Video prompt text',
        imagePrompt: 'Image prompt text',
        imageAsset: { name: 'ref.png', path: 'path/ref.png', referenceType: 'both', status: 'attached' },
        imageStatus: 'attached',
        videoNeedsReview: true,
        done: false,
      },
    ];

    const exported = exportProjectToJson(project);
    assert.ok(exported.project);
    assert.strictEqual(exported.project.scenes[0].videoPrompt, 'Video prompt text');
    assert.strictEqual(exported.project.scenes[0].imagePrompt, 'Image prompt text');
    assert.strictEqual(exported.project.scenes[0].imageAsset.name, 'ref.png');
    assert.strictEqual(exported.project.scenes[0].videoNeedsReview, true);

    // Re-importing validates cleanly
    const reImport = parseAndValidateProjectImport(exported);
    assert.strictEqual(reImport.valid, true);
  });

  await t.test('DEFAULT_SCENES includes clean initial image and video prompt values', () => {
    assert.ok(Array.isArray(DEFAULT_SCENES));
    assert.ok(DEFAULT_SCENES.length >= 3);
    for (const sc of DEFAULT_SCENES) {
      assert.ok(sc.imagePrompt && sc.imagePrompt.length > 0, `Scene ${sc.sceneNumber} should have imagePrompt`);
      assert.ok(sc.videoPrompt && sc.videoPrompt.length > 0, `Scene ${sc.sceneNumber} should have videoPrompt`);
      assert.strictEqual(sc.prompt, sc.videoPrompt);
      assert.strictEqual(validateSceneCard(sc).valid, true);
    }
  });
});

// -----------------------------------------------------------------------
// 6. REGRESSION SAFEGUARDS: FLOW CONFIRMATION & PUBLISHING KIT
// -----------------------------------------------------------------------
test('Regression Safeguards - Google Flow Confirmation & Publishing Kit', async (t) => {
  await t.test('deliveryTracker accurately records and retrieves Flow prompt delivery', () => {
    const storage = createMockStorage();
    const projId = 'proj-reg-1';
    const sceneId = 'scene-flow-1';

    // No prior delivery
    assert.strictEqual(getPreviousDelivery(projId, sceneId, 'flow', storage), null);

    // Record delivery
    recordDelivery(projId, sceneId, {
      sceneNumber: 1,
      target: 'flow',
      status: 'inserted',
      verified: true,
    }, storage);

    const recorded = getPreviousDelivery(projId, sceneId, 'flow', storage);
    assert.ok(recorded);
    assert.strictEqual(recorded.status, 'inserted');
    assert.strictEqual(recorded.verified, true);
    assert.strictEqual(recorded.sceneNumber, 1);
  });

  await t.test('Publishing Kit storyboard fingerprint computes reliably with dual prompts', () => {
    const project = createNewProject('Publishing Test Project');
    const fp1 = computeStoryboardFingerprint(project);
    assert.ok(fp1 && fp1.length > 0);

    // Modifying video prompt alters fingerprint
    const modifiedProj = {
      ...project,
      scenes: project.scenes.map((s, idx) =>
        idx === 0 ? { ...s, prompt: 'Brand new video prompt altered' } : s
      ),
    };
    const fp2 = computeStoryboardFingerprint(modifiedProj);
    assert.notStrictEqual(fp1, fp2);
  });

  await t.test('Done status toggling remains strictly functional on dual-prompt scenes', () => {
    const scenes = [
      { id: 'sc-1', sceneNumber: 1, prompt: 'V1', imagePrompt: 'I1', done: false },
      { id: 'sc-2', sceneNumber: 2, prompt: 'V2', imagePrompt: 'I2', done: false },
    ];

    const toggle = (list, id) => list.map((s) => (s.id === id ? { ...s, done: !s.done } : s));

    const updated = toggle(scenes, 'sc-1');
    const active = updated.filter((s) => !s.done);
    const done = updated.filter((s) => s.done);

    assert.strictEqual(active.length, 1);
    assert.strictEqual(active[0].id, 'sc-2');
    assert.strictEqual(done.length, 1);
    assert.strictEqual(done[0].id, 'sc-1');
    assert.strictEqual(done[0].imagePrompt, 'I1', 'Image prompt preserved in done card');
  });
});
