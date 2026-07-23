# Conductor — StudyOS

Navigation hub for project context and development orchestration.

## Quick Links

- [Product Definition](./product.md)
- [Product Guidelines](./product-guidelines.md)
- [Tech Stack](./tech-stack.md)
- [Workflow](./workflow.md)
- [Code Styleguides](./code_styleguides/)
- [Tracks](./tracks.md)

## Active Tracks

<!-- Auto-populated by conductor:new-track -->

| Status | Track ID | Title | Phase |
| ------ | -------- | ----- | ----- |

## Project Snapshot

| Attribute | Value |
|-----------|-------|
| **Type** | Electron + React desktop application (kiosk-mode study environment) |
| **Language** | TypeScript / JavaScript (React 19) + Node.js (Electron 41) |
| **Key Frameworks** | Vite 7, Tailwind CSS 4, Framer Motion 12 |
| **AI** | Groq SDK (Llama 3.1), OpenAI SDK (NVIDIA NIM GLM-5 fallback) |

## Getting Started

- `npm run dev` — Start Vite dev server (renderer)
- `npm start` — Launch Electron shell (requires dev server running)
- `npm run start-os` — Concurrently run dev server + Electron (launch StudyOS)
- `launch_studyos.bat` — Full kiosk boot (run as Administrator)

## Conductor CLI Reference

- `/conductor:new-track` — Create a new feature track
- `/conductor:status` — Show project status and active tracks
- `/conductor:implement` — Execute tasks from a track's implementation plan
- `/conductor:revert` — Undo by logical work unit (track, phase, task)
