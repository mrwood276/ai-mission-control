import React, { useState, useEffect } from 'react';
import { 
  Pin, 
  Layers, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Sparkles, 
  Copy, 
  FileText, 
  RefreshCw, 
  Flame, 
  Edit3, 
  Check, 
  X, 
  ClipboardPaste,
  ArrowRight,
  ListFilter,
  RotateCcw,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { MODES, WEBVIEWS } from '../constants';
import { injectTextToWebview, injectFreshGemini, DELIVERY_STATUS } from '../utils/webviewInjection';
import { parsePromptText } from '../utils/sceneParser';

const STORAGE_KEYS = {
  GLOBAL_RULES: 'aimc_global_rules',
  SCENE_CARDS: 'aimc_scene_cards',
  SIDEBAR_COLLAPSED: 'aimc_sidebar_collapsed',
};

const DEFAULT_GLOBAL_RULES = 
  'Aspect Ratio 16:9, Unreal Engine 5.4 cinematic lighting, octane render, 8k hyper-detailed, photorealistic, volumetric fog, dynamic camera angles.';

const DEFAULT_SCENES = [
  {
    id: 'scene-1',
    sceneNumber: 1,
    title: 'Scene 1: Opening Hook',
    prompt: 'Cinematic wide shot of cybernetic command center with holographic screens glowing in neon blue and amber, cinematic depth of field.',
    done: false,
  },
  {
    id: 'scene-2',
    sceneNumber: 2,
    title: 'Scene 2: Problem Statement',
    prompt: 'Medium close-up of protagonist analyzing multi-screen AI telemetry as neural network nodes pulse with urgent amber alerts.',
    done: false,
  },
  {
    id: 'scene-3',
    sceneNumber: 3,
    title: 'Scene 3: AI Pipeline Solution',
    prompt: 'Dynamic 3D camera pan across Claude, ChatGPT, Gemini neural pathways connecting into a unified creator command center.',
    done: false,
  },
];

export default function PipelineSidebar({
  activeMode,
  geminiCounter = 0,
  setGeminiCounter,
  className = '',
  orderStyle = {},
}) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED);
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const [globalRules, setGlobalRules] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.GLOBAL_RULES);
      return typeof raw === 'string' && raw.trim() ? raw : DEFAULT_GLOBAL_RULES;
    } catch {
      return DEFAULT_GLOBAL_RULES;
    }
  });

  const [scenes, setScenes] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SCENE_CARDS);
      if (!saved) return DEFAULT_SCENES;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.filter(
          (s) => s && typeof s === 'object' && typeof s.id === 'string' && typeof s.prompt === 'string'
        );
        return valid.length > 0 ? valid : DEFAULT_SCENES;
      }
      return DEFAULT_SCENES;
    } catch {
      return DEFAULT_SCENES;
    }
  });

  const [isParserOpen, setIsParserOpen] = useState(false);
  const [rawInputText, setRawInputText] = useState('');
  const [parsedPreview, setParsedPreview] = useState(null); // Holds { scenes, globalRules, warnings } when previewing
  const [toastMessage, setToastMessage] = useState(null);
  const [editingCardId, setEditingCardId] = useState(null);
  const [filterDone, setFilterDone] = useState('all'); // 'all', 'pending', 'completed'

  // Persist Global Rules
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.GLOBAL_RULES, globalRules);
    } catch {}
  }, [globalRules]);

  // Persist Scene Cards
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SCENE_CARDS, JSON.stringify(scenes));
    } catch {}
  }, [scenes]);

  // Persist Collapsed State
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, JSON.stringify(collapsed));
    } catch {}
  }, [collapsed]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const showToast = (message, type = 'info') => {
    setToastMessage({ message, type });
  };

  // Parsing raw text from ChatGPT / AI
  const handleParseRawText = () => {
    if (!rawInputText.trim()) {
      showToast('Paste AI storyboard output before parsing.', 'warning');
      return;
    }

    const result = parsePromptText(rawInputText);
    if (!result.success || result.scenes.length === 0) {
      const errorMsg = result.errors.length > 0 ? result.errors.join(' ') : 'No valid scenes found.';
      showToast(`Parsing failed: ${errorMsg}`, 'error');
      return;
    }

    // Show preview confirmation before modifying project
    setParsedPreview(result);
  };

  // Confirm replacement after reviewing preview
  const handleConfirmImport = () => {
    if (!parsedPreview || parsedPreview.scenes.length === 0) return;

    if (parsedPreview.globalRules) {
      setGlobalRules(parsedPreview.globalRules);
    }

    setScenes(parsedPreview.scenes);
    setParsedPreview(null);
    setIsParserOpen(false);
    setRawInputText('');
    showToast(
      `✓ Imported ${parsedPreview.scenes.length} Scene Cards${parsedPreview.globalRules ? ' & updated Global Rules' : ''}!`,
      'success'
    );
  };

  const handleCancelPreview = () => {
    setParsedPreview(null);
  };

  // Quick Copy Storyboard Prompt Wrapper for Mode 2
  const handleCopyStoryboardWrapper = async () => {
    try {
      let clipboardText = '';
      try {
        if (navigator?.clipboard?.readText) {
          clipboardText = await navigator.clipboard.readText();
        }
      } catch (e) {
        console.warn('Clipboard read failed:', e);
      }

      const promptWrapper = 
`Role: You are an expert Video Director, Storyboard Artist, and AI Prompt Engineer.

Task:
Analyze the storyboard provided below and generate two structured outputs:

1. GLOBAL RULES:
Define a consistent aesthetic, aspect ratio (16:9), camera lighting, color grading, artistic style, and rendering parameters that must be maintained across all scenes.

2. SCENE PROMPTS:
Break down the storyboard into numbered individual scene prompts using this exact format:
Scene 1: [Short Title]
[Detailed visual animation prompt describing camera angle, movement, subject action, environment, and visual effects]

Scene 2: [Short Title]
[Detailed visual animation prompt]

(Continue for all scenes)

--- STORYBOARD INPUT ---
${clipboardText.trim() ? clipboardText.trim() : '[PASTE YOUR CLAUDE STORYBOARD SCRIPT HERE]'}`;

      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(promptWrapper);
        showToast('✓ Storyboard Prompt Wrapper copied! Paste it into ChatGPT.', 'success');
      } else {
        showToast('Clipboard write is not supported in this environment.', 'warning');
      }
    } catch {
      showToast('Failed to copy wrapper to clipboard.', 'error');
    }
  };

  // Action Button Handlers with explicit delivery tracking
  const handleSendToGemini = async (scene) => {
    try {
      const res = await injectTextToWebview(WEBVIEWS.GEMINI.id, scene.prompt);

      if (res.status === DELIVERY_STATUS.INSERTED) {
        if (setGeminiCounter) {
          setGeminiCounter((prev) => Math.min(prev + 1, 4));
        }
        showToast(
          `▶️ Gemini: Prompt inserted into input! (Estimated session load: ${Math.min((geminiCounter || 0) + 1, 4)}/4)`,
          'success'
        );
      } else if (res.status === DELIVERY_STATUS.COPIED) {
        showToast(
          '📋 Gemini: Prompt copied to clipboard for manual paste (Ctrl+V). Webview input not reachable.',
          'info'
        );
      } else {
        showToast(`⚠️ Gemini delivery failed: ${res.error || res.reason || 'Input unavailable'}`, 'error');
      }
    } catch (e) {
      showToast('Failed to deliver prompt to Gemini.', 'error');
    }
  };

  const handleFreshGeminiGlobal = async (scene) => {
    try {
      const fullPrompt = globalRules?.trim()
        ? `${globalRules.trim()}\n\n${scene.prompt.trim()}`
        : scene.prompt.trim();

      showToast('🔄 Initializing fresh Gemini chat session...', 'info');
      const res = await injectFreshGemini(WEBVIEWS.GEMINI.id, fullPrompt);

      if (res.status === DELIVERY_STATUS.INSERTED) {
        if (setGeminiCounter) {
          setGeminiCounter(1);
        }
        showToast('✓ Gemini Fresh: Session initialized and prompt inserted (Load: 1/4)', 'success');
      } else if (res.status === DELIVERY_STATUS.COPIED) {
        if (setGeminiCounter) {
          setGeminiCounter(1);
        }
        showToast('📋 Gemini Fresh: Navigated. Prompt copied to clipboard for manual paste.', 'info');
      } else {
        showToast(`⚠️ Failed to load fresh Gemini session: ${res.error || res.reason}`, 'error');
      }
    } catch {
      showToast('Failed to open fresh Gemini chat.', 'error');
    }
  };

  const handleSendToFlow = async (scene) => {
    try {
      const flowPrompt = globalRules?.trim()
        ? `${globalRules.trim()}\n\n${scene.prompt.trim()}`
        : scene.prompt.trim();

      const res = await injectTextToWebview(WEBVIEWS.GOOGLE_FLOW.id, flowPrompt);

      if (res.status === DELIVERY_STATUS.INSERTED) {
        showToast('🎬 Flow: Prompt inserted into Google Flow input!', 'success');
      } else if (res.status === DELIVERY_STATUS.COPIED) {
        showToast('📋 Flow: Prompt copied to clipboard for manual paste (Ctrl+V).', 'info');
      } else {
        showToast(`⚠️ Flow delivery failed: ${res.error || res.reason}`, 'error');
      }
    } catch {
      showToast('Failed to deliver prompt to Google Flow.', 'error');
    }
  };

  // Scene card management
  const handleToggleDone = (id) => {
    setScenes((prev) =>
      prev.map((scene) =>
        scene.id === id ? { ...scene, done: !scene.done } : scene
      )
    );
  };

  const handleAddScene = () => {
    const nextNumber = scenes.length > 0 ? Math.max(...scenes.map((s) => s.sceneNumber || 0)) + 1 : 1;
    const newScene = {
      id: `scene-${Date.now()}`,
      sceneNumber: nextNumber,
      title: `Scene ${nextNumber}: New Scene`,
      prompt: 'Cinematic shot description...',
      done: false,
    };
    setScenes([...scenes, newScene]);
    setEditingCardId(newScene.id);
    showToast(`Scene ${nextNumber} added.`, 'info');
  };

  const handleDeleteScene = (id) => {
    setScenes((prev) => prev.filter((s) => s.id !== id));
    showToast('Scene Card deleted.', 'info');
  };

  const handleUpdateScene = (id, field, value) => {
    setScenes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const filteredScenes = scenes.filter((scene) => {
    if (filterDone === 'pending') return !scene.done;
    if (filterDone === 'completed') return scene.done;
    return true;
  });

  const completedCount = scenes.filter((s) => s.done).length;

  return (
    <aside
      id="pipelineSidebar"
      style={orderStyle}
      className={`h-full border-r border-slate-800 bg-slate-900/95 flex-col flex-shrink-0 transition-all duration-200 z-20 overflow-hidden relative ${
        collapsed ? 'w-12 min-w-[48px]' : 'w-80 min-w-[320px] max-w-[400px]'
      } ${className}`}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-10 inset-x-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
          <div
            className={`p-2 rounded-lg text-xs shadow-lg border flex items-center justify-between gap-1.5 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950/95 border-emerald-700 text-emerald-200'
                : toastMessage.type === 'error'
                ? 'bg-rose-950/95 border-rose-700 text-rose-200'
                : 'bg-indigo-950/95 border-indigo-700 text-indigo-200'
            }`}
          >
            <span className="truncate flex-1 font-sans">{toastMessage.message}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="h-8 bg-slate-900 border-b border-slate-800 px-2 flex items-center justify-between text-xs select-none flex-shrink-0">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1.5 text-slate-300 hover:text-white font-medium truncate"
          title={collapsed ? 'Expand Pipeline Sidebar' : 'Collapse Sidebar'}
        >
          <Layers className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
          {!collapsed && (
            <span className="truncate font-semibold text-slate-200">
              Pipeline Control
            </span>
          )}
        </button>

        <div className="flex items-center gap-1.5">
          {!collapsed && (
            <>
              {/* Gemini Session Load Badge with Reset Action */}
              <div
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 border transition-all ${
                  geminiCounter >= 4
                    ? 'bg-rose-950/80 text-rose-300 border-rose-700/80'
                    : geminiCounter >= 3
                    ? 'bg-amber-950/80 text-amber-300 border-amber-700/80'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
                title={`Estimated Gemini Session Load: ${geminiCounter}/4. Recommends starting a fresh session every 4 prompts to maintain prompt adherence.`}
              >
                <Flame className={`w-3 h-3 ${geminiCounter >= 4 ? 'text-rose-400 animate-bounce' : 'text-sky-400'}`} />
                <span>Gemini: {geminiCounter}/4</span>
                <button
                  onClick={() => {
                    if (setGeminiCounter) setGeminiCounter(0);
                    showToast('Gemini session prompt counter reset to 0/4', 'info');
                  }}
                  className="ml-0.5 p-0.5 rounded hover:bg-white/20 text-slate-400 hover:text-white transition"
                  title="Reset Gemini session prompt tracker to 0"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                </button>
              </div>

              {/* Parser Trigger Button */}
              <button
                onClick={() => {
                  setParsedPreview(null);
                  setIsParserOpen(true);
                }}
                className="p-1 rounded bg-purple-600/30 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/40 transition"
                title="Paste raw ChatGPT output to parse into Scene Cards"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Sidebar Content Area */}
      {!collapsed && (
        <div className="flex-1 flex flex-col overflow-hidden text-xs">
          {/* Quick Handoff Banner in Mode 2 */}
          {activeMode === MODES.PROMPT_ENGINEERING && (
            <div className="p-2.5 bg-gradient-to-r from-purple-950/40 to-slate-900 border-b border-purple-800/30 flex flex-col gap-2 flex-shrink-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-purple-300 text-[11px] flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Mode 2: Prompt Handoff
                </span>
                <span className="text-[10px] text-slate-400">Claude → ChatGPT</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Copy Claude storyboard, wrap with Director rules, and send to ChatGPT:
              </p>
              <button
                onClick={handleCopyStoryboardWrapper}
                className="w-full py-1.5 px-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-[11px] flex items-center justify-center gap-1.5 transition shadow-sm"
              >
                <Copy className="w-3 h-3" />
                <span>Copy Storyboard Wrapper</span>
              </button>
            </div>
          )}

          {/* Section 1: Pinned Global Rules Card */}
          <div className="p-2.5 border-b border-slate-800 bg-slate-950/60 flex-shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                <Pin className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
                <span className="tracking-wide">Global Visual Rules</span>
              </div>
              <span className="text-[10px] text-amber-400/80 font-mono">Pinned</span>
            </div>
            <textarea
              value={globalRules}
              onChange={(e) => setGlobalRules(e.target.value)}
              placeholder="e.g. Aspect Ratio 16:9, Unreal Engine 5 lighting, 8k render..."
              rows={3}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-300 text-[11px] resize-none focus:outline-none focus:border-amber-500/50 transition font-mono leading-relaxed"
            />
          </div>

          {/* Section 2: Scene Cards List Filter Bar */}
          <div className="h-8 px-2.5 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between flex-shrink-0 select-none">
            <div className="flex items-center gap-1.5 font-medium text-slate-300 text-[11px]">
              <FileText className="w-3 h-3 text-sky-400" />
              <span>Scene Cards ({completedCount}/{scenes.length})</span>
            </div>

            <div className="flex items-center gap-1">
              {/* Filter Completed / Pending */}
              <div className="flex items-center bg-slate-950 rounded border border-slate-800 p-0.5 text-[10px]">
                <button
                  onClick={() => setFilterDone('all')}
                  className={`px-1.5 py-0.5 rounded ${filterDone === 'all' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterDone('pending')}
                  className={`px-1.5 py-0.5 rounded ${filterDone === 'pending' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Todo
                </button>
                <button
                  onClick={() => setFilterDone('completed')}
                  className={`px-1.5 py-0.5 rounded ${filterDone === 'completed' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Done
                </button>
              </div>

              {/* Add New Scene Button */}
              <button
                onClick={handleAddScene}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                title="Add a new blank Scene Card"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Section 3: Scrollable Scene Cards List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {filteredScenes.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                <FileText className="w-6 h-6 text-slate-600" />
                <span>No scene cards found matching filter.</span>
                <button
                  onClick={() => {
                    setParsedPreview(null);
                    setIsParserOpen(true);
                  }}
                  className="mt-1 px-3 py-1 rounded bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 text-[11px] transition"
                >
                  Parse Storyboard
                </button>
              </div>
            ) : (
              filteredScenes.map((scene) => {
                const isEditing = editingCardId === scene.id;
                const isGeminiFull = (geminiCounter || 0) >= 4;

                return (
                  <div
                    key={scene.id}
                    className={`rounded-xl border transition-all duration-150 p-2.5 flex flex-col gap-2 ${
                      scene.done
                        ? 'bg-slate-950/40 border-slate-800/60 opacity-70'
                        : 'bg-slate-950 border-slate-800/90 shadow-sm hover:border-slate-700'
                    }`}
                  >
                    {/* Scene Header */}
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <button
                          onClick={() => handleToggleDone(scene.id)}
                          className={`flex-shrink-0 transition ${
                            scene.done
                              ? 'text-emerald-400 hover:text-emerald-300'
                              : 'text-slate-600 hover:text-slate-400'
                          }`}
                          title={scene.done ? 'Mark as Pending' : 'Mark as Done'}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>

                        {isEditing ? (
                          <input
                            type="text"
                            value={scene.title}
                            onChange={(e) =>
                              handleUpdateScene(scene.id, 'title', e.target.value)
                            }
                            className="flex-1 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-slate-200 font-semibold focus:outline-none"
                          />
                        ) : (
                          <span
                            className={`font-semibold text-xs truncate ${
                              scene.done
                                ? 'line-through text-slate-500'
                                : 'text-slate-200'
                            }`}
                          >
                            {scene.title}
                          </span>
                        )}
                      </div>

                      {/* Card Tools */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() =>
                            setEditingCardId(isEditing ? null : scene.id)
                          }
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                          title={isEditing ? 'Save Edit' : 'Edit Scene'}
                        >
                          {isEditing ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Edit3 className="w-3 h-3" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteScene(scene.id)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition"
                          title="Delete Scene"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Scene Prompt Text */}
                    {isEditing ? (
                      <textarea
                        value={scene.prompt}
                        onChange={(e) =>
                          handleUpdateScene(scene.id, 'prompt', e.target.value)
                        }
                        rows={3}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-300 text-[11px] font-mono resize-none focus:outline-none"
                      />
                    ) : (
                      <p className="text-[11px] text-slate-400 font-mono leading-relaxed line-clamp-3 select-text bg-slate-900/50 p-1.5 rounded border border-slate-900">
                        {scene.prompt}
                      </p>
                    )}

                    {/* Action Delivery Buttons */}
                    <div className="flex items-center gap-1.5 pt-1 border-t border-slate-900/80">
                      {/* Button 1: Inject Scene Only to Gemini */}
                      <button
                        onClick={() => handleSendToGemini(scene)}
                        className={`flex-1 py-1 px-1.5 rounded text-[10px] font-medium flex items-center justify-center gap-1 transition shadow-sm ${
                          isGeminiFull
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                            : 'bg-sky-600/80 hover:bg-sky-500 text-white'
                        }`}
                        title="Inject scene prompt into Gemini webview input"
                      >
                        <ArrowRight className="w-2.5 h-2.5" />
                        <span>Inject Scene</span>
                      </button>

                      {/* Button 2: Fresh Gemini + Global + Scene */}
                      <button
                        onClick={() => handleFreshGeminiGlobal(scene)}
                        className={`flex-1 py-1 px-1.5 rounded text-[10px] font-medium flex items-center justify-center gap-1 transition shadow-sm ${
                          isGeminiFull
                            ? 'bg-amber-600 hover:bg-amber-500 text-white font-semibold animate-pulse ring-1 ring-amber-400'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                        title="Open fresh Gemini chat, wait for load, and inject Global Rules + Scene Prompt together"
                      >
                        <RefreshCw className="w-2.5 h-2.5 text-amber-300" />
                        <span>Fresh + Global</span>
                      </button>

                      {/* Button 3: Send to Google Flow */}
                      <button
                        onClick={() => handleSendToFlow(scene)}
                        className="flex-1 py-1 px-1.5 rounded bg-purple-600/80 hover:bg-purple-500 text-white text-[10px] font-medium flex items-center justify-center gap-1 transition shadow-sm"
                        title="Combine Global Rules + Scene Prompt and inject/copy to Google Flow"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>🎬 Flow</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Raw Output Parser Modal with Preview Confirmation */}
      {isParserOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <ClipboardPaste className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-slate-100">
                    {parsedPreview ? 'Confirm Scene Import Preview' : 'Raw AI Output Parser'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {parsedPreview
                      ? 'Review parsed scenes before confirming replacement of existing project.'
                      : 'Paste raw ChatGPT storyboard to extract Global Rules and individual Scene Cards.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setParsedPreview(null);
                  setIsParserOpen(false);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            {parsedPreview ? (
              <div className="p-5 flex-1 flex flex-col gap-3 overflow-hidden text-xs">
                <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-800/40 text-purple-200 flex items-center justify-between">
                  <span className="font-medium">
                    ✓ Successfully parsed {parsedPreview.scenes.length} Scene Cards
                  </span>
                  <span className="text-[10px] text-purple-300 font-mono">
                    {parsedPreview.globalRules ? 'Global Rules Found' : 'No Global Rules'}
                  </span>
                </div>

                {parsedPreview.globalRules && (
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-amber-400 font-mono font-medium block mb-1">
                      EXTRACTED GLOBAL RULES:
                    </span>
                    <p className="text-slate-300 font-mono text-[11px] line-clamp-2">
                      {parsedPreview.globalRules}
                    </p>
                  </div>
                )}

                {/* Parsed Scenes Preview List */}
                <div className="flex-1 overflow-y-auto space-y-2 border border-slate-800 rounded-xl p-2 bg-slate-950/40">
                  {parsedPreview.scenes.map((s, idx) => (
                    <div key={s.id || idx} className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="font-semibold text-slate-200 text-xs mb-0.5">
                        {s.title}
                      </div>
                      <p className="text-slate-400 font-mono text-[11px] line-clamp-2">
                        {s.prompt}
                      </p>
                    </div>
                  ))}
                </div>

                {parsedPreview.warnings && parsedPreview.warnings.length > 0 && (
                  <div className="p-2 rounded bg-amber-950/30 border border-amber-800/30 text-amber-300 text-[11px]">
                    {parsedPreview.warnings.join(' ')}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-5 flex-1 flex flex-col gap-3 overflow-hidden">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-300">
                    Paste ChatGPT Output:
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        if (navigator?.clipboard?.readText) {
                          const text = await navigator.clipboard.readText();
                          setRawInputText(text);
                        }
                      } catch {}
                    }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 text-[11px] transition flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Paste Clipboard</span>
                  </button>
                </div>

                <textarea
                  value={rawInputText}
                  onChange={(e) => setRawInputText(e.target.value)}
                  placeholder={
`Global Rules:
Aspect Ratio 16:9, Unreal Engine 5.4 cinematic lighting, 8k render...

Scene 1: Opening Hook
Cinematic wide shot of mission control room...

Scene 2: Problem Statement
Medium close-up of protagonist analyzing AI telemetry...`}
                  rows={12}
                  className="w-full flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 font-mono text-xs resize-none focus:outline-none focus:border-purple-500/50"
                />
              </div>
            )}

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">
                {parsedPreview
                  ? 'Existing scenes will be replaced upon confirmation.'
                  : 'Detects headings: Scene 1, SCENE 1:, # Scene 1, etc.'}
              </span>

              <div className="flex items-center gap-2">
                {parsedPreview ? (
                  <>
                    <button
                      onClick={handleCancelPreview}
                      className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                    >
                      Back to Edit
                    </button>
                    <button
                      onClick={handleConfirmImport}
                      className="px-5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirm & Replace Project</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setIsParserOpen(false)}
                      className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleParseRawText}
                      disabled={!rawInputText.trim()}
                      className="px-5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-purple-600/20 flex items-center gap-1.5 transition"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Parse & Preview</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
