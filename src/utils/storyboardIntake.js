/**
 * Storyboard Intake and Source Validation Utility
 * Validates raw storyboards from Claude/creators, prevents false positives,
 * and maintains truthful intake lifecycle states.
 */

export const INTAKE_STATUS = {
  EMPTY: 'empty',
  SOURCE_ENTERED: 'source-entered',
  SOURCE_NEEDS_REVIEW: 'source-needs-review',
  SOURCE_VALIDATED: 'source-validated',
  WRAPPER_READY: 'wrapper-ready',
  COPIED_TO_CLIPBOARD: 'copied-to-clipboard',
  FAILED: 'failed',
};

/**
 * Heuristic indicators that text looks like a video storyboard or script.
 */
const STORYBOARD_INDICATORS = [
  /\bscene\s*\d+\b/i,
  /\bshot\s*\d+\b/i,
  /\bcut\s+to\b/i,
  /\bclose[\s-]*up\b/i,
  /\bwide[\s-]*shot\b/i,
  /\bpan\b/i,
  /\bzoom\b/i,
  /\bcamera\b/i,
  /\bvoice[\s-]*over\b|\bvo:\b|\bv\.o\.\b/i,
  /\bnarration\b/i,
  /\bvisual[s]?\b/i,
  /\baudio\b/i,
  /\btransition\b/i,
  /\bframe\b/i,
  /\blighting\b/i,
  /\bangle\b/i,
];

/**
 * Indicators that text is completely unrelated to a storyboard
 * (e.g., source code, raw json, stack traces, shell commands).
 */
const UNRELATED_INDICATORS = [
  /^(?:import|export)\s+.*\s+from\s+['"][^'"]+['"]/m,
  /^\s*(?:function|const|let|var|class)\s+\w+\s*[:=(]/m,
  /^\s*<!DOCTYPE\s+html>/i,
  /^\s*\{\s*"[\w-]+":/m, // raw json object
  /^\s*at\s+[\w.<>$]+\s+\([^)]+:\d+:\d+\)/m, // node/browser stack trace
  /^(?:npm|yarn|pnpm|git|docker)\s+[a-z-]+/m, // terminal command
  /^https?:\/\/[^\s]+$/i, // lone URL
];

/**
 * Validates raw storyboard source text.
 * @param {string} rawText
 * @returns {{
 *   valid: boolean,
 *   status: string,
 *   warnings: string[],
 *   errors: string[],
 *   sceneCountEstimate: number,
 *   hasVoiceOver: boolean,
 *   cleanedText: string
 * }}
 */
export function validateStoryboardSource(rawText) {
  if (typeof rawText !== 'string' || !rawText.trim()) {
    return {
      valid: false,
      status: INTAKE_STATUS.EMPTY,
      warnings: [],
      errors: ['Storyboard source text is empty. Please enter or paste your Claude storyboard.'],
      sceneCountEstimate: 0,
      hasVoiceOver: false,
      cleanedText: '',
    };
  }

  // Normalize line endings to standard LF
  const cleanedText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  // Guard against placeholder strings being treated as valid input
  const placeholderRegex = /^\[(?:paste\s+)?your\s+claude\s+storyboard(?:\s+script)?\s+here\]$/i;
  if (placeholderRegex.test(cleanedText)) {
    return {
      valid: false,
      status: INTAKE_STATUS.EMPTY,
      warnings: [],
      errors: ['Input contains only a placeholder template. Please paste your actual Claude storyboard text.'],
      sceneCountEstimate: 0,
      hasVoiceOver: false,
      cleanedText: '',
    };
  }

  // Minimum length check
  if (cleanedText.length < 25) {
    return {
      valid: false,
      status: INTAKE_STATUS.SOURCE_NEEDS_REVIEW,
      warnings: ['Input is very brief (less than 25 characters). Please verify this is a complete storyboard.'],
      errors: ['Input too short to be a valid storyboard.'],
      sceneCountEstimate: 0,
      hasVoiceOver: false,
      cleanedText,
    };
  }

  // Check for obvious unrelated content
  const isUnrelated = UNRELATED_INDICATORS.some((pattern) => pattern.test(cleanedText));
  if (isUnrelated) {
    return {
      valid: false,
      status: INTAKE_STATUS.SOURCE_NEEDS_REVIEW,
      warnings: [
        'Input text resembles code, JSON, logs, or system output rather than a storyboard.',
      ],
      errors: ['Content does not appear to be a narrative or visual storyboard.'],
      sceneCountEstimate: 0,
      hasVoiceOver: false,
      cleanedText,
    };
  }

  // Count storyboard cues
  let indicatorMatches = 0;
  for (const pattern of STORYBOARD_INDICATORS) {
    if (pattern.test(cleanedText)) {
      indicatorMatches++;
    }
  }

  // Estimate scene count based on explicit Scene / Shot markers
  const sceneMatches = cleanedText.match(/(?:^|\n)(?:#{1,4}\s*)?(?:Scene|SCENE|Shot|SHOT)\s*\d+/gi) || [];
  const sceneCountEstimate = sceneMatches.length;

  const hasVoiceOver = /\b(?:voice[\s-]*over|vo|v\.o\.|narration|narrator|dialogue)\b/i.test(cleanedText);

  const warnings = [];

  if (sceneCountEstimate === 0 && indicatorMatches < 2) {
    warnings.push(
      'No explicit "Scene" or "Shot" headings detected. ChatGPT will need to identify scene boundaries automatically.'
    );
    return {
      valid: true,
      status: INTAKE_STATUS.SOURCE_NEEDS_REVIEW,
      warnings,
      errors: [],
      sceneCountEstimate: 0,
      hasVoiceOver,
      cleanedText,
    };
  }

  return {
    valid: true,
    status: INTAKE_STATUS.SOURCE_VALIDATED,
    warnings,
    errors: [],
    sceneCountEstimate,
    hasVoiceOver,
    cleanedText,
  };
}

/**
 * Safely reads text from system clipboard with explicit error reporting.
 * @returns {Promise<{ success: boolean, text: string, error?: string }>}
 */
export async function readClipboardText() {
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.readText === 'function'
    ) {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        return {
          success: false,
          text: '',
          error: 'Clipboard is empty. Copy your storyboard from Claude or paste it manually.',
        };
      }
      return { success: true, text: text.trim() };
    }
    return {
      success: false,
      text: '',
      error: 'Clipboard read API is unavailable. Please paste your text manually.',
    };
  } catch (err) {
    return {
      success: false,
      text: '',
      error: `Clipboard access error: ${err.message || 'Permission denied'}. Please paste your text manually.`,
    };
  }
}
