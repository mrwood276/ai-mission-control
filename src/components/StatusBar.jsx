import React from 'react';
import { 
  Clock, 
  Sparkles, 
  MessageSquare, 
  Database, 
  CheckCircle2, 
  Activity,
  Layers,
  Flame
} from 'lucide-react';
import { SESSION_PARTITION } from '../constants';

export default function StatusBar({ geminiCounter = 0, maxGemini = 4 }) {
  return (
    <footer className="h-8 bg-slate-950 border-t border-slate-800/80 px-3 flex items-center justify-between text-xs text-slate-400 font-mono select-none flex-shrink-0 z-50">
      {/* Left: Active Pipeline Monitors */}
      <div className="flex items-center gap-4">
        {/* Claude Free Tier Monitor */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900/90 border border-slate-800 text-[11px]">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          <span className="text-slate-300 font-medium">Claude Free Tier:</span>
          <span className="text-amber-400">Ready</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-500" />
            No cooldown
          </span>
        </div>

        {/* ChatGPT Free Tier Monitor */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900/90 border border-slate-800 text-[11px]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span className="text-slate-300 font-medium">ChatGPT Free:</span>
          <span className="text-emerald-400">Active</span>
        </div>

        {/* Gemini Session Load (X/4) */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900/90 border border-slate-800 text-[11px]">
          <Flame className={`w-3.5 h-3.5 ${geminiCounter >= maxGemini ? 'text-rose-400 animate-pulse' : 'text-sky-400'}`} />
          <span className="text-slate-300 font-medium">Gemini Load:</span>
          <span className={`font-semibold ${geminiCounter >= maxGemini ? 'text-rose-400' : 'text-sky-400'}`}>
            {geminiCounter}/{maxGemini} Prompts
          </span>
          {geminiCounter >= maxGemini && (
            <span className="text-[10px] bg-rose-950/80 text-rose-300 px-1 rounded border border-rose-800">
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
  );
}
