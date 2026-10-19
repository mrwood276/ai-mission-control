/**
 * Scene & Global Rules Parser for AI Mission Control
 * Parses raw ChatGPT/AI storyboards into structured Global Rules and Scene Cards.
 */

/**
 * @typedef {Object} ParsedScene
 * @property {string} id - Unique identifier for the scene card
 * @property {number} sceneNumber - Integer scene number (can be non-sequential)
 * @property {string} title - Formatted title (e.g. "Scene 1: Opening Hook")
 * @property {string} prompt - Multiline visual/animation prompt
 * @property {boolean} done - Initial completion state (default false)
 */

/**
 * @typedef {Object} ParseResult
 * @property {boolean} success - Whether at least one valid scene was parsed
 * @property {string|null} globalRules - Extracted global visual rules, or null if absent
 * @property {ParsedScene[]} scenes - Array of parsed scene cards
 * @property {string[]} errors - Actionable error messages if parsing failed
 * @property {string[]} warnings - Non-fatal warnings (e.g. empty prompts or duplicate scene numbers)
 */

/**
 * Parses raw text containing Global Rules and/or Scene descriptions.
 * @param {string} rawText
 * @returns {ParseResult}
 */
export function parsePromptText(rawText) {
  const errors = [];
  const warnings = [];

  if (typeof rawText !== 'string' || !rawText.trim()) {
    return {
      success: false,
      globalRules: null,
      scenes: [],
      errors: ['Input text is empty or blank. Please paste your AI storyboard output.'],
      warnings: [],
    };
  }

  // Normalize Windows/Mac line endings to standard LF
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  // 1. Extract Global Rules (if present)
  let extractedRules = null;
  const nextSectionPattern =
    '(?:\\n(?:#{1,4}\\s*)?(?:\\*\\*)?(?:(?:\\d+\\.|\\d+\\))\\s*)?(?:Scene|SCENE)\\s*\\d+|$)';
  const globalRulesRegex = new RegExp(
    '(?:^|\\n)(?:#{1,4}\\s*)?(?:\\*\\*)?(?:(?:\\d+\\.|\\d+\\))\\s*)?(?:Global\\s+(?:Rules|Visual\\s+Rules|Settings)|GLOBAL\\s+(?:RULES|VISUAL\\s+RULES|SETTINGS))[:\\s\\-–—]*(.*?)(?=' +
      nextSectionPattern +
      ')',
    'is'
  );

  const rulesMatch = text.match(globalRulesRegex);
  if (rulesMatch && rulesMatch[1]) {
    let cleanRules = rulesMatch[1]
      .replace(/\*\*/g, '')
      .replace(/^\s*[-*_]{3,}\s*$/gm, '') // Strip markdown horizontal dividers
      .trim();

    if (cleanRules) {
      extractedRules = cleanRules;
    }
  }

  // 2. Locate all Scene headings
  // Matches variations like:
  // "## Scene 1: Title", "Scene 2 - Title", "**Scene 3: Title**", "**1. Scene 1:**", "SCENE 10"
  const sceneHeaderRegex =
    /(?:^|\n)(?:#{1,4}[^\S\r\n]*)?(?:\*\*)?(?:(?:\d+\.|\d+\))[^\S\r\n]*)?(?:Scene|SCENE)[^\S\r\n]*(\d+)[^\S\r\n]*[:\-–—]?[^\S\r\n]*(.*?)(?:\*\*)?(?=\r?\n|$)/gi;

  const matches = [];
  let headerMatch;

  while ((headerMatch = sceneHeaderRegex.exec(text)) !== null) {
    const rawNumber = headerMatch[1];
    const parsedNumber = parseInt(rawNumber, 10);

    matches.push({
      startIndex: headerMatch.index,
      headerEndIndex: headerMatch.index + headerMatch[0].length,
      sceneNumber: isNaN(parsedNumber) ? 1 : parsedNumber,
      rawTitle: (headerMatch[2] || '').trim(),
    });
  }

  if (matches.length === 0) {
    errors.push(
      'No valid Scene headings found. Expected format like "Scene 1: [Title]" or "Scene 1".'
    );
    return {
      success: false,
      globalRules: extractedRules,
      scenes: [],
      errors,
      warnings,
    };
  }

  // 3. Extract multiline content for each scene
  const parsedScenes = [];
  const seenNumbers = new Set();
  const timestamp = Date.now();

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const nextMatch = i + 1 < matches.length ? matches[i + 1] : null;

    const bodyStart = current.headerEndIndex;
    const bodyEnd = nextMatch ? nextMatch.startIndex : text.length;

    let sceneBody = text.slice(bodyStart, bodyEnd).trim();

    // Clean leading and trailing markdown divider lines (---, ***, ___)
    sceneBody = sceneBody
      .replace(/^\s*[-*_]{3,}\s*\n/g, '')
      .replace(/\n\s*[-*_]{3,}\s*$/g, '')
      .trim();

    // Format clean title
    let cleanedTitle = current.rawTitle
      .replace(/\*\*/g, '')
      .replace(/__/g, '')
      .replace(/^[:\-–—\s]+/, '')
      .trim();

    const finalTitle = cleanedTitle
      ? `Scene ${current.sceneNumber}: ${cleanedTitle}`
      : `Scene ${current.sceneNumber}`;

    if (!sceneBody) {
      warnings.push(`Scene ${current.sceneNumber} prompt is empty.`);
    }

    if (seenNumbers.has(current.sceneNumber)) {
      warnings.push(`Duplicate scene number ${current.sceneNumber} detected.`);
    }
    seenNumbers.add(current.sceneNumber);

    parsedScenes.push({
      id: `scene-${current.sceneNumber}-${timestamp}-${i + 1}`,
      sceneNumber: current.sceneNumber,
      title: finalTitle,
      prompt: sceneBody,
      done: false,
    });
  }

  // If every single parsed scene is empty, treat as an error
  const allEmpty = parsedScenes.every((s) => !s.prompt.trim());
  if (allEmpty) {
    errors.push('Found scene headings, but all scenes contained empty prompts.');
    return {
      success: false,
      globalRules: extractedRules,
      scenes: [],
      errors,
      warnings,
    };
  }

  return {
    success: true,
    globalRules: extractedRules,
    scenes: parsedScenes,
    errors: [],
    warnings,
  };
}
