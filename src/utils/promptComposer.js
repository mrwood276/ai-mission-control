/**
 * Canonical Prompt Composition Engine & Quality Gate
 * Normalizes, composes, validates, and quality-checks final production prompts
 * for Google Flow and Gemini delivery.
 */

import { formatContinuitySummary } from './continuityManager.js';

/**
 * Estimates token count based on a standard ~4 characters per token heuristic for English prose.
 * Clearly labeled as an approximation.
 * @param {string} text
 * @returns {number}
 */
export function estimateTokenCount(text) {
  if (typeof text !== 'string' || !text.trim()) return 0;
  return Math.ceil(text.trim().length / 4);
}

/**
 * Detects whether the scene prompt already substantially duplicates the Global Rules text,
 * preventing redundant double-concatenation.
 * @param {string} scenePrompt
 * @param {string} globalRules
 * @returns {boolean}
 */
export function checkRulesDuplication(scenePrompt, globalRules) {
  if (!scenePrompt || !globalRules) return false;
  const cleanPrompt = scenePrompt.toLowerCase().replace(/\s+/g, ' ').trim();
  const cleanRules = globalRules.toLowerCase().replace(/\s+/g, ' ').trim();

  if (cleanRules.length < 20) return false;

  // Direct containment check
  if (cleanPrompt.includes(cleanRules)) return true;

  // Check if opening 60 chars of global rules match prompt
  const rulesPrefix = cleanRules.slice(0, 60);
  return cleanPrompt.includes(rulesPrefix);
}

/**
 * Detects contradictory aspect ratio or camera format directives.
 * @param {string} text
 * @returns {string[]} Contradiction warnings
 */
export function detectFormatContradictions(text) {
  const warnings = [];
  if (!text) return warnings;

  const has16x9 = /\b(?:16:9|widescreen|horizontal)\b/i.test(text);
  const has9x16 = /\b(?:9:16|vertical|portrait|tiktok|shorts|reels)\b/i.test(text);
  const has1x1 = /\b(?:1:1|square)\b/i.test(text);

  const matchedFormats = [has16x9 && '16:9 (horizontal)', has9x16 && '9:16 (vertical)', has1x1 && '1:1 (square)'].filter(Boolean);

  if (matchedFormats.length > 1) {
    warnings.push(
      `Conflicting aspect ratio indicators detected in prompt: ${matchedFormats.join(' vs ')}.`
    );
  }

  return warnings;
}

/**
 * Deterministically composes the final production prompt from project rules,
 * scene prompt (image or video), reference directives, and optional continuity context.
 *
 * @param {Object} params
 * @param {Object} params.scene - Scene object { id, sceneNumber, title, prompt, videoPrompt?, imagePrompt?, imageAsset? }
 * @param {string} [params.globalRules=''] - Project-level Global Rules
 * @param {Object} [params.continuityContext=null] - Optional continuity context object
 * @param {boolean} [params.includeGlobalRules=true] - Whether to prepend Global Rules
 * @param {boolean} [params.includeContinuity=false] - Whether to include continuity summary
 * @param {'video' | 'image'} [params.promptType='video'] - Target prompt type ('video' or 'image')
 * @param {boolean} [params.includeReferenceDirective=true] - Whether to append reference image directive for video prompts
 * @returns {{
 *   composedPrompt: string,
 *   charCount: number,
 *   tokenEstimate: number,
 *   isDuplicatedRules: boolean,
 *   hasGlobalRules: boolean,
 *   hasContinuity: boolean,
 *   hasReferenceDirective: boolean,
 *   promptType: string
 * }}
 */
