/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              HYPERBEAM CLOUD BROWSER COMPONENT                ║
 * ║                                                              ║
 * ║  Replaces the old Electron webview-based browser with a      ║
 * ║  full Hyperbeam virtual cloud browser.                       ║
 * ║                                                              ║
 * ║  Architecture (modeled after cloud-chrome-hyperbeam):        ║
 * ║                                                              ║
 * ║  ┌──────────┐    POST /api/vm     ┌──────────┐    HTTPS     ┌──────────────┐
 * ║  │  Browser │ ──────────────────→ │  Vite    │ ───────────→ │ Hyperbeam    │
 * ║  │  (React) │ ←── {embed_url} ── │  Proxy   │ ←── {data}── │ API          │
 * ║  └──────────┘                    └──────────┘              └──────────────┘
 * ║       │                                                           │
 * ║       │  Hyperbeam SDK loads embed_url                            │
 * ║       └──────────────────────────────────────────────────────────→│
 * ║                   Cloud Chromium VM streams into <div>            │
 * ║                                                              ║
 * ║  Session creation strategies (tried in order):                ║
 * ║    1. POST /api/vm        → Vite dev proxy (same-origin)     ║
 * ║    2. Electron IPC        → main.cjs native fetch            ║
 * ║    3. CORS proxy          → proxy-server.cjs or corsproxy.io ║
 * ║                                                              ║
 * ║  Key Features:                                               ║
 * ║    • API key gate (first-open prompt, stored in localStorage)║
 * ║    • Settings sidebar with: API key, Proxy URL, toggles      ║
 * ║    • Real-time connection status badge                        ║
 * ║    • URL navigation bar with back/forward/reload              ║
 * ║    • Session persistence (survives page refresh)              ║
 * ║    • Error handling with retry                                ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Lucide Icons ───────────────────────────────────────────────
