export const SESSION_PARTITION = 'persist:clean_chrome_v3';

export const MODES = {
  ANALYTICS: 'MODE_1_ANALYTICS',
  PROMPT_ENGINEERING: 'MODE_2_PROMPT_ENGINEERING',
  VISUAL_STUDIO: 'MODE_3_VISUAL_STUDIO',
};

export const WEBVIEWS = {
  YOUTUBE: {
    id: 'ytStudio',
    name: 'YouTube Studio',
    url: 'https://studio.youtube.com',
    badge: 'Analytics',
    badgeColor: 'text-red-400 bg-red-950/60 border-red-800/60',
  },
  CLAUDE: {
    id: 'claude',
    name: 'Claude',
    url: 'https://claude.ai',
    badge: 'Ideation / Scripting',
    badgeColor: 'text-amber-400 bg-amber-950/60 border-amber-800/60',
  },
  CHATGPT: {
    id: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chatgpt.com',
    badge: 'Prompt Decomposition',
    badgeColor: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60',
  },
  GEMINI: {
    id: 'gemini',
    name: 'Gemini',
    url: 'https://gemini.google.com/app',
    badge: 'Visual Prompts (Max 4/chat)',
    badgeColor: 'text-sky-400 bg-sky-950/60 border-sky-800/60',
  },
  GOOGLE_FLOW: {
    id: 'googleFlow',
    name: 'Google Flow',
    url: 'https://labs.google/fx/tools/flow',
    badge: 'Scene Rendering FX',
    badgeColor: 'text-purple-400 bg-purple-950/60 border-purple-800/60',
  },
};
