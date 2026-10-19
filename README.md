# Creator & AI Pipeline Command Center

A high-performance desktop command center built with **Electron + React (Vite) + Tailwind CSS**, designed to streamline a YouTube content creator's end-to-end AI production pipeline across **YouTube Studio, Claude, ChatGPT, Gemini, and Google Flow**.

## Security Architecture & Design

- **Least-Privilege IPC Bridge:** The renderer context is strictly isolated (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`). Only audited, frozen APIs (`openExternal`, `reloadApp`) are exposed via `contextBridge`. IPC handlers validate sender webContents ownership, URL structure, and domain allowlists.
- **Explicit Destination Allowlists:** External links and popups are strictly validated against an approved service domain allowlist (`youtube.com`, `google.com`, `claude.ai`, `anthropic.com`, `chatgpt.com`, `openai.com`, `labs.google`). Disallowed schemes (e.g. `javascript:`, `file:`, `data:`) and unexpected external destinations are rejected.
- **Origin-Restricted Permissions:** Permission requests are evaluated per-origin. Broad permissions (`geolocation`, `clipboard-read`, `notifications`) are denied by default; media/audio input permissions are granted only to verified AI service domains for voice prompting.
- **Webview Isolation:** Guest webviews run sandboxed with remote Node integration disabled, web security enforced, and unauthorized renderer preloads stripped at attachment time.
- **Persistent Session Partition:** Uses `partition="persist:clean_chrome_v3"` across webviews so legitimate authenticated sessions and preferences persist across restarts.
- **No Identity Spoofing or Secret Circumvention:** Does not tamper with browser fingerprint headers (`sec-ch-ua`, User-Agent spoofing) or automation flags, and does not extract, import, or store third-party authentication cookies or session secrets.

### Authentication & Supported Sign-In Flows

- **Claude & ChatGPT:** Support direct in-webview authentication using standard email, password, or magic link sign-in flows. Sessions are preserved in the persistent partition.
- **Google Services (YouTube Studio, Gemini, Google Flow):** Google restricts sign-in from embedded Chromium / Electron webviews under its secure browser policy (*"This browser or app may not be secure"*). AI Mission Control provides one-click ordinary browser navigation alternatives to open these services in your default system browser when embedded authentication is restricted.

---

## 3 Workspace Modes

1. **Mode 1: Analytics & Ideation**
   - Left (45%): YouTube Studio (`https://studio.youtube.com`)
   - Right (55%): Claude (`https://claude.ai`)
2. **Mode 2: Prompt Engineering**
   - Left (45%): Claude (`https://claude.ai`)
   - Center (Collapsible): Handoff & Parser Panel
   - Right (Flex-1): ChatGPT (`https://chatgpt.com`)
3. **Mode 3: Visual Studio**
   - Left Sidebar (25%): Scene Cards Manager (Pinned Global Rules + Scenes)
   - Center (Flex-1): Gemini (`https://gemini.google.com/app`)
   - Right (Flex-1): Google Flow (`https://labs.google/fx/tools/flow`)

---

## Quick Start Commands

### 1. Install Dependencies
```bash
npm install
```

### 2. Run in Development Mode (Vite HMR + Electron)
```bash
npm run dev
```

### 3. Run Automated Tests
```bash
npm test
```

### 4. Build & Run Production Version
> **Note:** Run `npm run build` before `npm start` to generate the production client bundle in `dist/`.

```bash
npm run build
npm start
```
