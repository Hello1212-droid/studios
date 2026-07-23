# StudyOS: Master Session Archive & Agent Context

## Project Mission
StudyOS is a proprietary, hyper-focused desktop environment for Windows, specifically engineered for PCM (Physics, Chemistry, Maths) preparation for competitive exams like IIT-JEE. It enforces discipline through a "Nuclear Option" system lockdown and provides an intelligent, agentic mentor named Neela.

---

## 1. Full Development History & Milestones

### **Milestone 1: Desktop Shell & Kiosk Lockdown**
- **Architecture**: Transitioned from a generic React-Vite web app to a high-priority Electron application.
- **The "Nuclear Option"**: Implemented a mandatory termination of `explorer.exe` on startup. This isolates the user from the Windows Taskbar, Start Menu, and Desktop distractions.
- **Z-Index Priority**: Set the app to `screen-saver` level (highest possible in Windows windowing) to prevent overlays.
- **Fail-Safe Recovery**: Integrated automatic restoration of `explorer.exe` on all exit paths (Normal Quit, Crash, Uncaught Exception).

### **Milestone 2: Multi-Tab Browser with Stealth**
- **Engine**: Switched to Electron's `<webview>` with `contextIsolation` and `sandbox` enabled.
- **Identity Spoofing**: Implemented a custom User-Agent (Chrome 123) and hardware fingerprint spoofing (WebGL, CPU Memory) to bypass bot-detection.
- **Stealth Shield**: Created `preload.cjs` to hide `navigator.webdriver` at the nanosecond of `document_start`.
- **Persistence**: Wired `partition="persist:studyos-v2"` to save all user logins and cookies (acts like Chrome/Edge).
- **Universal Handler**: Custom `onNewWindow` logic ensures every link click opens in a new tab within the OS, never spawning outside browser windows.

### **Milestone 3: PDF Viewer Ecosystem**
- **Architecture**: Standalone React component in the dock.
- **Features**:
    - Multi-tab support for documents.
    - Integration with Electron's `dialog` API for main-system file picking.
    - **Flicker Fix**: Applied `disable-gpu-compositing` switches to handle heavy PDF blobs from sites like Physics Wallah.

### **Milestone 4: Neela - The Agentic Mentor**
- **Intelligence Core**: `neelaBrain.ts` utilizing a multi-provider strategy.
    - Primary: Groq (Llama 3.1 8B Instant) with 4-key rotation.
    - Secondary: NVIDIA NIM (GLM-5) fallback.
    - Tertiary: Heuristic Offline Engine (100% accuracy logic).
- **100% Agentic Control**: Neela has read/write access to the `StudyStore`. She issues `[ACTION]` blocks to:
    - Add/Update/Delete tasks in the Scheduler.
    - Update the PCM (Chapter Health) database.
    - Analyze Break reasons and momentum.
- **Structured Rendering**: Integrated `react-markdown` and `remark-gfm` for professional, high-fidelity responses.

### **Milestone 5: Integrated Scheduler & System Controls**
- **Forge Protocol**: A deterministic algorithm that takes Time Budget + Subject Priority and generates a minute-by-minute mission plan.
- **Carry-Forward Logic**: Automated "Midnight Reset" that moves incomplete tasks from previous days to a high-priority "Debt" list.
- **Hardware Integration**: Real-time Volume and Brightness control via PowerShell IPC in the `StatusBar`.
- **Audit Logging**: A persistent `AuditTrail` that logs every user action (breaks, completions, delays) for AI analysis.

---

## 2. Carry Forward Instructions (For Future Agents)

### **State Management**
- All persistent data lives in `localStorage` under `studyos_data_v3`.
- The `StudyState` interface in `src/utils/studyStore.ts` is the "Single Source of Truth."
- **IMPORTANT**: When modifying the Scheduler, always use the `[ACTION]` block protocol to maintain Neela's agentic integrity.

### **Environment Safety**
- **Kiosk Mode**: `IS_KIOSK` in `main.cjs` toggles the "Nuclear Option." For development/testing, it can be set to `false`.
- **Preload Integrity**: `preload.cjs` must remain "Pure JS" (no `require`). Adding Node APIs here will break Cloudflare stealth.
- **Launcher**: Always use `launch_studyos.bat`. It ensures all ports are cleared and ports are correctly assigned.

### **AI Interaction**
- Neela's persona is **Strict, High-Signal, and Direct**. Do not make her chatty or redundant.
- Always provide Neela with the full `StudyState` in the system prompt to maintain 100% context awareness.

---

## 3. Tech Stack Reference
- **Frontend**: React 19 + Vite + Tailwind 4 + Framer Motion
- **Native**: Electron 41 + Node.js (CommonJS Main, ESM Renderer)
- **AI**: Groq SDK + OpenAI SDK
- **OS**: Windows (PowerShell/WMI)

---
**ARCHIVE GENERATED: MAY 14, 2026**
**STATUS: ALL SYSTEMS NOMINAL**
