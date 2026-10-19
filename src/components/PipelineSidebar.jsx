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
  Search,
  Loader2,
  Eye,
  ShieldCheck,
  AlertCircle,
  Sliders,
  HelpCircle,
  Send,
  Clock
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
  applyParsedStoryboardToProject,
  GLOBAL_RULES_STRATEGY,
  STORAGE_KEYS
} from '../utils/projectManager';
import {
  validateStoryboardSource,
  readClipboardText,
  INTAKE_STATUS
} from '../utils/storyboardIntake';
import {
  buildChatGPTWrapper,
  SUPPORTED_ASPECT_RATIOS,
  ARTISTIC_STYLES
} from '../utils/promptTemplate';
import {
  composeProductionPrompt,
  evaluatePromptQuality
} from '../utils/promptComposer';
import {
  getPreviousDelivery,
  recordDelivery,
  formatTimeAgo
} from '../utils/deliveryTracker';

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
  const [toastMessage, setToastMessage] = useState(null);
  const [editingCardId, setEditingCardId] = useState(null);
  const [filterDone, setFilterDone] = useState('all'); // 'all', 'pending', 'completed'
  const [searchQuery, setSearchQuery] = useState('');
  const [deliveringAction, setDeliveringAction] = useState(null); // { sceneId, target }
  const [sceneToDelete, setSceneToDelete] = useState(null);
  const [isDoneSectionCollapsed, setIsDoneSectionCollapsed] = useState(false);

  // Flow Send Confirmation Dialog State
  const [flowConfirmScene, setFlowConfirmScene] = useState(null);
  const [isDeliveringFlowConfirm, setIsDeliveringFlowConfirm] = useState(false);

  // Storyboard Intake Modal State
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [intakeSourceText, setIntakeSourceText] = useState('');
  const [intakeStatus, setIntakeStatus] = useState(INTAKE_STATUS.EMPTY);
  const [intakeValidation, setIntakeValidation] = useState(null);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState('16:9');
  const [selectedStyle, setSelectedStyle] = useState('photorealistic');
  const [customStyleText, setCustomStyleText] = useState('');
  const [customVisualReqs, setCustomVisualReqs] = useState('');

  // ChatGPT Output Parser Modal State
  const [isParserOpen, setIsParserOpen] = useState(false);
  const [rawInputText, setRawInputText] = useState('');
  const [parsedPreview, setParsedPreview] = useState(null);
  const [rulesStrategy, setRulesStrategy] = useState(GLOBAL_RULES_STRATEGY.USE_IMPORTED);
  const [importMode, setImportMode] = useState('replace'); // 'replace' or 'append'

  // Scene Prompt Preview & Quality Gate Modal State
  const [previewScene, setPreviewScene] = useState(null);

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
      const timer = setTimeout(() => setToastMessage(null), 3800);
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

  // ----------------------------------------------------
  // STORYBOARD INTAKE HANDLERS
  // ----------------------------------------------------

  const handleSourceTextChange = (text) => {
    setIntakeSourceText(text);
    if (!text.trim()) {
      setIntakeStatus(INTAKE_STATUS.EMPTY);
      setIntakeValidation(null);
      return;
    }
    const val = validateStoryboardSource(text);
    setIntakeValidation(val);
    setIntakeStatus(val.status);
  };

  const handleClipboardReadIntake = async () => {
    const res = await readClipboardText();
    if (!res.success) {
      showToast(res.error || 'Could not read clipboard.', 'error');
      return;
    }
    handleSourceTextChange(res.text);
    showToast('✓ Clipboard storyboard source loaded.', 'success');
  };

  const handleGenerateAndCopyWrapper = async () => {
    const validation = validateStoryboardSource(intakeSourceText);
    if (!validation.valid && validation.status === INTAKE_STATUS.EMPTY) {
      showToast('Storyboard text is empty. Paste your Claude script first.', 'warning');
      return;
    }

    const styleLabel =
      selectedStyle === 'custom'
        ? customStyleText.trim() || 'Preserve artistic style from storyboard'
        : ARTISTIC_STYLES.find((s) => s.id === selectedStyle)?.label || selectedStyle;

    const wrapper = buildChatGPTWrapper({
      storyboardText: intakeSourceText,
      aspectRatio: selectedAspectRatio,
      artisticStyle: styleLabel,
      targetGenerator: 'Google Flow & Gemini',
      customVisualRequirements: customVisualReqs,
      preserveVoiceOver: true,
    });

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(wrapper);
        setIntakeStatus(INTAKE_STATUS.COPIED_TO_CLIPBOARD);
        showToast('✓ Complete Prompt Wrapper copied to clipboard! Ready to paste into ChatGPT.', 'success');
      } else {
        showToast('Clipboard write is not supported in this environment.', 'warning');
      }
    } catch (err) {
      showToast(`Failed to copy wrapper: ${err.message}`, 'error');
    }
  };

  // ----------------------------------------------------
  // PARSER IMPORT HANDLERS
  // ----------------------------------------------------

  const handleRunParser = () => {
    if (!rawInputText.trim()) {
      showToast('Paste ChatGPT output before parsing.', 'warning');
      return;
    }
    const result = parsePromptText(rawInputText, {
      existingScenes: activeProject.scenes,
    });

    if (!result.success || result.scenes.length === 0) {
      showToast(`Parsing failed: ${result.errors.join(' ')}`, 'error');
      return;
    }

    setParsedPreview(result);
    // If parsed output has no rules, default strategy to keep active
    if (!result.globalRules) {
      setRulesStrategy(GLOBAL_RULES_STRATEGY.KEEP_ACTIVE);
    } else {
      setRulesStrategy(GLOBAL_RULES_STRATEGY.USE_IMPORTED);
    }
  };

  const handleConfirmParserImport = () => {
    if (!parsedPreview || parsedPreview.scenes.length === 0) return;

    try {
      const updatedProject = applyParsedStoryboardToProject(activeProject, parsedPreview, {
        globalRulesStrategy: rulesStrategy,
        mode: importMode,
      });

      updateActiveProject(() => updatedProject);

      setParsedPreview(null);
      setIsParserOpen(false);
      setRawInputText('');
      showToast(
        `✓ Imported ${parsedPreview.scenes.length} Scene Cards (${importMode === 'replace' ? 'replaced' : 'appended'})!`,
        'success'
      );
    } catch (err) {
      showToast(`Import error: ${err.message}`, 'error');
    }
  };

  // ----------------------------------------------------
  // PROMPT DELIVERY & FLOW CONFIRMATION HANDLERS
  // ----------------------------------------------------

  // Feature B: Intercept Flow send request to open confirmation dialog first
  const handleRequestFlowSend = (scene) => {
    if (deliveringAction) return; // Prevent double clicks during in-flight delivery
    setFlowConfirmScene(scene);
  };

  const handleCancelFlowConfirm = () => {
    setFlowConfirmScene(null);
  };

  const handleExecuteFlowDelivery = async () => {
    if (!flowConfirmScene || deliveringAction) return;
    const scene = flowConfirmScene;

    // Canonical composition & quality gate
    const composition = composeProductionPrompt({
      scene,
      globalRules: activeProject.globalRules,
      includeGlobalRules: true,
    });

    const quality = evaluatePromptQuality({
      scene,
      composedPrompt: composition.composedPrompt,
      globalRules: activeProject.globalRules,
      project: activeProject,
    });

    if (!quality.passed) {
      showToast(`⚠️ Quality check failed: ${quality.errors.join(' ')}`, 'error');
      setFlowConfirmScene(null);
      setPreviewScene(scene); // Open preview to allow user to inspect and fix
      return;
    }

    setDeliveringAction({ sceneId: scene.id, target: 'flow' });
    setIsDeliveringFlowConfirm(true);

    try {
      const res = await injectTextToWebview(WEBVIEWS.GOOGLE_FLOW.id, composition.composedPrompt);

      if (res.status === DELIVERY_STATUS.INSERTED) {
        recordDelivery(activeProjectId, scene.id, {
          sceneNumber: scene.sceneNumber,
          target: 'flow',
          status: 'inserted',
          verified: Boolean(res.verified),
        });
        showToast('🎬 Flow: Prompt inserted and verified in Google Flow input!', 'success');
      } else if (res.status === DELIVERY_STATUS.COPIED) {
        recordDelivery(activeProjectId, scene.id, {
          sceneNumber: scene.sceneNumber,
          target: 'flow',
          status: 'copied',
          verified: false,
        });
        showToast(
          '📋 Flow: Prompt copied to clipboard for manual paste (Ctrl+V). Webview input not reachable.',
          'info'
        );
      } else {
        showToast(`⚠️ Flow delivery failed: ${res.error || res.reason || 'Input unavailable'}`, 'error');
      }
    } catch {
      showToast('Failed to deliver prompt to Google Flow.', 'error');
    } finally {
      setDeliveringAction(null);
      setIsDeliveringFlowConfirm(false);
      setFlowConfirmScene(null);
    }
  };

  const handleSendToGemini = async (scene) => {
    if (deliveringAction) return;
    setDeliveringAction({ sceneId: scene.id, target: 'gemini' });

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
    } finally {
      setDeliveringAction(null);
    }
  };

  const handleFreshGeminiGlobal = async (scene) => {
    if (deliveringAction) return;
    setDeliveringAction({ sceneId: scene.id, target: 'gemini-fresh' });

    try {
      const composition = composeProductionPrompt({
        scene,
        globalRules: activeProject.globalRules,
        includeGlobalRules: true,
      });

      showToast('🔄 Initializing fresh Gemini session...', 'info');
      const res = await injectFreshGemini(WEBVIEWS.GEMINI.id, composition.composedPrompt);

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
    } finally {
      setDeliveringAction(null);
    }
  };

  // ----------------------------------------------------
  // PROJECT MANAGEMENT HANDLERS
  // ----------------------------------------------------

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
      updateActiveProject(() => ({
        ...importPreview,
        id: activeProject.id,
      }));
      showToast(`✓ Replaced active project with "${importPreview.name}".`, 'success');
    }
    setImportPreview(null);
  };

  // ----------------------------------------------------
  // SCENE CARD HANDLERS (Feature A: Auto-Move Done Cards)
  // ----------------------------------------------------

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

  const handleConfirmDeleteScene = () => {
    if (!sceneToDelete) return;
    updateActiveProject((p) => ({
      ...p,
      scenes: p.scenes.filter((s) => s.id !== sceneToDelete.id),
    }));
    showToast(`Scene ${sceneToDelete.sceneNumber} deleted.`, 'info');
    setSceneToDelete(null);
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

  // Feature A: Partition scenes strictly from the single source of truth
  const scenes = activeProject.scenes || [];

  const matchesSearch = (scene) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchTitle = (scene.title || '').toLowerCase().includes(q);
    const matchPrompt = (scene.prompt || '').toLowerCase().includes(q);
    const matchNum = String(scene.sceneNumber || '').includes(q);
    return matchTitle || matchPrompt || matchNum;
  };

  const activeScenes = scenes.filter((s) => !s.done && matchesSearch(s));
  const doneScenes = scenes.filter((s) => s.done && matchesSearch(s));

  const totalActiveCount = scenes.filter((s) => !s.done).length;
  const totalCompletedCount = scenes.filter((s) => s.done).length;

  // Reusable scene card renderer
  const renderSceneCard = (scene, isDoneCard = false) => {
    const isEditing = editingCardId === scene.id;
    const isGeminiFull = (geminiCounter || 0) >= 4;
    const isThisDelivering = deliveringAction?.sceneId === scene.id;

    return (
      <div
        key={scene.id}
        className={`rounded-xl border transition-all duration-150 p-2.5 flex flex-col gap-2 ${
          isDoneCard
            ? 'bg-slate-950/60 border-slate-800/80 shadow-sm opacity-90'
            : 'bg-slate-950 border-slate-800/90 shadow-sm hover:border-slate-700'
        }`}
      >
        {/* Scene Header */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <button
              onClick={() => handleToggleDone(scene.id)}
              aria-label={isDoneCard ? `Reopen scene ${scene.sceneNumber}` : `Mark scene ${scene.sceneNumber} as done`}
              className={`flex-shrink-0 transition focus-visible:ring-1 focus-visible:ring-emerald-400 focus:outline-none rounded ${
                isDoneCard
                  ? 'text-emerald-400 hover:text-emerald-300'
                  : 'text-slate-600 hover:text-slate-400'
              }`}
              title={isDoneCard ? 'Reopen scene (move back to Active)' : 'Mark as Done (move to Completed)'}
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
                className="flex-1 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-slate-200 font-semibold focus:outline-none focus:ring-1 focus:ring-purple-400"
              />
            ) : (
              <span
                className={`font-semibold text-xs truncate ${
                  isDoneCard
                    ? 'line-through text-slate-400'
                    : 'text-slate-200'
                }`}
              >
                {scene.title}
              </span>
            )}
          </div>

          {/* Card Tools */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {isDoneCard && (
              <button
                onClick={() => handleToggleDone(scene.id)}
                aria-label={`Reopen scene ${scene.sceneNumber}`}
                className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-1"
                title="Reopen scene and move back to Active"
              >
                <RotateCcw className="w-2.5 h-2.5 text-emerald-400" />
                <span>Reopen</span>
              </button>
            )}

            {/* Prompt Preview & Quality Gate Tool */}
            <button
              onClick={() => setPreviewScene(scene)}
              aria-label={`Preview composed prompt for scene ${scene.sceneNumber}`}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-purple-300 transition focus-visible:ring-1 focus-visible:ring-purple-400 focus:outline-none"
              title="Preview Final Prompt & Quality Checks"
            >
              <Eye className="w-3 h-3" />
            </button>

            <button
              onClick={() =>
                setEditingCardId(isEditing ? null : scene.id)
              }
              aria-label={isEditing ? 'Save edits' : 'Edit scene card'}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition focus-visible:ring-1 focus-visible:ring-purple-400 focus:outline-none"
              title={isEditing ? 'Save Edit' : 'Edit Scene'}
            >
              {isEditing ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Edit3 className="w-3 h-3" />
              )}
            </button>
            <button
              onClick={() => setSceneToDelete(scene)}
              aria-label={`Delete scene ${scene.sceneNumber}`}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition focus-visible:ring-1 focus-visible:ring-rose-400 focus:outline-none"
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
            className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-300 text-[11px] font-mono resize-none focus:outline-none focus:ring-1 focus:ring-purple-400"
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
            disabled={isThisDelivering}
            aria-label={`Inject scene ${scene.sceneNumber} to Gemini`}
            className={`flex-1 py-1 px-1.5 rounded text-[10px] font-medium flex items-center justify-center gap-1 transition shadow-sm focus-visible:ring-1 focus-visible:ring-sky-400 focus:outline-none ${
              isThisDelivering && deliveringAction?.target === 'gemini'
                ? 'bg-slate-800 text-slate-400 cursor-wait'
                : isGeminiFull
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                : 'bg-sky-600/80 hover:bg-sky-500 text-white'
            }`}
            title="Inject scene prompt into Gemini webview input"
          >
            {isThisDelivering && deliveringAction?.target === 'gemini' ? (
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
            ) : (
              <ArrowRight className="w-2.5 h-2.5" />
            )}
            <span>Inject Scene</span>
          </button>

          {/* Button 2: Fresh Gemini + Global + Scene */}
          <button
            onClick={() => handleFreshGeminiGlobal(scene)}
            disabled={isThisDelivering}
            aria-label={`Fresh session with Global Rules and scene ${scene.sceneNumber} to Gemini`}
            className={`flex-1 py-1 px-1.5 rounded text-[10px] font-medium flex items-center justify-center gap-1 transition shadow-sm focus-visible:ring-1 focus-visible:ring-amber-400 focus:outline-none ${
              isThisDelivering && deliveringAction?.target === 'gemini-fresh'
                ? 'bg-slate-800 text-slate-400 cursor-wait'
                : isGeminiFull
                ? 'bg-amber-600 hover:bg-amber-500 text-white font-semibold animate-pulse ring-1 ring-amber-400'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            title="Open fresh Gemini chat, wait for load, and inject Global Rules + Scene Prompt together"
          >
            {isThisDelivering && deliveringAction?.target === 'gemini-fresh' ? (
              <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-300" />
            ) : (
              <RefreshCw className="w-2.5 h-2.5 text-amber-300" />
            )}
            <span>Fresh + Global</span>
          </button>

          {/* Button 3: Send to Google Flow (Feature B: Opens Confirmation First) */}
          <button
            onClick={() => handleRequestFlowSend(scene)}
            disabled={isThisDelivering}
            aria-label={`Inject scene ${scene.sceneNumber} to Google Flow`}
            className="flex-1 py-1 px-1.5 rounded bg-purple-600/80 hover:bg-purple-500 text-white text-[10px] font-medium flex items-center justify-center gap-1 transition shadow-sm focus-visible:ring-1 focus-visible:ring-purple-400 focus:outline-none disabled:opacity-50"
            title="Confirm and send prompt to Google Flow"
          >
            {isThisDelivering && deliveringAction?.target === 'flow' ? (
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
            ) : (
              <Sparkles className="w-2.5 h-2.5" />
            )}
            <span>🎬 Flow</span>
          </button>
        </div>
      </div>
    );
  };

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
                : toastMessage.type === 'warning'
                ? 'bg-amber-950/95 border-amber-700 text-amber-200'
                : 'bg-indigo-950/95 border-indigo-700 text-indigo-200'
            }`}
          >
            <span className="truncate flex-1 font-sans">{toastMessage.message}</span>
            <button
              onClick={() => setToastMessage(null)}
              aria-label="Dismiss notification"
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
          aria-label={collapsed ? 'Expand Pipeline Sidebar' : 'Collapse Sidebar'}
          className="flex items-center gap-1.5 text-slate-300 hover:text-white font-medium truncate focus-visible:ring-1 focus-visible:ring-purple-400 focus:outline-none rounded"
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
                  aria-label="Reset Gemini prompt counter"
                  className="ml-0.5 p-0.5 rounded hover:bg-white/20 text-slate-400 hover:text-white transition focus-visible:ring-1 focus-visible:ring-sky-400 focus:outline-none"
                  title="Reset Gemini session prompt tracker to 0"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                </button>
              </div>

              {/* Storyboard Intake Trigger */}
              <button
                onClick={() => setIsIntakeOpen(true)}
                aria-label="Open Storyboard Intake & Wrapper Builder"
                className="p-1 rounded bg-amber-600/30 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/40 transition focus-visible:ring-1 focus-visible:ring-amber-400 focus:outline-none"
                title="Open Claude Storyboard Intake & ChatGPT Wrapper Builder"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>

              {/* Parser Trigger Button */}
              <button
                onClick={() => {
                  setParsedPreview(null);
                  setIsParserOpen(true);
                }}
                aria-label="Open AI Storyboard Parser"
                className="p-1 rounded bg-purple-600/30 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/40 transition focus-visible:ring-1 focus-visible:ring-purple-400 focus:outline-none"
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
                    className="flex-1 bg-slate-900 border border-purple-500/60 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-400"
                  />
                  <button
                    onClick={handleRenameSubmit}
                    aria-label="Save project name"
                    className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500"
                    title="Save name"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setIsRenameOpen(false)}
                    aria-label="Cancel renaming"
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
                    aria-label="Select Project"
                    className="flex items-center justify-between gap-1.5 flex-1 min-w-0 px-2 py-1 rounded bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-left transition focus-visible:ring-1 focus-visible:ring-purple-400 focus:outline-none"
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
                    aria-label="Rename current project"
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 focus-visible:ring-1 focus-visible:ring-purple-400 focus:outline-none"
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
                              aria-label={`Delete project ${proj.name}`}
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
                Review Claude storyboard, configure aspect ratio & director rules, and build ChatGPT wrapper:
              </p>
              <button
                onClick={() => setIsIntakeOpen(true)}
                className="w-full py-1.5 px-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-[11px] flex items-center justify-center gap-1.5 transition shadow-sm focus-visible:ring-2 focus-visible:ring-purple-400 focus:outline-none"
              >
                <Sliders className="w-3 h-3" />
                <span>Open Storyboard Intake & Builder</span>
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

          {/* Section 2: Scene Cards List Filter & Search Bar */}
          <div className="p-2 bg-slate-900/60 border-b border-slate-800 flex flex-col gap-1.5 flex-shrink-0 select-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-medium text-slate-300 text-[11px]">
                <FileText className="w-3 h-3 text-sky-400" />
                <span>
                  Scenes ({totalActiveCount} active, {totalCompletedCount} done)
                </span>
              </div>

              <div className="flex items-center gap-1">
                {/* Filter Completed / Pending / All */}
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
                  aria-label="Add new scene card"
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition focus-visible:ring-1 focus-visible:ring-purple-400 focus:outline-none"
                  title="Add a new blank Scene Card"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Quick Search Input */}
            <div className="relative flex items-center">
              <Search className="w-3 h-3 text-slate-500 absolute left-2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search scenes by title, number, prompt..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-6 pr-6 py-1 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/60"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-1.5 p-0.5 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Section 3: Scrollable Scene Cards List (Feature A: Partitioned Active & Dedicated Done Sections) */}
          <div className="flex-1 overflow-y-auto p-2 space-y-3">
            {/* If no scenes match anywhere */}
            {activeScenes.length === 0 && doneScenes.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                <FileText className="w-6 h-6 text-slate-600" />
                <span>
                  {searchQuery.trim()
                    ? `No scenes match "${searchQuery}".`
                    : scenes.length === 0
                    ? 'No scenes in this project yet.'
                    : 'No scenes match current filter.'}
                </span>
                {searchQuery.trim() ? (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-1 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition"
                  >
                    Clear Search
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setParsedPreview(null);
                      setIsParserOpen(true);
                    }}
                    className="mt-1 px-3 py-1 rounded bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 text-[11px] transition"
                  >
                    Parse Storyboard
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* 1. Active Scenes Section (shown if filter is 'all' or 'pending') */}
                {filterDone !== 'completed' && (
                  <div className="space-y-2">
                    {filterDone === 'all' && doneScenes.length > 0 && (
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 px-1 pt-0.5">
                        <span className="flex items-center gap-1.5">
                          <FileText className="w-3 h-3 text-sky-400" />
                          <span>Active Scenes ({activeScenes.length})</span>
                        </span>
                      </div>
                    )}

                    {activeScenes.length === 0 && filterDone === 'pending' ? (
                      <div className="p-4 text-center text-slate-500 text-xs">
                        No pending scenes remaining. All scenes are marked Done!
                      </div>
                    ) : (
                      activeScenes.map((scene) => renderSceneCard(scene, false))
                    )}
                  </div>
                )}

                {/* 2. Dedicated Done / Completed Section (shown if filter is 'all' or 'completed') */}
                {filterDone !== 'pending' && doneScenes.length > 0 && (
                  <div className="space-y-2 pt-1 border-t border-slate-800/80">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 px-1 pt-1">
                      <div className="flex items-center gap-1.5 text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Completed ({doneScenes.length})</span>
                      </div>
                      <button
                        onClick={() => setIsDoneSectionCollapsed(!isDoneSectionCollapsed)}
                        aria-label={isDoneSectionCollapsed ? 'Expand completed scenes' : 'Collapse completed scenes'}
                        className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-0.5 transition"
                      >
                        <span>{isDoneSectionCollapsed ? 'Show' : 'Hide'}</span>
                        <ChevronDown className={`w-3 h-3 transition-transform ${isDoneSectionCollapsed ? '-rotate-90' : ''}`} />
                      </button>
                    </div>

                    {!isDoneSectionCollapsed && (
                      <div className="space-y-2">
                        {doneScenes.map((scene) => renderSceneCard(scene, true))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 0: GOOGLE FLOW SEND CONFIRMATION (Feature B)   */}
      {/* ---------------------------------------------------- */}
      {flowConfirmScene && (() => {
        const prevDelivery = getPreviousDelivery(activeProjectId, flowConfirmScene.id, 'flow');
        const isDuplicate = Boolean(prevDelivery);

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 space-y-4 text-xs animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isDuplicate
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  }`}
                >
                  {isDuplicate ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-slate-100 flex items-center gap-1.5">
                    {isDuplicate ? (
                      <span>Scene {flowConfirmScene.sceneNumber} may have already been sent</span>
                    ) : (
                      <span>Send Scene {flowConfirmScene.sceneNumber} to Google Flow?</span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    Scene: <span className="text-slate-200 font-medium">"{flowConfirmScene.title}"</span>
                  </p>
                </div>
              </div>

              {/* Duplicate Warning Callout */}
              {isDuplicate && (
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/50 text-amber-200 space-y-1">
                  <div className="font-semibold text-[11px] flex items-center gap-1.5 text-amber-300">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Previous delivery record detected</span>
                  </div>
                  <p className="text-[11px] text-amber-300/90 leading-relaxed">
                    This scene was previously sent {formatTimeAgo(prevDelivery.timestamp)} (status: {prevDelivery.status === 'inserted' ? 'verified insertion' : 'manual clipboard copy'}). Sending it again may create a duplicate prompt in Google Flow.
                  </p>
                </div>
              )}

              {/* Standard Confirmation Text */}
              {!isDuplicate && (
                <p className="text-slate-300 leading-relaxed">
                  You are about to send the prompt for <span className="font-semibold text-white">Scene {flowConfirmScene.sceneNumber}</span> to Google Flow.
                  Please confirm that this is the intended scene and that you have not already submitted it accidentally.
                </p>
              )}

              {/* Prompt snippet preview */}
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 font-mono block">PROMPT PREVIEW:</span>
                <p className="text-[11px] text-slate-300 font-mono line-clamp-2 leading-relaxed">
                  {flowConfirmScene.prompt}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/80">
                <button
                  onClick={handleCancelFlowConfirm}
                  disabled={isDeliveringFlowConfirm}
                  className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteFlowDelivery}
                  disabled={isDeliveringFlowConfirm}
                  className={`px-4 py-1.5 rounded-xl text-white text-xs font-semibold shadow-lg flex items-center gap-1.5 transition disabled:opacity-50 ${
                    isDuplicate
                      ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-600/20'
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-600/20'
                  }`}
                >
                  {isDeliveringFlowConfirm ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : isDuplicate ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Send Again</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Send Scene {flowConfirmScene.sceneNumber}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ---------------------------------------------------- */}
      {/* MODAL 1: CLAUDE STORYBOARD INTAKE & WRAPPER BUILDER   */}
      {/* ---------------------------------------------------- */}
      {isIntakeOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-slate-100 flex items-center gap-2">
                    <span>Claude Storyboard Intake</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                        intakeStatus === INTAKE_STATUS.SOURCE_VALIDATED || intakeStatus === INTAKE_STATUS.COPIED_TO_CLIPBOARD
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : intakeStatus === INTAKE_STATUS.SOURCE_NEEDS_REVIEW
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {intakeStatus}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Paste Claude's script, configure director specifications, and copy the production wrapper to ChatGPT.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsIntakeOpen(false)}
                aria-label="Close Storyboard Intake"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 flex-1 flex flex-col gap-3.5 overflow-y-auto text-xs">
              {/* Source Text Area with Actions */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    <span>Storyboard Source Script:</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleClipboardReadIntake}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] transition flex items-center gap-1.5 border border-slate-700"
                  >
                    <ClipboardPaste className="w-3 h-3" />
                    <span>Read from Clipboard</span>
                  </button>
                </div>

                <textarea
                  value={intakeSourceText}
                  onChange={(e) => handleSourceTextChange(e.target.value)}
                  placeholder="Paste complete Claude storyboard here (e.g. Scene 1: Camera moves through..., Scene 2: ...)"
                  rows={6}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 font-mono text-xs resize-none focus:outline-none focus:border-amber-500/50 leading-relaxed"
                />

                {/* Validation Status & Warnings */}
                {intakeValidation && (
                  <div className="space-y-1">
                    {intakeValidation.sceneCountEstimate > 0 && (
                      <div className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Detected ~{intakeValidation.sceneCountEstimate} explicit scene markers.</span>
                        {intakeValidation.hasVoiceOver && <span>• Voice-over/narration cues detected.</span>}
                      </div>
                    )}
                    {intakeValidation.warnings?.map((w, idx) => (
                      <div key={idx} className="p-2 rounded-lg bg-amber-950/30 border border-amber-800/30 text-amber-300 text-[11px] flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{w}</span>
                      </div>
                    ))}
                    {intakeValidation.errors?.map((err, idx) => (
                      <div key={idx} className="p-2 rounded-lg bg-rose-950/30 border border-rose-800/30 text-rose-300 text-[11px] flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{err}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Configuration Controls */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                {/* Aspect Ratio Selector */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-slate-300">Target Aspect Ratio:</label>
                  <select
                    value={selectedAspectRatio}
                    onChange={(e) => setSelectedAspectRatio(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    {SUPPORTED_ASPECT_RATIOS.map((ratio) => (
                      <option key={ratio} value={ratio}>
                        {ratio} {ratio === '16:9' ? '(Horizontal Standard)' : ratio === '9:16' ? '(Vertical Shorts/Reels)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Artistic Style Preset */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-slate-300">Artistic Style Preset:</label>
                  <select
                    value={selectedStyle}
                    onChange={(e) => setSelectedStyle(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    {ARTISTIC_STYLES.map((style) => (
                      <option key={style.id} value={style.id}>
                        {style.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Custom style text if custom chosen */}
                {selectedStyle === 'custom' && (
                  <div className="col-span-2 flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-slate-300">Custom Artistic Style Description:</label>
                    <input
                      type="text"
                      value={customStyleText}
                      onChange={(e) => setCustomStyleText(e.target.value)}
                      placeholder="e.g. 1970s Technicolor cinematic film, warm grain, anamorphic lens flare"
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}

                {/* Visual requirements */}
                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-slate-300">Additional Project Visual Constraints (Optional):</label>
                  <input
                    type="text"
                    value={customVisualReqs}
                    onChange={(e) => setCustomVisualReqs(e.target.value)}
                    placeholder="e.g. Protagonist wears blue parka throughout; consistent overcast dawn lighting"
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">
                {intakeSourceText.trim() ? `${intakeSourceText.length} chars entered` : 'Enter storyboard source to proceed'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsIntakeOpen(false)}
                  className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                >
                  Close
                </button>
                <button
                  onClick={handleGenerateAndCopyWrapper}
                  disabled={!intakeSourceText.trim()}
                  className="px-5 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-amber-600/20 flex items-center gap-1.5 transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Build & Copy ChatGPT Wrapper</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 2: RAW CHATGPT OUTPUT PARSER & STRUCTURED IMPORT */}
      {/* ---------------------------------------------------- */}
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
                    {parsedPreview ? 'Review Parsed Scenes & Confirm Import' : 'Raw AI Output Parser'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {parsedPreview
                      ? 'Review extracted Global Rules and Scene Cards before modifying the project.'
                      : 'Paste raw ChatGPT storyboard output to extract Global Rules and individual Scene Cards.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setParsedPreview(null);
                  setIsParserOpen(false);
                }}
                aria-label="Close parser"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            {parsedPreview ? (
              <div className="p-5 flex-1 flex flex-col gap-3 overflow-hidden text-xs">
                {/* Status Bar */}
                <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-800/40 text-purple-200 flex items-center justify-between">
                  <span className="font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Parsed {parsedPreview.scenes.length} Scene Cards</span>
                  </span>
                  <span className="text-[10px] text-purple-300 font-mono">
                    {parsedPreview.globalRules ? '✓ Global Rules Extracted' : 'No Global Rules in Output'}
                  </span>
                </div>

                {/* Missing Global Rules Options */}
                {!parsedPreview.globalRules && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-amber-800/40 space-y-2">
                    <div className="flex items-center gap-1.5 text-amber-300 font-medium">
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Missing Global Rules: How should rules be handled?</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer text-[11px]">
                        <input
                          type="radio"
                          name="rulesStrategy"
                          checked={rulesStrategy === GLOBAL_RULES_STRATEGY.KEEP_ACTIVE}
                          onChange={() => setRulesStrategy(GLOBAL_RULES_STRATEGY.KEEP_ACTIVE)}
                          className="text-purple-600 focus:ring-purple-400"
                        />
                        <span>Keep Active Rules</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer text-[11px]">
                        <input
                          type="radio"
                          name="rulesStrategy"
                          checked={rulesStrategy === GLOBAL_RULES_STRATEGY.USE_DEFAULT}
                          onChange={() => setRulesStrategy(GLOBAL_RULES_STRATEGY.USE_DEFAULT)}
                          className="text-purple-600 focus:ring-purple-400"
                        />
                        <span>Use Defaults</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer text-[11px]">
                        <input
                          type="radio"
                          name="rulesStrategy"
                          checked={rulesStrategy === GLOBAL_RULES_STRATEGY.CLEAR}
                          onChange={() => setRulesStrategy(GLOBAL_RULES_STRATEGY.CLEAR)}
                          className="text-purple-600 focus:ring-purple-400"
                        />
                        <span>Leave Empty</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Global Rules Extracted Preview */}
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

                {/* Import Mode: Replace or Append */}
                <div className="flex items-center justify-between px-2 py-1 bg-slate-950/60 rounded-lg border border-slate-800 text-[11px]">
                  <span className="text-slate-400 font-medium">Destination Project Mode:</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1 text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                        className="text-purple-600"
                      />
                      <span>Replace All ({activeProject.scenes?.length || 0} existing)</span>
                    </label>
                    <label className="flex items-center gap-1 text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'append'}
                        onChange={() => setImportMode('append')}
                        className="text-purple-600"
                      />
                      <span>Append to End</span>
                    </label>
                  </div>
                </div>

                {/* Parsed Scenes Preview List */}
                <div className="flex-1 overflow-y-auto space-y-2 border border-slate-800 rounded-xl p-2 bg-slate-950/40">
                  {parsedPreview.scenes.map((s, idx) => (
                    <div key={s.id || idx} className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="font-semibold text-slate-200 text-xs mb-0.5 flex items-center justify-between">
                        <span>{s.title}</span>
                        {s.warnings && s.warnings.length > 0 && (
                          <span className="text-[10px] text-amber-400 font-mono">{s.warnings.join(' ')}</span>
                        )}
                      </div>
                      <p className="text-slate-400 font-mono text-[11px] line-clamp-2">
                        {s.prompt}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Unparsed Content Notice */}
                {parsedPreview.unparsedContent && parsedPreview.unparsedContent.length > 0 && (
                  <div className="p-2 rounded-lg bg-indigo-950/30 border border-indigo-800/40 text-indigo-300 text-[11px]">
                    <span className="font-medium block">Preserved Unparsed Content:</span>
                    <span className="line-clamp-2 font-mono text-[10px]">{parsedPreview.unparsedContent.join('\n')}</span>
                  </div>
                )}

                {/* Warnings */}
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
                      const res = await readClipboardText();
                      if (res.success) {
                        setRawInputText(res.text);
                      }
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
`GLOBAL RULES:
Aspect Ratio 16:9, Unreal Engine 5.4 cinematic lighting, 8k render...

SCENE 1: Opening Hook
Cinematic wide shot of mission control room...

SCENE 2: Problem Statement
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
                  ? `${parsedPreview.scenes.length} scenes ready to import`
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
                      <span>Confirm & Import to Project</span>
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
                      onClick={handleRunParser}
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

      {/* ---------------------------------------------------- */}
      {/* MODAL 3: SCENE PROMPT PREVIEW & QUALITY GATE         */}
      {/* ---------------------------------------------------- */}
      {previewScene && (() => {
        const composition = composeProductionPrompt({
          scene: previewScene,
          globalRules: activeProject.globalRules,
          includeGlobalRules: true,
        });

        const quality = evaluatePromptQuality({
          scene: previewScene,
          composedPrompt: composition.composedPrompt,
          globalRules: activeProject.globalRules,
          project: activeProject,
        });

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="px-5 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-slate-100 flex items-center gap-2">
                      <span>{previewScene.title}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium ${
                          quality.status === 'passed'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : quality.status === 'warning'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-rose-950 text-rose-300 border border-rose-800'
                        }`}
                      >
                        Quality: {quality.status.toUpperCase()}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Deterministic prompt composition preview and generator readiness check.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewScene(null)}
                  aria-label="Close Preview"
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 flex-1 flex flex-col gap-3 overflow-y-auto text-xs">
                {/* Stats Bar */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono">
                  <span className="text-slate-300">
                    Characters: <span className="text-white font-semibold">{composition.charCount}</span>
                  </span>
                  <span className="text-slate-300">
                    Approx. Tokens: <span className="text-white font-semibold">~{composition.tokenEstimate}</span>
                  </span>
                  <span className="text-slate-300">
                    Global Rules: <span className="text-amber-400 font-semibold">{composition.hasGlobalRules ? 'Included' : 'None'}</span>
                  </span>
                </div>

                {/* Quality Checks Breakdown */}
                <div className="space-y-1">
                  <span className="font-medium text-slate-300 block mb-0.5">Quality Gate Results:</span>
                  {quality.checks.map((check, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-lg text-[11px] flex items-center justify-between border ${
                        check.passed
                          ? 'bg-emerald-950/20 border-emerald-800/30 text-emerald-300'
                          : 'bg-amber-950/20 border-amber-800/30 text-amber-300'
                      }`}
                    >
                      <span className="font-medium">{check.name}</span>
                      <span>{check.message}</span>
                    </div>
                  ))}
                </div>

                {/* Composed Prompt Preview */}
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-slate-300">Exact Delivered Prompt Preview:</span>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono text-[11px] leading-relaxed max-h-48 overflow-y-auto select-text whitespace-pre-wrap">
                    {composition.composedPrompt}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
                <button
                  onClick={() => setPreviewScene(null)}
                  className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                >
                  Close
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(composition.composedPrompt);
                        showToast('✓ Composed prompt copied to clipboard!', 'success');
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition flex items-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Composed</span>
                  </button>
                  <button
                    onClick={() => {
                      const targetScene = previewScene;
                      setPreviewScene(null);
                      handleRequestFlowSend(targetScene);
                    }}
                    className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/20 flex items-center gap-1.5 transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Send to Google Flow</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete Scene Confirmation Modal */}
      {sceneToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-3 text-xs">
            <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>Delete Scene Card</span>
            </div>
            <p className="text-slate-300">
              Are you sure you want to delete <span className="font-semibold text-white">"{sceneToDelete.title}"</span>?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSceneToDelete(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteScene}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium"
              >
                Delete Scene
              </button>
            </div>
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
                Delete Project
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
              <button
                onClick={() => setImportPreview(null)}
                aria-label="Close import preview"
                className="text-slate-400 hover:text-white"
              >
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
    </aside>
  );
}
