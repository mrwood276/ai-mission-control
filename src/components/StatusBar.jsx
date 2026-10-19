import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Sparkles, 
  MessageSquare, 
  Database, 
  CheckCircle2, 
  Activity,
  Layers,
  Flame,
  Plus,
  RotateCcw,
  Timer,
  Bell,
  X,
  AlertTriangle
} from 'lucide-react';
import { SESSION_PARTITION } from '../constants';

// Native Web Audio API Chime Synthesizer
function playChimeSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.setValueAtTime(659.25, now + 0.15); // E5

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(783.99, now + 0.15); // G5
    osc2.frequency.setValueAtTime(1046.50, now + 0.3); // C6

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.15);
    osc1.stop(now + 0.9);
    osc2.stop(now + 0.9);
  } catch (err) {
    console.warn('[Audio] Failed to play notification sound:', err);
  }
}

export default function StatusBar({ geminiCounter = 0, maxGemini = 4 }) {
  // Claude message counter & cooldown
  const [claudeCount, setClaudeCount] = useState(() => {
    try {
      return parseInt(localStorage.getItem('aimc_claude_msg_count') || '0', 10);
    } catch (e) {
      return 0;
    }
  });

  const [claudeCooldownEnd, setClaudeCooldownEnd] = useState(() => {
    try {
      return parseInt(localStorage.getItem('aimc_claude_cooldown_end') || '0', 10);
    } catch (e) {
      return 0;
    }
  });

  // ChatGPT message counter & cooldown
  const [chatgptCount, setChatgptCount] = useState(() => {
    try {
      return parseInt(localStorage.getItem('aimc_chatgpt_msg_count') || '0', 10);
    } catch (e) {
      return 0;
    }
  });

  const [chatgptCooldownEnd, setChatgptCooldownEnd] = useState(() => {
    try {
      return parseInt(localStorage.getItem('aimc_chatgpt_cooldown_end') || '0', 10);
    } catch (e) {
      return 0;
    }
  });

  // Cooldown modal state
  const [timerModal, setTimerModal] = useState({
    isOpen: false,
    service: 'claude', // 'claude' or 'chatgpt'
    hours: 3,
    minutes: 0,
  });

  const [currentTime, setCurrentTime] = useState(Date.now());

  // 1-second clock tick for countdowns
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Check Claude countdown expiry
  useEffect(() => {
    if (claudeCooldownEnd && currentTime >= claudeCooldownEnd) {
      playChimeSound();
      setClaudeCooldownEnd(0);
      try {
        localStorage.removeItem('aimc_claude_cooldown_end');
      } catch (e) {}
    }
  }, [currentTime, claudeCooldownEnd]);

  // Check ChatGPT countdown expiry
  useEffect(() => {
    if (chatgptCooldownEnd && currentTime >= chatgptCooldownEnd) {
      playChimeSound();
      setChatgptCooldownEnd(0);
      try {
        localStorage.removeItem('aimc_chatgpt_cooldown_end');
      } catch (e) {}
    }
  }, [currentTime, chatgptCooldownEnd]);

  // Persist message counters
  const handleIncrementClaude = (e) => {
    e.stopPropagation();
    const next = claudeCount + 1;
    setClaudeCount(next);
    try {
      localStorage.setItem('aimc_claude_msg_count', String(next));
    } catch (err) {}
  };

  const handleResetClaudeMsg = (e) => {
    e.stopPropagation();
    setClaudeCount(0);
    try {
      localStorage.setItem('aimc_claude_msg_count', '0');
    } catch (err) {}
  };

  const handleIncrementChatgpt = (e) => {
    e.stopPropagation();
    const next = chatgptCount + 1;
    setChatgptCount(next);
    try {
      localStorage.setItem('aimc_chatgpt_msg_count', String(next));
    } catch (err) {}
  };

  const handleResetChatgptMsg = (e) => {
    e.stopPropagation();
    setChatgptCount(0);
    try {
      localStorage.setItem('aimc_chatgpt_msg_count', '0');
    } catch (err) {}
  };

  // Helper to format remaining time
  const formatRemaining = (endTime) => {
    const diff = Math.max(0, endTime - currentTime);
    if (diff <= 0) return '00:00:00';
    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // Start timer handler
  const handleStartTimer = (service, hours, minutes) => {
    const durationMs = (hours * 3600 + minutes * 60) * 1000;
    const targetEnd = Date.now() + durationMs;

    if (service === 'claude') {
      setClaudeCooldownEnd(targetEnd);
      try {
        localStorage.setItem('aimc_claude_cooldown_end', String(targetEnd));
      } catch (e) {}
    } else {
      setChatgptCooldownEnd(targetEnd);
      try {
        localStorage.setItem('aimc_chatgpt_cooldown_end', String(targetEnd));
      } catch (e) {}
    }

    setTimerModal({ isOpen: false, service: 'claude', hours: 3, minutes: 0 });
  };

  const handleCancelTimer = (service) => {
    if (service === 'claude') {
      setClaudeCooldownEnd(0);
      try {
        localStorage.removeItem('aimc_claude_cooldown_end');
      } catch (e) {}
    } else {
      setChatgptCooldownEnd(0);
      try {
        localStorage.removeItem('aimc_chatgpt_cooldown_end');
      } catch (e) {}
    }
  };

  const isClaudeCooldownActive = claudeCooldownEnd > currentTime;
  const isChatgptCooldownActive = chatgptCooldownEnd > currentTime;

  return (
    <>
      <footer className="h-8 bg-slate-950 border-t border-slate-800/80 px-3 flex items-center justify-between text-xs text-slate-400 font-mono select-none flex-shrink-0 z-50">
        {/* Left: Active Pipeline Monitors */}
        <div className="flex items-center gap-3">
          {/* Claude Free Tier Monitor */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900/90 border border-slate-800 text-[11px]">
            <span className={`w-1.5 h-1.5 rounded-full ${isClaudeCooldownActive ? 'bg-rose-400 animate-ping' : 'bg-amber-400'}`}></span>
            <span className="text-slate-300 font-medium">Claude Free:</span>
            
            {/* Msg Count & +1 button */}
            <span className="text-amber-400 font-semibold">{claudeCount} msg</span>
            <button
              onClick={handleIncrementClaude}
              className="p-0.5 hover:bg-slate-800 text-slate-400 hover:text-amber-300 rounded transition"
              title="Add 1 message"
            >
              <Plus className="w-2.5 h-2.5" />
            </button>
            {claudeCount > 0 && (
              <button
                onClick={handleResetClaudeMsg}
                className="p-0.5 hover:bg-slate-800 text-slate-500 hover:text-slate-300 rounded transition"
                title="Reset message counter"
              >
                <RotateCcw className="w-2.5 h-2.5" />
              </button>
            )}

            <span className="text-slate-600">|</span>

            {/* Cooldown Timer or Start Button */}
            {isClaudeCooldownActive ? (
              <div className="flex items-center gap-1 text-rose-300 font-bold animate-pulse">
                <Timer className="w-3 h-3 text-rose-400" />
                <span>{formatRemaining(claudeCooldownEnd)}</span>
                <button
                  onClick={() => handleCancelTimer('claude')}
                  className="p-0.5 hover:bg-rose-950/80 text-rose-400 rounded"
                  title="Batalkan timer cooldown"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setTimerModal({ isOpen: true, service: 'claude', hours: 3, minutes: 0 })}
                className="flex items-center gap-1 text-slate-400 hover:text-amber-300 transition"
                title="Set Cooldown Timer (3 Hours / Custom)"
              >
                <Clock className="w-3 h-3 text-slate-500" />
                <span>Start Cooldown</span>
              </button>
            )}
          </div>

          {/* ChatGPT Free Tier Monitor */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900/90 border border-slate-800 text-[11px]">
            <span className={`w-1.5 h-1.5 rounded-full ${isChatgptCooldownActive ? 'bg-rose-400 animate-ping' : 'bg-emerald-400'}`}></span>
            <span className="text-slate-300 font-medium">ChatGPT Free:</span>
            
            {/* Msg Count & +1 button */}
            <span className="text-emerald-400 font-semibold">{chatgptCount} msg</span>
            <button
              onClick={handleIncrementChatgpt}
              className="p-0.5 hover:bg-slate-800 text-slate-400 hover:text-emerald-300 rounded transition"
              title="Add 1 message"
            >
              <Plus className="w-2.5 h-2.5" />
            </button>
            {chatgptCount > 0 && (
              <button
                onClick={handleResetChatgptMsg}
                className="p-0.5 hover:bg-slate-800 text-slate-500 hover:text-slate-300 rounded transition"
                title="Reset message counter"
              >
                <RotateCcw className="w-2.5 h-2.5" />
              </button>
            )}

            <span className="text-slate-600">|</span>

            {/* Cooldown Timer or Start Button */}
            {isChatgptCooldownActive ? (
              <div className="flex items-center gap-1 text-rose-300 font-bold animate-pulse">
                <Timer className="w-3 h-3 text-rose-400" />
                <span>{formatRemaining(chatgptCooldownEnd)}</span>
                <button
                  onClick={() => handleCancelTimer('chatgpt')}
                  className="p-0.5 hover:bg-rose-950/80 text-rose-400 rounded"
                  title="Batalkan timer cooldown"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setTimerModal({ isOpen: true, service: 'chatgpt', hours: 3, minutes: 0 })}
                className="flex items-center gap-1 text-slate-400 hover:text-emerald-300 transition"
                title="Set Cooldown Timer (3 Hours / Custom)"
              >
                <Clock className="w-3 h-3 text-slate-500" />
                <span>Start Cooldown</span>
              </button>
            )}
          </div>

          {/* Gemini Session Load (X/4) */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900/90 border border-slate-800 text-[11px]">
            <Flame className={`w-3.5 h-3.5 ${geminiCounter >= maxGemini ? 'text-rose-400 animate-pulse' : 'text-sky-400'}`} />
            <span className="text-slate-300 font-medium">Gemini Load:</span>
            <span className={`font-semibold ${geminiCounter >= maxGemini ? 'text-rose-400 animate-pulse' : 'text-sky-400'}`}>
              {geminiCounter}/{maxGemini} Prompts
            </span>
            {geminiCounter >= maxGemini && (
              <span className="text-[10px] bg-rose-950/80 text-rose-300 px-1.5 py-0.2 rounded border border-rose-800 font-bold animate-pulse">
                Fresh Chat Recommended
              </span>
            )}
          </div>
        </div>

        {/* Right: Storage & Session Status */}
        <div className="flex items-center gap-4 text-[11px]">
          {/* Flow Render Worker */}
          <div className="flex items-center gap-1.5 text-slate-400">
            <Activity className="w-3 h-3 text-purple-400" />
            <span>Flow Worker: Idle</span>
          </div>

          <div className="h-3 w-px bg-slate-800"></div>

          {/* Persistent Session Partition */}
          <div className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Session Saved ({SESSION_PARTITION})</span>
          </div>

          <div className="h-3 w-px bg-slate-800"></div>

          {/* DOM Preservation Notice */}
          <div className="flex items-center gap-1 text-slate-500">
            <Layers className="w-3 h-3 text-slate-500" />
            <span>Webviews: 5/5 Mounted (Zero Reload)</span>
          </div>
        </div>
      </footer>

      {/* Cooldown Timer Setup Modal */}
      {timerModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-sm text-slate-100">
                  Set Cooldown Timer ({timerModal.service === 'claude' ? 'Claude' : 'ChatGPT'})
                </h3>
              </div>
              <button
                onClick={() => setTimerModal({ ...timerModal, isOpen: false })}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Atur timer hitung mundur saat terkena rate limit Free Tier. Aplikasi akan membunyikan alarm audio otomatis saat waktu selesai.
            </p>

            {/* Quick Presets */}
            <div className="grid grid-cols-4 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setTimerModal({ ...timerModal, hours: 3, minutes: 0 })}
                className={`py-1.5 rounded-lg border text-xs font-medium transition ${
                  timerModal.hours === 3 && timerModal.minutes === 0
                    ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                3 Jam (Std)
              </button>
              <button
                type="button"
                onClick={() => setTimerModal({ ...timerModal, hours: 2, minutes: 0 })}
                className={`py-1.5 rounded-lg border text-xs font-medium transition ${
                  timerModal.hours === 2 && timerModal.minutes === 0
                    ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                2 Jam
              </button>
              <button
                type="button"
                onClick={() => setTimerModal({ ...timerModal, hours: 1, minutes: 0 })}
                className={`py-1.5 rounded-lg border text-xs font-medium transition ${
                  timerModal.hours === 1 && timerModal.minutes === 0
                    ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                1 Jam
              </button>
              <button
                type="button"
                onClick={() => setTimerModal({ ...timerModal, hours: 0, minutes: 30 })}
                className={`py-1.5 rounded-lg border text-xs font-medium transition ${
                  timerModal.hours === 0 && timerModal.minutes === 30
                    ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                30 Mnt
              </button>
            </div>

            {/* Custom Time Inputs */}
            <div className="flex items-center gap-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 font-mono">JAM</label>
                <input
                  type="number"
                  min="0"
                  max="24"
                  value={timerModal.hours}
                  onChange={(e) =>
                    setTimerModal({ ...timerModal, hours: Math.max(0, parseInt(e.target.value || '0', 10)) })
                  }
                  className="bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-center font-mono text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <span className="font-bold text-slate-600 text-lg mt-3">:</span>

              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 font-mono">MENIT</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={timerModal.minutes}
                  onChange={(e) =>
                    setTimerModal({
                      ...timerModal,
                      minutes: Math.max(0, Math.min(59, parseInt(e.target.value || '0', 10))),
                    })
                  }
                  className="bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-center font-mono text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setTimerModal({ ...timerModal, isOpen: false })}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleStartTimer(timerModal.service, timerModal.hours, timerModal.minutes)}
                disabled={timerModal.hours === 0 && timerModal.minutes === 0}
                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition"
              >
                Mulai Cooldown Timer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
