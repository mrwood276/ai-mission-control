/**
 * Publishing Kit Generator & Storyboard Grounding Engine for AI Mission Control.
 * Generates platform-tailored publishing assets (YouTube Shorts & TikTok)
 * strictly grounded in the project's active storyboard and scene cards.
 *
 * Implements strict anti-hallucination constraints, change-detection fingerprinting,
 * selective field regeneration, quality verification, and dual-mode AI prompt export/import.
 */

export const PUBLISHING_STATUS = {
  DRAFT: 'draft',
  READY: 'ready',
  NEEDS_REVIEW: 'needs_review',
};

export const SUPPORTED_PLATFORMS = {
  YOUTUBE: 'youtube', // YouTube Shorts (backward-compatible identifier)
  YOUTUBE_SHORTS: 'youtube',
  YOUTUBE_LONG: 'youtube_long',
  TIKTOK: 'tiktok',
};

export const PLATFORM_CONFIG = {
  [SUPPORTED_PLATFORMS.YOUTUBE]: {
    id: SUPPORTED_PLATFORMS.YOUTUBE,
    label: 'YouTube Shorts',
    badge: 'Shorts',
    enabled: true,
    destinationUrl: 'https://studio.youtube.com/',
    workspaceTarget: 'youtube',
  },
  [SUPPORTED_PLATFORMS.YOUTUBE_LONG]: {
    id: SUPPORTED_PLATFORMS.YOUTUBE_LONG,
    label: 'YouTube Long-form',
    badge: 'Long-form',
    enabled: true,
    destinationUrl: 'https://studio.youtube.com/',
    workspaceTarget: 'youtube',
  },
  [SUPPORTED_PLATFORMS.TIKTOK]: {
    id: SUPPORTED_PLATFORMS.TIKTOK,
    label: 'TikTok',
    badge: 'TikTok',
    enabled: false, // Temporarily disabled throughout active publishing workflow
    destinationUrl: 'https://www.tiktok.com/',
    workspaceTarget: 'tiktok',
  },
};

/**
 * Returns whether a publishing platform is currently enabled.
 * @param {string} platform
 * @returns {boolean}
 */
export function isPlatformEnabled(platform) {
  return Boolean(PLATFORM_CONFIG[platform]?.enabled);
}

export const PUBLISH_STATE = {
  NOT_PUBLISHED: 'not_published',
  PUBLISHED: 'published',
};

export const SHORTS_CHECKLIST_ITEMS = [
  { id: 'videoGenerated', label: 'Final video generated', description: 'Video exported or rendered from Google Flow' },
  { id: 'videoReviewed', label: 'Final video reviewed', description: 'Visuals, pacing, audio, and continuity verified' },
  { id: 'titleChecked', label: 'Title checked', description: 'Accurate, compelling, and within character limit' },
  { id: 'descriptionChecked', label: 'Description / Caption checked', description: 'Grounded in story with proper call-to-action' },
  { id: 'hashtagsChecked', label: 'Hashtags checked', description: 'Relevant platform and topic hashtags selected' },
  { id: 'thumbnailChecked', label: 'Thumbnail / Cover checked', description: 'Engaging cover frame selected for feed display' },
  { id: 'uploadFormReviewed', label: 'Upload form reviewed', description: 'Video file and metadata properly entered' },
  { id: 'settingsReviewed', label: 'Publishing settings reviewed', description: 'Audience, visibility, and tags confirmed' },
];

// Alias for backward compatibility
export const CHECKLIST_ITEMS = SHORTS_CHECKLIST_ITEMS;

export const LONG_FORM_CHECKLIST_ITEMS = [
  { id: 'videoGenerated', label: 'Final video generated', description: 'Full video exported or rendered from video editor' },
  { id: 'videoReviewed', label: 'Full video reviewed', description: 'Visuals, audio balance, continuity, and pacing verified' },
  { id: 'titleChecked', label: 'Title checked', description: 'Clear, educational, compelling, and within 100 character limit' },
  { id: 'descriptionChecked', label: 'Full description checked', description: 'Detailed topic explanation and grounded summary reviewed' },
  { id: 'thumbnailChecked', label: 'Thumbnail prepared and reviewed', description: 'Custom high-resolution 16:9 thumbnail ready' },
  { id: 'hashtagsChecked', label: 'Hashtags checked', description: 'Topic and category hashtags selected' },
  { id: 'audienceReviewed', label: 'Audience & settings reviewed', description: 'Audience (Made for Kids), age restriction, and category confirmed' },
  { id: 'uploadFormReviewed', label: 'Upload form reviewed', description: 'Video file, playlist, and metadata properly entered' },
  { id: 'settingsReviewed', label: 'Final publishing settings reviewed', description: 'Visibility (Public/Unlisted/Private/Scheduled) and copyright confirmed' },
];

/**
 * Creates default false state for all 8 Shorts checklist items.
 * @returns {Record<string, boolean>}
 */
export function createDefaultChecklist() {
  return {
    videoGenerated: false,
    videoReviewed: false,
    titleChecked: false,
    descriptionChecked: false,
    hashtagsChecked: false,
    thumbnailChecked: false,
    uploadFormReviewed: false,
    settingsReviewed: false,
  };
}

/**
 * Creates default false state for all 9 Long-form checklist items.
 * @returns {Record<string, boolean>}
 */
export function createDefaultLongFormChecklist() {
  return {
    videoGenerated: false,
    videoReviewed: false,
    titleChecked: false,
    descriptionChecked: false,
    thumbnailChecked: false,
    hashtagsChecked: false,
    audienceReviewed: false,
    uploadFormReviewed: false,
    settingsReviewed: false,
  };
}

/**
 * Creates an empty, migration-safe Publishing Kit object.
 * @returns {Object}
 */
export function createDefaultPublishingKit() {
  return {
    status: PUBLISHING_STATUS.DRAFT,
    sourceFingerprint: '',
    lastGeneratedAt: null,
    youtube: {
      titles: ['', '', ''],
      selectedTitleIndex: 0,
      description: '',
      hashtags: [],
      pinnedComment: '',
      checklist: createDefaultChecklist(),
      publishedStatus: PUBLISH_STATE.NOT_PUBLISHED,
      publishedAt: null,
    },
    youtube_long: {
      titles: ['', '', ''],
      selectedTitleIndex: 0,
      description: '',
      hashtags: [],
      pinnedComment: '',
      checklist: createDefaultLongFormChecklist(),
      publishedStatus: PUBLISH_STATE.NOT_PUBLISHED,
      publishedAt: null,
    },
    tiktok: {
      captions: ['', '', ''],
      selectedCaptionIndex: 0,
      hashtags: [],
      pinnedComment: '',
      checklist: createDefaultChecklist(),
      publishedStatus: PUBLISH_STATE.NOT_PUBLISHED,
      publishedAt: null,
    },
    qualityWarnings: [],
    userEditedFields: {},
  };
}

/**
 * Safely normalizes older project publishing kit data, ensuring backward compatibility.
 * @param {Object} rawKit
 * @returns {Object}
 */
