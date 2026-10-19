import React, { useRef, useState, useEffect } from 'react';
import { 
  RotateCw, 
  ArrowLeft, 
  ArrowRight, 
  ExternalLink, 
  Loader2,
  Lock,
  Globe
} from 'lucide-react';
import { CHROME_USER_AGENT, SESSION_PARTITION } from '../constants';

export default function WebviewWrapper({
  id,
  name,
  url,
  badge,
  badgeColor,
  className = '',
  orderStyle = {},
}) {
  const webviewRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(url);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleStartLoading = () => setIsLoading(true);
    const handleStopLoading = () => {
      setIsLoading(false);
      try {
        setCanGoBack(webview.canGoBack ? webview.canGoBack() : false);
        setCanGoForward(webview.canGoForward ? webview.canGoForward() : false);
        setCurrentUrl(webview.getURL ? webview.getURL() : url);
      } catch (e) {
        // Safe fallback
      }
    };

    const handleFailLoad = (event) => {
      setIsLoading(false);
      console.warn(`[Webview ${name}] Failed to load:`, event);
    };

    webview.addEventListener('did-start-loading', handleStartLoading);
    webview.addEventListener('did-stop-loading', handleStopLoading);
    webview.addEventListener('did-fail-load', handleFailLoad);

    return () => {
      webview.removeEventListener('did-start-loading', handleStartLoading);
      webview.removeEventListener('did-stop-loading', handleStopLoading);
      webview.removeEventListener('did-fail-load', handleFailLoad);
    };
  }, [name, url]);

  const handleReload = () => {
    if (webviewRef.current && webviewRef.current.reload) {
      webviewRef.current.reload();
    }
  };

  const handleBack = () => {
    if (webviewRef.current && webviewRef.current.goBack && canGoBack) {
      webviewRef.current.goBack();
    }
  };

  const handleForward = () => {
    if (webviewRef.current && webviewRef.current.goForward && canGoForward) {
      webviewRef.current.goForward();
    }
  };

  const handleOpenExternal = () => {
    if (webviewRef.current && webviewRef.current.getURL) {
      const liveUrl = webviewRef.current.getURL() || url;
      window.open(liveUrl, '_blank');
    }
  };

  const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron);
  const stealthPreloadUrl = typeof window !== 'undefined' ? window.electronAPI?.stealthPreloadUrl : undefined;
  const canRenderWebview = !isElectron || Boolean(stealthPreloadUrl);

  return (
    <div 
      id={`container-${id}`}
      style={orderStyle}
      className={`h-full border-r border-slate-800/80 bg-slate-950 flex-col overflow-hidden relative ${className}`}
    >
      {/* Top Window Bar for this Webview */}
      <div className="h-8 bg-slate-900/90 border-b border-slate-800/80 px-2.5 flex items-center justify-between text-xs select-none flex-shrink-0">
        {/* Title & Badge */}
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="flex items-center gap-1.5 font-medium text-slate-200 truncate">
            <Globe className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="truncate">{name}</span>
          </div>
          {badge && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono font-medium truncate ${badgeColor}`}>
              {badge}
            </span>
          )}
        </div>

        {/* Browser Navigation & Control Buttons */}
        <div className="flex items-center gap-1">
          {isLoading && (
            <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin mr-1" />
          )}

          <button
            onClick={handleBack}
            disabled={!canGoBack}
            className={`p-1 rounded hover:bg-slate-800 text-slate-400 transition ${!canGoBack ? 'opacity-30 cursor-not-allowed' : 'hover:text-slate-200'}`}
            title="Go Back"
          >
            <ArrowLeft className="w-3 h-3" />
          </button>

          <button
            onClick={handleForward}
            disabled={!canGoForward}
            className={`p-1 rounded hover:bg-slate-800 text-slate-400 transition ${!canGoForward ? 'opacity-30 cursor-not-allowed' : 'hover:text-slate-200'}`}
            title="Go Forward"
          >
            <ArrowRight className="w-3 h-3" />
          </button>

          <button
            onClick={handleReload}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
            title="Reload Webview"
          >
            <RotateCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
          </button>

          <button
            onClick={handleOpenExternal}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
            title="Open in System Browser"
          >
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Persistent Electron Webview Instance */}
      <div className="flex-1 w-full h-full relative bg-slate-950">
        {canRenderWebview ? (
          <webview
            id={id}
            ref={webviewRef}
            src={url}
            partition={SESSION_PARTITION}
            useragent={CHROME_USER_AGENT || undefined}
            preload={stealthPreloadUrl}
            allowpopups="true"
            style={{ width: '100%', height: '100%', display: 'flex' }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500 text-xs">
            <Loader2 className="w-4 h-4 animate-spin mr-2 text-sky-400" />
            <span>Memuat konfigurasi webview...</span>
          </div>
        )}
      </div>
    </div>
  );
}
