/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              STUDYOS — REACT ENTRY POINT                     ║
 * ║                                                              ║
 * ║  This is the absolute starting point of the React app.       ║
 * ║  It creates the React root on #root (from index.html) and    ║
 * ║  renders <App /> inside React.StrictMode for dev warnings.   ║
 * ║                                                              ║
 * ║  Everything flows from here:                                 ║
 * ║    main.tsx → App.tsx → Window → <Browser | Scheduler | ...> ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { StrictMode } from "react";      // StrictMode: enables extra dev checks (double-renders, deprecated API warnings)
import { createRoot } from "react-dom/client"; // createRoot: React 18+ way to create a root for concurrent rendering
import "./index.css";                    // Global styles: Tailwind directives + custom CSS utilities (glass, scrollbars, etc.)
import App from "./App";                 // The main App component — the entire desktop shell

/**
 * Mount the React application.
 *
 * React.StrictMode wraps the app to enable:
 *   - Double-invoking effects/state initializers in dev (catches side-effect bugs)
 *   - Warning about deprecated APIs
 *   - No impact in production builds
 *
 * The ! after getElementById is a TypeScript non-null assertion —
 * we KNOW #root exists because index.html defines it.
 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