export function composeProductionPrompt({
  scene,
  globalRules = '',
  continuityContext = null,
  includeGlobalRules = true,
  includeContinuity = false,
  promptType = 'video',
  includeReferenceDirective = true,
}) {
  if (!scene || typeof scene !== 'object') {
    return {
      composedPrompt: '',
      charCount: 0,
      tokenEstimate: 0,
      isDuplicatedRules: false,
      hasGlobalRules: false,
      hasContinuity: false,
      hasReferenceDirective: false,
      promptType,
    };
  }

  const isImage = promptType === 'image';
  const rawScenePrompt = (
    isImage
      ? (scene.imagePrompt || scene.prompt || '')
      : (scene.videoPrompt || scene.prompt || '')
  ).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  const rawGlobalRules = (globalRules || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  const isDuplicated = checkRulesDuplication(rawScenePrompt, rawGlobalRules);

  const sections = [];

  // Add Global Rules if approved and not already duplicated in scene body
  const shouldApplyRules = includeGlobalRules && rawGlobalRules.length > 0 && !isDuplicated;
  if (shouldApplyRules) {
    sections.push(rawGlobalRules);
  }

  // Add reference image directive for video prompts if asset exists
  let hasReferenceDirective = false;
  if (!isImage && scene.imageAsset && includeReferenceDirective) {
    const assetName = scene.imageAsset.name ? ` (${scene.imageAsset.name})` : '';
    sections.push(
      `[IMAGE REFERENCE: Maintain visual continuity with the reference image for Scene ${scene.sceneNumber}${assetName}. Preserve character appearance, wardrobe, environment, lighting, and palette.]`
    );
    hasReferenceDirective = true;
  }

  // Add optional continuity context
  const continuitySummary = includeContinuity && continuityContext ? formatContinuitySummary(continuityContext) : '';
  if (continuitySummary) {
    sections.push(continuitySummary);
  }

  // Add scene prompt
  if (rawScenePrompt) {
    sections.push(rawScenePrompt);
  }

  const composedPrompt = sections.join('\n\n').trim();

  return {
    composedPrompt,
    charCount: composedPrompt.length,
    tokenEstimate: estimateTokenCount(composedPrompt),
    isDuplicatedRules: isDuplicated,
    hasGlobalRules: shouldApplyRules,
    hasContinuity: Boolean(continuitySummary),
    hasReferenceDirective,
    promptType,
  };
}

/**
 * Runs a deterministic quality gate on the scene and its composed prompt.
 *
 * @param {Object} params
 * @param {Object} params.scene - Target scene
 * @param {string} params.composedPrompt - Final composed prompt
 * @param {string} [params.globalRules=''] - Global rules
 * @param {Object} [params.project=null] - Active project
 * @param {'video' | 'image'} [params.promptType='video'] - Target prompt type
 * @returns {{
 *   status: 'passed' | 'warning' | 'failed',
 *   passed: boolean,
 *   errors: string[],
 *   warnings: string[],
 *   checks: Array<{ name: string, passed: boolean, message: string }>
 * }}
 */
export function evaluatePromptQuality({
  scene,
  composedPrompt,
  globalRules = '',
  _project = null,
  promptType = 'video',
}) {
  const errors = [];
  const warnings = [];
  const checks = [];

  // Check 1: Scene existence and number
  const hasValidScene = scene && typeof scene === 'object' && Number.isInteger(scene.sceneNumber) && scene.sceneNumber >= 0;
  checks.push({
    name: 'Scene Identification',
    passed: Boolean(hasValidScene),
    message: hasValidScene ? `Scene ${scene.sceneNumber} properly identified.` : 'Invalid scene identity or missing scene number.',
  });
  if (!hasValidScene) {
    errors.push('Scene metadata is invalid or missing.');
  }

  // Check 2: Prompt content not empty
  const rawScenePrompt = (
    promptType === 'image'
      ? (scene?.imagePrompt !== undefined ? scene.imagePrompt : (scene?.prompt || ''))
      : (scene?.videoPrompt !== undefined ? scene.videoPrompt : (scene?.prompt || ''))
  ).trim();
  const hasSceneContent = rawScenePrompt.length > 0;
  checks.push({
    name: `${promptType === 'image' ? 'Image' : 'Video'} Prompt Content`,
    passed: hasSceneContent,
    message: hasSceneContent ? `Prompt contains ${rawScenePrompt.length} characters.` : `${promptType === 'image' ? 'Image' : 'Scene'} prompt is completely empty.`,
  });
  if (!hasSceneContent) {
    errors.push(`${promptType === 'image' ? 'Image' : 'Scene'} prompt text is empty.`);
  }

  // Check 3: Composed prompt presence
  const finalPrompt = (composedPrompt || '').trim();
  const hasComposedPrompt = finalPrompt.length > 0;
  checks.push({
    name: 'Final Prompt Composition',
    passed: hasComposedPrompt,
    message: hasComposedPrompt ? `Composed prompt length: ${finalPrompt.length} chars (~${estimateTokenCount(finalPrompt)} tokens).` : 'Composed prompt is empty.',
  });
  if (!hasComposedPrompt) {
    errors.push('Composed prompt cannot be empty.');
  }

  // Check 4: Unusually large prompt warning
  if (finalPrompt.length > 3500) {
    warnings.push(
      `Prompt is unusually large (${finalPrompt.length} characters). Some web generators have input buffer limits.`
    );
    checks.push({
      name: 'Prompt Length Safety',
      passed: false,
      message: `Prompt length (${finalPrompt.length} chars) is very high. Verify target generator limits.`,
    });
  } else {
    checks.push({
      name: 'Prompt Length Safety',
      passed: true,
      message: `Prompt length (${finalPrompt.length} chars) within standard range.`,
    });
  }

  // Check 5: Contradictory aspect ratio settings
  const contradictions = detectFormatContradictions(finalPrompt);
  if (contradictions.length > 0) {
    warnings.push(...contradictions);
    checks.push({
      name: 'Aspect Ratio Consistency',
      passed: false,
      message: contradictions.join(' '),
    });
  } else {
    checks.push({
      name: 'Aspect Ratio Consistency',
      passed: true,
      message: 'No conflicting aspect ratio directives found.',
    });
  }

  // Check 6: Global Rules state
  const cleanRules = (globalRules || '').trim();
  if (!cleanRules) {
    warnings.push('Global Rules are currently empty. Prompt relies solely on scene-level text.');
    checks.push({
      name: 'Global Rules State',
      passed: true,
      message: 'No Global Rules attached (scene delivered standalone).',
    });
  } else {
    checks.push({
      name: 'Global Rules State',
      passed: true,
      message: 'Active Global Rules are applied.',
    });
  }

  // Check 7: Scene warnings from parsing
  if (Array.isArray(scene?.warnings) && scene.warnings.length > 0) {
    warnings.push(...scene.warnings);
    checks.push({
      name: 'Parser Warnings',
      passed: false,
      message: scene.warnings.join('; '),
    });
  }

  const passed = errors.length === 0;
  const status = errors.length > 0 ? 'failed' : warnings.length > 0 ? 'warning' : 'passed';

  return {
    status,
    passed,
    errors,
    warnings,
    checks,
  };
}
