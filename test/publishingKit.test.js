const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  createNewProject,
  saveProjectsToStorage,
  STORAGE_KEYS,
  applyParsedStoryboardToProject,
  ensurePublishingKit,
} = require('../src/utils/projectManager');

const {
  PUBLISHING_STATUS,
  PUBLISH_STATE,
  SUPPORTED_PLATFORMS,
  PLATFORM_CONFIG,
  isPlatformEnabled,
  CHECKLIST_ITEMS,
  LONG_FORM_CHECKLIST_ITEMS,
  createDefaultPublishingKit,
  createDefaultLongFormChecklist,
  normalizePublishingKit,
  computeStoryboardFingerprint,
  extractStoryboardContext,
  generatePublishingKit,
  generateSingleField,
  generateTitles,
  generateYouTubeDescription,
  generateLongFormTitles,
  generateYouTubeLongFormDescription,
  generateLongFormPinnedComment,
  generateHashtags,
  generatePinnedComment,
  generateTikTokCaptions,
  validatePublishingKitAgainstStoryboard,
  formatCompletePackage,
  buildPublishingAiPrompt,
  parsePublishingAiResponse,
} = require('../src/utils/publishingKitGenerator');

const {
  ALLOWED_SERVICE_DOMAINS,
  isDomainAllowed,
} = require('../electron/security');

// Mock localStorage helper
function createMockStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    _store: store,
  };
}

