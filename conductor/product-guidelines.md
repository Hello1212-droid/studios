# Product Guidelines: StudyOS

## Voice & Tone

StudyOS communicates with the user through two distinct voices:

### 1. System UI (Status Bar, Dock, Window chrome, Boot screen)

- **Tone**: Professional, minimal, confident
- **Style**: Concise labels, no fluff. Think Apple's macOS Human Interface.
- **Labels**: Use sentence case or ALL-CAPS for emphasis (e.g., "The Hard Truth", "Target", "Gap")
- **Feedback**: Subtle animations (springs, fade-ins) for state changes, never intrusive modals

### 2. Neela — The AI Mentor (AureliusAI component)

- **Tone**: Strict, high-signal, direct, but ultimately caring
- **Style**: Professional Markdown (H1, H2, bold, lists). Decisive — never asks for permission to help.
- **Accountability**: Uses mock test data and percentile tracking to hold the user accountable
- **Discipline**: Calls out slacking directly. No sugar-coating.
- **Constraints**: Must never be chatty or redundant. Every response provides value.

## Design Principles

### 1. Zero Distraction

Every UI element must serve the mission: focused exam preparation. No decorative elements that don't serve a purpose. The kiosk/lockdown mode is a core feature, not an afterthought.

### 2. Recovery-First Engineering

Any destructive operation (explorer.exe kill, window state changes) must have a corresponding recovery path:
- Crash handlers restore shell
- `will-quit` and `window-all-closed` events restore shell
- Uncaught exception handlers restore shell
- Single-instance lock prevents duplicate OS instances

### 3. Stealth and Security Integrity

The browser must pass as a genuine Chrome 130 installation to external sites (Cloudflare, PW, YouTube):
- `navigator.webdriver` must be falsified at `document_start`
- User-Agent headers are spoofed per-request
- WebGL fingerprinting is spoofed
- The preload injector must fire before any page script runs

### 4. Context Isolation

The Electron main process and React renderer communicate exclusively through `window.electronAPI` (contextBridge). Raw Node globals (`require`, `fs`, `process`) must never leak into the renderer.

### 5. Agentic AI Integration

Neela has direct read/write access to the StudyStore. Structured `[ACTION]` blocks in AI responses enable programmatic control of the Scheduler, PCM data, and task management without user intervention.

## UI/UX Constraints

- **No native dialogs in kiosk mode**: `alert()`, `confirm()`, `prompt()` must be replaced with custom non-blocking UI
- **Boot sequence**: 1.2s boot animation with fade-out, then gradual window entrance
- **Windows are macOS-style**: Traffic light buttons, glassmorphism, spring animations, dock with magnification

## Environment Targets

| Environment | Kiosk Mode | Notes |
|-------------|-----------|-------|
| **Production (student)** | ✅ Enabled | Full explorer.exe kill, always-on-top, frameless |
| **Development** | ❌ Disabled | IS_KIOSK = false, windowed mode, frame visible |
