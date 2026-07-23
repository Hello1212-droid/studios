# Workflow & Coding Standards: StudyOS

This document outlines the development guidelines and workflow practices for StudyOS.

## Code Standards
1. **Electron Main vs Renderer Boundaries**:
   - Do not request Node features (`require`, `fs`, etc.) in the React code. Use `window.electronAPI`.
   - Update `main-preload.cjs` when exposing new IPC methods.
2. **Stealth and Security Integrity**:
   - Any guest link clicked in `<webview>` must open in a new tab within the main React window rather than opening a new native window.
   - The stealth injection must happen early at `document_start` to ensure `navigator.webdriver` is falsified.
3. **Recovery-First Engineering**:
   - Any shell changes (e.g. killing explorer) must have corresponding listeners for restoration on crash, exit, or uncaught exception.
4. **No Blockers in Kiosk Mode**:
   - Dialogs, confirms, and alerts must be custom UI dialogs or handled in a non-blocking way to prevent the kiosk shell from hanging.
