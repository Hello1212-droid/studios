# Track: Kiosk Lockdown and Browser Navigation Fixes

## Goal
Establish stable kiosk isolation and correct browser navigation (new-tab handling) for StudyOS.

## Current State
- **COMPLETED**: Kiosk Lockdown and Browser Stealth fully resolved.

## Implementation Summary

### Kiosk Mode
- Dynamic `IS_KIOSK` variable (changed from `const` to `let`) enables runtime toggling
- `enter-kiosk` / `exit-kiosk` IPC handlers working with explorer.exe kill/restore
- Kiosk toggle button on main wallpaper with animated ON/OFF states
- Kiosk status banner visible across the desktop
- State changes broadcast to renderer via `kiosk-state-changed` IPC

### Browser Stealth (Cloudflare + Google OAuth)
- Upgraded stealth shield to Chrome 136 (matching Electron 41)
- Added ALL critical navigator properties: `vendor`, `vendorSub`, `hardwareConcurrency`, `deviceMemory`, `platform`, `languages`, `pdfViewerEnabled`
- Fixed `sec-ch-ua` headers to match Chrome version (136)
- Added Canvas fingerprint noise to prevent hashing
- Added AudioContext fingerprint protection
- Fixed WebGL vendor/renderer spoofing
- Added `navigator.connection` spoofing for realistic network profile
- Complete bot signature cleanup (`__SELENIUM__`, `__DRIVER__`, etc.)
- Google auth URLs auto-redirected to system browser via `shell.openExternal()`
- Enhanced error handling for webview failures (`ERR_BLOCKED_BY_CLIENT`, etc.)

### Key Files Modified
- `preload.cjs` — Complete stealth rewrite (Level 6 Titan)
- `main.cjs` — UA fix, sec-ch-ua headers, open-in-browser IPC
- `main-preload.cjs` — Added open-in-browser invoke channel
- `Browser.tsx` — Google auth detection + system browser redirect
- `App.tsx` — Kiosk toggle button + status banner on wallpaper

## Status
✅ **Complete** — All items resolved.
