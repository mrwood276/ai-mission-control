# Storyboard-to-Google-Flow Production Pipeline

This document describes the architecture, data contracts, validation rules, and operational workflow of the end-to-end **Claude Storyboard → ChatGPT Prompt Engineering → Google Flow Delivery** pipeline in AI Mission Control.

---

## 1. Pipeline Overview & The 5 Production Stages

```
[ Stage 1: Claude ]
  Storyboard Ideation & Scripting (in Mode 1 or Mode 2)
         │
         ▼
[ Stage 2: Storyboard Intake ]
  Input validation, heuristic check, aspect ratio & artistic style selection
  (Statuses: empty, source-entered, source-needs-review, source-validated)
         │
         ▼
[ Stage 3: ChatGPT Prompt Engineering ]
  Structured director wrapper generation, copied to ChatGPT
  (Outputs: GLOBAL RULES + numbered SCENE prompts)
         │
         ▼
[ Stage 4: Structured Scene Parsing & Safe Import ]
  sceneParser extracts Global Rules, scenes, warnings, unparsed content
  User reviews diff & missing rule strategy (keep active, defaults, clear)
         │
         ▼
[ Stage 5: Quality Gate & Verified Google Flow Delivery ]
  Canonical prompt composition, token estimation, contradiction checks,
  DOM injection with readback verification and manual clipboard fallback
```

---

## 2. Stage-by-Stage Workflow Specification

### Stage 1: Claude Storyboard Ideation
- **Environment**: Embedded Claude webview (`https://claude.ai`) in **Mode 1 (Analytics & Ideation)** or **Mode 2 (Prompt Engineering)**.
- **Handoff**: The creator drafts their video concept or script in Claude. Because webviews run in sandboxed contexts without privileged scraping extensions, the creator copies the resulting script or passages to the system clipboard or pastes directly into Mission Control.

### Stage 2: Storyboard Intake & Source Validation
- **Module**: `src/utils/storyboardIntake.js`
- **Actions**:
  - **Manual Entry / Paste**: The creator can paste or edit text in the intake dialog.
  - **Read Clipboard**: Safely attempts `navigator.clipboard.readText()`. If the clipboard is empty or denied, clear instructions are displayed rather than substituting false placeholders.
  - **Heuristic Validation**: Checks for scene/shot indicators, narrative structure, and flags non-storyboard content (e.g. source code, raw JSON, stack traces).
- **Intake States**:
  - `empty`: No source text provided.
  - `source-entered`: Text is present but pending analysis.
  - `source-needs-review`: Content is unusually brief, missing explicit scene markers, or resembles non-storyboard data.
  - `source-validated`: Passed heuristic checks with detected scene markers.
  - `wrapper-ready`: Template built and ready for dispatch.
  - `copied-to-clipboard`: Complete wrapper written to system clipboard.
  - `failed`: Clipboard read or write error.

### Stage 3: Director Prompt Wrapper Template
- **Module**: `src/utils/promptTemplate.js`
- **Capabilities**:
  - **Configurable Aspect Ratio**: Supports `16:9` (horizontal standard), `9:16` (vertical reels/shorts), `1:1` (square), `4:3`, `21:9`, `2.39:1` (anamorphic cinema). Never blindly hardcodes 16:9.
  - **Artistic Style Selection**: Supports photorealistic, 35mm film, Unreal Engine 5 3D, cyberpunk anime, stylized 2D, retro synthwave, or custom descriptive styles.
  - **Verbatim Voice-Over Preservation**: Instructs ChatGPT to preserve all spoken dialogue and voice-over text.
  - **Output Contract**: Directs ChatGPT to emit exactly:
    ```
    GLOBAL RULES:
    [Project-wide visual consistency, lighting, camera, and technical rules]

    SCENE 1: [Short Title]
    [Complete visual video prompt]

    SCENE 2: [Short Title]
    [Complete visual video prompt]
    ```

