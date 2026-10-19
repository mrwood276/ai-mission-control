import React, { useState, useEffect } from 'react';
import { 
  Pin, 
  Layers, 
  Send, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Sparkles, 
  Copy, 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  RefreshCw, 
  Flame, 
  Edit3, 
  Check, 
  X, 
  ClipboardPaste,
  ArrowRight,
  ListFilter
} from 'lucide-react';
import { MODES } from '../constants';

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
    } catch (e) {
      return false;
    }
  });

  const [globalRules, setGlobalRules] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.GLOBAL_RULES) || DEFAULT_GLOBAL_RULES;
    } catch (e) {
      return DEFAULT_GLOBAL_RULES;
    }
  });

  const [scenes, setScenes] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SCENE_CARDS);
      return saved ? JSON.parse(saved) : DEFAULT_SCENES;
    } catch (e) {
      return DEFAULT_SCENES;
    }
  });

  const [isParserOpen, setIsParserOpen] = useState(false);
  const [rawInputText, setRawInputText] = useState('');
  const [toastMessage, setToastMessage] = useState(null);
  const [editingCardId, setEditingCardId] = useState(null);
  const [filterDone, setFilterDone] = useState('all'); // 'all', 'pending', 'completed'

  // Persist Global Rules
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.GLOBAL_RULES, globalRules);
    } catch (e) {}
  }, [globalRules]);

  // Persist Scene Cards
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SCENE_CARDS, JSON.stringify(scenes));
    } catch (e) {}
  }, [scenes]);

  // Persist Collapsed State
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, JSON.stringify(collapsed));
    } catch (e) {}
  }, [collapsed]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const showToast = (message, type = 'info') => {
    setToastMessage({ message, type });
  };

  // Parsing logic for ChatGPT raw text
  const handleParseRawText = () => {
    if (!rawInputText.trim()) {
      showToast('Paste teks output ChatGPT terlebih dahulu.', 'warning');
      return;
    }

    const text = rawInputText.trim();
    let extractedRules = null;
    const parsedScenes = [];

    // 1. Detect Global Rules section if present before scenes
    const globalRulesMatch = text.match(
      /(?:^|\n)(?:#{1,4}\s*)?(?:\*\*)?(?:1\.\s*)?(?:Global Rules|GLOBAL RULES|Global Visual Rules|Global Settings)[:\s\-–—]*(.*?)(?=(?:\n(?:#{1,4}\s*)?(?:\*\*)?(?:2\.\s*)?(?:Scene|SCENE)\s*\d+)|$)/is
    );

    if (globalRulesMatch && globalRulesMatch[1]) {
      const cleanRules = globalRulesMatch[1].replace(/\*\*/g, '').trim();
      if (cleanRules) {
        extractedRules = cleanRules;
      }
    }

    // 2. Detect Scene headers pattern
    const sceneHeaderRegex = /(?:^|\n)(?:#{1,4}\s*)?(?:\*\*)?(?:2\.\s*)?(?:Scene|SCENE)\s*(\d+)[:\s\-–—]*(.*?)(?:\*\*)?(?=\n|$)/gi;
    const matches = [];
    let match;

    while ((match = sceneHeaderRegex.exec(text)) !== null) {
      matches.push({
        index: match.index,
        fullLength: match[0].length,
        sceneNumber: match[1],
        rawTitle: match[2] || '',
      });
    }

    if (matches.length === 0) {
      showToast('Tidak ditemukan pola Scene (Scene 1, Scene 2, dll).', 'error');
      return;
    }

    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const startIndex = current.index + current.fullLength;
      const endIndex = i + 1 < matches.length ? matches[i + 1].index : text.length;

      let sceneBody = text.slice(startIndex, endIndex).trim();
      // Remove trailing divider dashes like ---
      sceneBody = sceneBody.replace(/\n\s*---+\s*$/g, '').trim();

      let cleanedTitle = current.rawTitle
        .replace(/\*\*/g, '')
        .replace(/__/g, '')
        .trim();
      cleanedTitle = cleanedTitle.replace(/^[:\-–—\s]+/, '').trim();

      const finalTitle = cleanedTitle
        ? `Scene ${current.sceneNumber}: ${cleanedTitle}`
        : `Scene ${current.sceneNumber}`;

      parsedScenes.push({
        id: `scene-${Date.now()}-${i + 1}`,
        sceneNumber: parseInt(current.sceneNumber, 10),
        title: finalTitle,
        prompt: sceneBody,
        done: false,
      });
    }

    if (extractedRules) {
      setGlobalRules(extractedRules);
    }

    setScenes(parsedScenes);
    setIsParserOpen(false);
    setRawInputText('');
    showToast(
      `Berhasil mem-parse ${parsedScenes.length} Scene Cards${extractedRules ? ' & Global Rules' : ''}!`,
      'success'
    );
  };

  // Quick Copy Storyboard Prompt Wrapper for Mode 2
  const handleCopyStoryboardWrapper = async () => {
    try {
      let clipboardText = '';
      try {
        clipboardText = await navigator.clipboard.readText();
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

      await navigator.clipboard.writeText(promptWrapper);
      showToast('✓ Storyboard Prompt Wrapper disalin! Siap dipaste ke ChatGPT.', 'success');
    } catch (err) {
      showToast('Gagal menyalin wrapper ke clipboard.', 'error');
    }
  };

  // Action Button Handlers
  const handleSendToGemini = async (scene) => {
    try {
      await navigator.clipboard.writeText(scene.prompt);
      if (setGeminiCounter) {
        setGeminiCounter((prev) => Math.min(prev + 1, 4));
      }
      showToast(`Prompt ${scene.title} disalin untuk Gemini! (Quota: ${Math.min((geminiCounter || 0) + 1, 4)}/4)`, 'success');
    } catch (e) {
      showToast('Gagal menyalin prompt.', 'error');
    }
  };

  const handleFreshGeminiGlobal = async (scene) => {
    try {
      const fullPrompt = `${globalRules.trim()}\n\n---\n\n${scene.prompt.trim()}`;
      await navigator.clipboard.writeText(fullPrompt);
      if (setGeminiCounter) {
        setGeminiCounter(1);
      }
      showToast(`Fresh Session: Global Rules + ${scene.title} disalin! (Counter di-reset ke 1)`, 'success');
    } catch (e) {
      showToast('Gagal menyalin prompt.', 'error');
    }
  };

  const handleSendToFlow = async (scene) => {
    try {
      await navigator.clipboard.writeText(scene.prompt);
      showToast(`Prompt ${scene.title} disalin untuk Google Flow FX!`, 'success');
    } catch (e) {
      showToast('Gagal menyalin prompt.', 'error');
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
    showToast(`Scene ${nextNumber} ditambahkan!`, 'info');
  };

  const handleDeleteScene = (id) => {
    setScenes((prev) => prev.filter((s) => s.id !== id));
    showToast('Scene Card dihapus.', 'info');
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

        <div className="flex items-center gap-1">
          {!collapsed && (
            <button
              onClick={() => setIsParserOpen(true)}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-white text-[11px] flex items-center gap-1 transition"
              title="Open Raw AI Output Parser"
            >
              <ClipboardPaste className="w-3 h-3 text-purple-400" />
              <span>Parser</span>
            </button>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Collapsed Vertical Indicator */}
      {collapsed ? (
        <div className="flex-1 flex flex-col items-center py-3 gap-4 text-slate-400">
          <button
            onClick={() => setCollapsed(false)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-400"
            title="Expand Sidebar"
          >
            <Layers className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              setCollapsed(false);
              setIsParserOpen(true);
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400"
            title="Open Raw Parser"
          >
            <ClipboardPaste className="w-4 h-4" />
          </button>

          <div className="w-5 h-5 rounded-full bg-purple-950/80 border border-purple-700 flex items-center justify-center text-[10px] font-bold text-purple-300">
            {scenes.length}
          </div>

          <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] tracking-widest uppercase font-semibold text-slate-500">
            Pipeline Sidebar
          </span>
        </div>
      ) : (
        /* Expanded Content */
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 text-xs">
          
          {/* Mode 2 Special Helper: Copy Storyboard Prompt Wrapper */}
          {activeMode === MODES.PROMPT_ENGINEERING && (
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/30 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Mode 2: Prompt Bridge
                </span>
                <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800 font-mono">
                  Claude → ChatGPT
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Copy storyboard dari Claude (kiri), lalu klik tombol di bawah untuk membungkusnya dengan instruksi ChatGPT:
              </p>
              <button
                onClick={handleCopyStoryboardWrapper}
                className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-950 transition active:scale-95"
                title="Wraps clipboard with ChatGPT instruction to generate Global Rules & Scene Prompts"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Storyboard Prompt Wrapper</span>
              </button>
            </div>
          )}

          {/* Pinned Global Rules Text Box */}
          <div className="p-2.5 rounded-xl bg-slate-950/90 border border-purple-500/30 shadow-sm flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-purple-400 text-[11px]">
                <Pin className="w-3 h-3 text-purple-400" />
                <span>Pinned Global Rules</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(globalRules);
                    showToast('Global Rules disalin ke clipboard!', 'info');
                  }}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                  title="Copy Global Rules"
                >
                  <Copy className="w-3 h-3" />
                </button>
                <span className="text-[9px] bg-purple-950/80 text-purple-300 px-1.5 py-0.5 rounded border border-purple-800/80 font-mono">
                  Saved
                </span>
              </div>
            </div>

            <textarea
              value={globalRules}
              onChange={(e) => setGlobalRules(e.target.value)}
              placeholder="Contoh: Aspect Ratio 16:9, Unreal Engine 5.4 cinematic lighting, octane render, 8k..."
              rows={2}
              className="w-full bg-slate-900/80 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono text-[11px] resize-y focus:outline-none focus:border-purple-500/50"
            />
          </div>

          {/* Scene Cards List Header */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-200 text-xs">
                Scene Cards ({scenes.length})
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                {completedCount}/{scenes.length} Done
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleAddScene}
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] transition"
                title="Tambah Scene Card baru"
              >
                <Plus className="w-3 h-3 text-purple-400" />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-lg border border-slate-800/60 text-[10px]">
            <span className="text-slate-500 px-1 flex items-center gap-1">
              <ListFilter className="w-3 h-3" />
            </span>
            <button
              onClick={() => setFilterDone('all')}
              className={`flex-1 py-0.5 rounded transition ${
                filterDone === 'all' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({scenes.length})
            </button>
            <button
              onClick={() => setFilterDone('pending')}
              className={`flex-1 py-0.5 rounded transition ${
                filterDone === 'pending' ? 'bg-slate-800 text-sky-400 font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pending ({scenes.length - completedCount})
            </button>
            <button
              onClick={() => setFilterDone('completed')}
              className={`flex-1 py-0.5 rounded transition ${
                filterDone === 'completed' ? 'bg-slate-800 text-emerald-400 font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Done ({completedCount})
            </button>
          </div>

          {/* Scene Cards List */}
          <div className="flex flex-col gap-2.5">
            {filteredScenes.length === 0 ? (
              <div className="p-4 text-center rounded-xl bg-slate-950/40 border border-slate-800/50 text-slate-500">
                <p className="text-xs">Tidak ada Scene Card.</p>
                <p className="text-[10px] text-slate-600 mt-1">
                  Gunakan tombol <b>Parser</b> untuk mengekstrak output ChatGPT atau klik <b>Add</b>.
                </p>
              </div>
            ) : (
              filteredScenes.map((scene) => {
                const isEditing = editingCardId === scene.id;

                return (
                  <div
                    key={scene.id}
                    className={`rounded-xl border transition-all duration-150 p-2.5 flex flex-col gap-2 ${
                      scene.done
                        ? 'bg-slate-950/40 border-slate-900 opacity-60'
                        : 'bg-slate-950/80 border-slate-800/90 hover:border-slate-700 shadow-sm'
                    }`}
                  >
                    {/* Card Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 overflow-hidden flex-1">
                        {/* Completed Checkbox */}
                        <input
                          type="checkbox"
                          checked={scene.done}
                          onChange={() => handleToggleDone(scene.id)}
                          className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                          title="Tandai sebagai selesai / rendered"
                        />

                        {/* Title Display or Edit */}
                        {isEditing ? (
                          <input
                            type="text"
                            value={scene.title}
                            onChange={(e) => handleUpdateScene(scene.id, 'title', e.target.value)}
                            className="flex-1 bg-slate-900 border border-purple-500/50 rounded px-1.5 py-0.5 text-xs text-slate-100 focus:outline-none"
                          />
                        ) : (
                          <span
                            className={`font-semibold text-xs truncate ${
                              scene.done ? 'line-through text-slate-500' : 'text-slate-200'
                            }`}
                            title={scene.title}
                          >
                            {scene.title}
                          </span>
                        )}
                      </div>

                      {/* Header Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => setEditingCardId(isEditing ? null : scene.id)}
                          className={`p-1 rounded transition ${
                            isEditing ? 'bg-purple-600 text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                          title={isEditing ? 'Selesai edit' : 'Edit scene'}
                        >
                          {isEditing ? <Check className="w-3 h-3" /> : <Edit3 className="w-3 h-3" />}
                        </button>

                        <button
                          onClick={() => handleDeleteScene(scene.id)}
                          className="p-1 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition"
                          title="Hapus Scene Card"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Prompt Content */}
                    <div className="flex flex-col gap-1">
                      <textarea
                        value={scene.prompt}
                        onChange={(e) => handleUpdateScene(scene.id, 'prompt', e.target.value)}
                        rows={isEditing ? 4 : 2}
                        placeholder="Deskripsi visual / animasi prompt scene..."
                        className={`w-full bg-slate-900/60 border rounded-lg p-2 text-[11px] font-mono resize-y focus:outline-none ${
                          scene.done ? 'text-slate-500 border-slate-900' : 'text-slate-300 border-slate-800 focus:border-purple-500/50'
                        }`}
                      />
                    </div>

                    {/* Action Buttons: [Send to Gemini], [Fresh Gemini + Global], [Send to Flow] */}
                    <div className="flex items-center gap-1 pt-1 border-t border-slate-900/80">
                      <button
                        onClick={() => handleSendToGemini(scene)}
                        className="flex-1 py-1 px-1.5 rounded bg-sky-600/70 hover:bg-sky-500 text-white text-[10px] font-medium flex items-center justify-center gap-1 transition"
                        title="Salin Scene Prompt untuk Gemini chat aktif"
                      >
                        <Send className="w-2.5 h-2.5" />
                        <span>Gemini</span>
                      </button>

                      <button
                        onClick={() => handleFreshGeminiGlobal(scene)}
                        className="flex-1 py-1 px-1.5 rounded bg-amber-600/70 hover:bg-amber-500 text-white text-[10px] font-medium flex items-center justify-center gap-1 transition"
                        title="Reset sesi chat & salin Global Rules + Scene Prompt bersamaan"
                      >
                        <Flame className="w-2.5 h-2.5" />
                        <span>Fresh+Global</span>
                      </button>

                      <button
                        onClick={() => handleSendToFlow(scene)}
                        className="flex-1 py-1 px-1.5 rounded bg-purple-600/70 hover:bg-purple-500 text-white text-[10px] font-medium flex items-center justify-center gap-1 transition"
                        title="Salin Scene Prompt untuk Google Flow FX"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>Flow</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Raw Output Parser Modal */}
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
                    Raw AI Output Parser
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Paste output mentah dari ChatGPT untuk otomatis dipecah menjadi Global Rules & Scene Cards.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsParserOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex-1 flex flex-col gap-3 overflow-hidden">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-300">
                  Paste ChatGPT Output:
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      setRawInputText(text);
                    } catch (e) {}
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

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">
                Mendeteksi pola: Scene 1, SCENE 1:, # Scene 1, dll.
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsParserOpen(false)}
                  className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                >
                  Batal
                </button>
                <button
                  onClick={handleParseRawText}
                  disabled={!rawInputText.trim()}
                  className="px-5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-purple-600/20 flex items-center gap-1.5 transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Parse to Scene Cards</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
