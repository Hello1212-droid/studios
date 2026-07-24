/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              STATUS BAR — macOS-STYLE MENU BAR                ║
 * ║                                                              ║
 * ║  Fixed 28px bar at the top of the screen.                    ║
 * ║  Contains:                                                   ║
 * ║    • Apple-style menu icon + "StudyOS" label                ║
 * ║    • Control Center toggle (brightness/volume sliders)      ║
 * ║    • Battery level indicator                                 ║
 * ║    • Current date and time                                   ║
 * ║                                                              ║
 * ║  Hardware Controls (via Electron IPC when available):        ║
 * ║    • Brightness → PowerShell WMI                             ║
 * ║    • Volume     → PowerShell SendKeys                        ║
 * ║  In browser mode: controls are UI-only (no-op).             ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Volume2,    // Sound/speaker icon
  Sun,        // Brightness icon
  Apple,      // Apple logo
  Sliders,    // Control Center toggle
  Battery     // Battery indicator
} from 'lucide-react';

const StatusBar: React.FC = () => {
  // ── Clock ────────────────────────────────────────────────
  /** time — Current Date object, updated every second. */
  const [time, setTime] = useState(new Date());

  // ── Battery ──────────────────────────────────────────────
  /** batteryLevel — 0-100 percentage. */
  const [batteryLevel, setBatteryLevel] = useState(100);

  /** isCharging — Whether the device is plugged in. (unused for now, could show a lightning bolt) */
  const [, setIsCharging] = useState(false);

  // ── Control Center ───────────────────────────────────────
  /** showControlCenter — Whether the dropdown panel is visible. */
  const [showControlCenter, setShowControlCenter] = useState(false);

  /** brightness — 0-100 slider value for screen brightness. */
  const [brightness, setBrightness] = useState(80);

  /** volume — 0-100 slider value for system volume. */
  const [volume, setVolume] = useState(50);

  // ── Electron Detection ───────────────────────────────────
  // @ts-ignore — electronAPI injected at runtime by main-preload.cjs
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  // ══════════════════════════════════════════════════════
  // EFFECTS
  // ══════════════════════════════════════════════════════

  /**
   * Clock tick: update time every second.
   * Cleanup on unmount to prevent memory leaks.
   */
  useEffect(() => {
    const timerInterval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timerInterval);
  }, []);

  /**
   * Battery API: Listen for battery level and charging state changes.
   * The Battery Status API is supported in Chromium-based browsers.
   * Falls back to showing 100% if the API is unavailable.
   */
  useEffect(() => {
    const updateBattery = (battery: any) => {
      setBatteryLevel(Math.round(battery.level * 100));
      setIsCharging(battery.charging);
    };

    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        updateBattery(battery);
        battery.addEventListener('levelchange', () => updateBattery(battery));
        battery.addEventListener('chargingchange', () => updateBattery(battery));
      });
    }
  }, []);

  // ══════════════════════════════════════════════════════
  // HARDWARE CONTROLS (Electron IPC)
  // ══════════════════════════════════════════════════════

  /**
   * Brightness debounce ref.
   * We debounce by 150ms to avoid spamming PowerShell on every slider move.
   */
  const brightnessTimeout = React.useRef<any>(null);

  /**
   * handleBrightness(val)
   * Updates the React state immediately (smooth slider),
   * and sends the IPC command after a 150ms debounce.
   */
  const handleBrightness = (val: number) => {
    setBrightness(val);
    if (isElectron) {
      if (brightnessTimeout.current) clearTimeout(brightnessTimeout.current);
      brightnessTimeout.current = setTimeout(() => {
        try {
          // @ts-ignore — send IPC to main.cjs → PowerShell WMI
          window.electronAPI.send('set-brightness', val);
        } catch (e) { /* Silently fail in browser */ }
      }, 150);
    }
  };

  /** Volume debounce ref. Same pattern as brightness. */
  const volumeTimeout = React.useRef<any>(null);

  /** handleVolume(val) — Same debounce pattern for volume. */
  const handleVolume = (val: number) => {
    setVolume(val);
    if (isElectron) {
      if (volumeTimeout.current) clearTimeout(volumeTimeout.current);
      volumeTimeout.current = setTimeout(() => {
        try {
          // @ts-ignore — send IPC to main.cjs → PowerShell SendKeys
          window.electronAPI.send('set-volume', val);
        } catch (e) { }
      }, 150);
    }
  };

  // ── Format time/date for display ───────────────────────
  const timeStr = time.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true
  });
  const dateStr = time.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric'
  });

  return (
    <>
      {/* ══════════════════════════════════════════════════════
          STATUS BAR (FIXED TOP)
          ══════════════════════════════════════════════════════ */}
      <div className="fixed top-0 left-0 right-0 h-7 flex items-center justify-between px-4 z-[60] status-bar bg-black/20 backdrop-blur-md">
        {/* ── Left: Apple icon + app name ─────────────────── */}
        <div className="flex items-center gap-4">
          <Apple size={14} className="text-white/80" fill="currentColor" />
          <span className="text-white/80 text-[11px] font-black uppercase tracking-widest">
            StudyOS
          </span>
        </div>

        {/* ── Right: Control Center + Clock ────────────────── */}
        <div className="flex items-center gap-4 h-full">
          {/* Control Center toggle button */}
          <button
            onClick={() => setShowControlCenter(!showControlCenter)}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-white/10 transition-colors"
          >
            <Sliders size={12} className="text-white/60" />
            <div className="flex items-center gap-1 text-white/60">
              <Battery size={12} />
              <span className="text-[10px] font-bold">{batteryLevel}%</span>
            </div>
          </button>

          {/* Date + Time */}
          <div className="flex items-center gap-2 text-white/80 text-[10px] font-bold uppercase tracking-tighter">
            <span>{dateStr}</span>
            <span>{timeStr}</span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          CONTROL CENTER DROPDOWN
          ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showControlCenter && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-9 right-4 w-72 glass-dark rounded-3xl p-6 z-[70] shadow-2xl border border-white/10"
          >
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-6">
              System Controls
            </h3>

            <div className="space-y-6">
              {/* ── Brightness Slider ────────────────────────── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white/60">
                    <Sun size={14} />
                    <span className="text-[10px] font-bold uppercase">Brightness</span>
                  </div>
                  <span className="text-[10px] font-black text-blue-400">{brightness}%</span>
                </div>
                <input
                  type="range" min="0" max="100" value={brightness}
                  onChange={(e) => handleBrightness(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* ── Volume Slider ───────────────────────────── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white/60">
                    <Volume2 size={14} />
                    <span className="text-[10px] font-bold uppercase">Sound</span>
                  </div>
                  <span className="text-[10px] font-black text-blue-400">{volume}%</span>
                </div>
                <input
                  type="range" min="0" max="100" value={volume}
                  onChange={(e) => handleVolume(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default StatusBar;
