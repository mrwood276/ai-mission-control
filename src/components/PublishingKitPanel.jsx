import React, { useState } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Share2,
  FileText,
  MessageSquare,
  Hash,
  Send,
  X,
  ClipboardPaste,
  ShieldCheck,
  ExternalLink,
  CheckSquare,
  Square,
  RotateCcw,
  Globe,
  ArrowUpRight
} from 'lucide-react';
import {
  PUBLISHING_STATUS,
  PUBLISH_STATE,
  SUPPORTED_PLATFORMS,
  CHECKLIST_ITEMS,
  LONG_FORM_CHECKLIST_ITEMS,
  createDefaultChecklist,
  createDefaultLongFormChecklist,
  isPlatformEnabled,
  normalizePublishingKit,
  generatePublishingKit,
  generateSingleField,
  formatCompletePackage,
  computeStoryboardFingerprint,
  buildPublishingAiPrompt,
  parsePublishingAiResponse,
  validatePublishingKitAgainstStoryboard,
  extractStoryboardContext
} from '../utils/publishingKitGenerator';

export default function PublishingKitPanel({
  project,
  onUpdateProject,
  onShowToast,
  className = '',
  publishingWorkspace = null,
  onOpenPlatformWorkspace,
  onClosePlatformWorkspace,
}) {
  const [activePlatform, setActivePlatform] = useState(SUPPORTED_PLATFORMS.YOUTUBE);
  const [copiedKey, setCopiedKey] = useState(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [rawAiInput, setRawAiInput] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [showWarnings, setShowWarnings] = useState(true);

  // Confirmation Modals State
  const [publishConfirmPlatform, setPublishConfirmPlatform] = useState(null);
  const [resetChecklistConfirmPlatform, setResetChecklistConfirmPlatform] = useState(null);

  if (!project) return null;

  // Ensure normalized, migration-safe kit
  const kit = normalizePublishingKit(project.publishingKit);

  const currentFingerprint = computeStoryboardFingerprint(project);
  const isFingerprintMismatch =
    Boolean(kit.sourceFingerprint) && kit.sourceFingerprint !== currentFingerprint;
  const isNeedsReview = kit.status === PUBLISHING_STATUS.NEEDS_REVIEW || isFingerprintMismatch;

  const hasContent = Boolean(
    kit.youtube?.titles?.[0] || kit.youtube?.description || kit.youtube_long?.titles?.[0]
  );

  // Fallback to enabled platform if current activePlatform is disabled
  const currentPlatform = isPlatformEnabled(activePlatform)
    ? activePlatform
    : SUPPORTED_PLATFORMS.YOUTUBE;
  const isLongForm = currentPlatform === SUPPORTED_PLATFORMS.YOUTUBE_LONG;
  const platformLabel = isLongForm ? 'YouTube Long-form' : 'YouTube Shorts';
  const platformData = isLongForm ? kit.youtube_long : kit.youtube;
  const platformChecklistItems = isLongForm ? LONG_FORM_CHECKLIST_ITEMS : CHECKLIST_ITEMS;
  const platformChecklist =
    platformData?.checklist ||
    (isLongForm ? createDefaultLongFormChecklist() : createDefaultChecklist());
  const isPublished = platformData?.publishedStatus === PUBLISH_STATE.PUBLISHED;

  // Calculate checklist progress
  const completedChecklistCount = platformChecklistItems.filter(
    (item) => Boolean(platformChecklist[item.id])
  ).length;

  // Helper to copy text to clipboard with truthful feedback
  const handleCopy = async (text, key, label = 'Copied to clipboard') => {
    if (!text || !text.trim()) {
      if (onShowToast) onShowToast('Field is empty to copy.', 'warning');
      return;
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2200);
        if (onShowToast) onShowToast(`✓ ${label}!`, 'success');
      } else {
        if (onShowToast) onShowToast('Clipboard API not available.', 'error');
      }
    } catch (err) {
      if (onShowToast) onShowToast(`Copy failed: ${err.message}`, 'error');
    }
  };

  // Mutate publishing kit inside active project
  const updateKit = (updater) => {
    onUpdateProject((p) => {
      const current = normalizePublishingKit(p.publishingKit);
      const nextKit = updater(current);
      return {
        ...p,
        publishingKit: nextKit,
        updatedAt: Date.now(),
      };
    });
  };

  // Full kit generation
  const handleGenerateFullKit = () => {
    try {
      const newKit = generatePublishingKit(project, { preserveEdited: false });
      updateKit(() => newKit);
      if (onShowToast) onShowToast('✓ Publishing Kit generated from active storyboard!', 'success');
    } catch (err) {
      if (onShowToast) onShowToast(`Generation error: ${err.message}`, 'error');
    }
  };

  // Single field regeneration
  const handleRegenerateField = (fieldKey, label) => {
    try {
      const updatedKit = generateSingleField(fieldKey, project);
      updateKit(() => updatedKit);
      if (onShowToast) onShowToast(`✓ Regenerated ${label}.`, 'info');
    } catch (err) {
      if (onShowToast) onShowToast(`Regenerate failed: ${err.message}`, 'error');
    }
  };

  // Edit metadata field handler
  const handleEditField = (path, value) => {
    updateKit((k) => {
      const copy = JSON.parse(JSON.stringify(k));
      const parts = path.split('.');
      let target = copy;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!target[parts[i]]) target[parts[i]] = {};
        target = target[parts[i]];
      }
      target[parts[parts.length - 1]] = value;

      if (!copy.userEditedFields) copy.userEditedFields = {};
      copy.userEditedFields[path] = true;

      const context = extractStoryboardContext({
        storyboardText: project.storyboardSource || '',
        scenes: project.scenes || [],
        globalRules: project.globalRules || '',
      });
      copy.qualityWarnings = validatePublishingKitAgainstStoryboard(copy, context);

      return copy;
    });
  };

  // Checklist toggle handler
  const handleToggleChecklistItem = (platform, itemId) => {
    updateKit((k) => {
      const copy = JSON.parse(JSON.stringify(k));
      if (!copy[platform]) copy[platform] = {};
      if (!copy[platform].checklist) {
        copy[platform].checklist =
          platform === SUPPORTED_PLATFORMS.YOUTUBE_LONG
            ? createDefaultLongFormChecklist()
            : createDefaultChecklist();
      }
      copy[platform].checklist[itemId] = !copy[platform].checklist[itemId];
      return copy;
    });
  };

  // Checklist reset handler
  const handleConfirmResetChecklist = () => {
    if (!resetChecklistConfirmPlatform) return;
    const targetPlatform = resetChecklistConfirmPlatform;
    updateKit((k) => {
      const copy = JSON.parse(JSON.stringify(k));
      if (!copy[targetPlatform]) copy[targetPlatform] = {};
      copy[targetPlatform].checklist =
        targetPlatform === SUPPORTED_PLATFORMS.YOUTUBE_LONG
          ? createDefaultLongFormChecklist()
          : createDefaultChecklist();
      return copy;
    });
    setResetChecklistConfirmPlatform(null);
    const platformName =
      targetPlatform === SUPPORTED_PLATFORMS.YOUTUBE_LONG
        ? 'YouTube Long-form'
        : targetPlatform === SUPPORTED_PLATFORMS.YOUTUBE
        ? 'YouTube Shorts'
        : 'TikTok';
    if (onShowToast) onShowToast(`✓ Reset checklist for ${platformName}.`, 'info');
  };

  // Published status confirmation handler
  const handleConfirmPublished = () => {
    if (!publishConfirmPlatform) return;
    const targetPlatform = publishConfirmPlatform;
    updateKit((k) => {
      const copy = JSON.parse(JSON.stringify(k));
      if (!copy[targetPlatform]) copy[targetPlatform] = {};
      copy[targetPlatform].publishedStatus = PUBLISH_STATE.PUBLISHED;
      copy[targetPlatform].publishedAt = Date.now();
      return copy;
    });
    setPublishConfirmPlatform(null);
    const platformName =
      targetPlatform === SUPPORTED_PLATFORMS.YOUTUBE_LONG
        ? 'YouTube Long-form'
        : targetPlatform === SUPPORTED_PLATFORMS.YOUTUBE
        ? 'YouTube Shorts'
        : 'TikTok';
    if (onShowToast) onShowToast(`✓ Marked as Published on ${platformName}.`, 'success');
  };

  // Revert published status handler
  const handleRevertPublishedStatus = (platform) => {
    updateKit((k) => {
      const copy = JSON.parse(JSON.stringify(k));
      if (!copy[platform]) copy[platform] = {};
      copy[platform].publishedStatus = PUBLISH_STATE.NOT_PUBLISHED;
      copy[platform].publishedAt = null;
      return copy;
    });
    if (onShowToast) onShowToast(`Status reverted to Not Published.`, 'info');
  };

  // Mark as reviewed (acknowledges storyboard changes without clearing edits)
  const handleMarkAsReviewed = () => {
    updateKit((k) => ({
      ...k,
      status: PUBLISHING_STATUS.READY,
      sourceFingerprint: currentFingerprint,
    }));
    if (onShowToast) onShowToast('✓ Publishing Kit marked as Reviewed & Ready.', 'success');
  };

  // Copy full package
  const handleCopyCompletePackage = (platform) => {
    const pkg = formatCompletePackage(kit, platform);
    const label =
      platform === SUPPORTED_PLATFORMS.YOUTUBE_LONG
        ? 'YouTube Long-form'
        : platform === SUPPORTED_PLATFORMS.YOUTUBE
        ? 'YouTube Shorts'
        : 'TikTok';
    handleCopy(pkg, `pkg-${platform}`, `Complete ${label} package copied`);
  };

  // AI Prompt copy
  const handleCopyAiPrompt = () => {
    const prompt = buildPublishingAiPrompt(project);
    handleCopy(prompt, 'ai-prompt', 'AI Publishing Prompt copied');
    setIsAiModalOpen(false);
  };

  // AI Response Import
  const handleImportAiResponse = () => {
    const res = parsePublishingAiResponse(rawAiInput, kit);
    if (!res.success) {
      if (onShowToast) onShowToast(res.error || 'Failed to parse AI response.', 'error');
      return;
    }
    const importedKit = {
      ...res.kit,
      sourceFingerprint: currentFingerprint,
      status: PUBLISHING_STATUS.READY,
    };
    updateKit(() => importedKit);
    setIsImportModalOpen(false);
    setRawAiInput('');
    if (onShowToast) onShowToast('✓ AI Publishing Kit imported successfully!', 'success');
  };

  // Workspace open handler
  const handleOpenWorkspace = () => {
    if (onOpenPlatformWorkspace) {
      onOpenPlatformWorkspace('youtube');
      if (onShowToast) {
        onShowToast(
          '🌐 Opening YouTube Studio workspace. Upload video and copy metadata as needed.',
          'info'
        );
      }
    }
  };

  const isCurrentPlatformWorkspaceOpen = publishingWorkspace === 'youtube';

  return (
    <div className={`flex flex-col h-full bg-slate-950 text-slate-200 text-xs overflow-hidden ${className}`}>
      {/* Top Kit Action Bar */}
      <div className="p-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-1.5 flex-shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Share2 className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
          <span className="font-semibold text-slate-200 truncate">Publishing Kit</span>

          {/* Status Badge */}
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 border ${
              isNeedsReview
                ? 'bg-amber-950/80 text-amber-300 border-amber-700/80'
                : kit.status === PUBLISHING_STATUS.READY
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {isNeedsReview ? (
              <>
                <AlertTriangle className="w-2.5 h-2.5 text-amber-400 animate-pulse" />
                <span>Needs Review</span>
              </>
            ) : kit.status === PUBLISHING_STATUS.READY ? (
              <>
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                <span>Ready</span>
              </>
            ) : (
              <span>Draft</span>
            )}
          </span>
        </div>

        {/* Global Action Tools */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleGenerateFullKit}
            aria-label="Generate or regenerate entire Publishing Kit"
            className="px-2 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-medium text-[11px] flex items-center gap-1 transition focus-visible:ring-1 focus-visible:ring-purple-400 focus:outline-none"
            title="Generate full publishing package grounded on current storyboard"
          >
            <Sparkles className="w-3 h-3" />
            <span>{hasContent ? 'Regenerate All' : 'Generate Kit'}</span>
          </button>

          <button
            onClick={() => setIsAiModalOpen(true)}
            aria-label="Export AI prompt for external ChatGPT or Claude"
            className="p-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 transition focus-visible:ring-1 focus-visible:ring-purple-400 focus:outline-none"
            title="Copy structured prompt for ChatGPT/Claude"
          >
            <Send className="w-3 h-3 text-sky-400" />
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            aria-label="Import AI response JSON"
            className="p-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 transition focus-visible:ring-1 focus-visible:ring-purple-400 focus:outline-none"
            title="Paste and import JSON output from ChatGPT/Claude"
          >
            <ClipboardPaste className="w-3 h-3 text-emerald-400" />
          </button>
        </div>
      </div>

      {/* Storyboard Change Alert Banner (Needs Review) */}
      {isNeedsReview && (
        <div className="p-2 bg-amber-950/40 border-b border-amber-800/40 flex items-center justify-between gap-2 flex-shrink-0 animate-in fade-in">
          <div className="flex items-center gap-1.5 min-w-0 text-amber-300 text-[11px]">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
            <span className="truncate">
              Storyboard changed since last generation. Review package.
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleMarkAsReviewed}
              className="px-1.5 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-medium transition"
              title="Acknowledge changes and keep current content"
            >
              Mark Reviewed
            </button>
          </div>
        </div>
      )}

      {/* Platform Switcher Tabs */}
      <div className="flex items-center border-b border-slate-800 bg-slate-900/60 p-1 gap-1 flex-shrink-0 select-none">
        <button
          onClick={() => setActivePlatform(SUPPORTED_PLATFORMS.YOUTUBE)}
          aria-label="YouTube Shorts Tab"
          className={`flex-1 py-1 px-2 rounded-lg font-medium text-[11px] flex items-center justify-center gap-1.5 transition ${
            currentPlatform === SUPPORTED_PLATFORMS.YOUTUBE
              ? 'bg-red-950/60 text-red-300 border border-red-800/50 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span>YouTube Shorts</span>
          {kit.youtube?.publishedStatus === PUBLISH_STATE.PUBLISHED && (
            <Check className="w-2.5 h-2.5 text-emerald-400 ml-0.5" />
          )}
        </button>

        <button
          onClick={() => setActivePlatform(SUPPORTED_PLATFORMS.YOUTUBE_LONG)}
          aria-label="YouTube Long-form Tab"
          className={`flex-1 py-1 px-2 rounded-lg font-medium text-[11px] flex items-center justify-center gap-1.5 transition ${
            currentPlatform === SUPPORTED_PLATFORMS.YOUTUBE_LONG
              ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/50 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-indigo-400" />
          <span>YouTube Long-form</span>
          {kit.youtube_long?.publishedStatus === PUBLISH_STATE.PUBLISHED && (
            <Check className="w-2.5 h-2.5 text-emerald-400 ml-0.5" />
          )}
        </button>
      </div>

      {/* Platform Publishing Status & Open Workspace Bar */}
      <div className="p-2 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between gap-1.5 flex-shrink-0">
        {/* Status Pill */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] text-slate-400 font-medium">Status:</span>
          {isPublished ? (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/80 text-[10px] font-semibold">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Published</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-medium">
              <span>Not Published</span>
            </div>
          )}
        </div>

        {/* Action Buttons: Mark as Published & Open Workspace */}
        <div className="flex items-center gap-1">
          {isPublished ? (
            <button
              onClick={() => handleRevertPublishedStatus(currentPlatform)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] transition"
              title="Revert status to Not Published if marked accidentally"
            >
              Revert Status
            </button>
          ) : (
            <button
              onClick={() => setPublishConfirmPlatform(currentPlatform)}
              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[10px] flex items-center gap-1 transition shadow-sm"
              title="Confirm that you have published the video manually"
            >
              <Check className="w-3 h-3" />
              <span>Mark as Published</span>
            </button>
          )}

          {/* Open Official Platform Workspace Button */}
          {isCurrentPlatformWorkspaceOpen ? (
            <button
              onClick={() => onClosePlatformWorkspace && onClosePlatformWorkspace()}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-[10px] flex items-center gap-1 transition"
              title="Close platform webview and return to standard view"
            >
              <X className="w-3 h-3 text-slate-400" />
              <span>Close View</span>
            </button>
          ) : (
            <button
              onClick={handleOpenWorkspace}
              aria-label="Open YouTube Studio"
              className="px-2 py-1 rounded font-medium text-[10px] flex items-center gap-1 transition shadow-sm bg-red-600 hover:bg-red-500 text-white"
              title="Open YouTube Studio in the adjacent workspace pane"
            >
              <Globe className="w-3 h-3" />
              <span>Open YouTube Studio</span>
              <ArrowUpRight className="w-2.5 h-2.5 opacity-80" />
            </button>
          )}
        </div>
      </div>

      {/* Quality Check Warnings Accordion (if any) */}
      {kit.qualityWarnings?.length > 0 && (
        <div className="p-2 bg-slate-900/40 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center justify-between text-[11px] text-amber-300 font-medium">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-amber-400" />
              <span>Grounding & Quality Gate ({kit.qualityWarnings.length} notices)</span>
            </span>
            <button
              onClick={() => setShowWarnings(!showWarnings)}
              className="text-[10px] text-slate-400 hover:text-slate-200"
            >
              {showWarnings ? 'Hide' : 'Show'}
            </button>
          </div>
          {showWarnings && (
            <div className="mt-1 space-y-1 text-[10px] text-amber-200/80">
              {kit.qualityWarnings.map((w, idx) => (
                <div key={idx} className="flex items-start gap-1">
                  <span className="text-amber-500">•</span>
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scrollable Publishing Content Area */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-3">
        {!hasContent ? (
          <div className="p-6 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
            <Share2 className="w-8 h-8 text-slate-600" />
            <p className="font-medium text-slate-400">Publishing Kit Not Generated Yet</p>
            <p className="text-[11px] max-w-xs text-slate-500 leading-relaxed">
              Generate grounded YouTube Shorts & TikTok titles, descriptions, hashtags, and discussion comments directly from your active storyboard scenes.
            </p>
            <button
              onClick={handleGenerateFullKit}
              className="mt-2 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs flex items-center gap-1.5 transition shadow"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate Publishing Kit</span>
            </button>
          </div>
        ) : activePlatform === SUPPORTED_PLATFORMS.YOUTUBE ? (
          /* ============================================================ */
          /* YOUTUBE SHORTS SECTION                                       */
          /* ============================================================ */
          <div className="space-y-3">
            {/* 1. YouTube Titles Selection & Editing */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 flex items-center gap-1 text-[11px]">
                  <FileText className="w-3 h-3 text-red-400" />
                  <span>3 Alternative Titles</span>
                </span>
                <button
                  onClick={() => handleRegenerateField('youtube.titles', 'YouTube Titles')}
                  aria-label="Regenerate 3 alternative YouTube titles"
                  className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-1"
                  title="Regenerate titles without touching description or hashtags"
                >
                  <RefreshCw className="w-2.5 h-2.5 text-purple-400" />
                  <span>Regenerate Titles</span>
                </button>
              </div>

              <div className="space-y-1.5">
                {(kit.youtube?.titles || ['', '', '']).map((title, idx) => {
                  const isSelected = (kit.youtube?.selectedTitleIndex || 0) === idx;
                  const charCount = (title || '').length;
                  const isCopied = copiedKey === `yt-title-${idx}`;

                  return (
                    <div
                      key={idx}
                      className={`p-1.5 rounded-lg border transition ${
                        isSelected
                          ? 'bg-slate-950 border-purple-500/60 shadow-sm'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-400">
                          <input
                            type="radio"
                            name="selectedYtTitle"
                            checked={isSelected}
                            onChange={() => updateKit((k) => ({
                              ...k,
                              youtube: { ...k.youtube, selectedTitleIndex: idx },
                            }))}
                            className="text-purple-600 focus:ring-purple-400 h-3 w-3"
                          />
                          <span className={isSelected ? 'text-purple-300 font-semibold' : 'text-slate-400'}>
                            Option {idx + 1} {isSelected && '• Primary'}
                          </span>
                        </label>

                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-mono ${charCount > 85 ? 'text-amber-400' : 'text-slate-500'}`}>
                            {charCount}/85
                          </span>
                          <button
                            onClick={() => handleCopy(title, `yt-title-${idx}`, `Title ${idx + 1} copied`)}
                            aria-label={`Copy Title Option ${idx + 1}`}
                            className="p-1 rounded hover:bg-slate-850 text-slate-400 hover:text-white transition"
                            title="Copy this title"
                          >
                            {isCopied ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>

                      <input
                        type="text"
                        value={title}
                        onChange={(e) => {
                          const updatedTitles = [...(kit.youtube?.titles || ['', '', ''])];
                          updatedTitles[idx] = e.target.value;
                          handleEditField('youtube.titles', updatedTitles);
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-[11px] focus:outline-none focus:border-purple-400"
                        placeholder={`Title Option ${idx + 1}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. YouTube Description */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 flex items-center gap-1 text-[11px]">
                  <FileText className="w-3 h-3 text-sky-400" />
                  <span>Main Description</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleRegenerateField('youtube.description', 'YouTube Description')}
                    aria-label="Regenerate YouTube description"
                    className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-1"
                    title="Regenerate description only"
                  >
                    <RefreshCw className="w-2.5 h-2.5 text-sky-400" />
                    <span>Regenerate</span>
                  </button>
                  <button
                    onClick={() => handleCopy(kit.youtube?.description || '', 'yt-desc', 'Description copied')}
                    aria-label="Copy YouTube description"
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
                    title="Copy description"
                  >
                    {copiedKey === 'yt-desc' ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>

              <textarea
                value={kit.youtube?.description || ''}
                onChange={(e) => handleEditField('youtube.description', e.target.value)}
                rows={4}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 text-[11px] leading-relaxed resize-none focus:outline-none focus:border-purple-400 font-sans"
                placeholder="YouTube description summarizing the premise and call to action..."
              />
            </div>

            {/* 3. YouTube Hashtags */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 flex items-center gap-1 text-[11px]">
                  <Hash className="w-3 h-3 text-emerald-400" />
                  <span>Hashtags</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleRegenerateField('youtube.hashtags', 'YouTube Hashtags')}
                    aria-label="Regenerate YouTube hashtags"
                    className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-1"
                    title="Regenerate hashtags only"
                  >
                    <RefreshCw className="w-2.5 h-2.5 text-emerald-400" />
                    <span>Regenerate</span>
                  </button>
                  <button
                    onClick={() => handleCopy((kit.youtube?.hashtags || []).join(' '), 'yt-tags', 'Hashtags copied')}
                    aria-label="Copy YouTube hashtags"
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
                    title="Copy hashtags"
                  >
                    {copiedKey === 'yt-tags' ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>

              {/* Tag Pills */}
              <div className="flex flex-wrap gap-1">
                {(kit.youtube?.hashtags || []).map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-emerald-400 font-mono"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <input
                type="text"
                value={(kit.youtube?.hashtags || []).join(' ')}
                onChange={(e) => {
                  const tags = e.target.value
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((t) => (t.startsWith('#') ? t : `#${t}`));
                  handleEditField('youtube.hashtags', tags);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-[11px] font-mono focus:outline-none focus:border-purple-400"
                placeholder="#Shorts #YouTubeShorts #Tag"
              />
            </div>

            {/* 4. YouTube Pinned Comment */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 flex items-center gap-1 text-[11px]">
                  <MessageSquare className="w-3 h-3 text-amber-400" />
                  <span>Pinned Discussion Comment</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleRegenerateField('youtube.pinnedComment', 'YouTube Pinned Comment')}
                    aria-label="Regenerate YouTube comment"
                    className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-1"
                    title="Regenerate discussion comment only"
                  >
                    <RefreshCw className="w-2.5 h-2.5 text-amber-400" />
                    <span>Regenerate</span>
                  </button>
                  <button
                    onClick={() => handleCopy(kit.youtube?.pinnedComment || '', 'yt-comment', 'Pinned comment copied')}
                    aria-label="Copy YouTube comment"
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
                    title="Copy pinned comment"
                  >
                    {copiedKey === 'yt-comment' ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>

              <textarea
                value={kit.youtube?.pinnedComment || ''}
                onChange={(e) => handleEditField('youtube.pinnedComment', e.target.value)}
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 text-[11px] leading-relaxed resize-none focus:outline-none focus:border-purple-400 font-sans"
                placeholder="Question designed to spark viewer comments..."
              />
            </div>

            {/* One-Click Copy Full YouTube Package */}
            <button
              onClick={() => handleCopyCompletePackage(SUPPORTED_PLATFORMS.YOUTUBE)}
              aria-label="Copy Complete YouTube Shorts Package"
              className="w-full py-2 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition shadow focus-visible:ring-2 focus-visible:ring-red-400 focus:outline-none"
            >
              {copiedKey === 'pkg-youtube' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>✓ Complete YouTube Package Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Complete YouTube Shorts Package</span>
                </>
              )}
            </button>

            {/* ============================================================ */}
            {/* 5. YOUTUBE PUBLISHING CHECKLIST                             */}
            {/* ============================================================ */}
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-red-400" />
                  <span className="font-semibold text-slate-200 text-[11px]">
                    YouTube Shorts Upload Checklist
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ({completedChecklistCount}/{CHECKLIST_ITEMS.length})
                  </span>
                </div>

                {completedChecklistCount > 0 && (
                  <button
                    onClick={() => setResetChecklistConfirmPlatform(SUPPORTED_PLATFORMS.YOUTUBE)}
                    className="p-1 rounded text-slate-500 hover:text-slate-300 text-[10px] flex items-center gap-0.5"
                    title="Reset all checklist items"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-red-500 h-full transition-all duration-300"
                  style={{ width: `${(completedChecklistCount / CHECKLIST_ITEMS.length) * 100}%` }}
                />
              </div>

              {/* Checklist items list */}
              <div className="space-y-1.5 pt-1">
                {CHECKLIST_ITEMS.map((item) => {
                  const isChecked = Boolean(platformChecklist[item.id]);

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleToggleChecklistItem(SUPPORTED_PLATFORMS.YOUTUBE, item.id)}
                      className={`p-2 rounded-lg border transition cursor-pointer flex items-start gap-2 ${
                        isChecked
                          ? 'bg-slate-950/80 border-slate-800 text-slate-300'
                          : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:border-slate-800'
                      }`}
                    >
                      <button
                        type="button"
                        aria-label={`Toggle ${item.label}`}
                        className={`mt-0.5 flex-shrink-0 ${
                          isChecked ? 'text-red-400' : 'text-slate-600'
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-3.5 h-3.5" />
                        ) : (
                          <Square className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] font-medium ${isChecked ? 'line-through text-slate-400' : 'text-slate-200'}`}>
                          {item.label}
                        </p>
                        <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* ============================================================ */
          /* YOUTUBE LONG-FORM SECTION                                    */
          /* ============================================================ */
          <div className="space-y-3">
            {/* 1. YouTube Long-form Titles Selection & Editing */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 flex items-center gap-1 text-[11px]">
                  <FileText className="w-3 h-3 text-indigo-400" />
                  <span>3 Alternative Titles (Full Story & Hook)</span>
                </span>
                <button
                  onClick={() => handleRegenerateField('youtube_long.titles', 'YouTube Long-form Titles')}
                  aria-label="Regenerate 3 alternative YouTube Long-form titles"
                  className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-1"
                  title="Regenerate long-form titles without touching description or hashtags"
                >
                  <RefreshCw className="w-2.5 h-2.5 text-indigo-400" />
                  <span>Regenerate Titles</span>
                </button>
              </div>

              <div className="space-y-1.5">
                {(kit.youtube_long?.titles || ['', '', '']).map((title, idx) => {
                  const isSelected = (kit.youtube_long?.selectedTitleIndex || 0) === idx;
                  const charCount = (title || '').length;
                  const isCopied = copiedKey === `yt-long-title-${idx}`;

                  return (
                    <div
                      key={idx}
                      className={`p-1.5 rounded-lg border transition ${
                        isSelected
                          ? 'bg-slate-950 border-indigo-500/60 shadow-sm'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-400">
                          <input
                            type="radio"
                            name="selectedYtLongTitle"
                            checked={isSelected}
                            onChange={() => updateKit((k) => ({
                              ...k,
                              youtube_long: { ...k.youtube_long, selectedTitleIndex: idx },
                            }))}
                            className="text-indigo-600 focus:ring-indigo-400 h-3 w-3"
                          />
                          <span className={isSelected ? 'text-indigo-300 font-semibold' : 'text-slate-400'}>
                            Option {idx + 1} {isSelected && '• Primary'}
                          </span>
                        </label>

                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-mono ${charCount > 100 ? 'text-amber-400 font-bold' : 'text-slate-500'}`}>
                            {charCount}/100
                          </span>
                          <button
                            onClick={() => handleCopy(title, `yt-long-title-${idx}`, `Long-form Title ${idx + 1} copied`)}
                            aria-label={`Copy Long-form Title Option ${idx + 1}`}
                            className="p-1 rounded hover:bg-slate-850 text-slate-400 hover:text-white transition"
                            title="Copy this title"
                          >
                            {isCopied ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>

                      <input
                        type="text"
                        value={title}
                        onChange={(e) => {
                          const updatedTitles = [...(kit.youtube_long?.titles || ['', '', ''])];
                          updatedTitles[idx] = e.target.value;
                          handleEditField('youtube_long.titles', updatedTitles);
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-[11px] focus:outline-none focus:border-indigo-400"
                        placeholder={`YouTube Long-form Title Option ${idx + 1}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. YouTube Long-form Description */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 flex items-center gap-1 text-[11px]">
                  <FileText className="w-3 h-3 text-sky-400" />
                  <span>Full Video Description</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleRegenerateField('youtube_long.description', 'YouTube Long-form Description')}
                    aria-label="Regenerate YouTube Long-form description"
                    className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-1"
                    title="Regenerate full description only"
                  >
                    <RefreshCw className="w-2.5 h-2.5 text-indigo-400" />
                    <span>Regenerate</span>
                  </button>
                  <button
                    onClick={() => handleCopy(kit.youtube_long?.description || '', 'yt-long-desc', 'Full description copied')}
                    aria-label="Copy YouTube Long-form description"
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
                    title="Copy full description"
                  >
                    {copiedKey === 'yt-long-desc' ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>

              <textarea
                value={kit.youtube_long?.description || ''}
                onChange={(e) => handleEditField('youtube_long.description', e.target.value)}
                rows={6}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 text-[11px] leading-relaxed resize-none focus:outline-none focus:border-indigo-400 font-sans"
                placeholder="Comprehensive educational description explaining the story arc, context, and call to action..."
              />
            </div>

            {/* 3. YouTube Long-form Hashtags */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 flex items-center gap-1 text-[11px]">
                  <Hash className="w-3 h-3 text-emerald-400" />
                  <span>Hashtags (Topic & Category)</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleRegenerateField('youtube_long.hashtags', 'YouTube Long-form Hashtags')}
                    aria-label="Regenerate YouTube Long-form hashtags"
                    className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-1"
                    title="Regenerate hashtags only"
                  >
                    <RefreshCw className="w-2.5 h-2.5 text-emerald-400" />
                    <span>Regenerate</span>
                  </button>
                  <button
                    onClick={() => handleCopy((kit.youtube_long?.hashtags || []).join(' '), 'yt-long-tags', 'Hashtags copied')}
                    aria-label="Copy YouTube Long-form hashtags"
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
                    title="Copy hashtags"
                  >
                    {copiedKey === 'yt-long-tags' ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>

              {/* Tag Pills */}
              <div className="flex flex-wrap gap-1">
                {(kit.youtube_long?.hashtags || []).map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-emerald-400 font-mono"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <input
                type="text"
                value={(kit.youtube_long?.hashtags || []).join(' ')}
                onChange={(e) => {
                  const tags = e.target.value
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((t) => (t.startsWith('#') ? t : `#${t}`));
                  handleEditField('youtube_long.hashtags', tags);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-[11px] font-mono focus:outline-none focus:border-indigo-400"
                placeholder="#Documentary #Story #Education #Topic"
              />
            </div>

            {/* 4. YouTube Long-form Pinned Comment */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 flex items-center gap-1 text-[11px]">
                  <MessageSquare className="w-3 h-3 text-amber-400" />
                  <span>First Comment / Discussion Prompt</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleRegenerateField('youtube_long.pinnedComment', 'YouTube Long-form Comment')}
                    aria-label="Regenerate YouTube Long-form pinned comment"
                    className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-1"
                    title="Regenerate discussion comment only"
                  >
                    <RefreshCw className="w-2.5 h-2.5 text-amber-400" />
                    <span>Regenerate</span>
                  </button>
                  <button
                    onClick={() => handleCopy(kit.youtube_long?.pinnedComment || '', 'yt-long-comment', 'Comment copied')}
                    aria-label="Copy YouTube Long-form comment"
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
                    title="Copy comment"
                  >
                    {copiedKey === 'yt-long-comment' ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>

              <textarea
                value={kit.youtube_long?.pinnedComment || ''}
                onChange={(e) => handleEditField('youtube_long.pinnedComment', e.target.value)}
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 text-[11px] leading-relaxed resize-none focus:outline-none focus:border-indigo-400 font-sans"
                placeholder="In-depth discussion starter for long-form video viewers..."
              />
            </div>

            {/* One-Click Copy Complete YouTube Long-form Package */}
            <button
              onClick={() => handleCopyCompletePackage(SUPPORTED_PLATFORMS.YOUTUBE_LONG)}
              aria-label="Copy Complete YouTube Long-form Package"
              className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition shadow focus-visible:ring-2 focus-visible:ring-indigo-400 focus:outline-none"
            >
              {copiedKey === 'pkg-youtube_long' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>✓ Complete YouTube Long-form Package Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Complete YouTube Long-form Package</span>
                </>
              )}
            </button>

            {/* ============================================================ */}
            {/* 5. YOUTUBE LONG-FORM PUBLISHING CHECKLIST                    */}
            {/* ============================================================ */}
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="font-semibold text-slate-200 text-[11px]">
                    YouTube Long-form Upload Checklist
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ({completedChecklistCount}/{LONG_FORM_CHECKLIST_ITEMS.length})
                  </span>
                </div>

                {completedChecklistCount > 0 && (
                  <button
                    onClick={() => setResetChecklistConfirmPlatform(SUPPORTED_PLATFORMS.YOUTUBE_LONG)}
                    className="p-1 rounded text-slate-500 hover:text-slate-300 text-[10px] flex items-center gap-0.5"
                    title="Reset all checklist items"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-indigo-500 h-full transition-all duration-300"
                  style={{ width: `${(completedChecklistCount / LONG_FORM_CHECKLIST_ITEMS.length) * 100}%` }}
                />
              </div>

              {/* Checklist items list */}
              <div className="space-y-1.5 pt-1">
                {LONG_FORM_CHECKLIST_ITEMS.map((item) => {
                  const isChecked = Boolean(platformChecklist[item.id]);

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleToggleChecklistItem(SUPPORTED_PLATFORMS.YOUTUBE_LONG, item.id)}
                      className={`p-2 rounded-lg border transition cursor-pointer flex items-start gap-2 ${
                        isChecked
                          ? 'bg-slate-950/80 border-slate-800 text-slate-300'
                          : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:border-slate-800'
                      }`}
                    >
                      <button
                        type="button"
                        aria-label={`Toggle ${item.label}`}
                        className={`mt-0.5 flex-shrink-0 ${
                          isChecked ? 'text-indigo-400' : 'text-slate-600'
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-3.5 h-3.5" />
                        ) : (
                          <Square className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] font-medium ${isChecked ? 'line-through text-slate-400' : 'text-slate-200'}`}>
                          {item.label}
                        </p>
                        <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* MODAL 1: MARK AS PUBLISHED CONFIRMATION                      */}
      {/* ============================================================ */}
      {publishConfirmPlatform && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-4 space-y-3 shadow-2xl">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span>Mark as Published?</span>
            </div>

            <p className="text-slate-300 text-xs leading-relaxed">
              Mark this project as Published on <span className="font-semibold text-white">
                {publishConfirmPlatform === SUPPORTED_PLATFORMS.YOUTUBE_LONG
                  ? 'YouTube Long-form'
                  : publishConfirmPlatform === SUPPORTED_PLATFORMS.YOUTUBE
                  ? 'YouTube Shorts'
                  : 'TikTok'}
              </span>?
            </p>

            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
              This only records your manual confirmation; it does not upload or verify the video with external servers.
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setPublishConfirmPlatform(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPublished}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1 transition shadow"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirm Published</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: RESET CHECKLIST CONFIRMATION                        */}
      {/* ============================================================ */}
      {resetChecklistConfirmPlatform && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-4 space-y-3 shadow-2xl">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>Reset Checklist?</span>
            </div>

            <p className="text-slate-300 text-xs leading-relaxed">
              Are you sure you want to uncheck all items in the {resetChecklistConfirmPlatform === SUPPORTED_PLATFORMS.YOUTUBE_LONG ? 'YouTube Long-form' : resetChecklistConfirmPlatform === SUPPORTED_PLATFORMS.YOUTUBE ? 'YouTube Shorts' : 'TikTok'} upload checklist?
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setResetChecklistConfirmPlatform(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmResetChecklist}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs flex items-center gap-1 transition shadow"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Checklist</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: AI PROMPT EXPORT (ChatGPT / Claude)                 */}
      {/* ============================================================ */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-4 space-y-3 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200 text-sm flex items-center gap-1.5">
                <Send className="w-4 h-4 text-sky-400" />
                <span>AI Prompt for ChatGPT / Claude</span>
              </span>
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-400 text-xs leading-relaxed">
              Copy this prompt to ChatGPT or Claude webview if you prefer generating creative publishing variants with external models. The prompt contains strict anti-hallucination rules and formatted JSON output.
            </p>

            <textarea
              readOnly
              value={buildPublishingAiPrompt(project)}
              rows={8}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-300 font-mono text-[11px] leading-relaxed resize-none focus:outline-none"
            />

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
              >
                Close
              </button>
              <button
                onClick={handleCopyAiPrompt}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs flex items-center gap-1.5 transition"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy AI Prompt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 4: AI RESPONSE IMPORT                                  */}
      {/* ============================================================ */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-4 space-y-3 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200 text-sm flex items-center gap-1.5">
                <ClipboardPaste className="w-4 h-4 text-emerald-400" />
                <span>Import AI Publishing Output</span>
              </span>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-400 text-xs leading-relaxed">
              Paste the raw JSON or code block output from ChatGPT or Claude to populate your Publishing Kit:
            </p>

            <textarea
              value={rawAiInput}
              onChange={(e) => setRawAiInput(e.target.value)}
              placeholder="Paste JSON or markdown code block here..."
              rows={8}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono text-[11px] leading-relaxed resize-none focus:outline-none focus:border-emerald-400"
            />

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleImportAiResponse}
                disabled={!rawAiInput.trim()}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-1.5 transition"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Import Package</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