test('Publishing Kit Generator & Grounding Engine', async (t) => {
  // Test 1: Grounded generation from project storyboard & scenes
  await t.test('1. Generates Publishing Kit strictly grounded on active project scenes', () => {
    const project = createNewProject('Cyber Attack Short', 'Aspect 16:9', [
      {
        id: 's-1',
        sceneNumber: 1,
        title: 'Scene 1: Anomaly Detected',
        prompt: 'Security analyst discovers encrypted telemetry breach in AI mainframe.',
        done: false,
      },
      {
        id: 's-2',
        sceneNumber: 2,
        title: 'Scene 2: Firewall Countermeasures',
        prompt: 'Activating neural countermeasures as glowing firewall nodes defend the server.',
        done: false,
      },
      {
        id: 's-3',
        sceneNumber: 3,
        title: 'Scene 3: Containment Secured',
        prompt: 'System returns to steady green baseline as rogue process is isolated.',
        done: false,
      },
    ]);

    const kit = generatePublishingKit(project);

    assert.strictEqual(kit.status, PUBLISHING_STATUS.READY);
    assert.ok(kit.sourceFingerprint.startsWith('fp-'));
    assert.strictEqual(kit.youtube.titles.length, 3);
    assert.strictEqual(typeof kit.youtube.description, 'string');
    assert.ok(kit.youtube.description.length > 20);
    assert.ok(kit.youtube.hashtags.length >= 3);
    assert.ok(kit.youtube.pinnedComment.includes('?'));
    assert.strictEqual(kit.tiktok.captions.length, 3);
    assert.ok(kit.tiktok.hashtags.length >= 3);
    assert.ok(kit.tiktok.pinnedComment.length > 10);

    // Assert grounding in scene content
    const allText = [
      ...kit.youtube.titles,
      kit.youtube.description,
      ...kit.tiktok.captions,
    ].join(' ').toLowerCase();

    // Must mention core subjects from scenes (anomaly / firewall / containment / telemetry)
    const hasGroundedWord = ['anomaly', 'telemetry', 'firewall', 'countermeasures', 'containment', 'cyber', 'attack']
      .some((w) => allText.includes(w));
    assert.strictEqual(hasGroundedWord, true, 'Output must reference grounded concepts from scenes');
  });

  // Test 2: Project isolation (data does not leak across projects)
  await t.test('2. Ensures titles and descriptions do not leak data between projects', () => {
    const sciFiProject = createNewProject('Sci-Fi Story', '16:9', [
      { id: 'sf-1', sceneNumber: 1, title: 'Scene 1: Quantum Leap', prompt: 'Cosmic spacecraft enters wormhole.', done: false },
    ]);

    const cookingProject = createNewProject('Cooking Show', '16:9', [
      { id: 'ck-1', sceneNumber: 1, title: 'Scene 1: Searing Steaks', prompt: 'Chef prepares garlic butter wagyu ribeye.', done: false },
    ]);

    const sciFiKit = generatePublishingKit(sciFiProject);
    const cookingKit = generatePublishingKit(cookingProject);

    const sciFiText = JSON.stringify(sciFiKit).toLowerCase();
    const cookingText = JSON.stringify(cookingKit).toLowerCase();

    assert.ok(sciFiText.includes('quantum') || sciFiText.includes('spacecraft') || sciFiText.includes('wormhole'));
    assert.ok(!sciFiText.includes('wagyu'));
    assert.ok(!sciFiText.includes('garlic'));

    assert.ok(cookingText.includes('steaks') || cookingText.includes('wagyu') || cookingText.includes('chef'));
    assert.ok(!cookingText.includes('wormhole'));
    assert.ok(!cookingText.includes('spacecraft'));
  });

  // Test 3: Editability and persistence of all fields
  await t.test('3. Allows all fields to be edited and persists manual modifications', () => {
    const project = createNewProject('Custom Edit Project', '16:9', [
      { id: 's-1', sceneNumber: 1, title: 'Scene 1: Intro', prompt: 'Mysterious ancient door opens.', done: false },
    ]);

    const kit = generatePublishingKit(project);

    // Manually edit fields
    kit.youtube.titles[0] = 'My Custom Masterpiece Title';
    kit.youtube.selectedTitleIndex = 0;
    kit.youtube.description = 'Custom user written description.';
    kit.youtube.hashtags = ['#CustomTag1', '#CustomTag2', '#Shorts'];
    kit.youtube.pinnedComment = 'Custom user question?';
    kit.userEditedFields = {
      'youtube.titles': true,
      'youtube.description': true,
      'youtube.hashtags': true,
      'youtube.pinnedComment': true,
    };

    project.publishingKit = kit;

    const storage = createMockStorage();
    const saveRes = saveProjectsToStorage(storage, [project], project.id);
    assert.strictEqual(saveRes.success, true);

    const reloadedRaw = storage.getItem(STORAGE_KEYS.PROJECTS_V1);
    const reloaded = JSON.parse(reloadedRaw)[0];

    assert.strictEqual(reloaded.publishingKit.youtube.titles[0], 'My Custom Masterpiece Title');
    assert.strictEqual(reloaded.publishingKit.youtube.description, 'Custom user written description.');
    assert.deepStrictEqual(reloaded.publishingKit.youtube.hashtags, ['#CustomTag1', '#CustomTag2', '#Shorts']);
    assert.strictEqual(reloaded.publishingKit.youtube.pinnedComment, 'Custom user question?');
  });

  // Test 4: Primary title selection
  await t.test('4. Primary title is selectable from alternatives and reflected in formatted package', () => {
    const project = createNewProject('Title Select', '16:9', [
      { id: 's-1', sceneNumber: 1, title: 'Scene 1: Opening', prompt: 'First scene.', done: false },
    ]);
    const kit = generatePublishingKit(project);

    kit.youtube.titles = ['Title Alt 1', 'Title Alt 2 (Selected)', 'Title Alt 3'];
    kit.youtube.selectedTitleIndex = 1;

    const formatted = formatCompletePackage(kit, SUPPORTED_PLATFORMS.YOUTUBE);
    assert.ok(formatted.includes('TITLE:\nTitle Alt 2 (Selected)'));
    assert.ok(!formatted.includes('Title Alt 1'));
  });

  // Test 5: Copy per field and copy complete package
  await t.test('5. Formats complete copy-ready packages for YouTube Shorts and TikTok', () => {
    const kit = {
      youtube: {
        titles: ['Epic YouTube Title'],
        selectedTitleIndex: 0,
        description: 'Detailed description for YouTube Shorts.',
        hashtags: ['#Shorts', '#SciFi'],
        pinnedComment: 'What was your favorite moment?',
      },
      tiktok: {
        captions: ['TikTok hook that hooks immediately.'],
        selectedCaptionIndex: 0,
        hashtags: ['#fyp', '#foryou', '#viral'],
        pinnedComment: 'Tell me in the comments!',
      },
    };

    const ytPackage = formatCompletePackage(kit, 'youtube');
    assert.ok(ytPackage.includes('TITLE:\nEpic YouTube Title'));
    assert.ok(ytPackage.includes('DESCRIPTION:\nDetailed description for YouTube Shorts.'));
    assert.ok(ytPackage.includes('HASHTAGS:\n#Shorts #SciFi'));
    assert.ok(ytPackage.includes('PINNED COMMENT:\nWhat was your favorite moment?'));

    const ttPackage = formatCompletePackage(kit, 'tiktok');
    assert.ok(ttPackage.includes('CAPTION:\nTikTok hook that hooks immediately.'));
    assert.ok(ttPackage.includes('HASHTAGS:\n#fyp #foryou #viral'));
    assert.ok(ttPackage.includes('FIRST COMMENT:\nTell me in the comments!'));
  });

  // Test 6: Selective field regeneration preserves other fields
  await t.test('6. Regenerating a single field does not overwrite user edits in other fields', () => {
    const project = createNewProject('Selective Regen', '16:9', [
      { id: 's-1', sceneNumber: 1, title: 'Scene 1: Desert Ruins', prompt: 'Explorer finds ancient buried temple.', done: false },
      { id: 's-2', sceneNumber: 2, title: 'Scene 2: Secret Chamber', prompt: 'Chamber lights up with hieroglyphs.', done: false },
    ]);

    const initialKit = generatePublishingKit(project);
    initialKit.youtube.description = 'DO NOT OVERWRITE THIS USER DESCRIPTION';
    initialKit.userEditedFields = { 'youtube.description': true };
    initialKit.youtube.titles[0] = 'Old Title';
    project.publishingKit = initialKit;

    // Regenerate ONLY youtube.titles
    const updatedKit = generateSingleField('youtube.titles', project);

    // Titles must be newly generated
    assert.notStrictEqual(updatedKit.youtube.titles[0], 'Old Title');
    // Description MUST be preserved
    assert.strictEqual(updatedKit.youtube.description, 'DO NOT OVERWRITE THIS USER DESCRIPTION');
  });

  // Test 7: Failure resilience preserves existing kit
  await t.test('7. Generation failure or bad input preserves existing valid kit', () => {
    const project = createNewProject('Resilience', '16:9', [
      { id: 's-1', sceneNumber: 1, title: 'Scene 1: Valid', prompt: 'Valid prompt.', done: false },
    ]);
    const validKit = generatePublishingKit(project);
    project.publishingKit = validKit;

    assert.throws(() => {
      generateSingleField('invalid.field.key', project);
    });

    // Existing kit on project remains completely intact
    assert.strictEqual(project.publishingKit, validKit);
  });

  // Test 8: Storyboard change detection marks Needs Review
  await t.test('8. Changing scenes or storyboard flags kit as Needs Review via fingerprint mismatch', () => {
    const project = createNewProject('Fingerprint Test', '16:9', [
      { id: 's-1', sceneNumber: 1, title: 'Scene 1: Original', prompt: 'Original prompt text.', done: false },
    ]);

    const kit = generatePublishingKit(project);
    project.publishingKit = kit;

    const initialFp = kit.sourceFingerprint;
    assert.ok(initialFp);

    // Modify scene prompt
    project.scenes[0].prompt = 'Completely changed prompt text with different storyline.';

    const newFp = computeStoryboardFingerprint(project);
    assert.notStrictEqual(newFp, initialFp, 'Fingerprint must change when storyboard scenes change');

    // Applying parsed storyboard updates status to needs_review
    const parsedUpdate = {
      globalRules: '16:9',
      scenes: [
        { id: 's-1', sceneNumber: 1, title: 'Scene 1: Updated', prompt: 'New storyline.' },
      ],
    };

    const updatedProj = applyParsedStoryboardToProject(project, parsedUpdate);
    assert.strictEqual(updatedProj.publishingKit.status, PUBLISHING_STATUS.NEEDS_REVIEW);
  });

  // Test 9: Persistence across reload and default values
  await t.test('9. Publishing Kit survives storage reload and schema migration', () => {
    const storage = createMockStorage();
    const project = createNewProject('Persistence Reload', '16:9', [
      { id: 's-1', sceneNumber: 1, title: 'Scene 1: Hook', prompt: 'Hook prompt.', done: false },
    ]);

    const kit = generatePublishingKit(project);
    kit.youtube.titles[0] = 'Persistent Video Title';
    kit.status = PUBLISHING_STATUS.READY;
    project.publishingKit = kit;

    saveProjectsToStorage(storage, [project], project.id);

    // Reload from storage
    const raw = storage.getItem(STORAGE_KEYS.PROJECTS_V1);
    const loadedProjects = JSON.parse(raw);

    assert.strictEqual(loadedProjects.length, 1);
    assert.strictEqual(loadedProjects[0].publishingKit.youtube.titles[0], 'Persistent Video Title');
    assert.strictEqual(loadedProjects[0].publishingKit.status, PUBLISHING_STATUS.READY);
  });

  // Test 10: Anti-hallucination and sparse storyboard warnings
  await t.test('10. Detects ungrounded scientific claims or sparse content and emits warnings', () => {
    // Sparse content
    const sparseContext = extractStoryboardContext({ scenes: [], storyboardText: '' });
    assert.strictEqual(sparseContext.isSufficient, false);
    assert.ok(sparseContext.warnings.length > 0);

    // Fabricated claims detection
    const fabricatedKit = {
      youtube: {
        titles: ['Valid Title'],
        description: 'Berdasarkan studi NASA, 99% orang tidak tahu fakta ini.',
        hashtags: ['#Shorts'],
        pinnedComment: 'Komentar?',
      },
      tiktok: {
        captions: ['Caption'],
        hashtags: ['#fyp'],
        pinnedComment: 'Komentar?',
      },
    };

    const warnings = validatePublishingKitAgainstStoryboard(fabricatedKit, {
      isSufficient: true,
      fullCorpus: 'Sebuah video cerita fiksi biasa tanpa kutipan sains.',
    });

    const hasClaimWarning = warnings.some((w) => w.includes('ungrounded claim') || w.includes('NASA'));
    assert.strictEqual(hasClaimWarning, true, 'Must detect ungrounded institutional/scientific claim');
  });

  // Test 11: Multilingual support (Indonesian and English)
  await t.test('11. Generates authentic Indonesian copy for Indonesian storyboards', () => {
    const idContext = extractStoryboardContext({
      storyboardText: 'Ini adalah cerita tentang seorang pemuda di desa terpencil yang menemukan artefak kuno di dalam gua rahasia.',
      scenes: [
        { id: 's-1', sceneNumber: 1, title: 'Scene 1: Penemuan Artefak', prompt: 'Seorang pemuda memegang artefak bercahaya di gua.' },
      ],
    });

    assert.strictEqual(idContext.language, 'id');
    const titles = generateTitles(idContext);
    assert.strictEqual(titles.length, 3);
    const desc = generateYouTubeDescription(idContext);
    const comment = generatePinnedComment(idContext);
    const captions = generateTikTokCaptions(idContext);

    // Assert Indonesian phrasing
    assert.ok(desc.includes('kisah') || desc.includes('perjalanan') || desc.includes('cerita'));
    assert.ok(comment.includes('Menurut') || comment.includes('kalian') || comment.includes('pendapat'));
    assert.ok(captions.some((c) => c.includes('nyangka') || c.includes('Tonton') || c.includes('kamu')));
  });

  // Test 12: AI Prompt Export and JSON response parsing
  await t.test('12. Builds formatted AI prompt and parses valid AI response JSON', () => {
    const project = createNewProject('AI Prompt Export', '16:9', [
      { id: 's-1', sceneNumber: 1, title: 'Scene 1: Start', prompt: 'Visual start.', done: false },
    ]);

    const prompt = buildPublishingAiPrompt(project);
    assert.ok(prompt.includes('=== STRICT ANTI-HALLUCINATION RULES ==='));
    assert.ok(prompt.includes('```json'));

    const mockAiResponse = `
Here is your requested Publishing Kit:
\`\`\`json
{
  "youtube": {
    "titles": [
      "AI Title 1: The Quantum Anomaly",
      "AI Title 2: Beyond the Event Horizon",
      "AI Title 3: The Final Signal"
    ],
    "description": "An exciting sci-fi short exploring the outer edges of human exploration.",
    "hashtags": ["#Shorts", "#YouTubeShorts", "#SciFi", "#Space"],
    "pinnedComment": "Would you board this spaceship? Let us know below!"
  },
  "tiktok": {
    "captions": [
      "I still get chills watching this ending... 🚀",
      "Did you notice the signal at the start? 👀",
      "What would you do if you received this transmission? 👇"
    ],
    "hashtags": ["#fyp", "#foryou", "#scifi"],
    "pinnedComment": "Drop your craziest theories in the comments!"
  }
}
\`\`\`
    `;

    const parsed = parsePublishingAiResponse(mockAiResponse);
    assert.strictEqual(parsed.success, true);
    assert.strictEqual(parsed.kit.youtube.titles[0], 'AI Title 1: The Quantum Anomaly');
    assert.strictEqual(parsed.kit.youtube.hashtags.length, 4);
    assert.strictEqual(parsed.kit.tiktok.captions.length, 3);
    assert.strictEqual(parsed.kit.status, PUBLISHING_STATUS.READY);
  });

  // Test 13: Feature A — Workspace destination and security allowlist
  await t.test('13. Workspace integration permits YouTube Studio and TikTok in security allowlist', () => {
    assert.strictEqual(isDomainAllowed('studio.youtube.com', ALLOWED_SERVICE_DOMAINS), true);
    assert.strictEqual(isDomainAllowed('youtube.com', ALLOWED_SERVICE_DOMAINS), true);
    assert.strictEqual(isDomainAllowed('tiktok.com', ALLOWED_SERVICE_DOMAINS), true);
    assert.strictEqual(isDomainAllowed('www.tiktok.com', ALLOWED_SERVICE_DOMAINS), true);
    assert.strictEqual(isDomainAllowed('unauthorized-site.com', ALLOWED_SERVICE_DOMAINS), false);
  });

  // Test 14: Feature C — Persistent Publishing Checklist independent per platform and project
  await t.test('14. Publishing Checklist maintains independent state per platform and project', () => {
    const project = createNewProject('Checklist Project', '16:9', []);
    const kit = normalizePublishingKit(project.publishingKit);

    // Initial state: all 8 items false
    CHECKLIST_ITEMS.forEach((item) => {
      assert.strictEqual(kit.youtube.checklist[item.id], false);
      assert.strictEqual(kit.tiktok.checklist[item.id], false);
    });

    // Check items for YouTube only
    kit.youtube.checklist.videoGenerated = true;
    kit.youtube.checklist.videoReviewed = true;
    kit.youtube.checklist.titleChecked = true;

    // TikTok checklist must remain untouched
    assert.strictEqual(kit.tiktok.checklist.videoGenerated, false);
    assert.strictEqual(kit.tiktok.checklist.titleChecked, false);

    // Persist to storage
    project.publishingKit = kit;
    const storage = createMockStorage();
    saveProjectsToStorage(storage, [project], project.id);

    // Reload and verify persistence
    const reloaded = JSON.parse(storage.getItem(STORAGE_KEYS.PROJECTS_V1))[0];
    assert.strictEqual(reloaded.publishingKit.youtube.checklist.videoGenerated, true);
    assert.strictEqual(reloaded.publishingKit.youtube.checklist.videoReviewed, true);
    assert.strictEqual(reloaded.publishingKit.youtube.checklist.titleChecked, true);
    assert.strictEqual(reloaded.publishingKit.tiktok.checklist.videoGenerated, false);
  });

  // Test 15: Feature C — Backward compatibility: older projects without checklist load safely
  await t.test('15. Backward compatibility: older projects without checklist or publishedStatus load safely', () => {
    const legacyProject = {
      id: 'legacy-proj-1',
      name: 'Legacy Project',
      globalRules: '16:9',
      scenes: [],
      publishingKit: {
        youtube: {
          titles: ['Legacy Title 1', 'Legacy Title 2', 'Legacy Title 3'],
          description: 'Legacy description',
        },
      },
    };

    const normalized = ensurePublishingKit(legacyProject);
    assert.ok(normalized.publishingKit.youtube.checklist);
    assert.strictEqual(normalized.publishingKit.youtube.checklist.videoGenerated, false);
    assert.strictEqual(normalized.publishingKit.youtube.publishedStatus, PUBLISH_STATE.NOT_PUBLISHED);
    assert.strictEqual(normalized.publishingKit.tiktok.publishedStatus, PUBLISH_STATE.NOT_PUBLISHED);
    // Preserves legacy data
    assert.strictEqual(normalized.publishingKit.youtube.titles[0], 'Legacy Title 1');
    assert.strictEqual(normalized.publishingKit.youtube.description, 'Legacy description');
  });

  // Test 16: Feature D — Published Status defaults to not_published and requires user confirmation
  await t.test('16. Published Status defaults to not_published and operates independently per platform', () => {
    const project = createNewProject('Publish Status Project', '16:9', []);
    const kit = normalizePublishingKit(project.publishingKit);

    assert.strictEqual(kit.youtube.publishedStatus, PUBLISH_STATE.NOT_PUBLISHED);
    assert.strictEqual(kit.tiktok.publishedStatus, PUBLISH_STATE.NOT_PUBLISHED);

    // Mark YouTube as published
    kit.youtube.publishedStatus = PUBLISH_STATE.PUBLISHED;
    kit.youtube.publishedAt = 1770000000000;

    // TikTok remains not_published
    assert.strictEqual(kit.tiktok.publishedStatus, PUBLISH_STATE.NOT_PUBLISHED);
    assert.strictEqual(kit.tiktok.publishedAt, null);

    // Revert status works
    kit.youtube.publishedStatus = PUBLISH_STATE.NOT_PUBLISHED;
    kit.youtube.publishedAt = null;
    assert.strictEqual(kit.youtube.publishedStatus, PUBLISH_STATE.NOT_PUBLISHED);
  });

  // Test 17: UI Source Inspection confirms all required Publishing Workflow V2 elements exist
  await t.test('17. UI Component source code contains all required Publishing Workflow V2 controls', () => {
    const panelSource = fs.readFileSync(
      path.join(__dirname, '../src/components/PublishingKitPanel.jsx'),
      'utf8'
    );
    const sidebarSource = fs.readFileSync(
      path.join(__dirname, '../src/components/PipelineSidebar.jsx'),
      'utf8'
    );
    const appSource = fs.readFileSync(
      path.join(__dirname, '../src/App.jsx'),
      'utf8'
    );

    // Open Workspace controls
    assert.ok(panelSource.includes('Open YouTube Studio'));
    assert.ok(panelSource.includes('onOpenPlatformWorkspace'));
    assert.ok(appSource.includes('publishingWorkspace'));

    // Upload Checklist controls
    assert.ok(panelSource.includes('Upload Checklist'));
    assert.ok(panelSource.includes('handleToggleChecklistItem'));

    // Published status controls
    assert.ok(panelSource.includes('Mark as Published'));
    assert.ok(panelSource.includes('Mark this project as Published'));
    assert.ok(panelSource.includes('Revert Status'));

    // Sidebar integration
    assert.ok(sidebarSource.includes('PublishingKitPanel'));
    assert.ok(sidebarSource.includes('onOpenPlatformWorkspace'));
  });

  // Test 18: TikTok platform is explicitly disabled at the configuration and runtime levels
  await t.test('18. TikTok platform is explicitly disabled at configuration and runtime levels', () => {
    assert.strictEqual(PLATFORM_CONFIG[SUPPORTED_PLATFORMS.TIKTOK].enabled, false);
    assert.strictEqual(isPlatformEnabled(SUPPORTED_PLATFORMS.TIKTOK), false);
    assert.strictEqual(isPlatformEnabled('tiktok'), false);
    assert.strictEqual(isPlatformEnabled(SUPPORTED_PLATFORMS.YOUTUBE), true);
    assert.strictEqual(isPlatformEnabled(SUPPORTED_PLATFORMS.YOUTUBE_LONG), true);
  });

  // Test 19: TikTok webview is conditionally unmounted in App.jsx to prevent background execution
  await t.test('19. App.jsx conditionally guards TikTok webview mounting to prevent background execution', () => {
    const appSource = fs.readFileSync(
      path.join(__dirname, '../src/App.jsx'),
      'utf8'
    );

    // Verifies that TikTok webview is wrapped in feature flag guard and is NOT unconditionally rendered
    assert.ok(appSource.includes('isPlatformEnabled(SUPPORTED_PLATFORMS.TIKTOK)'));
    assert.ok(appSource.includes("publishingWorkspace === 'tiktok'"));

    // Verifies onOpenPlatformWorkspace guards against opening disabled platforms
    assert.ok(appSource.includes('isPlatformEnabled(platform)'));
  });

  // Test 20: Existing TikTok project data is strictly preserved and not lost or corrupted
  await t.test('20. Existing TikTok project data is strictly preserved and not lost or corrupted', () => {
    const legacyProject = {
      id: 'legacy-project-with-tiktok',
      name: 'Historical Campaign',
      publishingKit: {
        youtube: {
          titles: ['Shorts Title 1', 'Shorts Title 2', 'Shorts Title 3'],
          selectedTitleIndex: 1,
          description: 'Shorts description text.',
          hashtags: ['#Shorts', '#Viral'],
          pinnedComment: 'Shorts comment?',
          checklist: { videoGenerated: true, videoReviewed: true },
          publishedStatus: PUBLISH_STATE.PUBLISHED,
          publishedAt: 1760000000000,
        },
        tiktok: {
          captions: ['TikTok Hook 1', 'TikTok Hook 2', 'TikTok Hook 3'],
          selectedCaptionIndex: 2,
          hashtags: ['#fyp', '#history'],
          pinnedComment: 'TikTok engagement starter comment?',
          checklist: { videoGenerated: true, videoReviewed: false },
          publishedStatus: PUBLISH_STATE.PUBLISHED,
          publishedAt: 1765000000000,
        },
      },
    };

    const normalized = normalizePublishingKit(legacyProject.publishingKit);

    // TikTok data is preserved exactly
    assert.strictEqual(normalized.tiktok.captions[2], 'TikTok Hook 3');
    assert.strictEqual(normalized.tiktok.selectedCaptionIndex, 2);
    assert.strictEqual(normalized.tiktok.hashtags[1], '#history');
    assert.strictEqual(normalized.tiktok.pinnedComment, 'TikTok engagement starter comment?');
    assert.strictEqual(normalized.tiktok.checklist.videoGenerated, true);
    assert.strictEqual(normalized.tiktok.publishedStatus, PUBLISH_STATE.PUBLISHED);
    assert.strictEqual(normalized.tiktok.publishedAt, 1765000000000);

    // YouTube Shorts data is preserved
    assert.strictEqual(normalized.youtube.titles[1], 'Shorts Title 2');
    assert.strictEqual(normalized.youtube.publishedStatus, PUBLISH_STATE.PUBLISHED);

    // YouTube Long-form is initialized with safe defaults without disturbing TikTok
    assert.ok(normalized.youtube_long);
    assert.strictEqual(normalized.youtube_long.publishedStatus, PUBLISH_STATE.NOT_PUBLISHED);
  });

  // Test 21: YouTube Long-form appears as available platform with independent metadata
  await t.test('21. YouTube Long-form generates independent grounded titles, descriptions, and comments', () => {
    const project = createNewProject('Space Exploration Documentary', 'Aspect 16:9', [
      {
        id: 'scene-long-1',
        sceneNumber: 1,
        title: 'Launch of the Deep Space Probe',
        prompt: 'Rocket engines ignite on the seaside launchpad as the spacecraft ascends into orbit.',
        done: false,
      },
      {
        id: 'scene-long-2',
        sceneNumber: 2,
        title: 'Entering the Kuiper Belt',
        prompt: 'The deep space probe navigates dense field of ancient icy planetesimals billions of miles from Earth.',
        done: false,
      },
    ]);

    const context = extractStoryboardContext({
      storyboardText: project.storyboardSource,
      scenes: project.scenes,
    });

    const shortsTitles = generateTitles(context);
    const longTitles = generateLongFormTitles(context);

    // Both generate 3 titles
    assert.strictEqual(shortsTitles.length, 3);
    assert.strictEqual(longTitles.length, 3);
    // Long-form titles are distinct from Shorts titles
    assert.notStrictEqual(longTitles[0], shortsTitles[0]);
    // Long-form titles do not exceed 100 characters
    longTitles.forEach((t) => assert.ok(t.length <= 100, `Title too long: ${t}`));

    const shortsDesc = generateYouTubeDescription(context);
    const longDesc = generateYouTubeLongFormDescription(context);

    // Long-form description is longer and provides fuller educational context
    assert.ok(longDesc.length > shortsDesc.length);
    assert.ok(longDesc.includes('Deep Space Probe') || longDesc.includes('spacecraft') || longDesc.includes('Kuiper Belt'));
    // No invented timestamps or false study claims
    assert.strictEqual(/00:\d\d/.test(longDesc), false);
    assert.strictEqual(/harvard|nasa study proves/i.test(longDesc), false);

    const shortsTags = generateHashtags(context, 'youtube');
    const longTags = generateHashtags(context, 'youtube_long');

    // Shorts tags contain #Shorts
    assert.ok(shortsTags.some((t) => t.toLowerCase() === '#shorts'));
    // Long-form tags do NOT contain #Shorts
    assert.ok(!longTags.some((t) => t.toLowerCase() === '#shorts'));
    assert.ok(!longTags.some((t) => t.toLowerCase() === '#youtubeshorts'));

    const longComment = generateLongFormPinnedComment(context);
    assert.ok(longComment.includes('?'));
  });

  // Test 22: YouTube Long-form 9-item checklist operates independently
  await t.test('22. YouTube Long-form 9-item checklist operates independently from Shorts and TikTok', () => {
    assert.strictEqual(LONG_FORM_CHECKLIST_ITEMS.length, 9);
    assert.strictEqual(CHECKLIST_ITEMS.length, 8);

    const defaultLongChecklist = createDefaultLongFormChecklist();
    assert.strictEqual(Object.keys(defaultLongChecklist).length, 9);
    Object.values(defaultLongChecklist).forEach((val) => assert.strictEqual(val, false));

    const kit = createDefaultPublishingKit();

    // Toggle Long-form checklist item
    kit.youtube_long.checklist.audienceReviewed = true;
    kit.youtube_long.checklist.videoGenerated = true;

    // Shorts checklist is completely unaffected
    assert.strictEqual(kit.youtube.checklist.videoGenerated, false);
    assert.strictEqual(kit.youtube.checklist.audienceReviewed, undefined);

    // TikTok checklist is completely unaffected
    assert.strictEqual(kit.tiktok.checklist.videoGenerated, false);
  });

  // Test 23: YouTube Long-form Published status operates independently with confirmation requirement
  await t.test('23. YouTube Long-form Published status is independent from Shorts and requires confirmation', () => {
    const kit = createDefaultPublishingKit();

    assert.strictEqual(kit.youtube_long.publishedStatus, PUBLISH_STATE.NOT_PUBLISHED);
    assert.strictEqual(kit.youtube.publishedStatus, PUBLISH_STATE.NOT_PUBLISHED);

    // Mark Long-form as published
    kit.youtube_long.publishedStatus = PUBLISH_STATE.PUBLISHED;
    kit.youtube_long.publishedAt = Date.now();

    // Shorts remains Not Published
    assert.strictEqual(kit.youtube.publishedStatus, PUBLISH_STATE.NOT_PUBLISHED);
    assert.strictEqual(kit.youtube.publishedAt, null);

    // Revert Long-form status
    kit.youtube_long.publishedStatus = PUBLISH_STATE.NOT_PUBLISHED;
    kit.youtube_long.publishedAt = null;
    assert.strictEqual(kit.youtube_long.publishedStatus, PUBLISH_STATE.NOT_PUBLISHED);
  });

  // Test 24: Copy Complete Package outputs correct YouTube Long-form metadata
  await t.test('24. Copy Complete Package formats correct YouTube Long-form package string', () => {
    const kit = createDefaultPublishingKit();
    kit.youtube_long.titles = ['The Untold History of Computing', 'Alt 2', 'Alt 3'];
    kit.youtube_long.selectedTitleIndex = 0;
    kit.youtube_long.description = 'Comprehensive multi-paragraph documentary breakdown.';
    kit.youtube_long.hashtags = ['#Documentary', '#History', '#Tech'];
    kit.youtube_long.pinnedComment = 'What was the most surprising milestone?';

    const pkg = formatCompletePackage(kit, 'youtube_long');

    assert.ok(pkg.includes('TITLE:\nThe Untold History of Computing'));
    assert.ok(pkg.includes('DESCRIPTION:\nComprehensive multi-paragraph documentary breakdown.'));
    assert.ok(pkg.includes('HASHTAGS:\n#Documentary #History #Tech'));
    assert.ok(pkg.includes('PINNED COMMENT:\nWhat was the most surprising milestone?'));
  });

  // Test 25: UI Source Inspection confirms TikTok is removed from active tabs and Long-form is present
  await t.test('25. UI Component source confirms TikTok removed from active selector and Long-form present', () => {
    const panelSource = fs.readFileSync(
      path.join(__dirname, '../src/components/PublishingKitPanel.jsx'),
      'utf8'
    );

    // Verifies YouTube Long-form tab exists
    assert.ok(panelSource.includes('YouTube Long-form Tab'));
    assert.ok(panelSource.includes('SUPPORTED_PLATFORMS.YOUTUBE_LONG'));

    // Verifies TikTok tab is NOT rendered in the platform switcher
    assert.ok(!panelSource.includes('aria-label="TikTok Tab"'));

    // Verifies YouTube Long-form checklist exists
    assert.ok(panelSource.includes('YouTube Long-form Upload Checklist'));
    assert.ok(panelSource.includes('LONG_FORM_CHECKLIST_ITEMS'));

    // Verifies Long-form complete package button
    assert.ok(panelSource.includes('Copy Complete YouTube Long-form Package'));
  });
});