export function normalizePublishingKit(rawKit) {
  const base = createDefaultPublishingKit();
  if (!rawKit || typeof rawKit !== 'object') return base;

  return {
    ...base,
    ...rawKit,
    youtube: {
      ...base.youtube,
      ...(rawKit.youtube || {}),
      checklist: {
        ...createDefaultChecklist(),
        ...(rawKit.youtube?.checklist || {}),
      },
      publishedStatus: rawKit.youtube?.publishedStatus || PUBLISH_STATE.NOT_PUBLISHED,
      publishedAt: rawKit.youtube?.publishedAt || null,
    },
    youtube_long: {
      ...base.youtube_long,
      ...(rawKit.youtube_long || {}),
      checklist: {
        ...createDefaultLongFormChecklist(),
        ...(rawKit.youtube_long?.checklist || {}),
      },
      publishedStatus: rawKit.youtube_long?.publishedStatus || PUBLISH_STATE.NOT_PUBLISHED,
      publishedAt: rawKit.youtube_long?.publishedAt || null,
    },
    tiktok: {
      ...base.tiktok,
      ...(rawKit.tiktok || {}),
      checklist: {
        ...createDefaultChecklist(),
        ...(rawKit.tiktok?.checklist || {}),
      },
      publishedStatus: rawKit.tiktok?.publishedStatus || PUBLISH_STATE.NOT_PUBLISHED,
      publishedAt: rawKit.tiktok?.publishedAt || null,
    },
    qualityWarnings: Array.isArray(rawKit.qualityWarnings) ? rawKit.qualityWarnings : [],
    userEditedFields: rawKit.userEditedFields || {},
  };
}

/**
 * Computes a fast, deterministic hash/fingerprint of a project's storyboard inputs.
 * Covers: raw storyboard source, scenes (number, title, prompt), and global rules.
 * @param {Object} project
 * @returns {string}
 */
export function computeStoryboardFingerprint(project) {
  if (!project || typeof project !== 'object') return '';

  const sourcePart = (project.storyboardSource || '').trim();
  const scenesPart = Array.isArray(project.scenes)
    ? project.scenes
        .map((s) => `${s.sceneNumber || 0}:${(s.title || '').trim()}:${(s.prompt || '').trim()}`)
        .join('||')
    : '';
  const rulesPart = (project.globalRules || '').trim();

  const combined = `${sourcePart}@@${scenesPart}@@${rulesPart}`;
  if (!combined.trim() || combined === '@@@@') return '';

  // 32-bit FNV-1a hash
  let hash = 2166136261;
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const sceneCount = Array.isArray(project.scenes) ? project.scenes.length : 0;
  return `fp-${(hash >>> 0).toString(16)}-${sceneCount}`;
}

/**
 * Common stopwords to filter out for keyword & entity extraction.
 */
const INDONESIAN_STOPWORDS = new Set([
  'dan', 'yang', 'di', 'ke', 'dari', 'ini', 'itu', 'untuk', 'pada', 'adalah',
  'sebagai', 'dengan', 'dalam', 'bisa', 'akan', 'atau', 'saat', 'sudah', 'jika',
  'karena', 'oleh', 'hanya', 'lebih', 'agar', 'kita', 'mereka', 'dia', 'ia',
  'ada', 'tersebut', 'setelah', 'sebelum', 'namun', 'tetapi', 'juga', 'secara',
  'sangat', 'lalu', 'kemudian', 'para', 'bagi', 'tentang', 'seperti', 'ketika',
  'adegan', 'scene', 'visual', 'kamera', 'suara', 'audio', 'cinematic'
]);

const ENGLISH_STOPWORDS = new Set([
  'the', 'and', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have',
  'has', 'had', 'do', 'does', 'did', 'but', 'if', 'or', 'because', 'as',
  'until', 'while', 'about', 'against', 'between', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'up', 'down', 'in', 'out', 'off',
  'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
  'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should',
  'now', 'scene', 'shot', 'camera', 'visual', 'cinematic', 'render', 'lighting'
]);

/**
 * Camera/render technical descriptors that should not be treated as narrative subjects.
 */
const TECHNICAL_DESCRIPTORS = new Set([
  'wide', 'shot', 'close-up', 'medium', 'pan', 'zoom', 'angle', 'lighting',
  'render', 'octane', 'unreal', 'engine', 'photorealistic', 'hyper-detailed',
  '8k', '4k', 'volumetric', 'fog', 'aspect', 'ratio', 'depth', 'field', 'fps'
]);

/**
 * Detects whether the primary language is Indonesian or English.
 * @param {string} text
 * @returns {'id' | 'en'}
 */
export function detectLanguage(text) {
  if (!text || typeof text !== 'string') return 'en';
  const lower = text.toLowerCase();
  const words = lower.match(/[a-z\u00C0-\u024F]+/gi) || [];
  let idScore = 0;
  let enScore = 0;

  words.slice(0, 200).forEach((w) => {
    if (INDONESIAN_STOPWORDS.has(w)) idScore++;
    if (ENGLISH_STOPWORDS.has(w)) enScore++;
  });

  return idScore > enScore ? 'id' : 'en';
}

/**
 * Extracts narrative entities, keywords, hook, and conclusion from storyboard inputs.
 * Strictly avoids hallucinating external concepts.
 *
 * @param {Object} params
 * @param {string} [params.storyboardText='']
 * @param {Array<Object>} [params.scenes=[]]
 * @param {string} [params.globalRules='']
 * @returns {Object} Extracted grounded context
 */
