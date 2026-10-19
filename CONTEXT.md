# Project Context: Creator & AI Pipeline Command Center

## 1. System Overview
Creator & AI Pipeline Command Center is a specialized desktop workstation built with **Electron, React (Vite), and Tailwind CSS**. It integrates a creator's video analytics and AI production pipeline into three persistent workspace modes, combining YouTube Studio, Claude, ChatGPT, Gemini, and Google Flow into a unified interface without context switching.

## 2. Technology Stack & Dependencies
- **Runtime**: Electron `^34.2.0` (with Context Isolation, Process Sandboxing, and Webview Sandboxing)
- **Frontend**: React `^18.3.1`, Vite `^6.1.0`, Tailwind CSS `^3.4.17`, Lucide React `^0.475.0`
- **Testing**: Node.js Native Test Runner (`node:test`, `node:assert/strict`)
- **Linting**: ESLint `^10.13.0` with `@eslint/js` and `globals`
- **CI/CD**: GitHub Actions (`.github/workflows/ci.yml`) on Node `20.x` and `22.x`

## 3. Project Architecture

### Workspace Modes & Webview Lifecycle
All webviews are instantiated in the DOM within [`src/components/WebviewWrapper.jsx`](file:///d:/ai-mission-control/src/components/WebviewWrapper.jsx) with partition `persist:clean_chrome_v3`. Webviews are preserved across mode switches using Tailwind `hidden` classes rather than unmounting, ensuring active renders and session state remain uninterrupted:
1. **Mode 1: Analytics & Ideation** — YouTube Studio (45%) + Claude (55%)
2. **Mode 2: Prompt Engineering** — Claude (45%) + Pipeline Sidebar + ChatGPT (Flex-1)
3. **Mode 3: Visual Production Studio** — Pipeline Sidebar (25%) + Gemini (Flex-1) + Google Flow (Flex-1)

### Multi-Project Management & Storage Schema
Located in [`src/utils/projectManager.js`](file:///d:/ai-mission-control/src/utils/projectManager.js):
- **Schema Version**: `aimc_project_schema_v1`
- **Storage Keys**:
  - `aimc_projects_v1`: JSON array of versioned project models.
  - `aimc_active_project_id_v1`: ID of currently active project.
- **Project Structure**:
  - `id`: Unique string (`proj-<timestamp>-<random>`)
  - `name`: Non-empty string
  - `createdAt`, `updatedAt`: ISO 8601 timestamps
  - `globalRules`: String containing pinned system prompt/rules
  - `scenes`: Array of scene cards:
    - `id`: Unique string (`scene-<timestamp>-<index>`)
    - `sceneNumber`: Positive integer
    - `title`: String
    - `prompt`: String
    - `done`: Boolean
- **Autosave & Backup**: Debounced local storage synchronization with export/import validation and seamless migration from legacy unversioned storage (`aimc_global_rules`, `aimc_scenes`).

### Pipeline Engine & Prompt Delivery
Located in [`src/components/PipelineSidebar.jsx`](file:///d:/ai-mission-control/src/components/PipelineSidebar.jsx) and [`src/utils/webviewInjection.js`](file:///d:/ai-mission-control/src/utils/webviewInjection.js):
- **Scene Parser**: Robust regex parser supporting various Markdown heading formats, multiline prompts, and non-sequential numbers with interactive preview.
- **Search & Filtering**: Real-time filtering across scene numbers, titles, and prompts.
- **In-Flight Action Guard**: Disables buttons during prompt injection to prevent duplicate submissions.
- **Delivery Engine**: Injects formatted prompt into target webview DOM. Automatically falls back to system clipboard with clear outcome states (`inserted`, `copied`, `failed`).

### Security Framework
Located in [`electron/security.js`](file:///d:/ai-mission-control/electron/security.js) and [`electron/main.js`](file:///d:/ai-mission-control/electron/main.js):
- **Preload Isolation**: Exposes only frozen `openExternal` and `reloadApp` APIs.
- **IPC Sender Verification**: Every handler verifies that the event sender matches `mainWindow.webContents`.
- **Destination Allowlists**: Enforces approved service domains (`youtube.com`, `google.com`, `claude.ai`, `anthropic.com`, `chatgpt.com`, `openai.com`, `labs.google`).
- **Permission Requests**: Blocks high-risk permissions (`geolocation`, `clipboard-read`, `notifications`); permits audio recording only on approved AI voice dictation origins.
- **Missing Build Protection**: [`electron/startup.js`](file:///d:/ai-mission-control/electron/startup.js) catches production startups missing `dist/index.html` and presents actionable diagnostic guidance.

## 4. Operational Commands & Scripts
- `npm run dev`: Concurrent Vite dev server and Electron app.
- `npm run build`: Vite production bundle compilation.
- `npm start`: Electron production execution.
- `npm test`: Node.js native test suite (`test/**/*.test.js`).
- `npm run lint`: ESLint check.
- `npm run verify`: Turnkey lint + test + build pipeline.

## 5. Development Workflow & Git Rules
- Work exclusively on dedicated feature branches (`feature/<task-name>`).
- Direct commits or pushes to `main` are strictly forbidden.
- Verify changes with `npm run verify` prior to opening pull requests.