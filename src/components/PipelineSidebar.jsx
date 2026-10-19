import React, { useState, useEffect, useRef } from 'react';
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
  RotateCcw, 
  FolderPlus, 
  Download, 
  Upload, 
  Folder, 
  AlertTriangle,
  ChevronDown,
  Save
} from 'lucide-react';
import { MODES, WEBVIEWS } from '../constants';
import { injectTextToWebview, injectFreshGemini, DELIVERY_STATUS } from '../utils/webviewInjection';
import { parsePromptText } from '../utils/sceneParser';
import {
  migrateLegacyData,
  saveProjectsToStorage,
  createNewProject,
  exportProjectToJson,
  parseAndValidateProjectImport,
  STORAGE_KEYS
} from '../utils/projectManager';

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

  // Project Collection State initialized via Migration
  const [projects, setProjects] = useState(() => {
    const storage = typeof window !== 'undefined' ? window.localStorage : null;
    return migrateLegacyData(storage).projects;
  });

  const [activeProjectId, setActiveProjectId] = useState(() => {
    const storage = typeof window !== 'undefined' ? window.localStorage : null;
    return migrateLegacyData(storage).activeId;
  });

  // Active Project Reference
  const activeProject =
    projects.find((p) => p.id === activeProjectId) || projects[0] || createNewProject('Default Project');

  // Autosave status state
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'error'
  const [saveError, setSaveError] = useState(null);

  // Modals and dialog states
  const [isParserOpen, setIsParserOpen] = useState(false);
  const [rawInputText, setRawInputText] = useState('');
  const [parsedPreview, setParsedPreview] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [editingCardId, setEditingCardId] = useState(null);
  const [filterDone, setFilterDone] = useState('all'); // 'all', 'pending', 'completed'

  // Project management modals
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const fileInputRef = useRef(null);

  const saveTimerRef = useRef(null);

  // Debounced Autosave on project mutations
  useEffect(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    setSaveStatus('saving');
    setSaveError(null);

    saveTimerRef.current = setTimeout(() => {
      const storage = typeof window !== 'undefined' ? window.localStorage : null;
      const res = saveProjectsToStorage(storage, projects, activeProjectId);
      if (res.success) {
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
        setSaveError(res.error || 'Failed to save to local storage');
      }
    }, 400);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [projects, activeProjectId]);

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

  // Helper to mutate active project
  const updateActiveProject = (updater) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === activeProject.id) {
          const updated = updater(p);
          return { ...updated, updatedAt: Date.now() };
        }
        return p;
      })
    );
  };

  // Project Management Handlers
  const handleCreateProject = () => {
    const name = newProjectName.trim() || `Project ${projects.length + 1}`;
    const newProj = createNewProject(name);
    setProjects((prev) => [...prev, newProj]);
    setActiveProjectId(newProj.id);
    setNewProjectName('');
    setIsNewProjectModalOpen(false);
    showToast(`✓ Project "${name}" created and active.`, 'success');
  };

  const handleDuplicateProject = () => {
    const copyName = `${activeProject.name} (Copy)`;
    const copyProj = createNewProject(copyName, activeProject.globalRules, activeProject.scenes);
    setProjects((prev) => [...prev, copyProj]);
    setActiveProjectId(copyProj.id);
    setIsProjectDropdownOpen(false);
    showToast(`✓ Duplicated as "${copyName}".`, 'success');
  };

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    updateActiveProject((p) => ({ ...p, name: trimmed }));
    setIsRenameOpen(false);
    showToast(`✓ Project renamed to "${trimmed}".`, 'info');
  };

  const handleConfirmDelete = () => {
    if (!projectToDelete) return;
    if (projects.length <= 1) {
      // If deleting the only project, reset to a fresh default project
      const fresh = createNewProject('Default Project');
      setProjects([fresh]);
      setActiveProjectId(fresh.id);
    } else {
      const remaining = projects.filter((p) => p.id !== projectToDelete.id);
      setProjects(remaining);
      if (activeProjectId === projectToDelete.id) {
        setActiveProjectId(remaining[0].id);
      }
    }
    const deletedName = projectToDelete.name;
    setProjectToDelete(null);
    showToast(`Project "${deletedName}" deleted.`, 'info');
  };

  // Export Project JSON
  const handleExportProject = () => {
    try {
      const exportData = exportProjectToJson(activeProject);
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `${activeProject.name.toLowerCase().replace(/[^a-z0-9]/gi, '_')}-project.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast(`✓ Project "${activeProject.name}" exported!`, 'success');
      setIsProjectDropdownOpen(false);
    } catch (err) {
      showToast(`Export failed: ${err.message}`, 'error');
    }
  };

  // Import Project JSON
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      const result = parseAndValidateProjectImport(text);
      if (!result.valid) {
        showToast(`Import failed: ${result.errors.join(' ')}`, 'error');
      } else {
        setImportPreview(result.project);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
    setIsProjectDropdownOpen(false);
  };

  const handleConfirmImport = (mode) => {
    if (!importPreview) return;
    if (mode === 'new') {
      setProjects((prev) => [...prev, importPreview]);
      setActiveProjectId(importPreview.id);
      showToast(`✓ Imported "${importPreview.name}" as new project.`, 'success');
    } else {
      // Replace active project
      updateActiveProject(() => ({
        ...importPreview,
        id: activeProject.id, // maintain current ID
      }));
      showToast(`✓ Replaced active project with "${importPreview.name}".`, 'success');
    }
    setImportPreview(null);
  };

  // Parser Confirmation Handler
  const handleConfirmParserImport = () => {
    if (!parsedPreview || parsedPreview.scenes.length === 0) return;

    updateActiveProject((p) => ({
      ...p,
      scenes: parsedPreview.scenes,
      globalRules: parsedPreview.globalRules !== null ? parsedPreview.globalRules : p.globalRules,
    }));

    setParsedPreview(null);
    setIsParserOpen(false);
    setRawInputText('');
    showToast(
      `✓ Imported ${parsedPreview.scenes.length} Scene Cards${parsedPreview.globalRules ? ' & Global Rules' : ''}!`,
      'success'
    );
  };

  // Quick Copy Storyboard Prompt Wrapper
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
        showToast('✓ Storyboard Prompt Wrapper copied! Ready to paste into ChatGPT.', 'success');
      } else {
        showToast('Clipboard write is unavailable.', 'warning');
      }
    } catch {
      showToast('Failed to copy wrapper to clipboard.', 'error');
    }
  };

  // Webview Action Handlers with explicit delivery tracking
  const handleSendToGemini = async (scene) => {
    try {
      const res = await injectTextToWebview(WEBVIEWS.GEMINI.id, scene.prompt);

      if (res.status === DELIVERY_STATUS.INSERTED) {
        if (setGeminiCounter) {
          setGeminiCounter((prev) => Math.min(prev + 1, 4));
        }
        showToast(
          `▶️ Gemini: Prompt inserted into input! (Session load: ${Math.min((geminiCounter || 0) + 1, 4)}/4)`,
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
    } catch {
      showToast('Failed to deliver prompt to Gemini.', 'error');
    }
  };

  const handleFreshGeminiGlobal = async (scene) => {
    try {
      const rules = activeProject.globalRules?.trim();
      const fullPrompt = rules ? `${rules}\n\n${scene.prompt.trim()}` : scene.prompt.trim();

      showToast('🔄 Initializing fresh Gemini session...', 'info');
      const res = await injectFreshGemini(WEBVIEWS.GEMINI.id, fullPrompt);

      if (res.status === DELIVERY_STATUS.INSERTED) {
        if (setGeminiCounter) setGeminiCounter(1);
        showToast('✓ Gemini Fresh: Session initialized and prompt inserted (Load: 1/4)', 'success');
      } else if (res.status === DELIVERY_STATUS.COPIED) {
        if (setGeminiCounter) setGeminiCounter(1);
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
      const rules = activeProject.globalRules?.trim();
      const flowPrompt = rules ? `${rules}\n\n${scene.prompt.trim()}` : scene.prompt.trim();

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

  // Scene card management for active project
  const handleToggleDone = (id) => {
    updateActiveProject((p) => ({
      ...p,
      scenes: p.scenes.map((s) => (s.id === id ? { ...s, done: !s.done } : s)),
    }));
  };

  const handleAddScene = () => {
    const currentScenes = activeProject.scenes || [];
    const nextNumber = currentScenes.length > 0 ? Math.max(...currentScenes.map((s) => s.sceneNumber || 0)) + 1 : 1;
    const newScene = {
      id: `scene-${Date.now()}`,
      sceneNumber: nextNumber,
      title: `Scene ${nextNumber}: New Scene`,
      prompt: 'Cinematic shot description...',
      done: false,
    };
    updateActiveProject((p) => ({
      ...p,
      scenes: [...p.scenes, newScene],
    }));
    setEditingCardId(newScene.id);
    showToast(`Scene ${nextNumber} added.`, 'info');
  };

  const handleDeleteScene = (id) => {
    updateActiveProject((p) => ({
      ...p,
      scenes: p.scenes.filter((s) => s.id !== id),
    }));
    showToast('Scene Card deleted.', 'info');
  };

  const handleUpdateScene = (id, field, value) => {
    updateActiveProject((p) => ({
      ...p,
      scenes: p.scenes.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    }));
  };

  const handleUpdateGlobalRules = (val) => {
    updateActiveProject((p) => ({
      ...p,
      globalRules: val,
    }));
  };

  const scenes = activeProject.scenes || [];
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
      {/* Hidden File Input for Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />

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
            <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">
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
              {/* Autosave Status Pill */}
              <div
                className="flex items-center gap-1 text-[10px] font-mono px-1 py-0.5 rounded border border-slate-800"
                title={saveError ? `Save Error: ${saveError}` : saveStatus === 'saving' ? 'Saving changes...' : 'All changes saved locally'}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    saveStatus === 'saved'
                      ? 'bg-emerald-400'
                      : saveStatus === 'saving'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-rose-400'
                  }`}
                />
                <span className="text-slate-400 capitalize">{saveStatus}</span>
              </div>

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
                <span>{geminiCounter}/4</span>
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
          {/* Section 0: Project Selector & Manager Bar */}
          <div className="p-2 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-1.5 flex-shrink-0">
            <div className="relative flex-1 min-w-0">
              {isRenameOpen ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameSubmit();
                      if (e.key === 'Escape') setIsRenameOpen(false);
                    }}
                    autoFocus
                    className="flex-1 bg-slate-900 border border-purple-500/60 rounded px-2 py-0.5 text-xs text-white focus:outline-none"
                  />
                  <button
                    onClick={handleRenameSubmit}
                    className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500"
                    title="Save name"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setIsRenameOpen(false)}
                    className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                    title="Cancel"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                    className="flex items-center justify-between gap-1.5 flex-1 min-w-0 px-2 py-1 rounded bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-left transition"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <Folder className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                      <span className="font-semibold text-slate-200 truncate">{activeProject.name}</span>
                    </div>
                    <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  </button>

                  <button
                    onClick={() => {
                      setRenameValue(activeProject.name);
                      setIsRenameOpen(true);
                    }}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                    title="Rename current project"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Project Dropdown Menu */}
              {isProjectDropdownOpen && (
                <div className="absolute top-8 left-0 right-0 z-50 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 space-y-1 animate-in fade-in duration-100">
                  <div className="max-h-40 overflow-y-auto space-y-0.5">
                    {projects.map((proj) => (
                      <div
                        key={proj.id}
                        className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                          proj.id === activeProjectId
                            ? 'bg-purple-950/60 text-purple-200 border border-purple-800/40'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                        onClick={() => {
                          setActiveProjectId(proj.id);
                          setIsProjectDropdownOpen(false);
                        }}
                      >
                        <span className="truncate flex-1 font-medium">{proj.name}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-[10px] text-slate-500 font-mono">
                            {proj.scenes?.length || 0} scenes
                          </span>
                          {projects.length > 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setProjectToDelete(proj);
                                setIsProjectDropdownOpen(false);
                              }}
                              className="p-1 hover:text-rose-400 text-slate-500 rounded"
                              title="Delete project"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-1.5 border-t border-slate-800 grid grid-cols-2 gap-1 text-[11px]">
                    <button
                      onClick={() => {
                        setIsProjectDropdownOpen(false);
                        setNewProjectName('');
                        setIsNewProjectModalOpen(true);
                      }}
                      className="flex items-center justify-center gap-1 p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                    >
                      <FolderPlus className="w-3 h-3 text-purple-400" />
                      <span>New</span>
                    </button>

                    <button
                      onClick={handleDuplicateProject}
                      className="flex items-center justify-center gap-1 p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                    >
                      <Copy className="w-3 h-3 text-sky-400" />
                      <span>Duplicate</span>
                    </button>

                    <button
                      onClick={handleExportProject}
                      className="flex items-center justify-center gap-1 p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                    >
                      <Download className="w-3 h-3 text-emerald-400" />
                      <span>Export</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsProjectDropdownOpen(false);
                        if (fileInputRef.current) fileInputRef.current.click();
                      }}
                      className="flex items-center justify-center gap-1 p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                    >
                      <Upload className="w-3 h-3 text-amber-400" />
                      <span>Import</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

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
              value={activeProject.globalRules || ''}
              onChange={(e) => handleUpdateGlobalRules(e.target.value)}
              placeholder="e.g. Aspect Ratio 16:9, Unreal Engine 5 lighting, 8k render..."
              rows={3}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-300 text-[11px] resize-none focus:outline-none focus:border-amber-500/50 transition font-mono leading-relaxed"
            />
          </div>

          {/* Section 2: Scene Cards List Filter Bar */}
          <div className="h-8 px-2.5 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between flex-shrink-0 select-none">
            <div className="flex items-center gap-1.5 font-medium text-slate-300 text-[11px]">
              <FileText className="w-3 h-3 text-sky-400" />
              <span>
                Scene Cards ({completedCount}/{scenes.length})
              </span>
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

      {/* New Project Modal */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <h3 className="font-semibold text-sm text-slate-100 flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-purple-400" />
              <span>Create New Project</span>
            </h3>
            <input
              type="text"
              placeholder="e.g. Cyberpunk Commercial"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateProject();
              }}
              autoFocus
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
            />
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setIsNewProjectModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-3 text-xs">
            <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>Delete Project</span>
            </div>
            <p className="text-slate-300">
              Are you sure you want to delete <span className="font-semibold text-white">"{projectToDelete.name}"</span>? This will permanently delete its Global Rules and {projectToDelete.scenes?.length || 0} Scene Cards.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setProjectToDelete(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Project Preview Modal */}
      {importPreview && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-slate-100 flex items-center gap-2">
                <Upload className="w-4 h-4 text-amber-400" />
                <span>Import Project Preview</span>
              </h3>
              <button onClick={() => setImportPreview(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
              <div className="font-semibold text-slate-200">{importPreview.name}</div>
              <div className="text-slate-400 font-mono text-[11px]">
                {importPreview.scenes?.length || 0} Scenes • {importPreview.globalRules ? 'Includes Global Rules' : 'No Global Rules'}
              </div>
            </div>
            <p className="text-slate-400">
              How would you like to import this project?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setImportPreview(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConfirmImport('replace')}
                className="px-3 py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-600 text-white font-medium"
              >
                Replace Active
              </button>
              <button
                onClick={() => handleConfirmImport('new')}
                className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium"
              >
                Add as New Project
              </button>
            </div>
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
                  ? 'Active project scenes will be replaced upon confirmation.'
                  : 'Detects headings: Scene 1, SCENE 1:, # Scene 1, etc.'}
              </span>

              <div className="flex items-center gap-2">
                {parsedPreview ? (
                  <>
                    <button
                      onClick={() => setParsedPreview(null)}
                      className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                    >
                      Back to Edit
                    </button>
                    <button
                      onClick={handleConfirmParserImport}
                      className="px-5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirm & Replace in Project</span>
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
                      onClick={() => {
                        if (!rawInputText.trim()) {
                          showToast('Paste AI storyboard output before parsing.', 'warning');
                          return;
                        }
                        const result = parsePromptText(rawInputText);
                        if (!result.success || result.scenes.length === 0) {
                          showToast(`Parsing failed: ${result.errors.join(' ')}`, 'error');
                        } else {
                          setParsedPreview(result);
                        }
                      }}
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
