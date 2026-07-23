# Gemini Playbook: StudyOS

This file provides context and rules for the Gemini CLI and coding agents working on the StudyOS project.

## Project Rules & Guidelines
- **Kiosk Safety**: Always ensure that when `IS_KIOSK` is set to `true`, `explorer.exe` is terminated to prevent distractions, and is restored gracefully on exit (`will-quit`, `window-all-closed`, `uncaughtException`).
- **Context Isolation**: Always use the context-isolated bridge pattern (`main-preload.cjs` and `window.electronAPI`) rather than exposing raw Node globals or using `require` directly in the renderer.
- **Stealth Preservation**: Do not modify the Cloudflare Stealth injector in `preload.cjs` without thorough verification. Any guest browser traffic must mask automation variables (`navigator.webdriver`).
- **Neela's Agentic Actions**: Neela communicates changes to the React Scheduler using strict `[ACTION]` JSON blocks parsed in the UI.

## Conductor References
- Conductor specifications are located in the `conductor/` directory.
- Product definition: [product.md](file:///c:/Users/anime/OneDrive/Desktop/Focus/build-macos-style-studyos/conductor/product.md)
- Tech Stack definition: [tech-stack.md](file:///c:/Users/anime/OneDrive/Desktop/Focus/build-macos-style-studyos/conductor/tech-stack.md)
- Workflow standards: [workflow.md](file:///c:/Users/anime/OneDrive/Desktop/Focus/build-macos-style-studyos/conductor/workflow.md)
