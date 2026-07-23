import React, { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Globe, Timer, CalendarDays, GraduationCap, Power, Brain, FileText, Shield, Lock } from 'lucide-react';

import Window from './components/Window';
import Dock from './components/Dock';
import StatusBar from './components/StatusBar';
import Browser from './components/Browser';
import StudySession from './components/StudySession';
import Scheduler from './components/Scheduler';
import AureliusAI from './components/AureliusAI';
import PdfViewer from './components/PdfViewer';
import TestResultEngine from './components/TestResultEngine';
import { loadState, saveState, calculateCarryForward, StudyState } from './utils/studyStore';

type AppId = 'browser' | 'timer' | 'scheduler' | 'aurelius' | 'pdfviewer' | 'testengine';

interface AppWindowState {
  id: AppId;
  isOpen: boolean;
  isMinimized: boolean;
  zIndex: number;
}

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
  browser: {
    title: 'StudyOS Browser',
    icon: <Globe size={15} />,
    color: '#007AFF',
    accent: '#007AFF',
    defaultSize: { width: 1000, height: 700 },
    defaultPos: () => ({ x: 60, y: 50 }),
    minWidth: 500,
    minHeight: 400,
  },
  pdfviewer: {
    title: 'PDF Viewer',
    icon: <FileText size={15} />,
    color: '#F04A00',
    accent: '#F04A00',
    defaultSize: { width: 900, height: 800 },
    defaultPos: () => ({ x: 120, y: 30 }),
    minWidth: 600,
    minHeight: 500,
  },
  aurelius: {
    title: 'Aurelius Mentor',
    icon: <Brain size={15} />,
    color: '#6366f1',
    accent: '#6366f1',
    defaultSize: { width: 850, height: 650 },
    defaultPos: () => ({ x: 100, y: 80 }),
    minWidth: 600,
    minHeight: 500,
  },
  timer: {
    title: 'Study Session',
    icon: <Timer size={15} />,
    color: '#007AFF',
    accent: '#007AFF',
    defaultSize: { width: 380, height: 580 },
    defaultPos: () => ({ x: window.innerWidth - 420, y: 50 }),
    minWidth: 340,
    minHeight: 480,
  },
  scheduler: {
    title: 'Study Scheduler',
    icon: <CalendarDays size={15} />,
    color: '#BF5AF2',
    accent: '#BF5AF2',
    defaultSize: { width: 420, height: 580 },
    defaultPos: () => ({ x: window.innerWidth - 860, y: 50 }),
    minWidth: 360,
    minHeight: 400,
  },
  testengine: {
    title: 'Test Engine',
    icon: <GraduationCap size={15} />,
    color: '#10b981',
    accent: '#10b981',
    defaultSize: { width: 800, height: 600 },
    defaultPos: () => ({ x: 150, y: 100 }),
    minWidth: 600,
    minHeight: 500,
  },
};

const DOCK_ICONS: Record<AppId, React.ReactNode> = {
  browser: <Globe size={28} />,
  pdfviewer: <FileText size={28} />,
  aurelius: <Brain size={28} />,
  timer: <Timer size={28} />,
  scheduler: <CalendarDays size={28} />,
  testengine: <GraduationCap size={28} />,
};

let zCounter = 10;

