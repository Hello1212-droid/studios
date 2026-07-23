# Tech Stack: StudyOS

This document defines the architecture, frameworks, and system integrations used in the StudyOS project.

## Frontend & Core Logic
- **Framework**: React 19 + TypeScript
- **Bundler**: Vite 7
- **Styling**: Tailwind CSS 4
- **Animations**: Framer Motion 12
- **Data Persistence**: `localStorage` (StudyStore) utilizing standard TypeScript storage schemas.

## Desktop Shell
- **Runtime**: Electron 41 (Node.js CommonJS Main, ESM Renderer)
- **Isolation/Security**:
  - Context isolation enabled with custom bridge definitions.
  - Multi-session headers interceptors and customized cookie management.
  - Custom `preload.cjs` executing main world stealth scripts to bypass bot detection.

## Artificial Intelligence
- **Integrations**: Groq SDK & OpenAI SDK
- **Models**: Groq (Llama 3.1 8B Instant), NVIDIA NIM (GLM-5)

## System & OS Integration
- **Platform**: Windows OS
- **Shell Commands**: Windows PowerShell / WMI (Windows Management Instrumentation) for controlling system audio volume and monitor brightness.
- **Process Management**: `tasklist` and `taskkill` via Node.js `child_process.exec` to control explorer shell.
