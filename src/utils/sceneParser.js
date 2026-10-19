/**
 * Scene & Global Rules Parser for AI Mission Control
 * Parses raw ChatGPT/AI storyboards into structured Global Rules, Scene Cards,
 * and tracks unparsed text, duplicate scene numbers, ordering anomalies, and errors.
 */

/**
 * @typedef {Object} ParsedScene
 * @property {string} id - Stable unique identifier for the scene card
 * @property {number} sceneNumber - Integer scene number (can be non-sequential)
 * @property {string} title - Formatted title (e.g. "Scene 1: Opening Hook")
 * @property {string} prompt - Multiline visual/animation prompt
 * @property {boolean} done - Initial completion state (default false)
 * @property {string[]} [warnings] - Specific scene-level warnings
 */

/**
 * @typedef {Object} ParseResult
 * @property {boolean} success - Whether at least one valid non-empty scene was parsed without blocking errors
 * @property {string|null} globalRules - Extracted global visual rules, or null if absent
 * @property {ParsedScene[]} scenes - Array of parsed scene cards
 * @property {string[]} errors - Blocking error messages preventing import
 * @property {string[]} warnings - Non-fatal warnings requiring user review
 * @property {string[]} notices - Informational notices
 * @property {string[]} unparsedContent - Content blocks not recognized as rules or scenes
 */

/**
 * Parses raw text containing Global Rules and/or Scene descriptions.
 * @param {string} rawText
 * @param {Object} [options]
 * @param {Array<Object>} [options.existingScenes] - Optional array of existing scenes to preserve stable IDs
 * @returns {ParseResult}
 */
