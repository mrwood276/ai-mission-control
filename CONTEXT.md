# Project Name: Creator & AI Pipeline Command Center

## Overview
A desktop application built with Electron, React (Vite), and Tailwind CSS designed to eliminate context switching for a content creator. The app integrates YouTube Studio monitoring and a sequential AI content production pipeline (Claude -> ChatGPT -> Gemini & Google Flow) using persistent `<webview>` tags (No paid AI APIs used; relies on Free Tier Web UIs and DOM manipulation).

## Tech Stack
- Framework: Electron + React (Vite) + Tailwind CSS
- Icons: Lucide-React
- State Management & Storage: React State + localStorage (for saving Global Rules, Scene Cards, and Quota Timers)
- Webviews: Electron `<webview>` with `partition="persist:clean_chrome_v3"` so login sessions and cookies are permanently saved.

## Core Workflow & Layout (3 Workspace Modes)
1. **Mode 1: Analytics & Ideation**
   - Left (45%): Webview for YouTube Studio (`https://studio.youtube.com`)
   - Right (55%): Webview for Claude (`https://claude.ai`) for research and storyboard creation.
2. **Mode 2: Prompt Engineering**
   - Left (45%): Webview for Claude (Storyboard reference)
   - Center (10% / Collapsible Sidebar): Handoff & Parser Panel
   - Right (45%): Webview for ChatGPT (`https://chatgpt.com`) to convert Storyboards into: (1) Global Rules, and (2) Scene-by-scene visual/animation prompts.
3. **Mode 3: Visual Production Studio**
   - Left Sidebar (25%): "Scene Cards Manager" containing the pinned Global Rules and individual Scene Cards (Scene 1, Scene 2, etc.).
   - Main Area (75% Split): Webviews for Gemini (`https://gemini.google.com/app`) and Google Flow (`https://labs.google/fx/tools/flow`).

## Key Technical Features
1. **Persistent Webviews:** All webviews must remain mounted in the DOM (hidden via CSS `hidden` / `display: none` when switching modes) so background tasks like Google Flow rendering or active chats never reset.
2. **Scene Parser:** A text area where the user pastes ChatGPT's output. The app parses it into:
   - `Global Rules` (Editable, pinned at the top).
   - `Scene Cards` (Array of scenes, each with Scene Number, Prompt Text, and Done status).
3. **Gemini 4-Prompt Limit Handler (Auto-Fresh Session):**
   - Tracks how many prompts have been injected into the current Gemini chat session (`geminiCounter`: 0 to 4).
   - Each Scene Card has two injection buttons for Gemini:
     - `[Inject Scene Only]`: Sends only the Scene prompt (used when `geminiCounter` is 1–3).
     - `[New Chat + Global + Scene]`: Resets `geminiCounter` to 1, navigates Gemini webview to a fresh `https://gemini.google.com/app`, waits for load, and injects `Global Rules + Scene Prompt` together. Automatically highlighted/recommended every 4 scenes.
   - Also includes an `[Inject to Flow]` button for Google Flow.
4. **Bottom Status & Quota Bar:**
   - Displays manual/semi-automatic message counters and cooldown countdown timers for Claude Free Tier and ChatGPT Free Tier, plus Gemini session load (`X/4`).