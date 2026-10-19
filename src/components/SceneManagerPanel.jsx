import React from 'react';
import { 
  Pin, 
  Layers, 
  Play, 
  Send, 
  Plus, 
  RefreshCw,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

export default function SceneManagerPanel({ className = '', orderStyle = {} }) {
  const dummyScenes = [
    { id: 1, title: 'Scene 1: Opening Hook', prompt: 'Cinematic wide shot of cybernetic command center with holographic screens glow...', done: false },
    { id: 2, title: 'Scene 2: Problem Statement', prompt: 'Medium close-up of protagonist analyzing multi-screen AI telemetry...', done: false },
    { id: 3, title: 'Scene 3: AI Pipeline Solution', prompt: 'Dynamic 3D camera pan across Claude, ChatGPT, Gemini neural pathways...', done: false },
  ];

  return (
    <div
      style={orderStyle}
      className={`h-full border-r border-slate-800 bg-slate-900/95 flex-col flex-shrink-0 z-10 ${className}`}
    >
      {/* Header */}
      <div className="h-8 bg-slate-900 border-b border-slate-800 px-3 flex items-center justify-between text-xs select-none flex-shrink-0">
        <div className="flex items-center gap-1.5 font-semibold text-purple-300">
          <Layers className="w-3.5 h-3.5 text-purple-400" />
          <span>Scene Cards Manager</span>
        </div>
        <button 
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          title="Add Custom Scene"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 text-xs">
        {/* Pinned Global Rules */}
        <div className="p-2.5 rounded-lg bg-slate-950/90 border border-purple-500/30 shadow-sm">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-purple-400 flex items-center gap-1">
              <Pin className="w-3 h-3 text-purple-400" />
              Pinned Global Rules
            </span>
            <span className="text-[10px] bg-purple-950 text-purple-300 px-1.5 py-0.2 rounded border border-purple-800">
              Active
            </span>
          </div>
          <p className="text-[11px] text-slate-300 font-mono line-clamp-2 bg-slate-900/70 p-2 rounded border border-slate-800">
            Aspect Ratio 16:9, Unreal Engine 5.4 cinematic lighting, octane render, 8k hyper-detailed...
          </p>
        </div>

        {/* Scene Cards List */}
        <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1">
          <span className="font-semibold uppercase tracking-wider text-slate-300">
            Active Scenes ({dummyScenes.length})
          </span>
          <span className="text-[10px] text-slate-500">Auto-inject Ready</span>
        </div>

        <div className="flex flex-col gap-2.5">
          {dummyScenes.map((scene) => (
            <div 
              key={scene.id}
              className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">{scene.title}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                  Pending
                </span>
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2 font-mono">
                {scene.prompt}
              </p>

              {/* Action Buttons for Gemini & Flow */}
              <div className="flex items-center gap-1.5 pt-1 border-t border-slate-900">
                <button 
                  className="flex-1 py-1 px-2 rounded bg-sky-600/80 hover:bg-sky-500 text-white text-[10px] font-medium flex items-center justify-center gap-1 transition"
                  title="Inject prompt into Gemini"
                >
                  <Send className="w-2.5 h-2.5" />
                  <span>Gemini</span>
                </button>
                <button 
                  className="flex-1 py-1 px-2 rounded bg-purple-600/80 hover:bg-purple-500 text-white text-[10px] font-medium flex items-center justify-center gap-1 transition"
                  title="Inject into Google Flow"
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>Flow</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
