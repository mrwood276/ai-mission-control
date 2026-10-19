import React, { useState } from 'react';
import { 
  ArrowLeftRight, 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  Sparkles,
  ClipboardPaste
} from 'lucide-react';

export default function HandoffPanel({ className = '', orderStyle = {} }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      style={orderStyle}
      className={`h-full border-r border-slate-800 bg-slate-900/95 flex-col flex-shrink-0 transition-all duration-200 z-10 ${
        collapsed ? 'w-10' : 'w-72'
      } ${className}`}
    >
      {/* Header */}
      <div className="h-8 bg-slate-900 border-b border-slate-800 px-2 flex items-center justify-between text-xs select-none">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1.5 text-slate-300 hover:text-white font-medium truncate"
          title={collapsed ? 'Expand Handoff Panel' : 'Collapse Panel'}
        >
          <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          {!collapsed && <span className="truncate">Handoff & Parser</span>}
        </button>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Body */}
      {!collapsed ? (
        <div className="flex-1 p-3 flex flex-col gap-3 overflow-y-auto text-xs">
          <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-400 mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Pipeline Bridge</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Copy storyboard from Claude (left), paste into ChatGPT (right) to generate Global Rules & Scene Prompts.
            </p>
          </div>

          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
              <FileText className="w-3 h-3 text-slate-400" />
              Raw AI Output Parser
            </label>
            <textarea
              placeholder="Paste ChatGPT output here for auto-parsing into Scene Cards..."
              className="flex-1 w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-300 font-mono text-[11px] resize-none focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <button className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition">
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>Parse to Scene Cards</span>
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center py-4 gap-4 text-slate-500">
          <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] tracking-wider uppercase font-semibold text-slate-400">
            Handoff & Parser
          </span>
        </div>
      )}
    </div>
  );
}
