import React, { useState } from 'react';
import { 
  BarChart3, 
  Sparkles, 
  Clapperboard, 
  RotateCw, 
  ShieldCheck, 
  Cpu,
  KeyRound,
  Loader2
} from 'lucide-react';
import { MODES, SESSION_PARTITION } from '../constants';

export default function TopNav({ activeMode, setActiveMode, onReloadActive, onReloadAll }) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);

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

  const handleGoogleLogin = async () => {
    if (window.electronAPI && window.electronAPI.openGoogleLogin) {
      setIsLoggingIn(true);
      try {
        await window.electronAPI.openGoogleLogin();
        // Popup window closed. Reload webviews so all Google services immediately reflect login cookies!
        if (onReloadAll) {
          onReloadAll();
        } else if (onReloadActive) {
          onReloadActive();
        }
      } catch (err) {
        console.error('Failed to run Google login popup:', err);
      } finally {
        setIsLoggingIn(false);
      }
    } else {
      window.open('https://accounts.google.com/ServiceLogin?hl=id', '_blank', 'width=650,height=750');
    }
  };

  return (
    <header className="h-14 bg-slate-950/95 border-b border-slate-800/80 px-4 flex items-center justify-between z-50 select-none backdrop-blur shadow-lg flex-shrink-0">
      {/* Brand / Title */}
      <div className="flex items-center gap-3 min-w-[220px]">
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
      <div className="flex items-center gap-2.5 min-w-[260px] justify-end">
        {/* The Ultimate Bypass: Standalone Google Auth Popup */}
        <button
          onClick={handleGoogleLogin}
          disabled={isLoggingIn}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md transition-all ${
            isLoggingIn
              ? 'bg-amber-600/50 text-amber-200 border border-amber-500/50 cursor-wait animate-pulse'
              : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 hover:shadow-orange-500/20 active:scale-95'
          }`}
          title="Opens a native Google Auth popup sharing the clean session partition. Sign in there, close it, and all webviews will be signed in without 'browser not secure' blocks!"
        >
          {isLoggingIn ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <KeyRound className="w-3.5 h-3.5" />
          )}
          <span>{isLoggingIn ? 'Popup Active...' : '🔑 Google Login'}</span>
        </button>

        {/* Clean Session Partition Badge */}
        <div 
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/40 border border-emerald-800/50 text-[11px] text-emerald-300 font-mono cursor-help"
          title={`All webviews share partition='${SESSION_PARTITION}' so authenticated sessions are preserved permanently.`}
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
  );
}
