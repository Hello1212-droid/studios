# Product Context: StudyOS

StudyOS is a hyper-focused desktop environment designed for JEE (Joint Entrance Examination) and competitive exam preparation. It enforces absolute study discipline through a system lockdown (kiosk mode) and integrates study tools.

## Target Audience
- Students preparing for competitive exams (IIT-JEE, NEET, etc.) who require zero distraction.

## Core Features
1. **The "Nuclear Option" System Lockdown**:
   - Disables standard Windows shell features (taskbar, start menu, desktop access) by terminating `explorer.exe` in kiosk mode.
   - Restores the Windows shell cleanly on exit.
2. **Multi-Tab Browser with Bot Stealth**:
   - Custom `<webview>` tabs using Chrome 130 spoofing and navigator stealth to bypass Cloudflare/bot mitigation.
   - Persistent partition (`persist:studyos-v3`) to maintain login states (e.g. Physics Wallah, YouTube).
3. **Agentic AI Mentor (Neela)**:
   - Mentors the student, audits study habits, and can write tasks directly into the scheduler via structured AI actions.
4. **Tactical Scheduler**:
   - Generates study blocks based on time budgets and chapter health.
5. **System Integration**:
   - Hardware controls (brightness, volume) via PowerShell and native integrations.