### Stage 4: Structured Scene Parsing & Safe Import
- **Modules**: `src/utils/sceneParser.js`, `src/utils/projectManager.js`
- **Checks & Taxonomy**:
  - **Blocking Errors**: Empty input, no recognizable scene headings, all scenes containing empty prompts. Import cannot proceed until resolved.
  - **Warnings**: Duplicate scene numbers, out-of-order scenes, empty scene body, unnumbered headings (e.g. `Scene: Title` without number), excessively long prompts (>3500 chars).
  - **Informational Notices**: Global Rules found/missing, preamble captured in unparsed content.
  - **Unparsed Content Retention**: Any text before the first scene (preamble) or unexpected trailing blocks are preserved in `unparsedContent` so no creator thoughts are lost.
- **Safe Import Confirmation**:
  - Explicit choice when Global Rules are missing in the imported output:
    1. *Keep Active Rules*: Retains current project's pinned rules.
    2. *Use Defaults*: Uses project-configured default visual rules.
    3. *Leave Empty*: Sets rules to blank for scene-only prompts.
  - Mode selection: *Replace Active* vs *Append to End*.
  - Canceling leaves active project data completely untouched.

### Stage 5: Prompt Quality Gate & Verified Google Flow Delivery
- **Modules**: `src/utils/promptComposer.js`, `src/utils/webviewInjection.js`
- **Canonical Composition**:
  - Normalizes line endings to standard `\n`.
  - Intelligently detects whether a scene prompt already incorporates the Global Rules, preventing duplicate text injection.
  - Provides character count and approximate token count (`~length / 4`).
- **Quality Gate Evaluations**:
  - Verifies scene identification and non-empty prompt.
  - Flags conflicting aspect ratios (e.g. 16:9 declared in rules vs 9:16 in scene body).
  - Flags unusually large prompts exceeding 3500 characters.
- **Delivery Engine Execution**:
  1. Concurrency lock prevents duplicate or overlapping injection attempts.
  2. Bounded timeout (default 4000ms) with clean timer cancellation.
  3. Targets priority selectors (`contenteditable`, `aria-label="prompt"`, `textarea`).
  4. Dispatches input events and performs **readback verification**: reads `target.innerText` or `target.value` to verify that the field retained the expected text.
  5. If verification succeeds: returns `inserted-verified`.
  6. If webview element is missing, input element is not reachable, or readback verification fails: automatically falls back to system clipboard copy, returning `copied-manual` with actionable guidance to paste via `Ctrl+V`.
  7. **Safety Guarantee**: The engine never clicks Google Flow's "Generate" button, never simulates video render completion, and never marks a scene completed automatically.

---

## 3. Testing & Verification

### Automated Regression Suite
Execute the native Node.js test runner:
```bash
npm test
```
The test suite validates:
- Storyboard intake heuristics, clipboard permissions, and status transitions (`test/pipelineRework.test.js`).
- Director prompt wrapper generation with various aspect ratios and styles (`test/pipelineRework.test.js`).
- Scene parsing, malformed headings, duplicate numbers, unparsed text, and legacy format compatibility (`test/sceneParser.test.js`, `test/reliability.test.js`).
- Safe project import strategies and non-destructive cancellations (`test/projectManager.test.js`, `test/pipelineRework.test.js`).
- Canonical prompt composition, token estimation, and quality gate evaluations (`test/pipelineRework.test.js`).
- Delivery engine readback verification, concurrency locks, and clipboard fallbacks (`test/pipelineRework.test.js`, `test/reliability.test.js`).

### Live Testing & Verification Boundaries
- **Unit / Mock Verification**: Webview injection, readback verification, timeouts, and fallbacks are tested deterministically via mock DOM environments.
- **Live Google Flow Limitations**:
  1. Google accounts require browser-level authentication that is blocked by Google in embedded Chromium webviews (*"This browser or app may not be secure"*). Creators authenticate via system browser if prompted.
  2. External provider DOM updates (Google Flow changing its input element hierarchy) are mitigated by our tiered selector fallback and verified readback. If Google Flow alters its input architecture, the engine truthfully falls back to clipboard copy (`copied-manual`).