export function extractStoryboardContext({ storyboardText = '', scenes = [], globalRules = '' } = {}) {
  const safeScenes = Array.isArray(scenes) ? scenes : [];
  const safeStoryboard = typeof storyboardText === 'string' ? storyboardText.trim() : '';

  // Aggregate narrative text
  const sceneTexts = safeScenes.map((s) => {
    const titleClean = (s.title || '').replace(/^Scene\s*\d+[:\-–\s]*/i, '').trim();
    const promptClean = (s.prompt || '').trim();
    return `${titleClean} ${promptClean}`.trim();
  });

  const fullCorpus = [safeStoryboard, ...sceneTexts].filter(Boolean).join('\n\n');
  const lang = detectLanguage(fullCorpus);
  const stopSet = lang === 'id' ? INDONESIAN_STOPWORDS : ENGLISH_STOPWORDS;

  // Content sufficiency check
  const totalLength = fullCorpus.trim().length;
  const hasSubstantiveScenes = safeScenes.some((s) => (s.prompt || '').trim().length > 15);
  const isSufficient = totalLength >= 30 && (hasSubstantiveScenes || safeStoryboard.length >= 40);

  const warnings = [];
  if (!isSufficient) {
    warnings.push(
      lang === 'id'
        ? 'Materi storyboard terlalu singkat untuk menghasilkan paket publikasi yang akurat. Harap masukkan naskah atau deskripsi adegan.'
        : 'Storyboard content is too sparse for grounded publishing kit generation. Please provide scene descriptions or script.'
    );
  }

  // Opening Hook concept (from Scene 1 or first paragraph of storyboard)
  let hookTitle = '';
  let hookText = '';
  if (safeScenes.length > 0 && safeScenes[0]) {
    hookTitle = (safeScenes[0].title || '').replace(/^Scene\s*\d+[:\-–\s]*/i, '').trim();
    hookText = (safeScenes[0].prompt || '').trim();
  } else if (safeStoryboard) {
    const firstPara = safeStoryboard.split('\n\n')[0] || '';
    hookText = firstPara.slice(0, 150).trim();
  }

  // Climax / Conclusion concept (from final scene)
  let conclusionTitle = '';
  let conclusionText = '';
  if (safeScenes.length > 0) {
    const lastScene = safeScenes[safeScenes.length - 1];
    conclusionTitle = (lastScene.title || '').replace(/^Scene\s*\d+[:\-–\s]*/i, '').trim();
    conclusionText = (lastScene.prompt || '').trim();
  }

  // Frequency-based narrative keyword extraction (strictly from source)
  const tokenRegex = /[a-zA-Z0-9_\u00C0-\u024F]{3,}/g;
  const rawTokens = fullCorpus.toLowerCase().match(tokenRegex) || [];
  const freqMap = new Map();

  rawTokens.forEach((token) => {
    if (stopSet.has(token) || TECHNICAL_DESCRIPTORS.has(token) || /^\d+$/.test(token)) {
      return;
    }
    freqMap.set(token, (freqMap.get(token) || 0) + 1);
  });

  // Top keywords sorted by frequency
  const sortedKeywords = [...freqMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w);

  const topKeywords = sortedKeywords.slice(0, 8);

  // Capitalized thematic keywords for hashtags
  const topicHashtags = topKeywords
    .filter((w) => w.length >= 3 && !/^(scene|shot|prompt)$/i.test(w))
    .slice(0, 4)
    .map((w) => `#${w.charAt(0).toUpperCase() + w.slice(1)}`);

  // Premise summary (from scene titles and key actions)
  const keyEvents = safeScenes
    .map((s) => (s.title || '').replace(/^Scene\s*\d+[:\-–\s]*/i, '').trim())
    .filter(Boolean);

  return {
    language: lang,
    isSufficient,
    warnings,
    hookTitle,
    hookText,
    conclusionTitle,
    conclusionText,
    topKeywords,
    topicHashtags,
    keyEvents,
    sceneCount: safeScenes.length,
    fullCorpus,
    globalRules: typeof globalRules === 'string' ? globalRules : '',
  };
}

/**
 * Cleans a generated title candidate so it is punchy, <= 85 characters,
 * and contains no markdown wrappers or quotes.
 * @param {string} rawTitle
 * @param {number} [maxLen=85]
 * @returns {string}
 */
