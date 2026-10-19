import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Sparkles, 
  Clapperboard, 
  RotateCw, 
  ShieldCheck, 
  Cpu,
  KeyRound,
  Loader2,
  Cookie,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import { MODES, SESSION_PARTITION } from '../constants';
import CookieImportModal from './CookieImportModal';

export default function TopNav({ activeMode, setActiveMode, onReloadActive, onReloadAll }) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isCookieModalOpen, setIsCookieModalOpen] = useState(false);
  const [authStatus, setAuthStatus] = useState(null);

  useEffect(() => {
    if (authStatus) {
      const timer = setTimeout(() => {
        setAuthStatus(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [authStatus]);

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
      setAuthStatus(null);
      try {
        const result = await window.electronAPI.openGoogleLogin();
        if (result && result.loggedIn) {
          setAuthStatus({
            type: 'success',
            message: 'Login Google berhasil! Sesi login terdeteksi dan tersimpan.',
          });
          if (onReloadAll) {
            onReloadAll();
          } else if (onReloadActive) {
            onReloadActive();
          }
        } else if (result && result.success === false) {
          setAuthStatus({
            type: 'error',
            message: result.error ? `Gagal memuat: ${result.error}` : 'Login Google gagal dimuat.',
          });
        } else {
          setAuthStatus({
            type: 'warning',
            message: 'Popup login ditutup tanpa mendeteksi sesi Google aktif (SID). Jika diblokir Google, gunakan Import Cookies.',
          });
        }
      } catch (err) {
        console.error('Failed to run Google login popup:', err);
        setAuthStatus({
          type: 'error',
          message: err.message || 'Terjadi kesalahan saat membuka login Google.',
        });
      } finally {
        setIsLoggingIn(false);
      }
    } else {
      const authUrl = 'https://accounts.google.com/ServiceLogin?hl=id';
      if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
        window.electronAPI.openExternal(authUrl);
      } else {
        window.open(authUrl, '_blank', 'width=650,height=750');
      }
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
          {/* 100% Guaranteed Fallback: Cookie Importer Modal */}
          <button
            onClick={() => setIsCookieModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md transition-all bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white border border-amber-500/40 hover:shadow-amber-500/20 active:scale-95"
            title="Import cookies exported from real Chrome (Cookie-Editor / EditThisCookie) for 100% guaranteed login"
          >
            <Cookie className="w-3.5 h-3.5 text-amber-200" />
            <span>🍪 Import Cookies</span>
          </button>

          {/* Standalone Google Auth Popup */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md transition-all ${
              isLoggingIn
                ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-wait animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 active:scale-95'
            }`}
            title="Opens a native Google Auth popup with clean sandbox partition."
          >
            {isLoggingIn ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <KeyRound className="w-3.5 h-3.5 text-sky-400" />
            )}
            <span>{isLoggingIn ? 'Popup...' : '🔑 Google Login'}</span>
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

      {/* Toast Notification for Google Login */}
      {authStatus && (
        <div className="fixed top-16 right-4 z-50 max-w-md animate-in fade-in slide-in-from-top-2 duration-200">
          <div className={`p-3 rounded-xl border shadow-xl flex items-start gap-2.5 text-xs ${
            authStatus.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-800 text-emerald-200'
              : authStatus.type === 'error'
              ? 'bg-rose-950/90 border-rose-800 text-rose-200'
              : 'bg-amber-950/90 border-amber-800 text-amber-200'
          }`}>
            {authStatus.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />}
            {authStatus.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />}
            {authStatus.type === 'warning' && <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />}
            <span className="flex-1 leading-relaxed">{authStatus.message}</span>
            <button
              onClick={() => setAuthStatus(null)}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Cookie Importer Modal */}
      <CookieImportModal
        isOpen={isCookieModalOpen}
        onClose={() => setIsCookieModalOpen(false)}
        onReloadAll={onReloadAll || onReloadActive}
      />
    </>
  );
}
