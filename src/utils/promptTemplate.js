/**
 * ChatGPT Prompt Wrapper & Template Generator
 * Generates structured, director-level prompt engineering instructions
 * for transforming Claude storyboards into production-ready video prompts.
 */

export const SUPPORTED_ASPECT_RATIOS = [
  '16:9',
  '9:16',
  '1:1',
  '4:3',
  '21:9',
  '2.39:1',
];

export const ARTISTIC_STYLES = [
  { id: 'custom', label: 'Use Storyboard / Custom Style' },
  { id: 'photorealistic', label: 'Photorealistic / Live Action' },
  { id: 'cinematic_film', label: 'Cinematic 35mm Film' },
  { id: 'unreal_cgi', label: '3D Hyper-Realistic (Unreal Engine 5)' },
  { id: 'anime_cyberpunk', label: 'Cinematic Anime / Cyberpunk' },
  { id: 'digital_2d', label: 'Stylized 2D Digital Animation' },
  { id: 'vintage_retro', label: 'Retro 80s/90s Synthwave VHS' },
];

/**
 * Builds the complete ChatGPT prompt wrapper instructing ChatGPT
 * to transform the storyboard into structured Global Rules and Scene Cards.
 *
 * @param {Object} options
 * @param {string} options.storyboardText - Raw storyboard source text
 * @param {string} [options.aspectRatio='16:9'] - Target aspect ratio
 * @param {string} [options.artisticStyle=''] - Visual style description or preset
 * @param {string} [options.targetGenerator='Google Flow / Gemini'] - Target generator platform
 * @param {string} [options.customVisualRequirements=''] - Project-specific visual requirements
 * @param {string} [options.durationConstraints=''] - Optional duration constraints per scene (e.g. 5-8s)
 * @param {boolean} [options.preserveVoiceOver=true] - Whether to explicitly preserve narrator/VO text
 * @returns {string} The complete wrapper text to copy to ChatGPT
 */