function cleanTitle(rawTitle, maxLen = 85) {
  if (!rawTitle) return '';
  let cleaned = rawTitle
    .replace(/^["'«»“”„]+|["'«»“”„]+$/g, '')
    .replace(/^Title\s*\d*[:\-–\s]*/i, '')
    .replace(/^Scene\s*\d*[:\-–\s]*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length > maxLen) {
    cleaned = cleaned.slice(0, maxLen).replace(/[,;:\-\s]+[^\s]*$/, '').trim();
  }
  return cleaned;
}

/**
 * Generates 3 alternative titles strictly grounded in the storyboard context.
 * Title 1: Hook / Intrigue-driven (from opening conflict/mystery).
 * Title 2: Reveal / Turning-point-driven (from climax/payoff).
 * Title 3: Punchy premise summary (from core story arc).
 *
 * @param {Object} context
 * @returns {string[]}
 */
export function generateTitles(context) {
  const { language: lang, hookTitle, conclusionTitle, topKeywords, keyEvents } = context;

  const hookConcept = hookTitle || (keyEvents[0] || (topKeywords[0] || ''));
  const climaxConcept = conclusionTitle || (keyEvents[keyEvents.length - 1] || (topKeywords[1] || ''));
  const primaryTopic = topKeywords[0] ? topKeywords[0].charAt(0).toUpperCase() + topKeywords[0].slice(1) : '';
  const secondaryTopic = topKeywords[1] ? topKeywords[1].charAt(0).toUpperCase() + topKeywords[1].slice(1) : '';

  if (lang === 'id') {
    const t1 = hookConcept
      ? `Misteri Tersembunyi: ${hookConcept}`
      : primaryTopic
      ? `Rahasia Nyata di Balik ${primaryTopic}`
      : 'Kisah Tak Terduga';

    const t2 = climaxConcept && climaxConcept !== hookConcept
      ? `Saat ${hookConcept || primaryTopic} Bertemu ${climaxConcept}`
      : primaryTopic && secondaryTopic
      ? `Apa yang Terjadi Ketika ${primaryTopic} Muncul?`
      : 'Momen Penentu yang Mengubah Segalanya';

    const t3 = primaryTopic
      ? `${primaryTopic}: Akhir Perjalanan yang Mengejutkan`
      : keyEvents.length > 1
      ? `${keyEvents[0]} Sampai Titik Terakhir`
      : 'Catatan Kisah Nyata';

    return [cleanTitle(t1), cleanTitle(t2), cleanTitle(t3)];
  }

  // English titles
  const t1 = hookConcept
    ? `The Mystery of ${hookConcept}`
    : primaryTopic
    ? `The Hidden Truth Behind ${primaryTopic}`
    : 'An Untold Story';

  const t2 = climaxConcept && climaxConcept !== hookConcept
    ? `When ${hookConcept || primaryTopic} Leads to ${climaxConcept}`
    : primaryTopic && secondaryTopic
    ? `What Really Happened with ${primaryTopic}?`
    : 'The Moment Everything Changed';

  const t3 = primaryTopic
    ? `${primaryTopic}: The Final Turning Point`
    : keyEvents.length > 1
    ? `${keyEvents[0]} - The Complete Arc`
    : 'A Cinematic Journey';

  return [cleanTitle(t1), cleanTitle(t2), cleanTitle(t3)];
}

/**
 * Generates a concise, grounded YouTube description (1-2 paragraphs).
 * Accurately reflects the story without introducing external ungrounded facts.
 *
 * @param {Object} context
 * @returns {string}
 */
export function generateYouTubeDescription(context) {
  const { language: lang, hookTitle, hookText, conclusionTitle, keyEvents, topKeywords } = context;

  const opening = hookTitle || (keyEvents[0] || '');
  const closing = conclusionTitle || (keyEvents[keyEvents.length - 1] || '');
  const topic = topKeywords[0] || 'cerita ini';

  if (lang === 'id') {
    const line1 = opening && closing && opening !== closing
      ? `Dari awal mula ${opening}, kisah ini membawa kita melalui perjalanan intens hingga ${closing}.`
      : opening
      ? `Saksikan kisah ${opening} yang membuka sudut pandang tak terduga tentang ${topic}.`
      : `Ikuti alur cerita mendalam yang terungkap adegan demi adegan.`;

    const detail = hookText
      ? ` Peristiwa bermula ketika detail cerita mulai terungkap.`
      : '';

    const cta = `\n\nBagaimana menurut kalian perjalanan ini? Tulis pendapat kalian di kolom komentar dan jangan lupa subscribe untuk kelanjutan cerita berikutnya!`;

    return `${line1}${detail}${cta}`.trim();
  }

  // English
  const line1 = opening && closing && opening !== closing
    ? `From the opening moments of ${opening}, this story follows an unfolding journey leading to ${closing}.`
    : opening
    ? `Follow the story of ${opening} as unexpected details come to light.`
    : `Experience the unfolding visual narrative scene by scene.`;

  const detail = hookText
    ? ` The story begins as the core event is revealed.`
    : '';

  const cta = `\n\nWhat are your thoughts on how this unfolded? Share your take in the comments and subscribe for more chapters!`;

  return `${line1}${detail}${cta}`.trim();
}

/**
 * Generates 4-6 targeted, relevant hashtags.
 * @param {Object} context
 * @param {'youtube' | 'youtube_long' | 'tiktok'} platform
 * @returns {string[]}
 */
export function generateHashtags(context, platform = 'youtube') {
  const { topicHashtags, topKeywords, language: lang } = context;

  let baseTags;
  if (platform === 'youtube' || platform === 'youtube_shorts') {
    baseTags = ['#Shorts', '#YouTubeShorts'];
  } else if (platform === 'youtube_long') {
    baseTags = lang === 'id'
      ? ['#Dokumenter', '#KisahNyata', '#Edukasi']
      : ['#Documentary', '#Story', '#Education'];
  } else {
    baseTags = ['#fyp', '#foryou', '#viral'];
  }

  // Add grounded topic tags
  const specificTags = topicHashtags.length > 0
    ? topicHashtags
    : topKeywords.slice(0, 3).map((w) => `#${w.charAt(0).toUpperCase() + w.slice(1)}`);

  const combined = [...baseTags, ...specificTags];
  // Deduplicate case-insensitively
  const seen = new Set();
  const deduped = [];
  combined.forEach((tag) => {
    const lower = tag.toLowerCase();
    if (!seen.has(lower) && deduped.length < 6) {
      seen.add(lower);
      deduped.push(tag);
    }
  });

  return deduped;
}

/**
 * Generates a pinned/discussion comment that invites viewers to discuss the video's specific premise.
 * Strictly avoids generic boilerplate ("Keren banget!" or "Nice video").
 *
 * @param {Object} context
 * @returns {string}
 */
export function generatePinnedComment(context) {
  const { language: lang, hookTitle, conclusionTitle, keyEvents, topKeywords } = context;

  const focus = conclusionTitle || hookTitle || (keyEvents[0] || (topKeywords[0] || ''));

  if (lang === 'id') {
    if (focus) {
      return `Pertanyaan untuk kalian: Menurutmu, apa keputusan terbaik yang seharusnya diambil saat peristiwa "${focus}" terjadi? Tulis pendapatmu di bawah! 👇`;
    }
    return `Menurut kalian, apa arti dari adegan terakhir video ini? Tulis pendapat kalian di bawah! 👇`;
  }

  if (focus) {
    return `Quick question for everyone: What would you have done when "${focus}" happened? Let us know in the comments below! 👇`;
  }
  return `What is your take on the final revelation of this story? Drop your thoughts below! 👇`;
}

/**
 * Generates 3 alternative titles for YouTube Long-form videos.
 * Grounded in storyboard facts without vertical/Shorts buzzwords, and <= 100 characters.
 *
 * @param {Object} context
 * @returns {string[]}
 */
export function generateLongFormTitles(context) {
  const { language: lang, hookTitle, conclusionTitle, topKeywords, keyEvents } = context;

  const hookConcept = hookTitle || (keyEvents[0] || (topKeywords[0] || ''));
  const climaxConcept = conclusionTitle || (keyEvents[keyEvents.length - 1] || (topKeywords[1] || ''));
  const primaryTopic = topKeywords[0] ? topKeywords[0].charAt(0).toUpperCase() + topKeywords[0].slice(1) : '';
  const secondaryTopic = topKeywords[1] ? topKeywords[1].charAt(0).toUpperCase() + topKeywords[1].slice(1) : '';

  if (lang === 'id') {
    const t1 = hookConcept
      ? `Kisah Lengkap: ${hookConcept}`
      : primaryTopic
      ? `Kisah Lengkap: Sejarah dan Rahasia di Balik ${primaryTopic}`
      : 'Kisah Lengkap yang Mengubah Segalanya';

    const t2 = climaxConcept && climaxConcept !== hookConcept
      ? `Dari ${hookConcept || primaryTopic} Menuju ${climaxConcept}: Penjelasan Menyeluruh`
      : primaryTopic && secondaryTopic
      ? `Mengapa Peristiwa ${primaryTopic} Terjadi? Analisis Lengkap`
      : 'Perjalanan Penuh Makna: Dokumenter Lengkap';

    const t3 = primaryTopic
      ? `${primaryTopic}: Kronologi Lengkap dan Titik Balik Terakhir`
      : keyEvents.length > 1
      ? `${keyEvents[0]}: Alur Cerita & Penjelasan Lengkap`
      : 'Dokumenter Sinematik: Perjalanan Penuh Misteri';

    return [cleanTitle(t1), cleanTitle(t2), cleanTitle(t3)];
  }

  // English titles
  const t1 = hookConcept
    ? `The Full Story of ${hookConcept}`
    : primaryTopic
    ? `The Complete Story Behind ${primaryTopic}`
    : 'The Untold Journey: Complete Documentary';

  const t2 = climaxConcept && climaxConcept !== hookConcept
    ? `From ${hookConcept || primaryTopic} to ${climaxConcept}: Full Breakdown`
    : primaryTopic && secondaryTopic
    ? `What Really Happened with ${primaryTopic}? Deep Dive`
    : 'The Turning Point: A Comprehensive Narrative';

  const t3 = primaryTopic
    ? `${primaryTopic}: The Complete Arc & Final Resolution`
    : keyEvents.length > 1
    ? `${keyEvents[0]} - The Complete Story Explained`
    : 'A Cinematic Exploration: The Full Narrative';

  return [cleanTitle(t1), cleanTitle(t2), cleanTitle(t3)];
}

/**
 * Generates an educational, multi-paragraph YouTube description for Long-form videos.
 * Grounded in the storyboard scenes, without fabricating timestamps, fake citations, or unknown stats.
 *
 * @param {Object} context
 * @returns {string}
 */
export function generateYouTubeLongFormDescription(context) {
  const { language: lang, hookTitle, conclusionTitle, keyEvents, topKeywords } = context;

  const opening = hookTitle || (keyEvents[0] || '');
  const closing = conclusionTitle || (keyEvents[keyEvents.length - 1] || '');
  const topic = topKeywords[0] || (lang === 'id' ? 'cerita ini' : 'this story');

  if (lang === 'id') {
    const p1 = opening
      ? `Dalam video ini, kita menelusuri kisah mendalam seputar ${opening}. Video ini menyajikan gambaran menyeluruh tentang bagaimana peristiwa tersebut bermula dan keterkaitannya dengan ${topic}.`
      : `Dalam video berdurasi penuh ini, kita mengeksplorasi kisah mendalam dan peristiwa utama yang membentuk perjalanan naratif ini.`;

    const milestoneText = keyEvents.length > 1
      ? ` Perjalanan ini bergerak melalui momen-momen penting dari ${keyEvents.slice(0, 3).join(', lalu ')}${closing && closing !== opening ? `, hingga mencapai ${closing}` : ''}.`
      : closing
      ? ` Alur kisah ini mengalir hingga mencapai puncaknya pada adegan ${closing}.`
      : '';

    const p2 = `Melalui representasi visual dan kronologi adegan yang terarah, setiap tahapan mengungkap detail yang memperjelas konteks cerita secara utuh.${milestoneText}`;

    const p3 = `Bagaimana sudut pandang kalian tentang perjalanan kisah ini? Sampaikan tanggapan kalian di kolom komentar di bawah. Jika video ini bermanfaat, dukung channel ini dengan Like, Share, dan Subscribe untuk dokumenter cerita berikutnya!`;

    return `${p1}\n\n${p2}\n\n${p3}`.trim();
  }

  // English
  const p1 = opening
    ? `In this comprehensive video, we explore the in-depth story surrounding ${opening}. This video examines how events unfolded and uncovers key context regarding ${topic}.`
    : `In this full-length presentation, we explore the complete narrative arc and primary events driving this journey.`;

  const milestoneText = keyEvents.length > 1
    ? ` The story progresses through pivotal moments including ${keyEvents.slice(0, 3).join(', followed by ')}${closing && closing !== opening ? `, culminating in ${closing}` : ''}.`
    : closing
    ? ` The narrative steadily builds toward its defining climax at ${closing}.`
    : '';

  const p2 = `Through focused visual storytelling and grounded scene sequences, every stage highlights essential details that bring the complete picture into perspective.${milestoneText}`;

  const p3 = `What are your reflections on how this narrative unfolded? Join the discussion in the comments section below. If you found this breakdown valuable, please like, share, and subscribe for more comprehensive stories!`;

  return `${p1}\n\n${p2}\n\n${p3}`.trim();
}

/**
 * Generates a discussion-provoking first comment for YouTube Long-form videos.
 *
 * @param {Object} context
 * @returns {string}
 */
export function generateLongFormPinnedComment(context) {
  const { language: lang, hookTitle, conclusionTitle, keyEvents, topKeywords } = context;
  const focus = conclusionTitle || hookTitle || (keyEvents[0] || (topKeywords[0] || ''));

  if (lang === 'id') {
    if (focus) {
      return `Diskusi penonton: Setelah menyimak keseluruhan cerita tentang "${focus}", bagaimana pandangan kalian mengenai keputusan dan pelajaran utama dari peristiwa ini? Tulis analisis kalian di bawah! 👇`;
    }
    return `Diskusi penonton: Menurut kalian, apa pesan terpenting yang bisa dipetik dari akhir kisah ini? Tulis pendapat kalian di bawah! 👇`;
  }

  if (focus) {
    return `Discussion question: After watching the complete story unfold around "${focus}", what do you consider the most crucial turning point or takeaway? Share your analysis in the comments below! 👇`;
  }
  return `Discussion question: What do you think was the biggest revelation in this complete narrative? Drop your thoughts below! 👇`;
}

/**
 * Generates 3 alternative TikTok captions/hooks.
 * Conversational, concise, engaging, and faithful to storyboard premise.
 *
 * @param {Object} context
 * @returns {string[]}
 */
export function generateTikTokCaptions(context) {
  const { language: lang, hookTitle, conclusionTitle, topKeywords, keyEvents } = context;

  const hookConcept = hookTitle || (keyEvents[0] || (topKeywords[0] || ''));
  const climaxConcept = conclusionTitle || (keyEvents[keyEvents.length - 1] || '');

  if (lang === 'id') {
    const c1 = hookConcept
      ? `Gak nyangka ternyata begini awal mula "${hookConcept}"... Tonton sampai habis! 😱`
      : 'Beneran gak nyangka plot twist-nya bisa begini... Tonton sampai selesai!';

    const c2 = climaxConcept && climaxConcept !== hookConcept
      ? `Dari ${hookConcept || 'awal'} sampai ${climaxConcept}, endingnya bikin mikir keras. Menurut kalian gimana? 🤔`
      : `Bagian ini bener-bener bikin penasaran. Kamu sadar gak ada yang janggal? 👀`;

    const c3 = hookConcept
      ? `Kalau kamu di posisi ini, apa yang bakal kamu lakuin saat "${hookConcept}"? 👇`
      : 'Tonton sampai akhir dan kasih tahu aku teori kalian di komentar! 👇';

    return [c1, c2, c3];
  }

  // English TikTok captions
  const c1 = hookConcept
    ? `Wait until you see what happens during "${hookConcept}"... Watch till the end! 😱`
    : 'I did not see that coming... Watch till the very end!';

  const c2 = climaxConcept && climaxConcept !== hookConcept
    ? `From ${hookConcept || 'the start'} to ${climaxConcept}, the ending is wild. What do you think? 🤔`
    : `Did you catch that hidden detail in this scene? Let me know 👀`;

  const c3 = hookConcept
    ? `What would you honestly do if you were in the middle of "${hookConcept}"? 👇`
    : 'Watch till the end and tell me your theory in the comments! 👇';

  return [c1, c2, c3];
}

/**
 * Validates a Publishing Kit against anti-hallucination rules and storyboard facts.
 * Checks for invented statistics, fake citations, empty fields, and relevance.
 *
 * @param {Object} kit - The publishing kit object
 * @param {Object} context - Extracted storyboard context
 * @returns {string[]} Array of quality warning messages
 */
export function validatePublishingKitAgainstStoryboard(kit, context) {
  const warnings = [];
  if (!kit || typeof kit !== 'object') {
    return ['Invalid Publishing Kit object'];
  }

  const { isSufficient, fullCorpus = '' } = context || {};

  if (isSufficient === false) {
    warnings.push('Publishing kit generated from sparse storyboard. Review titles and descriptions carefully.');
  }

  // Check YouTube Shorts Titles
  const ytTitles = kit.youtube?.titles || [];
  if (!Array.isArray(ytTitles) || ytTitles.filter((t) => (t || '').trim()).length === 0) {
    warnings.push('YouTube Shorts titles are missing or empty.');
  } else {
    ytTitles.forEach((title, idx) => {
      if ((title || '').length > 100) {
        warnings.push(`YouTube Shorts Title ${idx + 1} exceeds recommended 100 character limit (${title.length} chars).`);
      }
    });
  }

  // Check YouTube Shorts Description
  const ytDesc = kit.youtube?.description || '';
  if (!ytDesc.trim()) {
    warnings.push('YouTube Shorts description is empty.');
  }

  // Check YouTube Long-form Titles
  const ytLongTitles = kit.youtube_long?.titles || [];
  if (!Array.isArray(ytLongTitles) || ytLongTitles.filter((t) => (t || '').trim()).length === 0) {
    warnings.push('YouTube Long-form titles are missing or empty.');
  } else {
    ytLongTitles.forEach((title, idx) => {
      if ((title || '').length > 100) {
        warnings.push(`YouTube Long-form Title ${idx + 1} exceeds recommended 100 character limit (${title.length} chars).`);
      }
    });
  }

  // Check YouTube Long-form Description
  const ytLongDesc = kit.youtube_long?.description || '';
  if (!ytLongDesc.trim()) {
    warnings.push('YouTube Long-form description is empty.');
  }

  // Check TikTok Captions (only if TikTok is active/checked)
  const ttCaptions = kit.tiktok?.captions || [];
  if (Array.isArray(ttCaptions) && ttCaptions.length > 0 && ttCaptions.filter((c) => (c || '').trim()).length === 0) {
    warnings.push('TikTok captions are missing or empty.');
  }

  // Anti-Hallucination: Check for invented citations or fake science claims not in corpus
  const suspiciousClaims = [
    { pattern: /\b(?:studi|penelitian|riset|survey)\s+(?:menunjukkan|membuktikan|dari)\b/i, label: 'Unverified research/study claim' },
    { pattern: /\b(?:according to|study proves|researchers found|science says)\b/i, label: 'Unverified study citation' },
    { pattern: /\b\d{2,3}%\s+(?:orang|populasi|manusia|people)\b/i, label: 'Invented percentage statistic' },
    { pattern: /\b(?:harvard|nasa|who|oxford)\b/i, label: 'Unverified institutional attribution' },
  ];

  const allText = [
    ...(kit.youtube?.titles || []),
    kit.youtube?.description || '',
    kit.youtube?.pinnedComment || '',
    ...(kit.youtube_long?.titles || []),
    kit.youtube_long?.description || '',
    kit.youtube_long?.pinnedComment || '',
    ...(kit.tiktok?.captions || []),
    kit.tiktok?.pinnedComment || '',
  ].join('\n');

  suspiciousClaims.forEach(({ pattern, label }) => {
    if (pattern.test(allText) && !pattern.test(fullCorpus)) {
      warnings.push(`Potential ungrounded claim detected: "${label}". Ensure this fact exists in your storyboard.`);
    }
  });

  // Hashtag relevance checks
  const ytTags = kit.youtube?.hashtags || [];
  if (Array.isArray(ytTags) && ytTags.length < 2) {
    warnings.push('Fewer than 2 hashtags provided for YouTube Shorts.');
  }

  const ytLongTags = kit.youtube_long?.hashtags || [];
  if (Array.isArray(ytLongTags) && ytLongTags.length < 2) {
    warnings.push('Fewer than 2 hashtags provided for YouTube Long-form.');
  }

  // Pinned comment discussion checks
  const ytComment = kit.youtube?.pinnedComment || '';
  if (ytComment && !ytComment.includes('?')) {
    warnings.push('YouTube Shorts pinned comment should ask a question to spark viewer engagement.');
  }

  const ytLongComment = kit.youtube_long?.pinnedComment || '';
  if (ytLongComment && !ytLongComment.includes('?')) {
    warnings.push('YouTube Long-form pinned comment should ask a question to spark viewer engagement.');
  }

  return warnings;
}

/**
 * Generates or regenerates a full Publishing Kit from a project model.
 * Preserves user-edited fields if specified.
 *
 * @param {Object} project
 * @param {Object} [options]
 * @param {boolean} [options.preserveEdited=true]
 * @returns {Object} Complete PublishingKit
 */
export function generatePublishingKit(project, { preserveEdited = true } = {}) {
  if (!project || typeof project !== 'object') {
    throw new Error('Project must be a valid object');
  }

  const existingKit = project.publishingKit || createDefaultPublishingKit();
  const context = extractStoryboardContext({
    storyboardText: project.storyboardSource || '',
    scenes: project.scenes || [],
    globalRules: project.globalRules || '',
  });

  const fingerprint = computeStoryboardFingerprint(project);
  const userEdited = preserveEdited ? existingKit.userEditedFields || {} : {};

  // Generate fresh candidates for YouTube Shorts
  const freshYtTitles = generateTitles(context);
  const freshYtDesc = generateYouTubeDescription(context);
  const freshYtTags = generateHashtags(context, 'youtube');
  const freshYtComment = generatePinnedComment(context);

  // Generate fresh candidates for YouTube Long-form
  const freshYtLongTitles = generateLongFormTitles(context);
  const freshYtLongDesc = generateYouTubeLongFormDescription(context);
  const freshYtLongTags = generateHashtags(context, 'youtube_long');
  const freshYtLongComment = generateLongFormPinnedComment(context);

  // Generate fresh candidates for TikTok (stored for when re-enabled)
  const freshTtCaptions = generateTikTokCaptions(context);
  const freshTtTags = generateHashtags(context, 'tiktok');
  const freshTtComment = generatePinnedComment(context);

  const kit = {
    status: PUBLISHING_STATUS.READY,
    sourceFingerprint: fingerprint,
    lastGeneratedAt: Date.now(),
    youtube: {
      titles: userEdited['youtube.titles'] && existingKit.youtube?.titles?.length === 3
        ? existingKit.youtube.titles
        : freshYtTitles,
      selectedTitleIndex: typeof existingKit.youtube?.selectedTitleIndex === 'number'
        ? existingKit.youtube.selectedTitleIndex
        : 0,
      description: userEdited['youtube.description'] && existingKit.youtube?.description
        ? existingKit.youtube.description
        : freshYtDesc,
      hashtags: userEdited['youtube.hashtags'] && Array.isArray(existingKit.youtube?.hashtags)
        ? existingKit.youtube.hashtags
        : freshYtTags,
      pinnedComment: userEdited['youtube.pinnedComment'] && existingKit.youtube?.pinnedComment
        ? existingKit.youtube.pinnedComment
        : freshYtComment,
      checklist: existingKit.youtube?.checklist
        ? { ...createDefaultChecklist(), ...existingKit.youtube.checklist }
        : createDefaultChecklist(),
      publishedStatus: existingKit.youtube?.publishedStatus || PUBLISH_STATE.NOT_PUBLISHED,
      publishedAt: existingKit.youtube?.publishedAt || null,
    },
    youtube_long: {
      titles: userEdited['youtube_long.titles'] && existingKit.youtube_long?.titles?.length === 3
        ? existingKit.youtube_long.titles
        : freshYtLongTitles,
      selectedTitleIndex: typeof existingKit.youtube_long?.selectedTitleIndex === 'number'
        ? existingKit.youtube_long.selectedTitleIndex
        : 0,
      description: userEdited['youtube_long.description'] && existingKit.youtube_long?.description
        ? existingKit.youtube_long.description
        : freshYtLongDesc,
      hashtags: userEdited['youtube_long.hashtags'] && Array.isArray(existingKit.youtube_long?.hashtags)
        ? existingKit.youtube_long.hashtags
        : freshYtLongTags,
      pinnedComment: userEdited['youtube_long.pinnedComment'] && existingKit.youtube_long?.pinnedComment
        ? existingKit.youtube_long.pinnedComment
        : freshYtLongComment,
      checklist: existingKit.youtube_long?.checklist
        ? { ...createDefaultLongFormChecklist(), ...existingKit.youtube_long.checklist }
        : createDefaultLongFormChecklist(),
      publishedStatus: existingKit.youtube_long?.publishedStatus || PUBLISH_STATE.NOT_PUBLISHED,
      publishedAt: existingKit.youtube_long?.publishedAt || null,
    },
    tiktok: {
      captions: userEdited['tiktok.captions'] && existingKit.tiktok?.captions?.length === 3
        ? existingKit.tiktok.captions
        : freshTtCaptions,
      selectedCaptionIndex: typeof existingKit.tiktok?.selectedCaptionIndex === 'number'
        ? existingKit.tiktok.selectedCaptionIndex
        : 0,
      hashtags: userEdited['tiktok.hashtags'] && Array.isArray(existingKit.tiktok?.hashtags)
        ? existingKit.tiktok.hashtags
        : freshTtTags,
      pinnedComment: userEdited['tiktok.pinnedComment'] && existingKit.tiktok?.pinnedComment
        ? existingKit.tiktok.pinnedComment
        : freshTtComment,
      checklist: existingKit.tiktok?.checklist
        ? { ...createDefaultChecklist(), ...existingKit.tiktok.checklist }
        : createDefaultChecklist(),
      publishedStatus: existingKit.tiktok?.publishedStatus || PUBLISH_STATE.NOT_PUBLISHED,
      publishedAt: existingKit.tiktok?.publishedAt || null,
    },
    qualityWarnings: [],
    userEditedFields: userEdited,
  };

  // Run anti-hallucination validation
  kit.qualityWarnings = validatePublishingKitAgainstStoryboard(kit, context);

  return kit;
}

/**
 * Regenerates a single specific field without modifying any other fields.
 *
 * @param {string} fieldKey - e.g. 'youtube.titles', 'youtube_long.description', 'tiktok.captions'
 * @param {Object} project - Active project
 * @returns {Object} Updated PublishingKit
 */
export function generateSingleField(fieldKey, project) {
  if (!project || typeof project !== 'object') {
    throw new Error('Project must be a valid object');
  }

  const existingKit = project.publishingKit
    ? JSON.parse(JSON.stringify(project.publishingKit))
    : createDefaultPublishingKit();

  const context = extractStoryboardContext({
    storyboardText: project.storyboardSource || '',
    scenes: project.scenes || [],
    globalRules: project.globalRules || '',
  });

  switch (fieldKey) {
    // YouTube Shorts fields
    case 'youtube.titles':
      existingKit.youtube.titles = generateTitles(context);
      delete existingKit.userEditedFields['youtube.titles'];
      break;
    case 'youtube.description':
      existingKit.youtube.description = generateYouTubeDescription(context);
      delete existingKit.userEditedFields['youtube.description'];
      break;
    case 'youtube.hashtags':
      existingKit.youtube.hashtags = generateHashtags(context, 'youtube');
      delete existingKit.userEditedFields['youtube.hashtags'];
      break;
    case 'youtube.pinnedComment':
      existingKit.youtube.pinnedComment = generatePinnedComment(context);
      delete existingKit.userEditedFields['youtube.pinnedComment'];
      break;

    // YouTube Long-form fields
    case 'youtube_long.titles':
      if (!existingKit.youtube_long) existingKit.youtube_long = createDefaultPublishingKit().youtube_long;
      existingKit.youtube_long.titles = generateLongFormTitles(context);
      delete existingKit.userEditedFields['youtube_long.titles'];
      break;
    case 'youtube_long.description':
      if (!existingKit.youtube_long) existingKit.youtube_long = createDefaultPublishingKit().youtube_long;
      existingKit.youtube_long.description = generateYouTubeLongFormDescription(context);
      delete existingKit.userEditedFields['youtube_long.description'];
      break;
    case 'youtube_long.hashtags':
      if (!existingKit.youtube_long) existingKit.youtube_long = createDefaultPublishingKit().youtube_long;
      existingKit.youtube_long.hashtags = generateHashtags(context, 'youtube_long');
      delete existingKit.userEditedFields['youtube_long.hashtags'];
      break;
    case 'youtube_long.pinnedComment':
      if (!existingKit.youtube_long) existingKit.youtube_long = createDefaultPublishingKit().youtube_long;
      existingKit.youtube_long.pinnedComment = generateLongFormPinnedComment(context);
      delete existingKit.userEditedFields['youtube_long.pinnedComment'];
      break;

    // TikTok fields
    case 'tiktok.captions':
      existingKit.tiktok.captions = generateTikTokCaptions(context);
      delete existingKit.userEditedFields['tiktok.captions'];
      break;
    case 'tiktok.hashtags':
      existingKit.tiktok.hashtags = generateHashtags(context, 'tiktok');
      delete existingKit.userEditedFields['tiktok.hashtags'];
      break;
    case 'tiktok.pinnedComment':
      existingKit.tiktok.pinnedComment = generatePinnedComment(context);
      delete existingKit.userEditedFields['tiktok.pinnedComment'];
      break;
    default:
      throw new Error(`Unknown field key for regeneration: ${fieldKey}`);
  }

  // Re-run quality validation
  existingKit.qualityWarnings = validatePublishingKitAgainstStoryboard(existingKit, context);
  existingKit.lastGeneratedAt = Date.now();

  return existingKit;
}

/**
 * Formats a complete, platform-ready publishing package string for one-click copy.
 *
 * @param {Object} kit - PublishingKit
 * @param {'youtube' | 'youtube_long' | 'tiktok'} platform
 * @returns {string} Formatted clipboard-ready package
 */
export function formatCompletePackage(kit, platform = 'youtube') {
  if (!kit || typeof kit !== 'object') return '';

  if (platform === 'youtube' || platform === 'youtube_shorts') {
    const titles = kit.youtube?.titles || [];
    const selectedIdx = kit.youtube?.selectedTitleIndex || 0;
    const activeTitle = titles[selectedIdx] || titles[0] || 'Untitled Video';
    const desc = kit.youtube?.description || '';
    const hashtags = Array.isArray(kit.youtube?.hashtags) ? kit.youtube.hashtags.join(' ') : '';
    const pinned = kit.youtube?.pinnedComment || '';

    return [
      `TITLE:`,
      activeTitle,
      ``,
      `DESCRIPTION:`,
      desc,
      ``,
      `HASHTAGS:`,
      hashtags,
      ``,
      `PINNED COMMENT:`,
      pinned,
    ].join('\n');
  }

  if (platform === 'youtube_long') {
    const titles = kit.youtube_long?.titles || [];
    const selectedIdx = kit.youtube_long?.selectedTitleIndex || 0;
    const activeTitle = titles[selectedIdx] || titles[0] || 'Untitled Video';
    const desc = kit.youtube_long?.description || '';
    const hashtags = Array.isArray(kit.youtube_long?.hashtags) ? kit.youtube_long.hashtags.join(' ') : '';
    const pinned = kit.youtube_long?.pinnedComment || '';

    return [
      `TITLE:`,
      activeTitle,
      ``,
      `DESCRIPTION:`,
      desc,
      ``,
      `HASHTAGS:`,
      hashtags,
      ``,
      `PINNED COMMENT:`,
      pinned,
    ].join('\n');
  }

  if (platform === 'tiktok') {
    const captions = kit.tiktok?.captions || [];
    const selectedIdx = kit.tiktok?.selectedCaptionIndex || 0;
    const activeCaption = captions[selectedIdx] || captions[0] || '';
    const hashtags = Array.isArray(kit.tiktok?.hashtags) ? kit.tiktok.hashtags.join(' ') : '';
    const comment = kit.tiktok?.pinnedComment || '';

    return [
      `CAPTION:`,
      activeCaption,
      ``,
      `HASHTAGS:`,
      hashtags,
      ``,
      `FIRST COMMENT:`,
      comment,
    ].join('\n');
  }

  return '';
}

/**
 * Builds an AI Prompt Wrapper for ChatGPT or Claude to generate or enhance
 * a Publishing Kit if the user chooses external LLM workflow.
 *
 * @param {Object} project
 * @returns {string}
 */
export function buildPublishingAiPrompt(project) {
  const context = extractStoryboardContext({
    storyboardText: project.storyboardSource || '',
    scenes: project.scenes || [],
    globalRules: project.globalRules || '',
  });

  const languageLabel = context.language === 'id' ? 'Indonesian' : 'English';

  const scenesFormatted = (project.scenes || [])
    .map((s) => `Scene ${s.sceneNumber}: ${s.title}\n${s.prompt}`)
    .join('\n\n');

  return `You are a social video publishing copywriter and fact-checking specialist.
Generate a structured, grounded Publishing Kit for YouTube Shorts, YouTube Long-form, and TikTok strictly based on the following storyboard:

=== STORYBOARD / SCENES ===
${scenesFormatted || project.storyboardSource || 'No scene content provided.'}

=== STRICT ANTI-HALLUCINATION RULES ===
1. Do NOT invent external scientific claims, statistics, numbers, or institutional references (e.g. NASA, Harvard) that are not in the storyboard.
2. Titles, descriptions, and captions MUST faithfully represent the actual storyline and events above.
3. For YouTube Long-form, provide a complete multi-paragraph educational description grounded in the scenes without inventing fake timestamps or citations.
4. Language must be: ${languageLabel}.
5. Return ONLY valid JSON matching this exact structure:

\`\`\`json
{
  "youtube": {
    "titles": [
      "Title Alternative 1 (Hook-driven Shorts, <= 85 chars)",
      "Title Alternative 2 (Climax-driven Shorts, <= 85 chars)",
      "Title Alternative 3 (Premise summary, <= 85 chars)"
    ],
    "description": "Clear 1-2 paragraph Shorts description and call-to-action.",
    "hashtags": ["#Shorts", "#YouTubeShorts", "#TopicTag1", "#TopicTag2"],
    "pinnedComment": "Thought-provoking question asking viewers their thoughts."
  },
  "youtube_long": {
    "titles": [
      "Full Story Title 1 (<= 95 chars)",
      "Deep Dive Title 2 (<= 95 chars)",
      "Comprehensive Title 3 (<= 95 chars)"
    ],
    "description": "Comprehensive multi-paragraph educational breakdown of the story arc and call-to-action.",
    "hashtags": ["#Documentary", "#Story", "#TopicTag1", "#TopicTag2"],
    "pinnedComment": "In-depth discussion question for long-form viewers."
  },
  "tiktok": {
    "captions": [
      "Caption Alternative 1 (High engagement hook)",
      "Caption Alternative 2 (Story reaction)",
      "Caption Alternative 3 (Discussion prompt)"
    ],
    "hashtags": ["#fyp", "#foryou", "#TopicTag1", "#TopicTag2"],
    "pinnedComment": "Engaging starter comment to spark discussion."
  }
}
\`\`\``;
}

/**
 * Parses raw AI output JSON from ChatGPT or Claude into a sanitized Publishing Kit.
 *
 * @param {string} rawAiText
 * @param {Object} [currentKit]
 * @returns {{ success: boolean, kit?: Object, error?: string }}
 */
export function parsePublishingAiResponse(rawAiText, currentKit = null) {
  if (!rawAiText || typeof rawAiText !== 'string' || !rawAiText.trim()) {
    return { success: false, error: 'AI output text is empty' };
  }

  try {
    // Strip markdown code fences if present
    let jsonString = rawAiText.trim();
    const match = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (match && match[1]) {
      jsonString = match[1].trim();
    }

    const parsed = JSON.parse(jsonString);
    const base = currentKit ? JSON.parse(JSON.stringify(currentKit)) : createDefaultPublishingKit();

    if (parsed.youtube && typeof parsed.youtube === 'object') {
      if (Array.isArray(parsed.youtube.titles) && parsed.youtube.titles.length > 0) {
        base.youtube.titles = parsed.youtube.titles.slice(0, 3).map((t) => String(t || '').trim());
        while (base.youtube.titles.length < 3) base.youtube.titles.push('');
      }
      if (typeof parsed.youtube.description === 'string') {
        base.youtube.description = parsed.youtube.description.trim();
      }
      if (Array.isArray(parsed.youtube.hashtags)) {
        base.youtube.hashtags = parsed.youtube.hashtags.map((h) => String(h || '').trim());
      }
      if (typeof parsed.youtube.pinnedComment === 'string') {
        base.youtube.pinnedComment = parsed.youtube.pinnedComment.trim();
      }
    }

    if (parsed.youtube_long && typeof parsed.youtube_long === 'object') {
      if (!base.youtube_long) base.youtube_long = createDefaultPublishingKit().youtube_long;
      if (Array.isArray(parsed.youtube_long.titles) && parsed.youtube_long.titles.length > 0) {
        base.youtube_long.titles = parsed.youtube_long.titles.slice(0, 3).map((t) => String(t || '').trim());
        while (base.youtube_long.titles.length < 3) base.youtube_long.titles.push('');
      }
      if (typeof parsed.youtube_long.description === 'string') {
        base.youtube_long.description = parsed.youtube_long.description.trim();
      }
      if (Array.isArray(parsed.youtube_long.hashtags)) {
        base.youtube_long.hashtags = parsed.youtube_long.hashtags.map((h) => String(h || '').trim());
      }
      if (typeof parsed.youtube_long.pinnedComment === 'string') {
        base.youtube_long.pinnedComment = parsed.youtube_long.pinnedComment.trim();
      }
    }

    if (parsed.tiktok && typeof parsed.tiktok === 'object') {
      if (Array.isArray(parsed.tiktok.captions) && parsed.tiktok.captions.length > 0) {
        base.tiktok.captions = parsed.tiktok.captions.slice(0, 3).map((c) => String(c || '').trim());
        while (base.tiktok.captions.length < 3) base.tiktok.captions.push('');
      }
      if (Array.isArray(parsed.tiktok.hashtags)) {
        base.tiktok.hashtags = parsed.tiktok.hashtags.map((h) => String(h || '').trim());
      }
      if (typeof parsed.tiktok.pinnedComment === 'string') {
        base.tiktok.pinnedComment = parsed.tiktok.pinnedComment.trim();
      }
    }

    base.status = PUBLISHING_STATUS.READY;
    base.lastGeneratedAt = Date.now();

    return { success: true, kit: base };
  } catch (err) {
    return { success: false, error: `Failed to parse AI JSON: ${err.message}` };
  }
}
