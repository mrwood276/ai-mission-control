import React, { useRef, useState, useEffect } from 'react';
import { 
  RotateCw, 
  ArrowLeft, 
  ArrowRight, 
  ExternalLink, 
  Loader2,
  Globe,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { SESSION_PARTITION } from '../constants';

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
  const [loadError, setLoadError] = useState(null);
  const [currentUrl, setCurrentUrl] = useState(url);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleStartLoading = () => {
      setIsLoading(true);
      setLoadError(null);
    };

    const handleStopLoading = () => {
      setIsLoading(false);
      try {
        setCanGoBack(webview.canGoBack ? webview.canGoBack() : false);
        setCanGoForward(webview.canGoForward ? webview.canGoForward() : false);
        setCurrentUrl(webview.getURL ? webview.getURL() : url);
      } catch {
        // Safe fallback
      }
    };

    const handleFailLoad = (event) => {
      setIsLoading(false);
      // Ignore normal navigation redirect aborts (code -3)
      if (event.errorCode !== -3 && event.isMainFrame) {
        setLoadError(event.errorDescription || `Error ${event.errorCode}`);
      }
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
    setLoadError(null);
    if (webviewRef.current && typeof webviewRef.current.reload === 'function') {
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
    const liveUrl = (webviewRef.current && webviewRef.current.getURL ? webviewRef.current.getURL() : '') || url;
    if (!liveUrl) return;
    if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
      window.electronAPI.openExternal(liveUrl);
    } else {
      window.open(liveUrl, '_blank', 'noopener,noreferrer');
    }
  };

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
            <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin mr-1" aria-label="Loading page" />
          )}

          <button
            onClick={handleBack}
            disabled={!canGoBack}
            aria-label={`Go back in ${name}`}
            className={`p-1 rounded hover:bg-slate-800 text-slate-400 transition focus-visible:ring-1 focus-visible:ring-sky-400 focus:outline-none ${!canGoBack ? 'opacity-30 cursor-not-allowed' : 'hover:text-slate-200'}`}
            title="Go Back"
          >
            <ArrowLeft className="w-3 h-3" />
          </button>

          <button
            onClick={handleForward}
            disabled={!canGoForward}
            aria-label={`Go forward in ${name}`}
            className={`p-1 rounded hover:bg-slate-800 text-slate-400 transition focus-visible:ring-1 focus-visible:ring-sky-400 focus:outline-none ${!canGoForward ? 'opacity-30 cursor-not-allowed' : 'hover:text-slate-200'}`}
            title="Go Forward"
          >
            <ArrowRight className="w-3 h-3" />
          </button>

          <button
            onClick={handleReload}
            aria-label={`Reload ${name}`}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition focus-visible:ring-1 focus-visible:ring-sky-400 focus:outline-none"
            title="Reload Webview"
          >
            <RotateCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
          </button>

          <button
            onClick={handleOpenExternal}
            aria-label={`Open ${name} in external browser`}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition focus-visible:ring-1 focus-visible:ring-sky-400 focus:outline-none"
            title="Open in System Browser"
          >
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Persistent Electron Webview Instance */}
      <div className="flex-1 w-full h-full relative bg-slate-950">
        <webview
          id={id}
          ref={webviewRef}
          src={url}
          partition={SESSION_PARTITION}
          allowpopups="true"
          style={{ width: '100%', height: '100%', display: 'flex' }}
        />

        {/* Failed Navigation / Offline Overlay */}
        {loadError && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h4 className="font-semibold text-sm text-slate-200 mb-1">
              Failed to load {name}
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mb-4 font-mono leading-relaxed">
              {loadError}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
              >
                <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
                <span>Retry</span>
              </button>
              <button
                onClick={handleOpenExternal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Browser</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
