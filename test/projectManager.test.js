const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateSceneCard,
  validateProject,
  createNewProject,
  migrateLegacyData,
  saveProjectsToStorage,
  exportProjectToJson,
  parseAndValidateProjectImport,
  STORAGE_KEYS,
  SCHEMA_VERSION,
  SCHEMA_IDENTIFIER,
} = require('../src/utils/projectManager');

// Mock localStorage helper
function createMockStorage(initialData = {}) {
  const store = new Map(Object.entries(initialData));
  return {
    getItem: (key) => store.get(key) || null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    _store: store,
  };
}

test('Project Schema Validation', async (t) => {
  await t.test('validates valid scene cards', () => {
    const valid = {
      id: 'scene-1',
      sceneNumber: 1,
      title: 'Scene 1: Intro',
      prompt: 'Wide shot of mountains.',
      done: false,
    };
    const res = validateSceneCard(valid);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.errors.length, 0);
  });

  await t.test('rejects invalid scene cards', () => {
    assert.strictEqual(validateSceneCard(null).valid, false);
    assert.strictEqual(validateSceneCard({ id: '', sceneNumber: 1 }).valid, false);
    assert.strictEqual(validateSceneCard({ id: '1', sceneNumber: -1, title: 'T', prompt: 'P' }).valid, false);
    assert.strictEqual(validateSceneCard({ id: '1', sceneNumber: 'abc', title: 'T', prompt: 'P' }).valid, false);
  });

  await t.test('validates complete project model', () => {
    const proj = createNewProject('Test Project', 'Custom Rules', [
      { id: 's-1', sceneNumber: 1, title: 'S1', prompt: 'Prompt', done: false },
    ]);
    const res = validateProject(proj);
    assert.strictEqual(res.valid, true);
  });

  await t.test('rejects project with missing fields or corrupt scenes', () => {
    assert.strictEqual(validateProject(null).valid, false);
    assert.strictEqual(validateProject({ id: 'p1' }).valid, false);
    assert.strictEqual(
      validateProject({
        id: 'p1',
        name: 'Project',
        globalRules: 'Rules',
        scenes: [{ id: 'corrupt' }],
      }).valid,
      false
    );
  });
});

test('Legacy Storage Migration', async (t) => {
  await t.test('migrates existing legacy single-project data', () => {
    const legacyScenes = [
      { id: 'legacy-1', sceneNumber: 1, title: 'Old Scene 1', prompt: 'Old prompt', done: true },
    ];
    const legacyRules = 'Aspect Ratio 16:9, Vintage 35mm film.';

    const storage = createMockStorage({
      [STORAGE_KEYS.LEGACY_GLOBAL_RULES]: legacyRules,
      [STORAGE_KEYS.LEGACY_SCENE_CARDS]: JSON.stringify(legacyScenes),
    });

    const res = migrateLegacyData(storage);
    assert.strictEqual(res.migrated, true);
    assert.strictEqual(res.projects.length, 1);
    assert.strictEqual(res.projects[0].globalRules, legacyRules);
    assert.strictEqual(res.projects[0].scenes.length, 1);
    assert.strictEqual(res.projects[0].scenes[0].title, 'Old Scene 1');
    assert.strictEqual(res.projects[0].scenes[0].done, true);
    assert.strictEqual(res.projects[0].metadata.migratedFromLegacy, true);

    // Verify written to storage
    assert.ok(storage.getItem(STORAGE_KEYS.PROJECTS_V1));
    assert.strictEqual(storage.getItem(STORAGE_KEYS.ACTIVE_PROJECT_ID), res.activeId);
  });

  await t.test('does not re-migrate if versioned projects already exist', () => {
    const existingProjects = [
      createNewProject('Existing Proj A'),
      createNewProject('Existing Proj B'),
    ];

    const storage = createMockStorage({
      [STORAGE_KEYS.PROJECTS_V1]: JSON.stringify(existingProjects),
      [STORAGE_KEYS.ACTIVE_PROJECT_ID]: existingProjects[1].id,
      [STORAGE_KEYS.LEGACY_GLOBAL_RULES]: 'Should not overwrite',
    });

    const res = migrateLegacyData(storage);
    assert.strictEqual(res.migrated, false);
    assert.strictEqual(res.projects.length, 2);
    assert.strictEqual(res.activeId, existingProjects[1].id);
  });

  await t.test('recovers safely from corrupt legacy JSON without crashing', () => {
    const storage = createMockStorage({
      [STORAGE_KEYS.LEGACY_SCENE_CARDS]: '{ invalid json...',
      [STORAGE_KEYS.LEGACY_GLOBAL_RULES]: 'Valid rules',
    });

    const res = migrateLegacyData(storage);
    assert.strictEqual(res.projects.length, 1);
    assert.strictEqual(res.projects[0].globalRules, 'Valid rules');
    assert.ok(res.projects[0].scenes.length > 0, 'Falls back to default scenes');
  });
});

