import React, { useState, useEffect } from 'react';
import TopNav from './components/TopNav';
import StatusBar from './components/StatusBar';
import WebviewWrapper from './components/WebviewWrapper';
import PipelineSidebar from './components/PipelineSidebar';
import { MODES, WEBVIEWS } from './constants';
import { isPlatformEnabled, SUPPORTED_PLATFORMS } from './utils/publishingKitGenerator';

export default function App() {
  const [activeMode, setActiveMode] = useState(MODES.ANALYTICS);
  const [publishingWorkspace, setPublishingWorkspace] = useState(null); // null | 'youtube'

  const handleSetMode = (mode) => {
    setPublishingWorkspace(null);
    setActiveMode(mode);
  };

  const normalizeCounter = (val) => {
    const num = parseInt(val, 10);
    return isNaN(num) ? 0 : Math.max(0, Math.min(4, num));
  };

  const [geminiCounter, setGeminiCounterState] = useState(() => {
    try {
      const saved = localStorage.getItem('aimc_gemini_counter');
      return normalizeCounter(saved ?? 0);
    } catch {
      return 0;
    }
  });

  const setGeminiCounter = (updater) => {
    setGeminiCounterState((prev) => {
      const nextVal = typeof updater === 'function' ? updater(prev) : updater;
      return normalizeCounter(nextVal);
    });
  };

  useEffect(() => {
    try {
      localStorage.setItem('aimc_gemini_counter', String(geminiCounter));
    } catch {}
  }, [geminiCounter]);

  const handleReloadActive = () => {
    // Reload active webviews based on publishing workspace or mode
    let ids = [];
    if (publishingWorkspace === 'youtube') {
      ids = [WEBVIEWS.YOUTUBE.id];
    } else if (activeMode === MODES.ANALYTICS) {
      ids = [WEBVIEWS.YOUTUBE.id, WEBVIEWS.CLAUDE.id];
    } else if (activeMode === MODES.PROMPT_ENGINEERING) {
      ids = [WEBVIEWS.CLAUDE.id, WEBVIEWS.CHATGPT.id];
    } else if (activeMode === MODES.VISUAL_STUDIO) {
      ids = [WEBVIEWS.GEMINI.id, WEBVIEWS.GOOGLE_FLOW.id];
    }

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el && typeof el.reload === 'function') {
        el.reload();
      }
    });
  };

  const handleReloadAll = () => {
    Object.values(WEBVIEWS).forEach((item) => {
      const el = document.getElementById(item.id);
      if (el && typeof el.reload === 'function') {
        el.reload();
      }
    });
  };

  // Helper to determine CSS classes and flex order for each element without ever unmounting them
  const getElementLayout = (elementId) => {
    // Publishing Workspace View: Keeps PipelineSidebar on the left and the platform webview on the right
    if (publishingWorkspace) {
      if (elementId === 'sidebar') {
        return { visible: true, className: 'w-[28%] min-w-[320px] max-w-[420px] flex', order: 1 };
      }
      if (publishingWorkspace === 'youtube' && elementId === WEBVIEWS.YOUTUBE.id) {
        return { visible: true, className: 'flex-1 flex', order: 2 };
      }
      return { visible: false, className: 'hidden', order: 99 };
    }

    switch (activeMode) {
      case MODES.ANALYTICS:
        if (elementId === WEBVIEWS.YOUTUBE.id) {
          return { visible: true, className: 'w-[45%] flex', order: 1 };
        }
        if (elementId === WEBVIEWS.CLAUDE.id) {
          return { visible: true, className: 'w-[55%] flex', order: 2 };
        }
        return { visible: false, className: 'hidden', order: 99 };

      case MODES.PROMPT_ENGINEERING:
        if (elementId === WEBVIEWS.CLAUDE.id) {
          return { visible: true, className: 'w-[45%] flex', order: 1 };
        }
        if (elementId === 'sidebar') {
          return { visible: true, className: 'flex', order: 2 };
        }
        if (elementId === WEBVIEWS.CHATGPT.id) {
          return { visible: true, className: 'flex-1 flex', order: 3 };
        }
        return { visible: false, className: 'hidden', order: 99 };

      case MODES.VISUAL_STUDIO:
        if (elementId === 'sidebar') {
          return { visible: true, className: 'w-[25%] min-w-[300px] max-w-[400px] flex', order: 1 };
        }
        if (elementId === WEBVIEWS.GEMINI.id) {
          return { visible: true, className: 'flex-1 flex', order: 2 };
        }
        if (elementId === WEBVIEWS.GOOGLE_FLOW.id) {
          return { visible: true, className: 'flex-1 flex', order: 3 };
        }
        return { visible: false, className: 'hidden', order: 99 };

      default:
        return { visible: false, className: 'hidden', order: 99 };
    }
  };

  const ytLayout = getElementLayout(WEBVIEWS.YOUTUBE.id);
  const claudeLayout = getElementLayout(WEBVIEWS.CLAUDE.id);
  const chatgptLayout = getElementLayout(WEBVIEWS.CHATGPT.id);
  const geminiLayout = getElementLayout(WEBVIEWS.GEMINI.id);
  const flowLayout = getElementLayout(WEBVIEWS.GOOGLE_FLOW.id);
  const tiktokLayout = getElementLayout(WEBVIEWS.TIKTOK.id);
  const sidebarLayout = getElementLayout('sidebar');

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 select-none">
      {/* Top Navigation Bar */}
      <TopNav
        activeMode={activeMode}
        setActiveMode={handleSetMode}
        onReloadActive={handleReloadActive}
        onReloadAll={handleReloadAll}
      />

      {/* Main Workspace Area (Holds all persistent components) */}
      <main className="flex-1 w-full flex overflow-hidden relative">
        {/* 1. YouTube Studio Webview */}
        <WebviewWrapper
          id={WEBVIEWS.YOUTUBE.id}
          name={WEBVIEWS.YOUTUBE.name}
          url={WEBVIEWS.YOUTUBE.url}
          badge={WEBVIEWS.YOUTUBE.badge}
          badgeColor={WEBVIEWS.YOUTUBE.badgeColor}
          className={ytLayout.className}
          orderStyle={{ order: ytLayout.order }}
        />

        {/* 2. Claude Webview (Preserved across Mode 1 and Mode 2) */}
        <WebviewWrapper
          id={WEBVIEWS.CLAUDE.id}
          name={WEBVIEWS.CLAUDE.name}
          url={WEBVIEWS.CLAUDE.url}
          badge={WEBVIEWS.CLAUDE.badge}
          badgeColor={WEBVIEWS.CLAUDE.badgeColor}
          className={claudeLayout.className}
          orderStyle={{ order: claudeLayout.order }}
        />

        {/* Persistent Pipeline Sidebar (Visible in Mode 2, Mode 3, and Publishing Workspace) */}
        <PipelineSidebar
          activeMode={activeMode}
          geminiCounter={geminiCounter}
          setGeminiCounter={setGeminiCounter}
          className={sidebarLayout.className}
          orderStyle={{ order: sidebarLayout.order }}
          publishingWorkspace={publishingWorkspace}
          onOpenPlatformWorkspace={(platform) => {
            if (platform === 'youtube' || platform === 'youtube_long' || platform === 'youtube_shorts') {
              setPublishingWorkspace('youtube');
            } else if (isPlatformEnabled(platform)) {
              setPublishingWorkspace(platform);
            }
          }}
          onClosePlatformWorkspace={() => setPublishingWorkspace(null)}
        />

        {/* 3. ChatGPT Webview */}
        <WebviewWrapper
          id={WEBVIEWS.CHATGPT.id}
          name={WEBVIEWS.CHATGPT.name}
          url={WEBVIEWS.CHATGPT.url}
          badge={WEBVIEWS.CHATGPT.badge}
          badgeColor={WEBVIEWS.CHATGPT.badgeColor}
          className={chatgptLayout.className}
          orderStyle={{ order: chatgptLayout.order }}
        />

        {/* 4. Gemini Webview */}
        <WebviewWrapper
          id={WEBVIEWS.GEMINI.id}
          name={WEBVIEWS.GEMINI.name}
          url={WEBVIEWS.GEMINI.url}
          badge={WEBVIEWS.GEMINI.badge}
          badgeColor={WEBVIEWS.GEMINI.badgeColor}
          className={geminiLayout.className}
          orderStyle={{ order: geminiLayout.order }}
        />

        {/* 5. Google Flow Webview */}
        <WebviewWrapper
          id={WEBVIEWS.GOOGLE_FLOW.id}
          name={WEBVIEWS.GOOGLE_FLOW.name}
          url={WEBVIEWS.GOOGLE_FLOW.url}
          badge={WEBVIEWS.GOOGLE_FLOW.badge}
          badgeColor={WEBVIEWS.GOOGLE_FLOW.badgeColor}
          className={flowLayout.className}
          orderStyle={{ order: flowLayout.order }}
        />

        {/* 6. TikTok Webview (Strictly disabled: never mounted into DOM) */}
        {isPlatformEnabled(SUPPORTED_PLATFORMS.TIKTOK) && publishingWorkspace === 'tiktok' && (
          <WebviewWrapper
            id={WEBVIEWS.TIKTOK.id}
            name={WEBVIEWS.TIKTOK.name}
            url={WEBVIEWS.TIKTOK.url}
            badge={WEBVIEWS.TIKTOK.badge}
            badgeColor={WEBVIEWS.TIKTOK.badgeColor}
            className={tiktokLayout.className}
            orderStyle={{ order: tiktokLayout.order }}
          />
        )}
      </main>

      {/* Bottom Status & Quota Bar */}
      <StatusBar
        geminiCounter={geminiCounter}
        setGeminiCounter={setGeminiCounter}
        maxGemini={4}
      />
    </div>
  );
}