export function parsePromptText(rawText, options = {}) {
  const errors = [];
  const warnings = [];
  const notices = [];
  const unparsedContent = [];

  if (typeof rawText !== 'string' || !rawText.trim()) {
    return {
      success: false,
      globalRules: null,
      scenes: [],
      errors: ['Input text is empty or blank. Please paste your AI storyboard output.'],
      warnings: [],
      notices: [],
      unparsedContent: [],
    };
  }

  // Normalize Windows/Mac line endings to standard LF
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  // Guard against placeholder template being pasted
  if (/^\[(?:paste\s+)?your\s+claude\s+storyboard(?:\s+script)?\s+here\]$/i.test(text)) {
    return {
      success: false,
      globalRules: null,
      scenes: [],
      errors: ['Pasted text contains only a placeholder template. Please paste actual AI storyboard output.'],
      warnings: [],
      notices: [],
      unparsedContent: [],
    };
  }

  // 1. Locate and Extract Global Rules (if present)
  let extractedRules = null;
  let rulesSpan = null; // { start, end }

  // Detect multiple Global Rules sections
  const globalRulesOccurrences = [
    ...text.matchAll(
      /(?:^|\n)(?:#{1,4}\s*)?(?:\*\*)?(?:(?:\d+\.|\d+\))\s*)?(?:Global\s+(?:Rules|Visual\s+Rules|Settings)|GLOBAL\s+(?:RULES|VISUAL\s+RULES|SETTINGS))[:\s\-–—]*/gi
    ),
  ];

  if (globalRulesOccurrences.length > 1) {
    warnings.push(
      `Multiple Global Rules sections detected (${globalRulesOccurrences.length}). The first recognized section was used.`
    );
  }

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
    rulesSpan = {
      start: rulesMatch.index,
      end: rulesMatch.index + rulesMatch[0].length,
    };

    let cleanRules = rulesMatch[1]
      .replace(/\*\*/g, '')
      .replace(/^\s*[-*_]{3,}\s*$/gm, '') // Strip markdown horizontal dividers
      .trim();

    if (cleanRules) {
      extractedRules = cleanRules;
      notices.push('Global Rules detected and extracted.');
    } else {
      warnings.push('Global Rules heading found, but its content was empty.');
    }
  } else {
    notices.push('No Global Rules heading found. Project will use active rules or leave rules unassigned.');
  }

  // 2. Locate all Scene headings
  // Matches variations like:
  // "## Scene 1: Title", "Scene 2 - Title", "**Scene 3: Title**", "**1. Scene 1:**", "SCENE 10", "### Scene 4"
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

  // Check for malformed unnumbered scene headings (e.g. "Scene: Title" or "Scene - Title" without number)
  const malformedHeadingRegex = /(?:^|\n)(?:#{1,4}[^\S\r\n]*)?(?:\*\*)?(?:Scene|SCENE)[^\S\r\n]*(?![\d])[:\-–—][^\S\r\n]*(.*?)(?:\*\*)?(?=\r?\n|$)/gi;
  const malformedMatches = text.match(malformedHeadingRegex);
  const malformedCount = malformedMatches ? malformedMatches.length : 0;
  if (malformedCount > 0) {
    warnings.push(
      `Detected ${malformedCount} unnumbered "Scene:" heading(s). Each scene heading should include a number (e.g. "Scene 1: Title").`
    );
  }

  if (matches.length === 0) {
    errors.push(
      'No valid Scene headings found. Expected format like "Scene 1: [Title]" or "Scene 1".'
    );

    // Save preamble as unparsed content if non-empty
    if (text.length > 0 && (!rulesSpan || text.length > (rulesSpan.end - rulesSpan.start))) {
      unparsedContent.push(text);
    }

    return {
      success: false,
      globalRules: extractedRules,
      scenes: [],
      errors,
      warnings,
      notices,
      unparsedContent,
    };
  }

  // 3. Detect unparsed text before the first scene
  const firstSceneStart = matches[0].startIndex;
  let preamble = text.slice(0, firstSceneStart).trim();

  if (preamble) {
    // If Global Rules was in the preamble, remove that portion
    if (rulesSpan && rulesSpan.start < firstSceneStart) {
      const beforeRules = text.slice(0, rulesSpan.start).trim();
      const afterRules = text.slice(rulesSpan.end, firstSceneStart).trim();
      preamble = [beforeRules, afterRules].filter(Boolean).join('\n\n').trim();
    }

    // Strip markdown dividers
    preamble = preamble.replace(/^\s*[-*_]{3,}\s*$/gm, '').trim();

    if (preamble && preamble.length > 20) {
      unparsedContent.push(preamble);
      notices.push('Preamble text preceding Scene 1 was preserved in unparsed content.');
    }
  }

  // 4. Extract multiline content for each scene
  const parsedScenes = [];
  const seenNumbers = new Map(); // sceneNumber -> count
  const existingSceneMap = new Map();

  if (Array.isArray(options.existingScenes)) {
    options.existingScenes.forEach((s) => {
      if (s && s.id && s.sceneNumber !== undefined) {
        existingSceneMap.set(s.sceneNumber, s.id);
      }
    });
  }

  const timestamp = Date.now();
  let previousSceneNumber = 0;
  let orderAnomalies = 0;

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const nextMatch = i + 1 < matches.length ? matches[i + 1] : null;

    const bodyStart = current.headerEndIndex;
    const bodyEnd = nextMatch ? nextMatch.startIndex : text.length;

    let sceneBody = text.slice(bodyStart, bodyEnd).trim();

    // Check for auxiliary metadata sections in the scene body (e.g., CONTINUITY SUMMARY)
    const continuitySplit = sceneBody.split(/\n(?:#{1,4}\s*)?(?:CONTINUITY(?:\s+SUMMARY)?|Continuity(?:\s+Summary)?):?/i);
    if (continuitySplit.length > 1) {
      sceneBody = continuitySplit[0].trim();
      const continuityText = continuitySplit.slice(1).join('\n').trim();
      if (continuityText) {
        unparsedContent.push(`Continuity Notes (from Scene ${current.sceneNumber}):\n${continuityText}`);
      }
    }

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

    const sceneWarnings = [];

    if (!sceneBody) {
      warnings.push(`Scene ${current.sceneNumber} prompt is empty.`);
      sceneWarnings.push('Scene prompt is empty.');
    } else if (sceneBody.length > 3500) {
      warnings.push(`Scene ${current.sceneNumber} prompt is very long (${sceneBody.length} characters). May exceed generator field limits.`);
      sceneWarnings.push('Prompt length is unusually high.');
    }

    // Track duplicate scene numbers
    const currentCount = seenNumbers.get(current.sceneNumber) || 0;
    if (currentCount > 0) {
      warnings.push(`Duplicate scene number ${current.sceneNumber} detected (occurrence ${currentCount + 1}).`);
      sceneWarnings.push(`Duplicate scene number ${current.sceneNumber}.`);
    }
    seenNumbers.set(current.sceneNumber, currentCount + 1);

    // Track ordering anomalies
    if (previousSceneNumber > 0 && current.sceneNumber < previousSceneNumber) {
      orderAnomalies++;
    }
    previousSceneNumber = current.sceneNumber;

    // Use existing stable ID if available, otherwise generate deterministic ID
    const stableId =
      existingSceneMap.get(current.sceneNumber) ||
      `scene-${current.sceneNumber}-${timestamp}-${i + 1}`;

    parsedScenes.push({
      id: stableId,
      sceneNumber: current.sceneNumber,
      title: finalTitle,
      prompt: sceneBody,
      done: false,
      warnings: sceneWarnings,
    });
  }

  if (orderAnomalies > 0) {
    warnings.push(
      `Detected non-chronological scene ordering (${orderAnomalies} scene(s) appear out of numerical order).`
    );
  }

  // If every single parsed scene is empty, treat as a blocking error
  const allEmpty = parsedScenes.every((s) => !s.prompt.trim());
  if (allEmpty) {
    errors.push('Found scene headings, but all scenes contained empty prompts.');
    return {
      success: false,
      globalRules: extractedRules,
      scenes: [],
      errors,
      warnings,
      notices,
      unparsedContent,
    };
  }

  return {
    success: errors.length === 0,
    globalRules: extractedRules,
    scenes: parsedScenes,
    errors,
    warnings,
    notices,
    unparsedContent,
  };
}
