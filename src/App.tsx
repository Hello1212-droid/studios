/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              STUDYOS — MAIN APPLICATION COMPONENT             ║
 * ║                                                              ║
 * ║  This is the central orchestrator of the entire desktop UI.  ║
 * ║                                                              ║
 * ║  Responsibilities:                                           ║
 * ║    1. Boot screen animation (1.2s splash)                    ║
 * ║    2. Window manager: open/close/minimize/focus windows      ║
 * ║    3. macOS-style Dock with magnification                    ║
 * ║    4. Desktop icons (top-right shortcuts)                    ║
 * ║    5. Kiosk lockdown toggle (desktop Electron mode only)     ║
 * ║    6. StudyStore: carry-forward tasks on new day             ║
 * ║    7. "Hard Truth" wallpaper widget with JEE percentile      ║
 * ║                                                              ║
 * ║  Apps rendered inside windows:                               ║
 * ║    • Browser   → Hyperbeam cloud browser                     ║
 * ║    • PdfViewer → Local and remote PDF reader                 ║
 * ║    • Aurelius  → Neela AI Mentor (Groq/NVIDIA-powered)       ║
 * ║    • Timer     → Pomodoro study session timer                ║
 * ║    • Scheduler → Forge Protocol study plan generator         ║
 * ║    • TestEngine → JEE 2027 percentile prediction engine      ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import React, { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

// ── Lucide Icons ───────────────────────────────────────────────
// Each app gets a unique icon from lucide-react's icon set.
import {
  Globe,          // Browser icon
  Timer,          // StudySession icon
  CalendarDays,   // Scheduler icon
  GraduationCap,  // TestEngine + boot screen icon
  Power,          // "Terminate StudyOS" dock icon
  Brain,          // Aurelius AI icon
  FileText,       // PDF Viewer icon
  Shield,         // Lockdown mode (unlocked state)
  Lock            // Lockdown mode (locked state)
} from 'lucide-react';

// ── Components ─────────────────────────────────────────────────
import Window from './components/Window';               // macOS-style draggable window chrome
import Dock from './components/Dock';                   // macOS-style dock with magnification
import StatusBar from './components/StatusBar';         // Top menu bar with clock + controls
import Browser from './components/Browser';             // Hyperbeam cloud browser
import StudySession from './components/StudySession';   // Pomodoro study timer
import Scheduler from './components/Scheduler';         // Forge Protocol scheduler
import AureliusAI from './components/AureliusAI';       // Neela AI mentor
import PdfViewer from './components/PdfViewer';         // PDF document viewer
import TestResultEngine from './components/TestResultEngine'; // JEE percentile engine

// ── Utilities ─────────────────────────────────────────────────
// studyStore manages all persistent data: tasks, test results,
// chat history, audit log, and carry-forward logic.
import {
  loadState,                  // Load StudyState from localStorage
  saveState,                  // Persist StudyState to localStorage
  calculateCarryForward,      // Move incomplete tasks to debt list on new day
  StudyState                  // TypeScript type for the full app state
} from './utils/studyStore';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * AppId — Unique identifier for each app/window in the desktop.
 * This union type ensures type safety when referencing apps.
 */
type AppId = 'browser' | 'timer' | 'scheduler' | 'aurelius' | 'pdfviewer' | 'testengine';

/**
 * AppWindowState — Runtime state for each window instance.
 *   isOpen:       Whether the window exists (true → rendered, false → destroyed)
 *   isMinimized:  Whether the window is hidden to the dock
 *   zIndex:       Stacking order (higher = on top). Incremented on focus.
 */
interface AppWindowState {
  id: AppId;
  isOpen: boolean;
  isMinimized: boolean;
  zIndex: number;
}

// ═══════════════════════════════════════════════════════════════
// APP CONFIGURATION
// ═══════════════════════════════════════════════════════════════

/**
 * APP_CONFIG — Static configuration for each app window.
 *
 * Each entry defines:
 *   title        → Window title bar text
 *   icon         → Lucide icon react node (15px for title bar)
 *   color        → Accent color (dock icon bg, desktop icon bg)
 *   accent       → Window focus border color
 *   defaultSize  → Initial window dimensions
 *   defaultPos   → Initial window position (function to compute based on screen)
 *   minWidth/Height → Minimum resize dimensions
 */
const APP_CONFIG: Record<AppId, {
  title: string;
  icon: React.ReactNode;
  color: string;
  accent: string;
  defaultSize: { width: number; height: number };
  defaultPos: (i: number) => { x: number; y: number };
  minWidth: number;
  minHeight: number;
}> = {
  // ── Hyperbeam Browser ───────────────────────────────────────
  // Purple/violet accent to distinguish from the older blue browser.
  browser: {
    title: 'Hyperbeam Browser',
    icon: <Globe size={15} />,
    color: '#8B5CF6',          // Violet purple (#8B5CF6)
    accent: '#8B5CF6',
    defaultSize: { width: 1000, height: 700 },
    defaultPos: () => ({ x: 60, y: 50 }),
    minWidth: 500,
    minHeight: 400,
  },

  // ── PDF Viewer ──────────────────────────────────────────────
  pdfviewer: {
    title: 'PDF Viewer',
    icon: <FileText size={15} />,
    color: '#F04A00',          // Orange-red
    accent: '#F04A00',
    defaultSize: { width: 900, height: 800 },
    defaultPos: () => ({ x: 120, y: 30 }),
    minWidth: 600,
    minHeight: 500,
  },

  // ── Aurelius AI Mentor ──────────────────────────────────────
  aurelius: {
    title: 'Aurelius Mentor',
    icon: <Brain size={15} />,
    color: '#6366f1',          // Indigo
    accent: '#6366f1',
    defaultSize: { width: 850, height: 650 },
    defaultPos: () => ({ x: 100, y: 80 }),
    minWidth: 600,
    minHeight: 500,
  },

  // ── Study Session (Pomodoro Timer) ─────────────────────────
  timer: {
    title: 'Study Session',
    icon: <Timer size={15} />,
    color: '#007AFF',          // Apple blue
    accent: '#007AFF',
    defaultSize: { width: 380, height: 580 },
    // Position on the right side of the screen
    defaultPos: () => ({ x: window.innerWidth - 420, y: 50 }),
    minWidth: 340,
    minHeight: 480,
  },

  // ── Study Scheduler (Forge Protocol) ────────────────────────
  scheduler: {
    title: 'Study Scheduler',
    icon: <CalendarDays size={15} />,
    color: '#BF5AF2',          // Purple
    accent: '#BF5AF2',
    defaultSize: { width: 420, height: 580 },
    // Positioned left of the timer (two side-by-side panels)
    defaultPos: () => ({ x: window.innerWidth - 860, y: 50 }),
    minWidth: 360,
    minHeight: 400,
  },

  // ── Test Engine (JEE Percentile Predictor) ──────────────────
  testengine: {
    title: 'Test Engine',
    icon: <GraduationCap size={15} />,
    color: '#10b981',          // Emerald green
    accent: '#10b981',
    defaultSize: { width: 800, height: 600 },
    defaultPos: () => ({ x: 150, y: 100 }),
    minWidth: 600,
    minHeight: 500,
  },
};

/**
 * DOCK_ICONS — Larger icons (28px) for the dock.
 * Each app gets a 28px version of its Lucide icon.
 */
const DOCK_ICONS: Record<AppId, React.ReactNode> = {
  browser:    <Globe size={28} />,
  pdfviewer:  <FileText size={28} />,
  aurelius:   <Brain size={28} />,
  timer:      <Timer size={28} />,
  scheduler:  <CalendarDays size={28} />,
  testengine: <GraduationCap size={28} />,
};

// ── Global Z-Index Counter ─────────────────────────────────────
// Starts at 10. Each focus/minimize cycle increments it.
// This ensures the most recently focused window is always on top.
let zCounter = 10;

// ═══════════════════════════════════════════════════════════════
// APP COMPONENT
// ═══════════════════════════════════════════════════════════════

const App: React.FC = () => {
  // ── Electron Detection ──────────────────────────────────────
  // In the Electron desktop app, window.electronAPI is exposed
  // by main-preload.cjs via contextBridge. In browser (GitHub Pages),
  // it's undefined. We use this to gate desktop-only features.
  // @ts-ignore — electronAPI is injected at runtime
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  // ══════════════════════════════════════════════════════════
  // STUDY STORE (PERSISTENT DATA)
  // ══════════════════════════════════════════════════════════

  /**
   * studyState — The single source of truth for all persistent data.
   * Stored in localStorage under key 'studyos_data_v3'.
   *
   * Contains: tasks, test results, chat history, audit log,
   * PCM chapter health, session state, user config.
   *
   * loadState() reads from localStorage and returns the parsed
   * StudyState or a fresh default if none exists.
   */
  const [studyState, setStudyState] = useState<StudyState>(loadState());

  /**
   * Carry-Forward Logic
   * ──────────────────────────────────────────────────────────
   * On every mount, check if lastLogin !== today.
   * If a new day has started, calculateCarryForward() converts
   * all incomplete past tasks into "debt" tasks (isDebt: true),
   * so they show up as high-priority items in the scheduler.
   */
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];  // "2026-07-24"
    if (studyState.lastLogin !== today) {
      const updatedTasks = calculateCarryForward(studyState.tasks);
      setStudyState(prev => ({ ...prev, tasks: updatedTasks, lastLogin: today }));
    }
  }, []); // Empty dependency array → runs once on mount

  /**
   * Auto-save to localStorage whenever studyState changes.
   * This ensures data persists across page reloads and crashes.
   */
  useEffect(() => {
    saveState(studyState);
  }, [studyState]);

  // ══════════════════════════════════════════════════════════
  // WINDOW MANAGEMENT
  // ══════════════════════════════════════════════════════════

  /**
   * apps — Array of AppWindowState for all 6 apps.
   * Initial state: all closed, all at zIndex 10.
   */
  const [apps, setApps] = useState<AppWindowState[]>([
    { id: 'browser',    isOpen: false, isMinimized: false, zIndex: 10 },
    { id: 'pdfviewer',  isOpen: false, isMinimized: false, zIndex: 10 },
    { id: 'aurelius',   isOpen: false, isMinimized: false, zIndex: 10 },
    { id: 'timer',      isOpen: false, isMinimized: false, zIndex: 10 },
    { id: 'scheduler',  isOpen: false, isMinimized: false, zIndex: 10 },
    { id: 'testengine', isOpen: false, isMinimized: false, zIndex: 10 },
  ]);

  /** activeApp — Which window currently has focus (null if none). */
  const [activeApp, setActiveApp] = useState<AppId | null>(null);

  /** bootComplete — Controls the splash screen animation. */
  const [bootComplete, setBootComplete] = useState(false);

  // Boot animation: after 1.2 seconds, fade out the splash screen.
  useEffect(() => {
    setTimeout(() => setBootComplete(true), 1200);
  }, []);

  /**
   * getTopZ() — Returns the next z-index by incrementing the global counter.
   * Every window focus/restore gets a higher z-index than any previous.
   */
  const getTopZ = () => ++zCounter;

  /**
   * openApp(id) — Opens a closed window (or restores a minimized one).
   * Sets isOpen: true, isMinimized: false, and bumps zIndex.
   * Also sets this app as the active (focused) app.
   */
  const openApp = useCallback((id: AppId) => {
    setApps(prev => prev.map(app =>
      app.id === id
        ? { ...app, isOpen: true, isMinimized: false, zIndex: getTopZ() }
        : app
    ));
    setActiveApp(id);
  }, []);

  /**
   * closeApp(id) — Closes an open window completely.
   * Sets isOpen: false, isMinimized: false (reset for next open).
   * If the closed window was active, clears activeApp.
   */
  const closeApp = useCallback((id: AppId) => {
    setApps(prev => prev.map(app =>
      app.id === id
        ? { ...app, isOpen: false, isMinimized: false }
        : app
    ));
    setActiveApp(prev => prev === id ? null : prev);
  }, []);

  /**
   * minimizeApp(id) — Minimizes a window to the dock.
   * Sets isMinimized: true (Window component returns null).
   * Minimized windows appear as floating chips above the dock.
   */
  const minimizeApp = useCallback((id: AppId) => {
    setApps(prev => prev.map(app =>
      app.id === id
        ? { ...app, isMinimized: true }
        : app
    ));
    setActiveApp(prev => prev === id ? null : prev);
  }, []);

  /**
   * focusApp(id) — Brings an app to the front.
   * Bumps zIndex, restores from minimized, and sets as active.
   * Used when clicking a minimized window chip or dock icon.
   */
  const focusApp = useCallback((id: AppId) => {
    setApps(prev => prev.map(app =>
      app.id === id
        ? { ...app, zIndex: getTopZ(), isMinimized: false }
        : app
    ));
    setActiveApp(id);
  }, []);

  /**
   * toggleApp(id) — Smart dock toggle behavior:
   *   1. If closed → open
   *   2. If minimized → restore and focus
   *   3. If open AND active → minimize (dock-style hide)
   *   4. If open but NOT active → focus it
   *
   * This matches macOS dock behavior exactly.
   */
  const toggleApp = useCallback((id: AppId) => {
    const app = apps.find(a => a.id === id);
    if (!app) return;
    if (!app.isOpen) {
      openApp(id);
    } else if (app.isMinimized) {
      focusApp(id);
    } else if (activeApp === id) {
      minimizeApp(id);
    } else {
      focusApp(id);
    }
  }, [apps, activeApp, openApp, focusApp, minimizeApp]);

  /**
   * dockApps — Transformed apps array for the Dock component.
   * Maps AppWindowState → DockApp format expected by Dock.tsx.
   */
  const dockApps = apps.map(app => ({
    id: app.id,
    label: APP_CONFIG[app.id].title,
    icon: DOCK_ICONS[app.id],
    isOpen: app.isOpen,
    isActive: app.id === activeApp && !app.isMinimized,
    color: APP_CONFIG[app.id].color,
    onClick: () => toggleApp(app.id),
  }));

  /**
   * exitDockApp — The "Terminate StudyOS" button at the dock's right edge.
   * In Electron: sends 'exit-app' IPC to quit the app.
   * In browser: shows an alert (the browser can't be quit programmatically).
   */
  const exitDockApp = {
    id: 'exit',
    label: 'Terminate StudyOS',
    icon: <Power size={28} />,
    isOpen: false,
    isActive: false,
    color: '#ef4444',   // Red accent
    onClick: () => {
      if (isElectron) {
        try {
          // @ts-ignore — electronAPI.send sends IPC message to main.cjs
          window.electronAPI.send("exit-app");
        } catch (e) { /* Silently fail in browser */ }
      } else {
        alert("Exit is only available in Desktop mode.");
      }
    }
  };

  /** finalDockApps — Regular apps + the exit button at the end. */
  const finalDockApps = [...dockApps, exitDockApp];

  /**
   * renderWindowContent(id) — Returns the inner content for each app window.
   * Route the AppId to the correct React component.
   * The Window component wraps this with chrome (title bar, buttons, resize).
   */
  const renderWindowContent = (id: AppId) => {
    switch (id) {
      case 'browser':
        return <Browser />;
      case 'pdfviewer':
        return <PdfViewer />;
      case 'aurelius':
        return <AureliusAI studyState={studyState} setStudyState={setStudyState} />;
      case 'timer':
        return <StudySession />;
      case 'scheduler':
        return <Scheduler studyState={studyState} setStudyState={setStudyState} />;
      case 'testengine':
        return <TestResultEngine studyState={studyState} setStudyState={setStudyState} />;
    }
  };

  // ══════════════════════════════════════════════════════════
  // KIOSK MODE (DESKTOP ELECTRON ONLY)
  // ══════════════════════════════════════════════════════════

  /** kioskActive — Whether the system lockdown is currently engaged. */
  const [kioskActive, setKioskActive] = useState(false);

  /**
   * Listen for kiosk state changes from the Electron main process.
   * main.cjs sends 'kiosk-state-changed' events when kiosk is toggled
   * from within window components (Scheduler, StudySession).
   */
  useEffect(() => {
    if (isElectron) {
      try {
        // @ts-ignore
        window.electronAPI.on('kiosk-state-changed', (active: boolean) => {
          setKioskActive(active);
        });
      } catch (e) {
        console.error('[StudyOS] Failed to register kiosk state listener:', e);
      }
    }
  }, [isElectron]);

  /** enterKiosk — Sends IPC to main process to engage system lockdown. */
  const enterKiosk = useCallback(() => {
    if (isElectron) {
      try {
        // @ts-ignore
        window.electronAPI.send('enter-kiosk');
        setKioskActive(true);
      } catch (e) {
        console.error('[StudyOS] Failed to enter kiosk:', e);
      }
    }
  }, [isElectron]);

  /** exitKiosk — Sends IPC to main process to release system lockdown. */
  const exitKiosk = useCallback(() => {
    if (isElectron) {
      try {
        // @ts-ignore
        window.electronAPI.send('exit-kiosk');
        setKioskActive(false);
      } catch (e) {
        console.error('[StudyOS] Failed to exit kiosk:', e);
      }
    }
  }, [isElectron]);

  /** toggleKiosk — Flips the lockdown state on/off. */
  const toggleKiosk = useCallback(() => {
    if (kioskActive) {
      exitKiosk();
    } else {
      enterKiosk();
    }
  }, [kioskActive, enterKiosk, exitKiosk]);

  // ══════════════════════════════════════════════════════════
  // WALLPAPER WIDGET DATA
  // ══════════════════════════════════════════════════════════

  /**
   * latestResult — The most recent test result (index 0 is newest).
   * Used to display the "Hard Truth" percentile message on the wallpaper.
   */
  const latestResult = studyState.testResults?.[0];

  /** targetPercentile — The target for the next test attempt. Default: 99.5%. */
  const targetPercentile = latestResult?.targetPercentile || 99.5;

  /** currentEquiv — The user's current JEE-equivalent percentile. Default: 0. */
  const currentEquiv = latestResult?.jeeEquivalentPercentile || 0;

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════

  return (
    /**
     * The root container: fixed to fill the entire viewport.
     * overflow-hidden prevents page-level scrolling.
     * select-none disables text selection across the desktop (re-enabled in input areas).
     */
    <div
      className="fixed inset-0 overflow-hidden select-none"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* ══════════════════════════════════════════════════════
          BOOT SPLASH SCREEN
          ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {!bootComplete && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-black"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center gap-8"
            >
              {/* App icon in a blue gradient rounded square */}
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-2xl">
                <GraduationCap size={40} className="text-white" />
              </div>
              {/* App name + tagline */}
              <div className="text-center">
                <div className="text-white text-3xl font-bold tracking-tight">StudyOS</div>
                <div className="text-white/40 text-sm mt-1">Your Productivity Desktop</div>
              </div>
              {/* Three loading dots with staggered pulse animation */}
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-white/40"
                    animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════
          DESKTOP WALLPAPER
          ══════════════════════════════════════════════════════ */}
      {/* Background image from /public/wallpaper.jpg */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: 'url(/wallpaper.jpg)' }}
      />
      {/* Dark overlay (60% opacity) for readability */}
      <div className="absolute inset-0 bg-black/60" />

      {/* ══════════════════════════════════════════════════════
          KIOSK LOCKDOWN BANNER
          ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {kioskActive && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="absolute top-7 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          >
            {/* Lock icon + red warning pill */}
            <div className="flex items-center gap-2.5 px-5 py-2 rounded-full bg-red-500/20 border border-red-500/30 backdrop-blur-md shadow-2xl shadow-red-900/30">
              {/* Pulsing lock icon */}
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Lock size={12} className="text-red-400" />
              </motion.div>
              {/* Warning text */}
              <span className="text-red-400 text-[11px] font-black uppercase tracking-[0.15em]">
                System Lockdown Active — Full Kiosk Mode
              </span>
              {/* Pulse dot (breathing indicator) */}
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════
          "HARD TRUTH" WALLPAPER WIDGET
          ══════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: bootComplete ? 1 : 0, x: 0 }}
        transition={{ delay: 1, duration: 1 }}
        className="absolute top-1/2 left-20 -translate-y-1/2 max-w-xl"
      >
        <div className="flex flex-col gap-6">
          {/* Dynamic truth message based on test results */}
          <div>
            <div className="text-blue-400 text-xs font-black uppercase tracking-[0.3em] mb-4">
              The Hard Truth
            </div>
            <h1 className="text-white text-5xl font-black leading-tight tracking-tighter">
              {currentEquiv > 0
                ? `You are at ${currentEquiv}% JEE Equivalent. The elite 1% requires obsession, not just effort.`
                : "The first step is always the hardest. Log your first mock result to reveal your reality."}
            </h1>
          </div>

          {/* Target + Gap stat cards */}
          <div className="flex items-center gap-8">
            {/* Target percentile card */}
            <div className="glass p-6 rounded-3xl border border-white/5 min-w-[200px]">
              <div className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">Target</div>
              <div className="text-3xl font-black text-purple-400 tracking-tighter">{targetPercentile}%</div>
              <div className="text-[10px] text-white/20 mt-1 uppercase font-bold tracking-tighter">Next Milestone</div>
            </div>

            {/* Gap (distance to target) card */}
            <div className="glass p-6 rounded-3xl border border-white/5 min-w-[200px]">
              <div className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">Gap</div>
              <div className="text-3xl font-black text-red-500 tracking-tighter">-{Math.max(0, targetPercentile - currentEquiv).toFixed(2)}%</div>
              <div className="text-[10px] text-white/20 mt-1 uppercase font-bold tracking-tighter">To Elite Bracket</div>
            </div>

            {/* ══════════════════════════════════════════════════
                KIOSK TOGGLE BUTTON
                ══════════════════════════════════════════════════ */}
            <motion.button
              onClick={toggleKiosk}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className={`relative p-6 rounded-3xl min-w-[180px] border transition-all duration-300 overflow-hidden ${
                kioskActive
                  ? 'bg-red-500/15 border-red-500/40 shadow-lg shadow-red-500/20'
                  : 'glass border-white/5 hover:border-white/20 hover:bg-white/[0.03]'
              }`}
            >
              {/* Animated pulse ring when kiosk is active */}
              {kioskActive && (
                <motion.div
                  className="absolute inset-0 rounded-3xl"
                  animate={{ boxShadow: ['0 0 0 0 rgba(239,68,68,0.3)', '0 0 0 20px rgba(239,68,68,0)'] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
              <div className="flex flex-col items-center gap-2 relative z-10">
                <motion.div
                  animate={kioskActive ? { rotate: [0, -10, 10, -10, 0] } : {}}
                  transition={{ duration: 0.5 }}
                  className={`p-2.5 rounded-2xl ${
                    kioskActive ? 'bg-red-500/30 text-red-400' : 'bg-white/10 text-white/40'
                  }`}
                >
                  {kioskActive ? <Lock size={22} /> : <Shield size={22} />}
                </motion.div>
                <div className="text-[10px] font-black uppercase tracking-widest">
                  <span className={kioskActive ? 'text-red-400' : 'text-white/50'}>
                    {kioskActive ? 'LOCKDOWN ACTIVE' : 'LOCKDOWN MODE'}
                  </span>
                </div>
                <div className={`text-[8px] font-bold uppercase tracking-wider ${kioskActive ? 'text-red-300/60' : 'text-white/30'}`}>
                  {kioskActive ? 'Tap to release' : 'Tap to secure'}
                </div>
                {!isElectron && (
                  <div className="text-[8px] text-amber-500/60 font-bold uppercase mt-1">Desktop Only</div>
                )}
              </div>
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════
          STATUS BAR (TOP)
          ══════════════════════════════════════════════════════ */}
      <StatusBar />

      {/* ══════════════════════════════════════════════════════
          DESKTOP ICONS (TOP-RIGHT)
          ══════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: bootComplete ? 1 : 0 }}
        transition={{ delay: 0.3 }}
        className="absolute top-12 right-4 flex flex-col gap-3"
      >
        {apps.map(app => (
          <button
            key={app.id}
            /** Double-click to open (macOS desktop behavior) */
            onDoubleClick={() => openApp(app.id)}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl desktop-icon w-20 text-center"
          >
            {/* Colored gradient icon background */}
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white"
              style={{
                background: `linear-gradient(145deg, ${APP_CONFIG[app.id].color}cc, ${APP_CONFIG[app.id].color}88)`
              }}
            >
              {DOCK_ICONS[app.id]}
            </div>
            {/* App label (use second word if multi-word title, e.g., "Browser" from "Hyperbeam Browser") */}
            <span className="text-white text-xs font-medium leading-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
              {APP_CONFIG[app.id].title.split(' ').length > 1
                ? APP_CONFIG[app.id].title.split(' ')[1]
                : APP_CONFIG[app.id].title}
            </span>
          </button>
        ))}
      </motion.div>

      {/* ══════════════════════════════════════════════════════
          WINDOWS
          ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {/* Render only open AND non-minimized windows */}
        {apps
          .filter(app => app.isOpen && !app.isMinimized)
          .map(app => {
            const cfg = APP_CONFIG[app.id];
            return (
              <Window
                key={app.id}
                id={app.id}
                title={cfg.title}
                icon={cfg.icon}
                isActive={activeApp === app.id}
                isMinimized={app.isMinimized}
                zIndex={app.zIndex}
                initialPosition={cfg.defaultPos(0)}
                initialSize={cfg.defaultSize}
                onFocus={() => focusApp(app.id)}
                onClose={() => closeApp(app.id)}
                onMinimize={() => minimizeApp(app.id)}
                minWidth={cfg.minWidth}
                minHeight={cfg.minHeight}
                accentColor={cfg.accent}
              >
                {renderWindowContent(app.id)}
              </Window>
            );
          })}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════
          DOCK (BOTTOM)
          ══════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: bootComplete ? 1 : 0 }}
        transition={{ delay: 0.5 }}
      >
        <Dock apps={finalDockApps} />
      </motion.div>

      {/* ══════════════════════════════════════════════════════
          MINIMIZED WINDOW CHIPS (ABOVE DOCK)
          ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {apps
          .filter(a => a.isOpen && a.isMinimized)
          .map((app, idx) => (
            <motion.button
              key={`min-${app.id}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              /** Click to restore the minimized window */
              onClick={() => focusApp(app.id)}
              className="fixed bottom-24 glass rounded-xl px-4 py-2 flex items-center gap-2 hover:bg-white/15 transition-colors"
              /** Position chips left-to-right with 160px spacing */
              style={{ left: 20 + idx * 160, zIndex: 35 }}
            >
              {/* Small colored icon */}
              <div
                className="w-5 h-5 rounded-lg flex items-center justify-center text-white"
                style={{ background: APP_CONFIG[app.id].color }}
              >
                {DOCK_ICONS[app.id]}
              </div>
              {/* Window title */}
              <span className="text-white/80 text-xs font-medium">
                {APP_CONFIG[app.id].title}
              </span>
            </motion.button>
          ))}
      </AnimatePresence>
    </div>
  );
};

export default App;
