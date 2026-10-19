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

  return `Role: You are an expert Film Director, Storyboard Artist, and AI Video Prompt Engineer specializing in generative video production (${generator}).

Task:
Analyze the source storyboard provided below and transform it into production-ready video-generation prompts without altering the underlying narrative order, character identities, or story outcome.

Target Video Specifications:
- Aspect Ratio: ${ratio}
- Visual / Artistic Style: ${style}
- Target Generator: ${generator}
${additionalDirectives.join('\n')}

Core Directives for Prompt Engineering:
1. Narrative Fidelity: Preserve the storyboard's original meaning, narrative order, key events, and intended emotional arc. Never introduce unprompted plot points or extra characters.
2. Self-Contained Scene Prompts: Every scene prompt must be completely understandable by an AI video model on its own. Never use lazy references like "same as before" or "repeat previous scene". Write out the necessary subject, clothing, environment, lighting, and camera details explicitly.
3. Strict Visual Continuity: Maintain consistent character appearances, clothing colors, key props, time-of-day lighting logic, and architectural details across scenes unless the storyboard explicitly states a transformation.
4. Camera & Action Clarity: Clearly describe camera framing (wide, medium, extreme close-up), camera movement (pan, tilt, slow push-in, orbital tracking), subject action, and environmental atmosphere (volumetric haze, neon reflections, golden hour sunlight).
5. Seamless Transitions: Specify camera transitions (match cut, whip pan, focus pull, continuous action) when relevant to scene continuity.
6. Clean Visuals: Do not add unwanted on-screen text, watermarks, UI overlays, or subtitles into the visual description unless explicitly requested.
7. No Silent Omissions: Every single scene in the storyboard must be represented. If scenes must be partitioned or paced, keep all source content accounted for.

REQUIRED OUTPUT STRUCTURE (Strictly follow this human-readable format):

GLOBAL RULES:
[Provide 2-4 concise sentences defining the project-wide visual requirements, aspect ratio (${ratio}), rendering parameters, color palette, lighting scheme, and aesthetic guidelines to be pinned across all scenes.]

SCENE 1: [Short, descriptive scene title]
[Complete, detailed video prompt for Scene 1 including camera angle/motion, subject actions, environment, lighting, and visual effects.]

SCENE 2: [Short, descriptive scene title]
[Complete, detailed video prompt for Scene 2 with explicit visual continuity from Scene 1.]

(Continue with SCENE 3, SCENE 4, etc., until all source scenes are fully generated. Do not include extraneous conversational preamble or closing remarks.)

--- STORYBOARD SOURCE ---
${cleanSource}`;
}