export function buildChatGPTWrapper({
  storyboardText,
  aspectRatio = '16:9',
  artisticStyle = '',
  targetGenerator = 'Google Flow & Gemini',
  customVisualRequirements = '',
  durationConstraints = '',
  preserveVoiceOver = true,
}) {
  const cleanSource = (storyboardText || '').trim();
  const ratio = (aspectRatio || '16:9').trim();
  const style = (artisticStyle || 'Preserve artistic style as defined in storyboard').trim();
  const generator = (targetGenerator || 'Google Flow & Gemini').trim();

  const additionalDirectives = [];
  if (customVisualRequirements.trim()) {
    additionalDirectives.push(`- Project-Specific Visual Requirements: ${customVisualRequirements.trim()}`);
  }
  if (durationConstraints.trim()) {
    additionalDirectives.push(`- Duration / Pacing Constraints: ${durationConstraints.trim()}`);
  }
  if (preserveVoiceOver) {
    additionalDirectives.push(
      '- Voice-Over & Narration: Preserve all verbatim voice-over/dialogue if supplied in the storyboard. Do not invent replacement narration unless the source is silent and narration is requested.'
    );
  }

  return `Role: You are an expert Film Director, Storyboard Artist, AI Image Generation Prompt Engineer, and AI Video Prompt Engineer specializing in generative visual and video production (${generator}).

Task:
Analyze the source storyboard provided below and transform it into a linked dual-production pipeline: for each scene, produce both an IMAGE GENERATION PROMPT (for visual references and final image assets) and a VIDEO GENERATION PROMPT (for animating the scene from that starting visual state). Maintain strict visual consistency, character appearance, and narrative continuity across both prompt types without altering the underlying narrative order or story outcome.

Target Specifications:
- Aspect Ratio: ${ratio}
- Visual / Artistic Style: ${style}
- Target Generator: ${generator}
${additionalDirectives.join('\n')}

Core Directives for Dual Prompt Engineering:
1. Linked Image & Video Consistency: For every scene, the IMAGE PROMPT defines the exact visual appearance, subject identity, wardrobe, framing, lighting, and environment of the opening frame. The VIDEO PROMPT describes how that scene animates, moves, and develops from that starting state.
2. Image Prompt Specifics: Write self-contained, detailed still image prompts. Describe the main subject, character identity/appearance/clothing, environment/background, composition, camera angle, lighting/atmosphere, color palette, artistic style, and key props. Include explicit restrictions against unwanted text, subtitles, logos, or watermarks. Do not use animation or movement verbs in image prompts.
3. Video Prompt Specifics: Describe the starting visual state (consistent with the image prompt), character and object movement, camera movement (pan, tilt, push-in, tracking), environmental motion, scene pacing, and natural continuity into the next scene.
4. Strict Visual Continuity: Maintain consistent character features, wardrobe colors, recurring objects, time-of-day lighting logic, and architectural designs across scenes unless a transformation is explicitly stated in the storyboard.
5. Narrative Fidelity & Ordering: Preserve original scene boundaries, numbering, and emotional arc. Never skip scenes or introduce unprompted plot points.
6. Clean Visuals: Do not introduce unrequested on-screen typography, watermarks, UI overlays, or burnt-in subtitles into prompt descriptions.

REQUIRED OUTPUT STRUCTURE (Strictly follow this human-readable format):

GLOBAL RULES:
[Provide 2-4 concise sentences defining the project-wide visual requirements, aspect ratio (${ratio}), rendering parameters, color palette, lighting scheme, and aesthetic guidelines to be pinned across all scenes.]

SCENE 1: [Short, descriptive scene title]
IMAGE PROMPT:
[Complete, detailed still image prompt for Scene 1 including framing, subject appearance, environment, lighting, and artistic style. No motion verbs.]

VIDEO PROMPT:
[Complete, detailed video prompt for Scene 1 describing camera movement, subject action, environmental animation, and transition starting from the visual state in the Image Prompt.]

SCENE 2: [Short, descriptive scene title]
IMAGE PROMPT:
[Complete, detailed still image prompt for Scene 2 with explicit character, wardrobe, and environmental continuity from Scene 1.]

VIDEO PROMPT:
[Complete, detailed video prompt for Scene 2 with camera motion, action, and continuity from Scene 1.]

(Continue with SCENE 3, SCENE 4, etc., until all source scenes are fully generated. Do not include extraneous conversational preamble or closing remarks.)

--- STORYBOARD SOURCE ---
${cleanSource}`;
}

/**
 * Builds an AI revision wrapper for refining or regenerating an image prompt.
 * @param {Object} options
 * @param {Object} options.scene - Scene object
 * @param {string} [options.globalRules=''] - Project global rules
 * @param {string} [options.currentImagePrompt=''] - Existing image prompt
 * @param {string} [options.revisionInstructions=''] - User-specified adjustments
 * @returns {string}
 */
export function buildImagePromptRevisionWrapper({
  scene,
  globalRules = '',
  currentImagePrompt = '',
  revisionInstructions = '',
}) {
  const sceneNum = scene?.sceneNumber || 1;
  const sceneTitle = scene?.title || `Scene ${sceneNum}`;
  const videoContext = scene?.videoPrompt || scene?.prompt || '';

  return `Role: Expert AI Image Prompt Engineer.
Task: Revise the Image Generation Prompt for Scene ${sceneNum} ("${sceneTitle}") to improve visual clarity, composition, and fidelity while strictly maintaining consistency with project Global Rules and the scene's video motion plan.

Project Global Rules:
${globalRules || 'None specified.'}

Scene Video Motion Context:
${videoContext || 'None specified.'}

Current Image Prompt:
${currentImagePrompt || 'None.'}

Requested Revisions:
${revisionInstructions || 'Refine for higher photorealism, clearer character framing, and cinematic lighting.'}

Deliverable:
Provide ONLY the revised IMAGE PROMPT text ready to be pasted into the image generator, with no conversational preamble.`;
}