const App: React.FC = () => {
  // @ts-ignore
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  // --- StudyStore Logic ---
  const [studyState, setStudyState] = useState<StudyState>(loadState());

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    if (studyState.lastLogin !== today) {
        const updatedTasks = calculateCarryForward(studyState.tasks);
        setStudyState(prev => ({ ...prev, tasks: updatedTasks, lastLogin: today }));
    }
  }, []);

  useEffect(() => {
    saveState(studyState);
  }, [studyState]);

  // --- Window Management ---
  const [apps, setApps] = useState<AppWindowState[]>([
    { id: 'browser', isOpen: false, isMinimized: false, zIndex: 10 },
    { id: 'pdfviewer', isOpen: false, isMinimized: false, zIndex: 10 },
    { id: 'aurelius', isOpen: false, isMinimized: false, zIndex: 10 },
    { id: 'timer', isOpen: false, isMinimized: false, zIndex: 10 },
    { id: 'scheduler', isOpen: false, isMinimized: false, zIndex: 10 },
    { id: 'testengine', isOpen: false, isMinimized: false, zIndex: 10 },
  ]);
  const [activeApp, setActiveApp] = useState<AppId | null>(null);
  const [bootComplete, setBootComplete] = useState(false);

  React.useEffect(() => {
    setTimeout(() => setBootComplete(true), 1200);
  }, []);

  const getTopZ = () => ++zCounter;

  const openApp = useCallback((id: AppId) => {
    setApps(prev => prev.map(app =>
      app.id === id
        ? { ...app, isOpen: true, isMinimized: false, zIndex: getTopZ() }
        : app
    ));
    setActiveApp(id);
  }, []);

  const closeApp = useCallback((id: AppId) => {
    setApps(prev => prev.map(app => app.id === id ? { ...app, isOpen: false, isMinimized: false } : app));
    setActiveApp(prev => prev === id ? null : prev);
  }, []);

  const minimizeApp = useCallback((id: AppId) => {
    setApps(prev => prev.map(app => app.id === id ? { ...app, isMinimized: true } : app));
    setActiveApp(prev => prev === id ? null : prev);
  }, []);

  const focusApp = useCallback((id: AppId) => {
    setApps(prev => prev.map(app =>
      app.id === id ? { ...app, zIndex: getTopZ(), isMinimized: false } : app
    ));
    setActiveApp(id);
  }, []);

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

  const dockApps = apps.map(app => ({
    id: app.id,
    label: APP_CONFIG[app.id].title,
    icon: DOCK_ICONS[app.id],
    isOpen: app.isOpen,
    isActive: app.id === activeApp && !app.isMinimized,
    color: APP_CONFIG[app.id].color,
    onClick: () => toggleApp(app.id),
  }));

  const exitDockApp = {
    id: 'exit',
    label: 'Terminate StudyOS',
    icon: <Power size={28} />,
    isOpen: false,
    isActive: false,
    color: '#ef4444',
    onClick: () => {
        if (isElectron) {
            try {
                // @ts-ignore
                window.electronAPI.send("exit-app");
                console.log("[StudyOS] exit-app sent successfully");
            } catch (e) {}
        } else {
            alert("Exit is only available in Desktop mode.");
        }
    }
  };

  const finalDockApps = [...dockApps, exitDockApp];

  const renderWindowContent = (id: AppId) => {
    switch (id) {
      case 'browser': return <Browser />;
      case 'pdfviewer': return <PdfViewer />;
      case 'aurelius': return <AureliusAI studyState={studyState} setStudyState={setStudyState} />;
      case 'timer': return <StudySession />;
      case 'scheduler': return <Scheduler studyState={studyState} setStudyState={setStudyState} />;
      case 'testengine': return <TestResultEngine studyState={studyState} setStudyState={setStudyState} />;
    }
  };

  // --- Kiosk Mode State ---
  const [kioskActive, setKioskActive] = useState(false);

  // Sync kiosk state from main process events (toggled from StudySession/Scheduler)
  useEffect(() => {
    if (isElectron) {
      try {
        // @ts-ignore
        window.electronAPI.on('kiosk-state-changed', (active: boolean) => {
          console.log('[StudyOS] Kiosk state synced from main:', active);
          setKioskActive(active);
        });
      } catch (e) {
        console.error('[StudyOS] Failed to register kiosk state listener:', e);
      }
    }
  }, [isElectron]);

  const enterKiosk = useCallback(() => {
    if (isElectron) {
      try {
        // @ts-ignore
        window.electronAPI.send('enter-kiosk');
        console.log('[StudyOS] Kiosk mode activated from desktop');
        setKioskActive(true);
      } catch (e) {
        console.error('[StudyOS] Failed to enter kiosk:', e);
      }
    }
  }, [isElectron]);

  const exitKiosk = useCallback(() => {
    if (isElectron) {
      try {
        // @ts-ignore
        window.electronAPI.send('exit-kiosk');
        console.log('[StudyOS] Kiosk mode deactivated from desktop');
        setKioskActive(false);
      } catch (e) {
        console.error('[StudyOS] Failed to exit kiosk:', e);
      }
    }
  }, [isElectron]);

  const toggleKiosk = useCallback(() => {
    if (kioskActive) {
      exitKiosk();
    } else {
      enterKiosk();
    }
  }, [kioskActive, enterKiosk, exitKiosk]);

  const latestResult = studyState.testResults?.[0];
  const targetPercentile = latestResult?.targetPercentile || 99.5;
  const currentEquiv = latestResult?.jeeEquivalentPercentile || 0;

  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ... existing boot div ... */}
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
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-2xl">
                <GraduationCap size={40} className="text-white" />
              </div>
              <div className="text-center">
                <div className="text-white text-3xl font-bold tracking-tight">StudyOS</div>
                <div className="text-white/40 text-sm mt-1">Your Productivity Desktop</div>
              </div>
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

      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: 'url(/wallpaper.jpg)' }}
      />
      <div className="absolute inset-0 bg-black/60" />

      {/* KIOSK STATUS BANNER — shown on wallpaper when lockdown is active */}
      <AnimatePresence>
        {kioskActive && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="absolute top-7 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          >
            <div className="flex items-center gap-2.5 px-5 py-2 rounded-full bg-red-500/20 border border-red-500/30 backdrop-blur-md shadow-2xl shadow-red-900/30">
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Lock size={12} className="text-red-400" />
              </motion.div>
              <span className="text-red-400 text-[11px] font-black uppercase tracking-[0.15em]">
                System Lockdown Active — Full Kiosk Mode
              </span>
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TRUTH & TARGET WIDGET */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: bootComplete ? 1 : 0, x: 0 }}
        transition={{ delay: 1, duration: 1 }}
        className="absolute top-1/2 left-20 -translate-y-1/2 max-w-xl"
      >
        <div className="flex flex-col gap-6">
           <div>
              <div className="text-blue-400 text-xs font-black uppercase tracking-[0.3em] mb-4">The Hard Truth</div>
              <h1 className="text-white text-5xl font-black leading-tight tracking-tighter">
                {currentEquiv > 0 
                  ? `You are at ${currentEquiv}% JEE Equivalent. The elite 1% requires obsession, not just effort.` 
                  : "The first step is always the hardest. Log your first mock result to reveal your reality."}
              </h1>
           </div>
           
           <div className="flex items-center gap-8">
              <div className="glass p-6 rounded-3xl border border-white/5 min-w-[200px]">
                <div className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">Target</div>
                <div className="text-3xl font-black text-purple-400 tracking-tighter">{targetPercentile}%</div>
                <div className="text-[10px] text-white/20 mt-1 uppercase font-bold tracking-tighter">Next Milestone</div>
              </div>
              
              <div className="glass p-6 rounded-3xl border border-white/5 min-w-[200px]">
                <div className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">Gap</div>
                <div className="text-3xl font-black text-red-500 tracking-tighter">-{Math.max(0, targetPercentile - currentEquiv).toFixed(2)}%</div>
                <div className="text-[10px] text-white/20 mt-1 uppercase font-bold tracking-tighter">To Elite Bracket</div>
              </div>

              {/* KIOSK MODE TOGGLE BUTTON — on the main wallpaper */}
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
                {/* Animated pulse ring when active */}
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
                      kioskActive
                        ? 'bg-red-500/30 text-red-400'
                        : 'bg-white/10 text-white/40'
                    }`}
                  >
                    {kioskActive ? <Lock size={22} /> : <Shield size={22} />}
                  </motion.div>
                  <div className="text-[10px] font-black uppercase tracking-widest">
                    <span className={kioskActive ? 'text-red-400' : 'text-white/50'}>
                      {kioskActive ? 'LOCKDOWN ACTIVE' : 'LOCKDOWN MODE'}
                    </span>
                  </div>
                  <div className={`text-[8px] font-bold uppercase tracking-wider ${
                    kioskActive ? 'text-red-300/60' : 'text-white/30'
                  }`}>
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

      <StatusBar />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: bootComplete ? 1 : 0 }}
        transition={{ delay: 0.3 }}
        className="absolute top-12 right-4 flex flex-col gap-3"
      >
        {apps.map(app => (
          <button
            key={app.id}
            onDoubleClick={() => openApp(app.id)}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl desktop-icon w-20 text-center"
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white"
              style={{ background: `linear-gradient(145deg, ${APP_CONFIG[app.id].color}cc, ${APP_CONFIG[app.id].color}88)` }}
            >
              {DOCK_ICONS[app.id]}
            </div>
            <span className="text-white text-xs font-medium leading-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
              {APP_CONFIG[app.id].title.split(' ').length > 1 ? APP_CONFIG[app.id].title.split(' ')[1] : APP_CONFIG[app.id].title}
            </span>
          </button>
        ))}
      </motion.div>

      <AnimatePresence>
        {apps.filter(app => app.isOpen && !app.isMinimized).map(app => {
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

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: bootComplete ? 1 : 0 }}
        transition={{ delay: 0.5 }}
      >
        <Dock apps={finalDockApps} />
      </motion.div>

      <AnimatePresence>
        {apps.filter(a => a.isOpen && a.isMinimized).map((app, idx) => (
          <motion.button
            key={`min-${app.id}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={() => focusApp(app.id)}
            className="fixed bottom-24 glass rounded-xl px-4 py-2 flex items-center gap-2 hover:bg-white/15 transition-colors"
            style={{ left: 20 + idx * 160, zIndex: 35 }}
          >
            <div className="w-5 h-5 rounded-lg flex items-center justify-center text-white"
              style={{ background: APP_CONFIG[app.id].color }}>
              {DOCK_ICONS[app.id]}
            </div>
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