test('Multi-Project Isolation and Operations', async (t) => {
  await t.test('maintains strict isolation between projects', () => {
    const projA = createNewProject('Project A', 'Rules A', [
      { id: 's-a1', sceneNumber: 1, title: 'Scene A1', prompt: 'Prompt A', done: false },
    ]);
    const projB = createNewProject('Project B', 'Rules B', [
      { id: 's-b1', sceneNumber: 1, title: 'Scene B1', prompt: 'Prompt B', done: true },
    ]);

    assert.notStrictEqual(projA.id, projB.id);
    assert.notStrictEqual(projA.globalRules, projB.globalRules);
    assert.notStrictEqual(projA.scenes[0].title, projB.scenes[0].title);
  });

  await t.test('duplicates project with clean ID and updated name', () => {
    const original = createNewProject('Original Movie', 'Rules', [
      { id: 's-1', sceneNumber: 1, title: 'S1', prompt: 'P', done: false },
    ]);

    const copy = createNewProject(
      `${original.name} (Copy)`,
      original.globalRules,
      original.scenes
    );

    assert.notStrictEqual(copy.id, original.id);
    assert.strictEqual(copy.name, 'Original Movie (Copy)');
    assert.strictEqual(copy.scenes.length, original.scenes.length);
  });
});

test('Storage Persistence & Quota Error Handling', async (t) => {
  await t.test('successfully saves valid projects to storage', () => {
    const storage = createMockStorage();
    const projects = [createNewProject('Project 1')];

    const res = saveProjectsToStorage(storage, projects, projects[0].id);
    assert.strictEqual(res.success, true);
    assert.ok(storage.getItem(STORAGE_KEYS.PROJECTS_V1));
  });

  await t.test('rejects saving empty project collection', () => {
    const storage = createMockStorage();
    const res = saveProjectsToStorage(storage, [], null);
    assert.strictEqual(res.success, false);
    assert.match(res.error, /empty project list/i);
  });

  await t.test('handles storage quota exceeded gracefully', () => {
    const quotaStorage = {
      getItem: () => null,
      setItem: () => {
        const err = new Error('Quota exceeded');
        err.name = 'QuotaExceededError';
        err.code = 22;
        throw err;
      },
    };

    const projects = [createNewProject('Project 1')];
    const res = saveProjectsToStorage(quotaStorage, projects, projects[0].id);
    assert.strictEqual(res.success, false);
    assert.match(res.error, /Storage quota exceeded/i);
  });
});

test('Project Export and Import Validation', async (t) => {
  await t.test('exports project to structured JSON without credentials', () => {
    const proj = createNewProject('Sci-Fi Short', 'Cyberpunk lighting', [
      { id: 's-1', sceneNumber: 1, title: 'Scene 1', prompt: 'Neon shot', done: false },
    ]);

    const exported = exportProjectToJson(proj);
    assert.strictEqual(exported.$schema, SCHEMA_IDENTIFIER);
    assert.strictEqual(exported.version, SCHEMA_VERSION);
    assert.strictEqual(exported.project.name, 'Sci-Fi Short');
    assert.strictEqual(exported.project.scenes.length, 1);

    // Verify no sensitive tokens or cookies
    const stringified = JSON.stringify(exported);
    assert.strictEqual(stringified.includes('cookie'), false);
    assert.strictEqual(stringified.includes('token'), false);
    assert.strictEqual(stringified.includes('password'), false);
  });

  await t.test('validates and imports exported project with new unique ID', () => {
    const proj = createNewProject('Docu Series', 'Natural light', [
      { id: 's-1', sceneNumber: 1, title: 'Scene 1', prompt: 'Forest shot', done: false },
    ]);
    const exportedJson = JSON.stringify(exportProjectToJson(proj));

    const importResult = parseAndValidateProjectImport(exportedJson);
    assert.strictEqual(importResult.valid, true);
    assert.ok(importResult.project);
    assert.strictEqual(importResult.project.name, 'Docu Series');
    // Ensure ID regenerated to prevent collisions
    assert.notStrictEqual(importResult.project.id, proj.id);
  });

  await t.test('rejects malformed import JSON', () => {
    const res = parseAndValidateProjectImport('{ invalid json...');
    assert.strictEqual(res.valid, false);
    assert.match(res.errors[0], /JSON syntax error/i);
  });

  await t.test('rejects import with unsupported future schema version', () => {
    const futurePayload = {
      $schema: SCHEMA_IDENTIFIER,
      version: 999, // future version
      project: createNewProject('Future Project'),
    };

    const res = parseAndValidateProjectImport(JSON.stringify(futurePayload));
    assert.strictEqual(res.valid, false);
    assert.match(res.errors[0], /Unsupported schema version/i);
  });
});
