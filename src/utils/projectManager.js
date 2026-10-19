/**
 * Project Management & Data Persistence for AI Mission Control.
 * Manages versioned projects, migrations, schema validation, import/export, and autosave.
 */

export const SCHEMA_VERSION = 1;
export const SCHEMA_IDENTIFIER = 'ai-mission-control/project-v1';
export const BACKUP_IDENTIFIER = 'ai-mission-control/backup-v1';

import {
  createDefaultPublishingKit,
  normalizePublishingKit,
  PUBLISHING_STATUS,
  computeStoryboardFingerprint,
} from './publishingKitGenerator.js';

export const STORAGE_KEYS = {
  PROJECTS_V1: 'aimc_projects_v1',
  ACTIVE_PROJECT_ID: 'aimc_active_project_id',
  SIDEBAR_COLLAPSED: 'aimc_sidebar_collapsed',
  LEGACY_GLOBAL_RULES: 'aimc_global_rules',
  LEGACY_SCENE_CARDS: 'aimc_scene_cards',
};

export const DEFAULT_GLOBAL_RULES =
  'Aspect Ratio 16:9, Unreal Engine 5.4 cinematic lighting, octane render, 8k hyper-detailed, photorealistic, volumetric fog, dynamic camera angles.';

export const DEFAULT_SCENES = [
  {
    id: 'scene-1',
    sceneNumber: 1,
    title: 'Scene 1: Opening Hook',
    prompt:
      'Cinematic wide shot of cybernetic command center with holographic screens glowing in neon blue and amber, cinematic depth of field.',
    done: false,
  },
  {
    id: 'scene-2',
    sceneNumber: 2,
    title: 'Scene 2: Problem Statement',
    prompt:
      'Medium close-up of protagonist analyzing multi-screen AI telemetry as neural network nodes pulse with urgent amber alerts.',
    done: false,
  },
  {
    id: 'scene-3',
    sceneNumber: 3,
    title: 'Scene 3: AI Pipeline Solution',
    prompt:
      'Dynamic 3D camera pan across Claude, ChatGPT, Gemini neural pathways connecting into a unified creator command center.',
    done: false,
  },
];

/**
 * Validates a Scene Card structure.
 * @param {any} scene
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSceneCard(scene) {
  const errors = [];
  if (!scene || typeof scene !== 'object') {
    return { valid: false, errors: ['Scene must be an object'] };
  }

  if (typeof scene.id !== 'string' || !scene.id.trim()) {
    errors.push('Scene must have a valid string id');
  }

  const num = parseInt(scene.sceneNumber, 10);
  if (isNaN(num) || num < 0) {
    errors.push('Scene sceneNumber must be a non-negative integer');
  }

  if (typeof scene.title !== 'string') {
    errors.push('Scene title must be a string');
  }

  if (typeof scene.prompt !== 'string') {
    errors.push('Scene prompt must be a string');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a Project model.
 * @param {any} project
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateProject(project) {
  const errors = [];
  if (!project || typeof project !== 'object') {
    return { valid: false, errors: ['Project must be an object'] };
  }

  if (typeof project.id !== 'string' || !project.id.trim()) {
    errors.push('Project must have a valid non-empty id');
  }

  if (typeof project.name !== 'string' || !project.name.trim()) {
    errors.push('Project must have a valid non-empty name');
  }

  if (typeof project.globalRules !== 'string') {
    errors.push('Project globalRules must be a string');
  }

  if (!Array.isArray(project.scenes)) {
    errors.push('Project scenes must be an array');
  } else {
    project.scenes.forEach((scene, index) => {
      const sceneValidation = validateSceneCard(scene);
      if (!sceneValidation.valid) {
        errors.push(`Scene at index ${index} invalid: ${sceneValidation.errors.join(', ')}`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generates a unique, non-empty project ID.
 * @returns {string}
 */
