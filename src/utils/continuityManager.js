/**
 * Scene Continuity Context Manager
 * Tracks recurring visual elements (characters, clothing, environment, lighting, props)
 * strictly derived from verified storyboard text, approved scenes, and user references.
 */

/**
 * @typedef {Object} ContinuityContext
 * @property {string} recurringCharacters - Names, visible traits, and wardrobe
 * @property {string} environment - Primary locations, architecture, atmosphere
 * @property {string} lightingTimeOfDay - Lighting scheme, time of day, color temperature
 * @property {string} keyProps - Important recurring objects or devices
 * @property {string} userNotes - User-provided reference constraints
 */

export const EMPTY_CONTINUITY_CONTEXT = Object.freeze({
  recurringCharacters: '',
  environment: '',
  lightingTimeOfDay: '',
  keyProps: '',
  userNotes: '',
});

/**
 * Formats a continuity context into an optional, concise prompt section.
 * Only non-empty fields are included.
 *
 * @param {ContinuityContext} context
 * @returns {string} Formatted continuity summary or empty string if no fields set
 */
export function formatContinuitySummary(context) {
  if (!context || typeof context !== 'object') return '';

  const entries = [];
  if (context.recurringCharacters?.trim()) {
    entries.push(`- Characters: ${context.recurringCharacters.trim()}`);
  }
  if (context.environment?.trim()) {
    entries.push(`- Setting/Environment: ${context.environment.trim()}`);
  }
  if (context.lightingTimeOfDay?.trim()) {
    entries.push(`- Lighting/Time: ${context.lightingTimeOfDay.trim()}`);
  }
  if (context.keyProps?.trim()) {
    entries.push(`- Key Props: ${context.keyProps.trim()}`);
  }
  if (context.userNotes?.trim()) {
    entries.push(`- Reference Notes: ${context.userNotes.trim()}`);
  }

  if (entries.length === 0) return '';
  return `CONTINUITY CONTEXT:\n${entries.join('\n')}`;
}

/**
 * Validates a continuity context object.
 * @param {any} context
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateContinuityContext(context) {
  const errors = [];
  if (!context || typeof context !== 'object') {
    return { valid: false, errors: ['Continuity context must be an object'] };
  }

  const stringFields = [
    'recurringCharacters',
    'environment',
    'lightingTimeOfDay',
    'keyProps',
    'userNotes',
  ];

  for (const field of stringFields) {
    if (context[field] !== undefined && typeof context[field] !== 'string') {
      errors.push(`Field '${field}' must be a string`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitizes and normalizes a continuity context.
 * @param {Partial<ContinuityContext>} context
 * @returns {ContinuityContext}
 */
export function sanitizeContinuityContext(context) {
  if (!context || typeof context !== 'object') {
    return { ...EMPTY_CONTINUITY_CONTEXT };
  }

  return {
    recurringCharacters: typeof context.recurringCharacters === 'string' ? context.recurringCharacters.trim() : '',
    environment: typeof context.environment === 'string' ? context.environment.trim() : '',
    lightingTimeOfDay: typeof context.lightingTimeOfDay === 'string' ? context.lightingTimeOfDay.trim() : '',
    keyProps: typeof context.keyProps === 'string' ? context.keyProps.trim() : '',
    userNotes: typeof context.userNotes === 'string' ? context.userNotes.trim() : '',
  };
}
