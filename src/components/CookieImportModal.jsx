import React, { useState } from 'react';
import { 
  Cookie, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Clipboard, 
  Trash2, 
  ExternalLink,
  ShieldAlert,
  Sparkles
} from 'lucide-react';

export default function CookieImportModal({ isOpen, onClose, onReloadAll }) {
  const [cookieJson, setCookieJson] = useState('');
  const [status, setStatus] = useState({ type: null, message: '', count: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setCookieJson(text);
      setStatus({ type: null, message: '', count: 0 });
    } catch (err) {
      console.warn('Clipboard read failed:', err);
    }
  };

  const handleClear = () => {
    setCookieJson('');
    setStatus({ type: null, message: '', count: 0 });
  };

  // Quick live validation & preview
  let previewStats = null;
  if (cookieJson.trim()) {
    try {
      const parsed = JSON.parse(cookieJson.trim());
      if (Array.isArray(parsed)) {
        const domains = [...new Set(parsed.map(c => c.domain).filter(Boolean))];
        previewStats = {
          valid: true,
          count: parsed.length,
          domains: domains.slice(0, 4).join(', ') + (domains.length > 4 ? ` (+${domains.length - 4} more)` : ''),
        };
      } else {
        previewStats = { valid: false, error: 'JSON harus berupa Array [ ... ]' };
      }
    } catch (e) {
      previewStats = { valid: false, error: 'Format JSON belum lengkap atau ada syntax error' };
    }
  }

  const handleImport = async () => {
    if (!cookieJson.trim()) {
      setStatus({ type: 'error', message: 'Silakan paste JSON cookie terlebih dahulu.' });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: null, message: '' });

    try {
      if (!window.electronAPI) {
        setStatus({
          type: 'error',
          message:
            'Aplikasi saat ini dibuka di browser biasa (Chrome/Edge), bukan di jendela desktop Electron. Pastikan Anda membuka aplikasi lewat jendela desktop Electron ("npm run dev" atau "npm start").',
        });
        return;
      }

      if (typeof window.electronAPI.importCookies !== 'function') {
        setStatus({
          type: 'error',
          message: 'Fungsi window.electronAPI.importCookies tidak ditemukan di preload script.',
        });
        return;
      }

      const result = await window.electronAPI.importCookies(cookieJson.trim());
      if (result.success) {
        let isGoogleLogged = Boolean(result.googleLoginDetected);
        if (!isGoogleLogged && typeof window.electronAPI.checkGoogleAuth === 'function') {
          try {
            const authCheck = await window.electronAPI.checkGoogleAuth();
            isGoogleLogged = Boolean(authCheck.loggedIn);
          } catch (e) {}
        }

        const failedList = result.failedCookies || [];
        const hasFailed = failedList.length > 0;

        setStatus({
          type: hasFailed ? 'warning' : 'success',
          message: `Berhasil menginjeksi ${result.injected || result.count} cookies (${result.count} total).`,
          count: result.count,
          failedCookies: failedList,
          googleLoginDetected: isGoogleLogged,
        });

        // Reload all webviews so YouTube Studio / Gemini / Flow pick up login session immediately!
        setTimeout(() => {
          if (onReloadAll) onReloadAll();
        }, 500);

        // Auto close only if fully successful and Google login detected
        if (!hasFailed && isGoogleLogged) {
          setTimeout(() => {
            onClose();
          }, 2400);
        }
      } else {
        setStatus({
          type: 'error',
          message: result.error || 'Gagal mengimpor cookies.',
        });
      }
    } catch (err) {
      setStatus({
        type: 'error',
        message: err.message || 'Terjadi kesalahan saat memproses cookies.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Cookie className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-100 flex items-center gap-2">
                Cookie Bridge Importer
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono font-medium">
                  100% Guaranteed Bypass
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Impor session cookies langsung dari Chrome browser asli Anda tanpa login di Electron.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Instructions Guide */}
        <div className="px-5 py-3 bg-slate-950/60 border-b border-slate-800/80 text-xs text-slate-300">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex flex-col gap-1">
              <span className="font-bold text-[11px] text-amber-400">Langkah 1: Ekstensi</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Install <b>Cookie-Editor</b> atau <b>EditThisCookie</b> di browser Google Chrome / Edge biasa.
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex flex-col gap-1">
              <span className="font-bold text-[11px] text-amber-400">Langkah 2: Export JSON (Incognito)</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Buka <b>youtube.com</b> & <b>google.com</b> di jendela <b>Incognito</b>, klik <b>Export (JSON)</b>, lalu <b>langsung tutup jendelanya</b> (Google merotasi cookie di tab yang masih terbuka, jadi cookie cepat tidak valid).
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex flex-col gap-1">
              <span className="font-bold text-[11px] text-emerald-400">Langkah 3: Paste & Inject</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Paste JSON di bawah dan klik <b>Inject Cookies</b>. Semua webview otomatis ter-login!
              </p>
            </div>
          </div>
        </div>

        {/* Help Notice on Embedded Login Security */}
        <div className="px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-[11px] text-amber-300/90 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>
            <b>Catatan Login:</b> Google dapat memblokir login di embedded browser kapan saja (&quot;This browser or app may not be secure&quot;). Jalur paling andal adalah <b>Cookie Import</b>, atau gunakan login Email/Magic Link untuk Claude dan ChatGPT.
          </span>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 flex flex-col gap-3 overflow-hidden">
          <div className="flex items-center justify-between text-xs">
            <label className="font-medium text-slate-300 flex items-center gap-1.5">
              <span>Paste JSON Cookies:</span>
              {previewStats && previewStats.valid && (
                <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
                  ✓ {previewStats.count} Cookies ({previewStats.domains})
                </span>
              )}
              {previewStats && !previewStats.valid && (
                <span className="text-[11px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 font-mono">
                  {previewStats.error}
                </span>
              )}
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
              >
                <Clipboard className="w-3 h-3 text-sky-400" />
                <span>Paste Clipboard</span>
              </button>
              {cookieJson && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs transition"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          <textarea
            value={cookieJson}
            onChange={(e) => {
              setCookieJson(e.target.value);
              setStatus({ type: null, message: '' });
            }}
            placeholder='[&#10;  {&#10;    "domain": ".google.com",&#10;    "name": "SID",&#10;    "value": "...",&#10;    "path": "/",&#10;    "secure": true&#10;  }&#10;]'
            rows={10}
            className="w-full flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 font-mono text-xs resize-none focus:outline-none focus:border-amber-500/50 selection:bg-amber-500/20"
          />

          {/* Feedback Alerts */}
          {(status.type === 'success' || status.type === 'warning') && (
            <div className={`p-3 rounded-xl border flex flex-col gap-2 text-xs animate-in fade-in ${
              status.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300'
                : 'bg-amber-950/60 border-amber-800/80 text-amber-300'
            }`}>
              <div className="flex items-center gap-2">
                {status.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                )}
                <span className="font-medium">{status.message}</span>
              </div>

              {/* Status Login Google (Cek SID / __Secure-1PSID) */}
              <div className="text-[11px] pl-6">
                {status.googleLoginDetected ? (
                  <span className="text-emerald-400 flex items-center gap-1 font-mono">
                    ✓ Sesi Google terverifikasi aktif (SID / __Secure-1PSID terdeteksi di .google.com).
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1 font-mono">
                    ⚠️ Sesi Google belum terdeteksi (tidak ditemukan SID / __Secure-1PSID di .google.com). Pastikan export dilakukan dari akun yang sudah login.
                  </span>
                )}
              </div>

              {/* Daftar Cookie Gagal jika ada */}
              {status.failedCookies && status.failedCookies.length > 0 && (
                <div className="mt-1 pl-6">
                  <div className="text-[11px] font-semibold text-rose-400 mb-1">
                    Daftar Cookie Gagal ({status.failedCookies.length}):
                  </div>
                  <div className="max-h-24 overflow-y-auto space-y-0.5 bg-slate-950/70 p-2 rounded border border-slate-800 font-mono text-[10px] text-slate-300">
                    {status.failedCookies.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-1.5">
                        <span className="text-rose-400 font-bold">{item.name}:</span>
                        <span className="text-slate-400">{item.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {status.type === 'error' && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 flex items-center gap-2.5 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{status.message}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          <p className="text-[11px] text-slate-500 font-mono">
            Cookies disimpan aman di session partition lokal Electron Anda.
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={isSubmitting || !cookieJson.trim()}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-slate-950 text-xs font-semibold shadow-lg shadow-amber-500/20 flex items-center gap-2 transition"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menginjeksi Cookies...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Inject Cookies & Reload</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