export function generateProjectId() {
  return `proj-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Creates a brand new Project object.
 * @param {string} [name='New Project']
 * @param {string} [globalRules=DEFAULT_GLOBAL_RULES]
 * @param {Array} [scenes=DEFAULT_SCENES]
 * @returns {Object}
 */
export function createNewProject(
  name = 'New Project',
  globalRules = DEFAULT_GLOBAL_RULES,
  scenes = DEFAULT_SCENES,
  storyboardSource = '',
  publishingKit = null
) {
  const now = Date.now();
  return {
    id: generateProjectId(),
    name: name.trim() || 'Untitled Project',
    createdAt: now,
    updatedAt: now,
    globalRules: typeof globalRules === 'string' ? globalRules : DEFAULT_GLOBAL_RULES,
    scenes: Array.isArray(scenes) ? JSON.parse(JSON.stringify(scenes)) : JSON.parse(JSON.stringify(DEFAULT_SCENES)),
    storyboardSource: typeof storyboardSource === 'string' ? storyboardSource : '',
    publishingKit: publishingKit || createDefaultPublishingKit(),
    metadata: {
      version: SCHEMA_VERSION,
    },
  };
}

/**
 * Migrates legacy storage keys ('aimc_global_rules', 'aimc_scene_cards')
 * into the versioned Project collection.
 * @param {Storage} storage - localStorage instance
 * @returns {{ migrated: boolean, projects: Object[], activeId: string }}
 */
export function migrateLegacyData(storage) {
  if (!storage) {
    const initial = createNewProject('Default Project');
    return { migrated: false, projects: [initial], activeId: initial.id };
  }

  try {
    const rawProjects = storage.getItem(STORAGE_KEYS.PROJECTS_V1);
    if (rawProjects) {
      const parsed = JSON.parse(rawProjects);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const validProjects = parsed.filter((p) => validateProject(p).valid);
        if (validProjects.length > 0) {
          let activeId = storage.getItem(STORAGE_KEYS.ACTIVE_PROJECT_ID);
          if (!activeId || !validProjects.some((p) => p.id === activeId)) {
            activeId = validProjects[0].id;
          }
          return { migrated: false, projects: validProjects, activeId };
        }
      }
    }
  } catch (err) {
    console.warn('[ProjectManager] Failed parsing existing projects, attempting migration:', err.message);
  }

  // Attempt migration from legacy single-project keys
  let legacyRules = DEFAULT_GLOBAL_RULES;
  let legacyScenes = DEFAULT_SCENES;
  let hasLegacy = false;

  try {
    const rawRules = storage.getItem(STORAGE_KEYS.LEGACY_GLOBAL_RULES);
    if (typeof rawRules === 'string' && rawRules.trim()) {
      legacyRules = rawRules;
      hasLegacy = true;
    }

    const rawScenes = storage.getItem(STORAGE_KEYS.LEGACY_SCENE_CARDS);
    if (rawScenes) {
      const parsed = JSON.parse(rawScenes);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.filter((s) => validateSceneCard(s).valid);
        if (valid.length > 0) {
          legacyScenes = valid;
          hasLegacy = true;
        }
      }
    }
  } catch (err) {
    console.warn('[ProjectManager] Failed reading legacy data:', err.message);
  }

  const migratedProject = createNewProject('Default Project', legacyRules, legacyScenes);
  migratedProject.metadata = {
    migratedFromLegacy: hasLegacy,
    migratedAt: Date.now(),
    version: SCHEMA_VERSION,
  };

  const projects = [migratedProject];
  const activeId = migratedProject.id;

  try {
    storage.setItem(STORAGE_KEYS.PROJECTS_V1, JSON.stringify(projects));
    storage.setItem(STORAGE_KEYS.ACTIVE_PROJECT_ID, activeId);
  } catch (err) {
    console.error('[ProjectManager] Failed to persist migrated project:', err.message);
  }

  return { migrated: hasLegacy, projects, activeId };
}

/**
 * Safely persists project collection to storage.
 * @param {Storage} storage
 * @param {Object[]} projects
 * @param {string} activeProjectId
 * @returns {{ success: boolean, error?: string }}
 */
export function saveProjectsToStorage(storage, projects, activeProjectId) {
  if (!storage) {
    return { success: false, error: 'Storage is not available' };
  }

  if (!Array.isArray(projects) || projects.length === 0) {
    return { success: false, error: 'Cannot save empty project list' };
  }

  // Validate all projects before writing
  for (let i = 0; i < projects.length; i++) {
    const val = validateProject(projects[i]);
    if (!val.valid) {
      return { success: false, error: `Invalid project at index ${i}: ${val.errors.join(', ')}` };
    }
  }

  try {
    storage.setItem(STORAGE_KEYS.PROJECTS_V1, JSON.stringify(projects));
    if (activeProjectId) {
      storage.setItem(STORAGE_KEYS.ACTIVE_PROJECT_ID, activeProjectId);
    }
    return { success: true };
  } catch (err) {
    console.error('[ProjectManager] Storage write failed:', err.message);
    const isQuota =
      err.name === 'QuotaExceededError' ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err.code === 22;
    return {
      success: false,
      error: isQuota ? 'Storage quota exceeded. Please export or delete older projects.' : err.message,
    };
  }
}

/**
 * Creates a clean export object for a single project (strictly excluding sensitive credentials).
 * @param {Object} project
 * @returns {Object}
 */
export function exportProjectToJson(project) {
  const val = validateProject(project);
  if (!val.valid) {
    throw new Error(`Cannot export invalid project: ${val.errors.join(', ')}`);
  }

  // Clean payload guaranteeing no secrets
  const cleanProject = {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt || Date.now(),
    updatedAt: project.updatedAt || Date.now(),
    globalRules: project.globalRules || '',
    scenes: (project.scenes || []).map((s) => ({
      id: s.id,
      sceneNumber: s.sceneNumber,
      title: s.title,
      prompt: s.prompt,
      done: Boolean(s.done),
    })),
    metadata: {
      description: project.metadata?.description || '',
      tags: Array.isArray(project.metadata?.tags) ? project.metadata.tags : [],
    },
  };

  return {
    $schema: SCHEMA_IDENTIFIER,
    version: SCHEMA_VERSION,
    exportedAt: Date.now(),
    project: cleanProject,
  };
}

/**
 * Validates and parses an imported project JSON string or object.
 * @param {string|Object} input
 * @returns {{ valid: boolean, project?: Object, errors: string[] }}
 */
export function parseAndValidateProjectImport(input) {
  let parsed = input;
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
    } catch (err) {
      return { valid: false, errors: [`JSON syntax error: ${err.message}`] };
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, errors: ['Import file must be a JSON object'] };
  }

  // Check schema version compatibility
  if (parsed.version && parsed.version > SCHEMA_VERSION) {
    return {
      valid: false,
      errors: [`Unsupported schema version (${parsed.version}). Maximum supported version is ${SCHEMA_VERSION}.`],
    };
  }

  const projectData = parsed.project || parsed;
  const validation = validateProject(projectData);
  if (!validation.valid) {
    return { valid: false, errors: validation.errors };
  }

  // Regenerate ID on import to avoid collision with existing projects
  const importedProject = {
    ...projectData,
    id: generateProjectId(),
    updatedAt: Date.now(),
  };

  return { valid: true, project: importedProject, errors: [] };
}

export const GLOBAL_RULES_STRATEGY = {
  USE_IMPORTED: 'imported',
  KEEP_ACTIVE: 'keep_active',
  USE_DEFAULT: 'use_default',
  CLEAR: 'clear',
};

/**
 * Safely applies a parsed storyboard to a project with explicit Global Rules strategy
 * and explicit replacement or merge modes.
 *
 * @param {Object} project - Active project
 * @param {Object} parsedResult - Output from parsePromptText
 * @param {Object} [options]
 * @param {string} [options.globalRulesStrategy='imported'] - One of GLOBAL_RULES_STRATEGY
 * @param {string} [options.mode='replace'] - 'replace' or 'append'
 * @returns {Object} Updated project object
 */
export function applyParsedStoryboardToProject(
  project,
  parsedResult,
  {
    globalRulesStrategy = GLOBAL_RULES_STRATEGY.USE_IMPORTED,
    mode = 'replace',
    storyboardSource = undefined,
  } = {}
) {
  if (!project || typeof project !== 'object') {
    throw new Error('Project must be a valid object');
  }
  if (!parsedResult || !Array.isArray(parsedResult.scenes)) {
    throw new Error('Parsed result must contain an array of scenes');
  }

  let finalRules = project.globalRules || '';

  if (parsedResult.globalRules && globalRulesStrategy === GLOBAL_RULES_STRATEGY.USE_IMPORTED) {
    finalRules = parsedResult.globalRules;
  } else if (!parsedResult.globalRules) {
    if (globalRulesStrategy === GLOBAL_RULES_STRATEGY.CLEAR) {
      finalRules = '';
    } else if (globalRulesStrategy === GLOBAL_RULES_STRATEGY.USE_DEFAULT) {
      finalRules = DEFAULT_GLOBAL_RULES;
    } else {
      // KEEP_ACTIVE: preserve project.globalRules
      finalRules = project.globalRules || '';
    }
  }

  const finalScenes =
    mode === 'append'
      ? [...(project.scenes || []), ...parsedResult.scenes]
      : [...parsedResult.scenes];

  const finalStoryboard =
    typeof storyboardSource === 'string'
      ? storyboardSource
      : project.storyboardSource || '';

  const updatedProject = {
    ...project,
    globalRules: finalRules,
    scenes: finalScenes,
    storyboardSource: finalStoryboard,
    updatedAt: Date.now(),
  };

  // If a publishing kit was previously generated, check if the storyboard/scenes changed
  if (project.publishingKit && project.publishingKit.lastGeneratedAt) {
    const newFp = computeStoryboardFingerprint(updatedProject);
    if (project.publishingKit.sourceFingerprint && project.publishingKit.sourceFingerprint !== newFp) {
      updatedProject.publishingKit = {
        ...project.publishingKit,
        status: PUBLISHING_STATUS.NEEDS_REVIEW,
      };
    }
  }

  return updatedProject;
}

/**
 * Ensures a project has an initialized Publishing Kit.
 * @param {Object} project
 * @returns {Object}
 */
export function ensurePublishingKit(project) {
  if (!project || typeof project !== 'object') return project;
  return {
    ...project,
    publishingKit: normalizePublishingKit(project.publishingKit),
  };
}

