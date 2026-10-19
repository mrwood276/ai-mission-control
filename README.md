# Creator & AI Pipeline Command Center

A high-performance desktop command center built with **Electron + React (Vite) + Tailwind CSS**, designed to streamline a YouTube content creator's end-to-end AI production pipeline across **YouTube Studio, Claude, ChatGPT, Gemini, and Google Flow**.

---

## Prerequisites

- **Node.js**: `v20.x` or `v22.x` (LTS recommended)
- **npm**: `v10.x` or higher
- **Supported Operating Systems**: Windows, macOS, Linux

---

## Setup & Commands

### 1. Installation

Install dependencies reproducibly from the locked dependency manifest:

```bash
npm ci
```

*(Alternatively, use `npm install` for development additions).*

### 2. Development Mode

Runs the Vite development server with Hot Module Replacement (HMR) on `http://localhost:5173` and automatically launches Electron:

```bash
npm run dev
```

### 3. Production Build

Compiles React components, Tailwind CSS, and assets into static production bundles under `dist/`:

```bash
npm run build
```

### 4. Production Application Startup

Launches Electron in production mode loading the compiled `dist/index.html`:

```bash
npm start
```

> **Diagnostic Protection:** If `npm start` is executed before `npm run build`, Electron detects the missing build artifacts and displays an actionable diagnostic screen rather than failing silently with a blank window or attempting to connect to an offline dev server.

### 5. Automated Tests

Runs the full regression and unit test suite using Node.js's native test runner (`node --test`):

```bash
npm test
```

### 6. Linting

Checks code quality and formatting according to the project ESLint configuration:

```bash
npm run lint
npm run lint:fix    # Automatically fix lint issues where supported
```

### 7. Turnkey Verification

Runs linter, test suite, and production build in sequence:

```bash
npm run verify
```

---

## Continuous Integration (CI)

A GitHub Actions workflow is located at [`.github/workflows/ci.yml`](file:///.github/workflows/ci.yml). It automatically runs on every pull request and on pushes to any non-main feature branch:

1. Checks out the repository.
2. Sets up Node.js versions (`20.x` and `22.x`).
3. Performs a clean, reproducible installation via `npm ci`.
4. Executes `npm run lint`.
5. Runs the automated test suite via `npm test`.
6. Executes `npm run build`.

Direct pushes to `main` are disallowed.

---

## Feature-Branch Development Workflow

To ensure stability, safety, and traceability:

1. **Never commit directly to `main`**: All work occurs on dedicated feature branches (`feature/<short-task-name>`).
2. **Branch Creation**: Always branch off the latest verified commit on `main`.
3. **Preserve Working Trees**: Verify git status before switching branches.
4. **Pre-commit Verification**: Run `npm run verify` locally before committing changes.
5. **Pull Requests**: Submit changes via pull request to trigger CI verification before merging.

---

## Feature Capabilities & Architecture

### 1. Workspace Consolidation (3 Persistent Modes)

- **Mode 1: Analytics & Ideation**
  - Left (45%): YouTube Studio (`https://studio.youtube.com`)
  - Right (55%): Claude (`https://claude.ai`) for storyboarding and research
- **Mode 2: Prompt Engineering**
  - Left (45%): Claude (`https://claude.ai`)
  - Center: Pipeline Sidebar (Scene Parser & Rules)
  - Right (Flex-1): ChatGPT (`https://chatgpt.com`)
- **Mode 3: Visual Studio**
  - Left Sidebar (25%): Pipeline Sidebar (Pinned Global Rules + Scene Cards)
  - Center (Flex-1): Gemini (`https://gemini.google.com/app`)
  - Right (Flex-1): Google Flow (`https://labs.google/fx/tools/flow`)

*Webviews remain mounted in the DOM across mode transitions to preserve form state, active chats, and background video generations.*

### 2. Multi-Project Management & Data Persistence

- **Versioned Storage Model (`v1`)**: Fully structured project schema with unique IDs, names, timestamps, global rules, and scene collections.
- **Project Switching & Creation**: Create, rename, duplicate, and switch projects instantly.
- **Safe Deletion**: Deletion requires explicit user confirmation.
- **Autosave & Status**: Debounced local storage autosave with visual save state indicators (`Saving...`, `Saved`, `Save Error`).
- **Data Portability**: Clean JSON project export and schema-validated import with format checks.
- **Automatic Migration**: Safely migrates legacy unversioned single-workspace storage keys (`aimc_global_rules`, `aimc_scenes`) without data loss.

### 3. Pipeline Sidebar & Scene Manager

- **Search & Filtering**: Real-time scene filtering by scene number, title, or prompt content.
- **In-Flight Action Guard**: Disables prompt injection triggers during execution to prevent duplicate submissions.
- **Scene Parsing**: Structured parser accepting Markdown scene headings (`## Scene 1: Title`), multiline prompts, and optional Global Rules with interactive preview before applying.
- **Prompt Delivery**: DOM injection with automatic fallback to system clipboard (`inserted`, `copied`, `failed`).

### 4. Status Bar & Usage Trackers

- **Manual Trackers**: Explicitly labeled manual message counters for Claude Free Tier (5-hour window) and ChatGPT Free Tier (3-hour window).
- **Local Timers**: Self-timed cooldown timers designated as local timers, without implying server-side quota synchronization.
- **Gemini Load Tracker**: Step counter (0 to 4) tracking prompt injection and indicating when a fresh session is advised.

---

## Security Architecture

- **Least-Privilege IPC Bridge**: Context isolation is strictly enabled (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`). Only frozen, validated APIs (`openExternal`, `reloadApp`) are exposed.
- **IPC Sender Verification**: Privileged handlers verify that incoming events originate from the trusted main window webContents.
- **Explicit Domain Allowlists**: External URLs and popups are restricted to approved service domains (`youtube.com`, `google.com`, `claude.ai`, `anthropic.com`, `chatgpt.com`, `openai.com`, `labs.google`). Disallowed protocols (`file:`, `javascript:`, `data:`) are rejected.
- **Origin-Restricted Permissions**: Geolocation, clipboard-read, and notifications are blocked. Audio recording is granted only to verified AI voice dictation origins.
- **No Identity Spoofing or Secret Extraction**: Avoids fingerprint spoofing, user-agent tampering, and browser session cookie extraction.

---

## Known Limitations & Unsupported Integrations

1. **Google Account Authentication in Embedded Webviews**:
   Google blocks sign-in attempts from embedded Chromium/Electron webviews under its secure browser policy (*"This browser or app may not be secure"*). AI Mission Control provides 1-click fallback buttons to open YouTube Studio, Gemini, and Google Flow in your primary system browser.
2. **Third-Party Live Quota APIs**:
   Claude and ChatGPT do not provide public unauthenticated live quota APIs. Usage trackers and cooldown clocks operate locally and manually based on creator input.
3. **Third-Party DOM Changes**:
   Direct DOM prompt injection targets standard web selectors (`textarea`, `contenteditable`). If external providers update their web interfaces, prompt delivery automatically falls back to copying the formatted prompt to the clipboard.