import {
  Key,           // API key input icon
  Settings,      // Settings sidebar toggle
  X,             // Close buttons
  Globe,         // Browser globe icon
  Loader2,       // Spinning loader
  AlertCircle,   // Error indicator
  Wifi,          // Connected state
  WifiOff,       // Disconnected state
  Save,          // Save & reconnect
  Trash2,        // Destroy session
  ArrowLeft,     // Back navigation
  ArrowRight,    // Forward navigation
  RotateCw,      // Reload
  Home,          // Start URL input
  Shield,        // Adblock toggle
  Zap,           // Connect button
  Eye,           // Show API key
  EyeOff,        // Hide API key
  Lock,          // Kiosk mode (locked)
  Unlock,        // Kiosk mode (unlocked)
  Monitor,       // Idle state + Dark mode toggle
  Cpu            // Loading animation
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * HyperbeamSession — Represents an active cloud browser VM.
 * Returned by Hyperbeam's POST /v0/vm API.
 *
 *   embedUrl   → URL passed to Hyperbeam SDK to stream the VM
 *   adminToken → Grants admin permissions (tab control, etc.)
 *   sessionId  → Unique ID for this VM instance
 *   createdAt  → Unix timestamp for session age tracking
 */
interface HyperbeamSession {
  embedUrl: string;
  adminToken: string;
  sessionId: string;
  createdAt: number;
}

/**
 * HyperbeamSettings — All user-configurable settings.
 * Persisted to localStorage under 'hyperbeam_settings_v2'.
 *
 *   apiKey    → User's Hyperbeam API key (from Hyperbeam dashboard)
 *   startUrl  → Initial URL the cloud browser navigates to
 *   kiosk     → Whether the VM runs in kiosk mode (no Chrome UI)
 *   adblock   → Enable built-in ad/tracker blocking
 *   darkMode  → Force dark mode on web pages
 *   proxyUrl  → CORS proxy URL (for GitHub Pages deployment)
 */
interface HyperbeamSettings {
  apiKey: string;
  startUrl: string;
  kiosk: boolean;
  adblock: boolean;
  darkMode: boolean;
  proxyUrl: string;
}

// ── Default settings (used when nothing is saved yet) ─────────
const DEFAULT_SETTINGS: HyperbeamSettings = {
  apiKey: '',                             // No default key — user must enter one
  startUrl: 'https://www.google.com',     // Default homepage
  kiosk: false,                           // Normal browser mode by default
  adblock: true,                          // Block ads by default
  darkMode: false,                        // Light pages by default
  proxyUrl: 'http://localhost:3456/proxy', // Local proxy server (npm run proxy)
};

// ── localStorage keys ─────────────────────────────────────────
const STORAGE_KEY = 'hyperbeam_settings_v2';  // Settings persistence
const SESSION_KEY = 'hyperbeam_session_v2';   // Active session persistence

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

const Browser: React.FC = () => {
  // ── STATE ──────────────────────────────────────────────────────

  /**
   * settings — User configuration (API key, toggles, proxy URL).
   * Initialized from localStorage or defaults.
   * The function form of useState ensures it only reads localStorage once.
   */
  const [settings, setSettings] = useState<HyperbeamSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // Merge saved settings over defaults (handles new fields gracefully)
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS; // Corrupted data → fresh start
    }
  });

  /**
   * session — The active Hyperbeam cloud browser session.
   * null = no active session (shows API key prompt).
   * Restored from localStorage on mount so a refresh doesn't lose the VM.
   */
  const [session, setSession] = useState<HyperbeamSession | null>(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // ── UI State ────────────────────────────────────────────────

  /** showSettings — Whether the settings sidebar is open. */
  const [showSettings, setShowSettings] = useState(false);

  /** isLoading — True while creating a Hyperbeam session (POST in progress). */
  const [isLoading, setIsLoading] = useState(false);

  /** error — Current error message (null = no error). Displayed as a banner. */
  const [error, setError] = useState<string | null>(null);

  /**
   * connectionState — Current status of the Hyperbeam video stream.
   * Possible values from Hyperbeam SDK: 'idle' | 'connecting' | 'playing' | 'reconnecting' | 'disconnected'
   * Used to show the connection badge and loading overlay.
   */
  const [connectionState, setConnectionState] = useState<string>('idle');

  /** currentUrl — The URL shown in the address bar. Syncs with the cloud browser. */
  const [currentUrl, setCurrentUrl] = useState(settings.startUrl);

  /** tabTitle — The <title> of the current page in the cloud browser. */
  const [tabTitle, setTabTitle] = useState('Hyperbeam Browser');

  /** showKey — Whether the API key input shows plaintext or password dots. */
  const [showKey, setShowKey] = useState(false);

  // ── Refs ────────────────────────────────────────────────────

  /** containerRef — Points to the <div> where Hyperbeam embeds the VM stream. */
  const containerRef = useRef<HTMLDivElement>(null);

  /** hbRef — Holds the Hyperbeam client instance (from the SDK). Used for tab navigation. */
  const hbRef = useRef<any>(null);

  /** initializedRef — Prevents the auto-open settings effect from running multiple times. */
  const initializedRef = useRef(false);

  // ══════════════════════════════════════════════════════════
  // EFFECTS
  // ══════════════════════════════════════════════════════════

  /**
   * Persist settings to localStorage whenever they change.
   * This runs on EVERY settings change — debouncing isn't needed
   * because settings are simple key-value pairs.
   */
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  /**
   * Persist active session to localStorage.
   * Allows the session to survive a page refresh (the embedUrl
   * remains valid until the VM times out).
   */
  useEffect(() => {
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
  }, [session]);

  /**
   * Auto-open settings sidebar if no API key is configured.
   * Only runs once (controlled by initializedRef).
   * This provides a smooth first-run experience — the user
   * sees the settings immediately without having to find the gear icon.
   */
  useEffect(() => {
    if (!settings.apiKey && !initializedRef.current) {
      setShowSettings(true);
      initializedRef.current = true;
    }
  }, [settings.apiKey]);

  // ══════════════════════════════════════════════════════════
  // SESSION CREATION
  // ══════════════════════════════════════════════════════════

  /** Detect Electron desktop environment for IPC fallback. */
  const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

  /**
   * createSession(overrideKey?)
   * ──────────────────────────────────────────────────────────
   * Creates a new Hyperbeam cloud browser VM.
   *
   * Tries three strategies in order:
   *
   *  Strategy 1: POST /api/vm
   *    → Vite's dev server proxies this to engine.hyperbeam.com/v0/vm
   *    → Same-origin, NO CORS issue. Works in dev mode.
   *    → Pattern borrowed from cloud-chrome-hyperbeam/server.ts
   *
   *  Strategy 2: Electron IPC
   *    → main.cjs has an IPC handler that uses Node's native fetch()
   *    → Node.js doesn't enforce CORS, so this always works
   *
   *  Strategy 3: CORS Proxy (configured in Settings → Proxy URL)
   *    → The proxy server (proxy-server.cjs or corsproxy.io)
   *    → Receives the request server-side and forwards to Hyperbeam
   *    → Used when deploying to GitHub Pages (no backend)
   *
   * On success: sets session state, closes settings, clears errors.
   * On failure: shows a specific error message guiding the user to fix.
   */
  const createSession = useCallback(async (overrideKey?: string) => {
    // Use overridden key or the one in settings
    const apiKey = overrideKey || settings.apiKey;

    // Validate: API key must not be empty
    if (!apiKey.trim()) {
      setError('Please enter your Hyperbeam API key');
      return;
    }

    // Enter loading state
    setIsLoading(true);
    setError(null);
    setConnectionState('connecting');

    // Build the request body for Hyperbeam's /v0/vm endpoint
    const body = JSON.stringify({
      start_url: settings.startUrl || 'https://www.google.com',
      kiosk: settings.kiosk,
      adblock: settings.adblock,
      ublock: settings.adblock,      // uBlock Origin level blocking
      dark: settings.darkMode,
      timeout: { offline: 600 },     // 10 minutes idle before VM shutdown
    });

    // Authorization header with the user's Bearer token
    const authHeaders = {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    };

    // ── Strategy 1: /api/vm (same-origin, Vite proxy → Hyperbeam) ──
    try {
      console.log('[HB] Strategy 1: POST /api/vm');
      const res = await fetch('/api/vm', {
        method: 'POST',
        headers: authHeaders,
        body,
      });

      // If successful, extract session data and finalize
      if (res.ok) {
        const data = await res.json();
        if (data.embed_url) {
          setSession({
            embedUrl: data.embed_url,
            adminToken: data.admin_token,
            sessionId: data.session_id,
            createdAt: Date.now(),
          });
          setSettings(prev => ({ ...prev, apiKey })); // Save successful key
          setShowSettings(false);                      // Close sidebar
          setError(null);
          setIsLoading(false);
          return; // Done!
        }
        // Hyperbeam returned a response but with an error field
        if (data.error) throw new Error(data.error);
      }
      console.log('[HB] /api/vm returned status', res.status);
    } catch (e: any) {
      console.log('[HB] /api/vm failed:', e.message);
      // Fall through to Strategy 2
    }

    // ── Strategy 2: Electron IPC (Node.js main process, no CORS) ──
    if (isElectron) {
      try {
        console.log('[HB] Strategy 2: Electron IPC');
        // Invoke the handler registered in main.cjs via ipcMain.handle()
        const result = await (window as any).electronAPI.invoke(
          'create-hyperbeam-session',
          { apiKey, bodyOpts: JSON.parse(body) }
        );

        if (result?.embed_url) {
          setSession({
            embedUrl: result.embed_url,
            adminToken: result.admin_token,
            sessionId: result.session_id,
            createdAt: Date.now(),
          });
          setSettings(prev => ({ ...prev, apiKey }));
          setShowSettings(false);
          setError(null);
          setIsLoading(false);
          return;
        }
        if (result?.error) throw new Error(result.error);
      } catch (e: any) {
        console.log('[HB] Electron IPC failed:', e.message);
      }
    }

    // ── Strategy 3: CORS Proxy ───────────────────────────────
    try {
      // Build proxy URL from settings
      const proxyBase = settings.proxyUrl || '';
      const targetUrl = 'https://engine.hyperbeam.com/v0/vm';
      const proxyUrl = proxyBase
        ? (proxyBase.includes('%s')
            ? proxyBase.replace('%s', encodeURIComponent(targetUrl))
            : proxyBase + encodeURIComponent(targetUrl))
        : targetUrl;

      console.log('[HB] Strategy 3: Proxy →', proxyUrl.substring(0, 60) + '...');

      const res = await fetch(proxyUrl, {
        method: 'POST',
        headers: { ...authHeaders, 'X-Requested-With': 'XMLHttpRequest' },
        body,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(errText || 'HTTP ' + res.status);
      }

      const data = await res.json();
      if (!data?.embed_url) throw new Error('No embed_url in response');

      setSession({
        embedUrl: data.embed_url,
        adminToken: data.admin_token,
        sessionId: data.session_id,
        createdAt: Date.now(),
      });
      setSettings(prev => ({ ...prev, apiKey }));
      setShowSettings(false);
      setError(null);
    } catch (err: any) {
      const msg = err.message || 'Connection failed';

      // Specific guidance for CORS/network errors
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setError(
          'Cannot reach Hyperbeam API. Run "npm run proxy" then paste http://localhost:3456/proxy in Proxy URL above.'
        );
      } else {
        setError(msg);
      }
      setConnectionState('disconnected');
    } finally {
      setIsLoading(false);
    }
  }, [settings, isElectron]);

  // ══════════════════════════════════════════════════════════
  // HYPERBEAM EMBED INITIALIZATION
  // ══════════════════════════════════════════════════════════

  /**
   * When session changes (new embedUrl), initialize the Hyperbeam SDK.
   *
   * Cleanup function:
   *   - Sets destroyed flag to prevent state updates after unmount
   *   - Calls hb.destroy() to tear down the VM connection
   *
   * Dependency: session?.sessionId
   *   We use sessionId (not the full session object) to avoid
   *   unnecessary re-initializations from reference changes.
   */
  useEffect(() => {
    // Guard: no session or container not yet rendered
    if (!session || !containerRef.current) return;

    let destroyed = false;  // Cleanup flag
    let hb: any = null;     // Hyperbeam client instance

    const initHyperbeam = async () => {
      try {
        // Access the Hyperbeam SDK loaded from CDN (see index.html / vite.config.ts)
        // window.__HYPERBEAM__ is set by the injected <script type="module">
        const Hyperbeam = (window as any).__HYPERBEAM__;

        // If the CDN script hasn't loaded yet (unlikely but defensive)
        if (!Hyperbeam) {
          throw new Error('Hyperbeam SDK not loaded. Please refresh the page.');
        }

        // Abort if component unmounted during async load
        if (destroyed || !containerRef.current) return;

        // Initialize the SDK with the embed URL from session creation
        // This connects to the cloud VM and starts streaming video/audio
        hb = await Hyperbeam(containerRef.current, session.embedUrl, {
          adminToken: session.adminToken,   // Grants tab control permissions
          timeout: 15000,                   // 15s connection timeout
          delegateKeyboard: true,           // Forward all keyboard events to the VM

          // Connection state callback: updates the badge in the toolbar
          onConnectionStateChange: ({ state }: { state: string }) => {
            console.log('[Hyperbeam] Connection:', state);
            setConnectionState(state);
          },

          // Disconnect callback: shows disconnected state
          onDisconnect: ({ type }: { type: string }) => {
            console.log('[Hyperbeam] Disconnected:', type);
            setConnectionState('disconnected');
          },
        });

        // Store the instance for navigation (back/forward/reload)
        if (!destroyed) {
          hbRef.current = hb;

          // Subscribe to tab updates (URL and title changes)
          try {
            hb.tabs?.onUpdated?.addListener?.((_tabId: number, changeInfo: any) => {
              if (changeInfo.title) setTabTitle(changeInfo.title);
              if (changeInfo.url) setCurrentUrl(changeInfo.url);
            });
          } catch (_) {
            // Tab listeners are optional — the SDK may not support them
          }
        }
      } catch (err: any) {
        if (!destroyed) {
          console.error('[Hyperbeam] Init error:', err);

          // Provide user-friendly error messages
          setError(
            err.message?.includes('timeout')
              ? 'Connection timed out. The virtual machine may still be starting. Try refreshing.'
              : 'Failed to load virtual browser. The session may have expired.'
          );
          setConnectionState('disconnected');
        }
      }
    };

    initHyperbeam();

    // Cleanup: runs when session changes or component unmounts
    return () => {
      destroyed = true;
      if (hb) {
        try { hb.destroy(); } catch (_) { /* best-effort cleanup */ }
        hb = null;
      }
      hbRef.current = null;
    };
  }, [session?.sessionId]); // Re-init only when session ID changes

  // ══════════════════════════════════════════════════════════
  // SESSION ACTIONS
  // ══════════════════════════════════════════════════════════

  /**
   * destroySession — Tears down the active Hyperbeam VM.
   *
   *  1. Calls hb.destroy() to disconnect the stream
   *  2. Clears session from state and localStorage
   *  3. Resets UI state (connection, errors, URL, title)
   *
   * After this, the user sees the API key prompt again.
   */
  const destroySession = useCallback(() => {
    if (hbRef.current) {
      try { hbRef.current.destroy(); } catch (_) { }
      hbRef.current = null;
    }
    setSession(null);
    localStorage.removeItem(SESSION_KEY);
    setConnectionState('idle');
    setError(null);
    setTabTitle('Hyperbeam Browser');
    setCurrentUrl(settings.startUrl);
  }, [settings.startUrl]);

  /** handleSaveAndConnect — Clears errors and triggers session creation. */
  const handleSaveAndConnect = () => {
    setError(null);
    createSession();
  };

  // ══════════════════════════════════════════════════════════
  // NAVIGATION
  // ══════════════════════════════════════════════════════════

  /**
   * navigateTo(url) — Tells the Hyperbeam VM to navigate to a URL.
   *
   * Uses hb.tabs.update() which is the Hyperbeam SDK method for
   * programmatic navigation. Falls back to just updating the input.
   */
  const navigateTo = (url: string) => {
    if (!url) return;
    let target = url;

    // Auto-prepend https:// if no protocol
    if (!target.startsWith('http')) target = 'https://' + target;

    // Navigate in the cloud browser
    if (hbRef.current?.tabs?.update) {
      hbRef.current.tabs.update({ url: target });
    }

    // Also update the React state so the input bar stays in sync
    setCurrentUrl(target);
  };

  /** handleUrlSubmit — Called when the user presses Enter in the URL bar. */
  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault(); // Prevent form submission (page reload)
    navigateTo(currentUrl);
  };

  // ══════════════════════════════════════════════════════════
  // CONNECTION STATUS BADGE
  // ══════════════════════════════════════════════════════════

  /**
   * connectionBadge() — Renders a color-coded pill showing the
   * current state of the Hyperbeam VM connection.
   *
   * States:
   *   idle          → Grey, no active VM
   *   connecting    → Amber, spinning loader
   *   playing       → Green, WiFi icon, "Connected"
   *   reconnecting  → Amber, spinning loader
   *   disconnected  → Red, WiFi-off icon
   */
  const connectionBadge = () => {
    const config: Record<string, {
      color: string;
      bg: string;
      icon: React.ReactNode;
      label: string;
    }> = {
      idle: {
        color: 'text-white/40', bg: 'bg-white/5',
        icon: <Monitor size={10} />, label: 'Idle'
      },
      connecting: {
        color: 'text-amber-400', bg: 'bg-amber-500/10',
        icon: <Loader2 size={10} className="animate-spin" />, label: 'Connecting'
      },
      playing: {
        color: 'text-green-400', bg: 'bg-green-500/10',
        icon: <Wifi size={10} />, label: 'Connected'
      },
      reconnecting: {
        color: 'text-amber-400', bg: 'bg-amber-500/10',
        icon: <Loader2 size={10} className="animate-spin" />, label: 'Reconnecting'
      },
      disconnected: {
        color: 'text-red-400', bg: 'bg-red-500/10',
        icon: <WifiOff size={10} />, label: 'Disconnected'
      },
    };

    const c = config[connectionState] || config.idle;

    return (
      <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${c.bg} ${c.color} text-[9px] font-black uppercase tracking-wider`}>
        {c.icon}
        <span>{c.label}</span>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col h-full bg-[#0a0a0c] text-white overflow-hidden select-none">
      {/* ══════════════════════════════════════════════════════
          TOOLBAR (only visible when a session is active)
          ══════════════════════════════════════════════════════ */}
      {session && (
        <div className="flex items-center gap-3 px-3 py-2 bg-[#121218] border-b border-white/5 shrink-0">
          {/* ── Navigation buttons ────────────────────────────── */}
          <div className="flex items-center gap-1">
            {/* Back: navigates to previous page in VM history */}
            <button
              onClick={() => hbRef.current?.tabs?.goBack?.()}
              className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"
              title="Back"
            >
              <ArrowLeft size={15} />
            </button>

            {/* Forward: navigates forward in VM history */}
            <button
              onClick={() => hbRef.current?.tabs?.goForward?.()}
              className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"
              title="Forward"
            >
              <ArrowRight size={15} />
            </button>

            {/* Reload: refreshes the current page in the VM */}
            <button
              onClick={() => hbRef.current?.tabs?.reload?.()}
              className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"
              title="Reload"
            >
              <RotateCw size={15} />
            </button>
          </div>

          {/* ── URL Bar (Omnibox) ──────────────────────────────── */}
          <form
            onSubmit={handleUrlSubmit}
            className="flex-1 flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 focus-within:bg-white/[0.07] focus-within:border-blue-500/30 transition-all"
          >
            {/* Lock icon indicating HTTPS (visual only — VM handles actual security) */}
            <Lock size={11} className="text-green-400/60 mr-2 shrink-0" />
            <input
              value={currentUrl}
              onChange={(e) => setCurrentUrl(e.target.value)}
              className="bg-transparent border-none outline-none text-[11px] w-full text-white/80 font-medium"
              spellCheck={false}
              placeholder="https://..."
            />
          </form>

          {/* ── Connection Status + Settings Toggle ────────────── */}
          <div className="flex items-center gap-2 shrink-0">
            {connectionBadge()}

            {/* Settings gear icon — toggles the settings sidebar */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 rounded-lg transition-all ${
                showSettings
                  ? 'bg-blue-600/20 border border-blue-500/30 text-blue-400'  // Active state
                  : 'hover:bg-white/10 text-white/50 hover:text-white'       // Inactive state
              }`}
              title="Settings"
            >
              <Settings size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MAIN CONTENT AREA
          ══════════════════════════════════════════════════════ */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* ── Hyperbeam Embed Container ──────────────────────── */}
        <div className="flex-1 relative bg-[#0d0d12]">
          {session ? (
            /* ── SESSION ACTIVE: Show VM stream ───────────── */
            <>
              {/* Loading overlay: shown during connection states */}
              <AnimatePresence>
                {(isLoading || connectionState === 'connecting' || connectionState === 'reconnecting') && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0a0a0c]/90 backdrop-blur-sm"
                  >
                    {/* Spinning CPU icon */}
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                      className="mb-4"
                    >
                      <Cpu size={48} className="text-blue-500/40" />
                    </motion.div>
                    <p className="text-white/60 text-sm font-bold uppercase tracking-widest">
                      {isLoading ? 'Launching Virtual Machine...' : 'Connecting...'}
                    </p>
                    <p className="text-white/20 text-[10px] mt-1 font-medium">
                      {isLoading ? 'Provisioning cloud browser instance' : 'Establishing secure stream'}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error banner: shown at top when an error occurs */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-0 left-0 right-0 z-30 flex items-center gap-3 px-4 py-3 bg-red-900/30 border-b border-red-500/30 backdrop-blur-md"
                  >
                    <AlertCircle size={16} className="text-red-400 shrink-0" />
                    <span className="text-red-200 text-xs font-medium flex-1">{error}</span>
                    {/* Retry button */}
                    <button
                      onClick={() => { setError(null); createSession(); }}
                      className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-[10px] font-black uppercase tracking-wider transition-colors"
                    >
                      Retry
                    </button>
                    {/* Dismiss button */}
                    <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
                      <X size={14} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* The Hyperbeam SDK targets this div to render the VM stream.
                  The SDK creates a canvas or iframe inside this element. */}
              <div
                ref={containerRef}
                className="w-full h-full"
                style={{ minHeight: 400 }}
              />

              {/* Floating page title (bottom-left) when page loads */}
              {connectionState === 'playing' && tabTitle && tabTitle !== 'Hyperbeam Browser' && (
                <div className="absolute bottom-4 left-4 z-20 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 pointer-events-none">
                  <span className="text-white/50 text-[10px] font-bold uppercase tracking-wider truncate max-w-[300px] block">
                    {tabTitle}
                  </span>
                </div>
              )}
            </>
          ) : (
            /* ── NO SESSION: API Key Prompt / Landing Page ──── */
            <div className="flex flex-col items-center justify-center h-full p-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="flex flex-col items-center text-center max-w-lg"
              >
                {/* ── Hero Icon ─────────────────────────────────── */}
                <div className="relative mb-8">
                  {/* Purple gradient orb with globe icon */}
                  <motion.div
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-500 via-blue-500 to-cyan-500 flex items-center justify-center shadow-2xl shadow-blue-500/30"
                  >
                    <Globe size={44} className="text-white" />
                  </motion.div>
                  {/* Pulsing glow behind the icon */}
                  <motion.div
                    animate={{ opacity: [0.3, 0.8, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute -inset-4 rounded-full bg-blue-500/20 blur-3xl -z-10"
                  />
                </div>

                {/* ── Title ─────────────────────────────────────── */}
                <h1 className="text-2xl font-black tracking-tighter bg-gradient-to-r from-violet-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                  HYPERBEAM BROWSER
                </h1>
                <p className="text-white/40 text-sm font-medium mb-8 max-w-sm">
                  Cloud-hosted virtual browser with zero fingerprinting.
                  Secure, isolated, and always private.
                </p>

                {/* ── API Key Input Card ────────────────────────── */}
                <div className="w-full glass-dark rounded-2xl p-6 space-y-4 border border-white/8">
                  <div className="flex items-center gap-2 mb-2">
                    <Key size={16} className="text-blue-400" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                      API Key Required
                    </span>
                  </div>

                  {/* Password/plaintext toggle input */}
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}   // Toggle visibility
                      value={settings.apiKey}
                      onChange={(e) => setSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveAndConnect()}
                      placeholder="Paste your Hyperbeam API key..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-sm font-medium outline-none focus:border-blue-500/50 focus:bg-white/[0.07] transition-all placeholder:text-white/20"
                      autoFocus
                    />
                    {/* Eye toggle for showing/hiding the key */}
                    <button
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {/* Inline error message */}
                  {error && (
                    <div className="flex items-center gap-2 text-red-400 text-[10px] font-bold bg-red-500/10 rounded-lg px-3 py-2">
                      <AlertCircle size={12} />
                      {error}
                    </div>
                  )}

                  {/* Connect button — purple gradient, full width */}
                  <button
                    onClick={handleSaveAndConnect}
                    disabled={isLoading || !settings.apiKey.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-600/30 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <><Loader2 size={15} className="animate-spin" /> Launching...</>
                    ) : (
                      <><Zap size={15} /> Connect & Launch</>
                    )}
                  </button>

                  {/* Privacy notice */}
                  <p className="text-[9px] text-white/20 text-center font-medium">
                    Your key is stored locally in your browser &amp; never sent
                    anywhere except Hyperbeam's API.
                  </p>
                </div>

                {/* ── Feature Pills ─────────────────────────────── */}
                <div className="flex flex-wrap gap-2 justify-center mt-6">
                  {['Zero Fingerprint', 'Cloud Isolated', 'Ad Blocking', 'Encrypted Stream'].map(f => (
                    <span
                      key={f}
                      className="px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[9px] font-bold text-white/30 uppercase tracking-wider"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </motion.div>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════
            SETTINGS SIDEBAR
            ══════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="border-l border-white/10 bg-[#0e0e14] flex flex-col overflow-hidden shrink-0"
            >
              {/* ── Sidebar Header ─────────────────────────────── */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Settings size={14} className="text-blue-400" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">
                    Browser Settings
                  </h3>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* ── Settings Fields ─────────────────────────────── */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                {/* ═══ API Key ═══ */}
                <div className="space-y-3">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 flex items-center gap-2">
                    <Key size={12} className="text-blue-400" />
                    API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={settings.apiKey}
                      onChange={(e) => setSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                      placeholder="sk_live_..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-xs font-mono outline-none focus:border-blue-500/50 transition-all placeholder:text-white/15"
                    />
                    <button
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
                    >
                      {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {/* ═══ Start URL ═══ */}
                <div className="space-y-3">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 flex items-center gap-2">
                    <Home size={12} className="text-blue-400" />
                    Start URL
                  </label>
                  <input
                    type="text"
                    value={settings.startUrl}
                    onChange={(e) => setSettings(prev => ({ ...prev, startUrl: e.target.value }))}
                    placeholder="https://www.google.com"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-blue-500/50 transition-all placeholder:text-white/15"
                  />
                </div>

                {/* ═══ Proxy URL ═══ */}
                <div className="space-y-3">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 flex items-center gap-2">
                    <Wifi size={12} className="text-amber-400" />
                    Proxy URL <span className="text-amber-400/60 font-medium ml-1">(fixes CORS)</span>
                  </label>
                  <input
                    type="text"
                    value={settings.proxyUrl}
                    onChange={(e) => setSettings(prev => ({ ...prev, proxyUrl: e.target.value }))}
                    placeholder="http://localhost:3456/proxy"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-amber-500/50 transition-all placeholder:text-white/15 font-mono"
                  />
                  <p className="text-[8px] text-white/20 leading-relaxed">
                    Run <code className="text-amber-400/60">node proxy-server.cjs</code> locally,
                    then paste <code className="text-amber-400/60">http://localhost:3456/proxy</code> here.
                    Or use corsproxy.io.
                  </p>
                </div>

                {/* ═══ Toggle Switches ═══ */}
                <div className="space-y-4">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 block">
                    Options
                  </label>

                  {/* Adblock toggle */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-3">
                      <Shield size={16} className="text-green-400/60" />
                      <div>
                        <div className="text-xs font-bold text-white/70">Ad Blocking</div>
                        <div className="text-[9px] text-white/25 font-medium">Block ads & trackers</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSettings(prev => ({ ...prev, adblock: !prev.adblock }))}
                      className={`w-10 h-5 rounded-full transition-all relative ${
                        settings.adblock ? 'bg-green-500' : 'bg-white/15'
                      }`}
                    >
                      {/* The sliding dot inside the toggle */}
                      <motion.div
                        animate={{ x: settings.adblock ? 20 : 2 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className="w-4 h-4 rounded-full bg-white absolute top-0.5 shadow-md"
                      />
                    </button>
                  </div>

                  {/* Dark Mode toggle */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-3">
                      <Monitor size={16} className="text-purple-400/60" />
                      <div>
                        <div className="text-xs font-bold text-white/70">Dark Mode</div>
                        <div className="text-[9px] text-white/25 font-medium">Force dark pages</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSettings(prev => ({ ...prev, darkMode: !prev.darkMode }))}
                      className={`w-10 h-5 rounded-full transition-all relative ${
                        settings.darkMode ? 'bg-purple-500' : 'bg-white/15'
                      }`}
                    >
                      <motion.div
                        animate={{ x: settings.darkMode ? 20 : 2 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className="w-4 h-4 rounded-full bg-white absolute top-0.5 shadow-md"
                      />
                    </button>
                  </div>

                  {/* Kiosk Mode toggle */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-3">
                      {settings.kiosk ? (
                        <Lock size={16} className="text-red-400/60" />
                      ) : (
                        <Unlock size={16} className="text-white/25" />
                      )}
                      <div>
                        <div className="text-xs font-bold text-white/70">Kiosk Mode</div>
                        <div className="text-[9px] text-white/25 font-medium">No browser UI in VM</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSettings(prev => ({ ...prev, kiosk: !prev.kiosk }))}
                      className={`w-10 h-5 rounded-full transition-all relative ${
                        settings.kiosk ? 'bg-red-500' : 'bg-white/15'
                      }`}
                    >
                      <motion.div
                        animate={{ x: settings.kiosk ? 20 : 2 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className="w-4 h-4 rounded-full bg-white absolute top-0.5 shadow-md"
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Sidebar Footer Actions ──────────────────────── */}
              <div className="p-5 border-t border-white/5 space-y-3">
                {session ? (
                  /* Show destroy + save when a session is active */
                  <>
                    <button
                      onClick={destroySession}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      <Trash2 size={14} /> Destroy Session
                    </button>
                    <button
                      onClick={handleSaveAndConnect}
                      disabled={isLoading}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20 disabled:opacity-40"
                    >
                      {isLoading ? (
                        <><Loader2 size={14} className="animate-spin" /> Saving...</>
                      ) : (
                        <><Save size={14} /> Save & Reconnect</>
                      )}
                    </button>
                  </>
                ) : (
                  /* Show connect when no session */
                  <button
                    onClick={handleSaveAndConnect}
                    disabled={isLoading || !settings.apiKey.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-600/30 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <><Loader2 size={14} className="animate-spin" /> Launching...</>
                    ) : (
                      <><Zap size={14} /> Connect & Launch VM</>
                    )}
                  </button>
                )}

                {/* Session ID display (truncated for privacy) */}
                <p className="text-[9px] text-white/15 text-center font-medium">
                  Session ID: {session ? session.sessionId.slice(0, 8) + '...' : 'none'}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ══════════════════════════════════════════════════════
          INLINE STYLES
          ══════════════════════════════════════════════════════ */}
      <style>{`
        /* Custom scrollbar for the settings sidebar */
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.06);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.12);
        }
      `}</style>
    </div>
  );
};

export default Browser;
