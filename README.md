# Creator & AI Pipeline Command Center

A high-performance desktop command center built with **Electron + React (Vite) + Tailwind CSS**, designed to streamline a YouTube content creator's end-to-end AI production pipeline across **YouTube Studio, Claude, ChatGPT, Gemini, and Google Flow**.

## Phase 1 Implementation Summary

- **Desktop Chrome User-Agent & Client Hints Spoofing:** Main process sets Windows Chrome User-Agent and `sec-ch-ua` Client Hints dynamically matching Chromium version on `persist:clean_chrome_v3`.
- **Stealth & Passkey Suppression:** Suppresses automation detection (`AutomationControlled`) and blocks WebAuthentication/Passkey Bluetooth popups.
- **Auth Popup Bypass (The Ultimate Google Fix):** Dedicated `🔑 Google Login` button opens a native `BrowserWindow` with `sandbox: true` sharing `persist:clean_chrome_v3` to complete authentication cleanly without `<webview>` guest detection blocks.
- **Zero-Unmount Webview Architecture:** All 5 `<webview>` instances are mounted continuously in the DOM. Switching between Workspace Modes only updates CSS `flex` / `hidden` and visual flex `order`, ensuring active chats and background Google Flow render tasks are never interrupted.
- **Top Navigation Bar:** Seamless switching between the 3 Workspace Modes with active mode indicators, Google Auth button, partition badges, and reload actions.
- **Bottom Status & Quota Bar:** Status monitors for Claude Free Tier cooldowns, ChatGPT availability, Gemini prompt session loads (0/4), and session persistence.
- **Persistent Partition:** Uses `partition="persist:clean_chrome_v3"` across all webviews to retain cookies and logins indefinitely.

### ⚠️ Panduan & Catatan Keamanan Login
- **Google Login di Embedded Browser:** Google dapat memblokir percobaan login langsung di browser embedded/webview kapan saja (*"This browser or app may not be secure"*). Jalur paling andal dan stabil adalah menggunakan tombol **🍪 Import Cookies** (ekspor cookies dari browser Google Chrome asli).
- **Claude & ChatGPT:** Disarankan menggunakan login langsung dengan email / magic link, atau gunakan fitur Cookie Import jika akun Anda terhubung lewat Google SSO.

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

### 3. Build & Run Production Version
```bash
npm run build
npm start
```
