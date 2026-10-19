import React, { useState } from 'react';
import { 
  BarChart3, 
  Sparkles, 
  Clapperboard, 
  RotateCw, 
  ShieldCheck, 
  Cpu,
  Info,
  ExternalLink,
  X,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { MODES, SESSION_PARTITION, WEBVIEWS } from '../constants';

export default function TopNav({ activeMode, setActiveMode, onReloadActive, onReloadAll }) {
  const [isAuthHelpOpen, setIsAuthHelpOpen] = useState(false);

  const navItems = [
    {
      id: MODES.ANALYTICS,
      number: '1',
      title: 'Analytics & Ideation',
      subtitle: 'YouTube Studio + Claude',
      icon: BarChart3,
    },
    {
      id: MODES.PROMPT_ENGINEERING,
      number: '2',
      title: 'Prompt Engineering',
      subtitle: 'Claude + ChatGPT + Parser',
      icon: Sparkles,
    },
    {
      id: MODES.VISUAL_STUDIO,
      number: '3',
      title: 'Visual Studio',
      subtitle: 'Scene Cards + Gemini + Flow',
      icon: Clapperboard,
    },
  ];

  const handleOpenExternal = (url) => {
    if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <>
      <header className="h-14 bg-slate-950/95 border-b border-slate-800/80 px-4 flex items-center justify-between z-40 select-none backdrop-blur shadow-lg flex-shrink-0">
        {/* Brand / Title */}
        <div className="flex items-center gap-3 min-w-[200px]">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-sky-500 shadow-md shadow-indigo-500/20 text-white">
            <Cpu className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wider text-slate-100 uppercase">
                Creator Pipeline
              </span>
              <span className="text-[10px] font-semibold tracking-widest px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                v1.0
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              Mission Control Active
            </p>
          </div>
        </div>

        {/* Mode Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800/80 shadow-inner">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeMode === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveMode(item.id)}
                className={`group relative flex items-center gap-3 px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  isActive
                    ? `bg-slate-800/95 text-white shadow-md border border-slate-700/60`
                    : `text-slate-400 hover:text-slate-200 hover:bg-slate-800/40`
                }`}
              >
                <div
                  className={`flex items-center justify-center w-6 h-6 rounded-md transition-colors ${
                    isActive
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                      : 'bg-slate-800 text-slate-400 group-hover:text-slate-300'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>

                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold">{item.title}</span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 group-hover:text-slate-400 font-normal">
                    {item.subtitle}
                  </div>
                </div>

                {isActive && (
                  <div className="absolute inset-x-0 -bottom-1 h-0.5 bg-gradient-to-r from-transparent via-sky-400 to-transparent"></div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Status & Actions */}
        <div className="flex items-center gap-2 min-w-[320px] justify-end">
          {/* Sign-In & Authentication Guidance */}
          <button
            onClick={() => setIsAuthHelpOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md transition-all bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 active:scale-95"
            title="View supported sign-in flows and external browser alternatives"
          >
            <Info className="w-3.5 h-3.5 text-sky-400" />
            <span>Sign-In Info</span>
          </button>

          {/* Session Partition Badge */}
          <div 
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/40 border border-emerald-800/50 text-[11px] text-emerald-300 font-mono cursor-help"
            title={`Persistent partition: '${SESSION_PARTITION}'. Session data and local storage remain isolated and preserved.`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{SESSION_PARTITION}</span>
          </div>

          {/* Global Reload Helper */}
          <button
            onClick={onReloadActive}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 transition"
            title="Reload active webviews"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Sign-In & Authentication Guidance Modal */}
      {isAuthHelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-slate-100">
                    Authentication & Sign-In Guidance
                  </h3>
                  <p className="text-xs text-slate-400">
                    Supported login flows and security limitations
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAuthHelpOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto text-xs text-slate-300">
              {/* Claude & ChatGPT Direct Flow */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 font-medium text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Supported Embedded Flows (Claude & ChatGPT)</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Claude (<span className="text-slate-200 font-mono">claude.ai</span>) and ChatGPT (<span className="text-slate-200 font-mono">chatgpt.com</span>) support direct in-webview sign-in using email, password, or magic link authentication. Their session states are automatically stored in the persistent desktop session partition.
                </p>
              </div>

              {/* Google Embedded Browser Limitation */}
              <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-800/40 space-y-2">
                <div className="flex items-center gap-2 font-medium text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Google Embedded Sign-In Limitation</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Google enforces an anti-embedded-browser security policy (&quot;This browser or app may not be secure&quot;) that restricts signing into Google Accounts from within Electron webviews. AI Mission Control does not circumvent or tamper with third-party authentication protections.
                </p>
              </div>

              {/* External Browser Alternatives */}
              <div className="space-y-2">
                <span className="font-medium text-slate-200">
                  Ordinary Browser Alternatives
                </span>
                <p className="text-slate-400">
                  If an embedded flow is blocked by service policy, use your regular system browser to access the service:
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => handleOpenExternal(WEBVIEWS.YOUTUBE.url)}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-left transition"
                  >
                    <span className="font-medium text-slate-200">{WEBVIEWS.YOUTUBE.name}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <button
                    onClick={() => handleOpenExternal(WEBVIEWS.GEMINI.url)}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-left transition"
                  >
                    <span className="font-medium text-slate-200">{WEBVIEWS.GEMINI.name}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <button
                    onClick={() => handleOpenExternal(WEBVIEWS.CLAUDE.url)}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-left transition"
                  >
                    <span className="font-medium text-slate-200">{WEBVIEWS.CLAUDE.name}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <button
                    onClick={() => handleOpenExternal(WEBVIEWS.CHATGPT.url)}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-left transition"
                  >
                    <span className="font-medium text-slate-200">{WEBVIEWS.CHATGPT.name}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/60 flex justify-end">
              <button
                onClick={() => setIsAuthHelpOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
