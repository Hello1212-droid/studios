import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, Settings, X, Bell, Coffee, Brain, Zap, ChevronUp, ChevronDown } from 'lucide-react';

type Mode = 'work' | 'short' | 'long';

interface TimerSettings {
  work: number;
  short: number;
  long: number;
}

const DEFAULT_SETTINGS: TimerSettings = { work: 25, short: 5, long: 15 };

const MODE_CONFIG = {
  work: { label: 'Deep Work', color: '#007AFF', glow: 'rgba(0,122,255,0.4)', icon: Brain, accent: 'blue' },
  short: { label: 'Short Break', color: '#34C759', glow: 'rgba(52,199,89,0.4)', icon: Coffee, accent: 'green' },
  long: { label: 'Long Break', color: '#FF9F0A', glow: 'rgba(255,159,10,0.4)', icon: Zap, accent: 'amber' },
};

const RING_RADIUS = 90;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const NumberInput: React.FC<{
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
}> = ({ value, onChange, min = 1, max = 120, label }) => (
  <div className="flex flex-col items-center gap-1">
    <span className="text-white/40 text-xs font-medium uppercase tracking-wider">{label}</span>
    <div className="flex flex-col items-center glass rounded-xl overflow-hidden">
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="px-4 py-1.5 hover:bg-white/10 transition-colors text-white/60 hover:text-white"
      >
        <ChevronUp size={14} />
      </button>
      <div className="px-5 py-1 text-white font-bold text-lg min-w-[56px] text-center">
        {value}
      </div>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="px-4 py-1.5 hover:bg-white/10 transition-colors text-white/60 hover:text-white"
      >
        <ChevronDown size={14} />
      </button>
    </div>
    <span className="text-white/30 text-xs">min</span>
  </div>
);

const PomodoroTimer: React.FC = () => {
  const [mode, setMode] = useState<Mode>('work');
  const [settings, setSettings] = useState<TimerSettings>(DEFAULT_SETTINGS);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_SETTINGS.work * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [tempSettings, setTempSettings] = useState<TimerSettings>(DEFAULT_SETTINGS);
  const [notification, setNotification] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const totalTime = settings[mode] * 60;
  const progress = timeLeft / totalTime;
  const strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress);
  const modeConfig = MODE_CONFIG[mode];
  const ModeIcon = modeConfig.icon;

  const playSound = useCallback((type: 'tick' | 'complete' | 'start') => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'complete') {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.15);
        osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.6);
      } else if (type === 'start') {
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
      } else {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.05);
      }
    } catch {}
  }, []);

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('StudyOS', { body: msg, icon: '/favicon.ico' });
    }
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const handleComplete = useCallback(() => {
    setIsRunning(false);
    playSound('complete');
    if (mode === 'work') {
      setSessions(s => s + 1);
      showNotification('🎯 Work session complete! Take a break.');
    } else {
      showNotification('⚡ Break over! Back to work.');
    }
  }, [mode, playSound, showNotification]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            handleComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, handleComplete]);

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setIsRunning(false);
    setTimeLeft(settings[newMode] * 60);
  };

  const handleStart = () => {
    playSound('start');
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    setIsRunning(true);
  };

  const reset = () => {
    setIsRunning(false);
    setTimeLeft(settings[mode] * 60);
  };

  const applySettings = () => {
    setSettings(tempSettings);
    setTimeLeft(tempSettings[mode] * 60);
    setIsRunning(false);
    setShowSettings(false);
  };

  const formatTime = (secs: number): string => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="flex flex-col h-full bg-[#0c0c10] rounded-b-2xl overflow-hidden relative">
      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 glass-lighter rounded-xl px-4 py-3 flex items-center gap-3 shadow-2xl"
          >
            <Bell size={14} className="text-amber-400" />
            <span className="text-white/90 text-sm font-medium">{notification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 z-40 bg-[#0c0c10]/95 backdrop-blur-xl flex flex-col items-center justify-center gap-8"
          >
            <div className="flex items-center justify-between w-full px-8 max-w-md">
              <h3 className="text-white font-bold text-lg">Timer Settings</h3>
              <button onClick={() => setShowSettings(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/60">
                <X size={16} />
              </button>
            </div>

            <div className="flex items-start gap-8">
              <NumberInput value={tempSettings.work} onChange={v => setTempSettings(p => ({ ...p, work: v }))} label="Work" />
              <NumberInput value={tempSettings.short} onChange={v => setTempSettings(p => ({ ...p, short: v }))} label="Short Break" />
              <NumberInput value={tempSettings.long} onChange={v => setTempSettings(p => ({ ...p, long: v }))} label="Long Break" />
            </div>

            <button
              onClick={applySettings}
              className="px-8 py-3 rounded-xl font-semibold text-white transition-all"
              style={{ background: modeConfig.color }}
            >
              Apply Settings
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
        {/* Mode selector */}
        <div className="flex items-center gap-1 glass rounded-xl p-1">
          {(Object.keys(MODE_CONFIG) as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                mode === m
                  ? 'text-white shadow-lg'
                  : 'text-white/40 hover:text-white/70'
              }`}
              style={mode === m ? { background: MODE_CONFIG[m].color } : {}}
            >
              {MODE_CONFIG[m].label}
            </button>
          ))}
        </div>

        {/* Progress ring */}
        <div className="relative flex items-center justify-center">
          {/* Glow effect */}
          <div
            className="absolute inset-0 rounded-full blur-3xl opacity-20 transition-colors duration-700"
            style={{ background: modeConfig.glow, transform: 'scale(0.8)' }}
          />

          <svg width="230" height="230" className="relative z-10">
            {/* Background ring */}
            <circle
              cx="115" cy="115" r={RING_RADIUS}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="10"
            />
            {/* Progress ring */}
            <circle
              cx="115" cy="115" r={RING_RADIUS}
              fill="none"
              stroke={modeConfig.color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              className="progress-ring-circle"
              style={{ filter: `drop-shadow(0 0 8px ${modeConfig.color}80)` }}
            />
            {/* Tick marks */}
            {Array.from({ length: 60 }).map((_, i) => {
              const angle = (i * 6 - 90) * (Math.PI / 180);
              const isMajor = i % 5 === 0;
              const outerR = RING_RADIUS + 18;
              const innerR = outerR - (isMajor ? 8 : 5);
              return (
                <line
                  key={i}
                  x1={115 + innerR * Math.cos(angle)}
                  y1={115 + innerR * Math.sin(angle)}
                  x2={115 + outerR * Math.cos(angle)}
                  y2={115 + outerR * Math.sin(angle)}
                  stroke={i < (1 - progress) * 60 ? 'rgba(255,255,255,0.05)' : `${modeConfig.color}60`}
                  strokeWidth={isMajor ? 2 : 1}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <ModeIcon size={20} className="mb-1" style={{ color: modeConfig.color }} />
            <motion.div
              key={timeLeft}
              className="text-5xl font-bold text-white tracking-tighter"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatTime(timeLeft)}
            </motion.div>
            <div className="text-white/40 text-xs font-medium">
              {Math.round(progress * 100)}% remaining
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          <button
            onClick={reset}
            className="w-12 h-12 flex items-center justify-center rounded-2xl glass hover:bg-white/10 text-white/60 hover:text-white transition-all"
          >
            <RotateCcw size={18} />
          </button>

          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={isRunning ? () => setIsRunning(false) : handleStart}
            className="w-20 h-20 flex items-center justify-center rounded-3xl font-bold text-white shadow-2xl transition-all"
            style={{
              background: `linear-gradient(135deg, ${modeConfig.color}, ${modeConfig.color}cc)`,
              boxShadow: isRunning ? `0 0 30px ${modeConfig.glow}` : `0 8px 32px ${modeConfig.glow}`,
            }}
          >
            {isRunning ? <Pause size={28} /> : <Play size={28} fill="white" />}
          </motion.button>

          <button
            onClick={() => { setShowSettings(true); setTempSettings(settings); }}
            className="w-12 h-12 flex items-center justify-center rounded-2xl glass hover:bg-white/10 text-white/60 hover:text-white transition-all"
          >
            <Settings size={18} />
          </button>
        </div>

        {/* Session tracker */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-all duration-500 ${
                  i < sessions % 4
                    ? 'scale-110'
                    : 'bg-white/10'
                }`}
                style={i < sessions % 4 ? { background: modeConfig.color } : {}}
              />
            ))}
          </div>
          <div className="text-white/30 text-xs">
            Session {sessions + 1} • {sessions} completed today
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
          {[
            { label: 'Work', value: `${settings.work}m`, color: MODE_CONFIG.work.color },
            { label: 'Short', value: `${settings.short}m`, color: MODE_CONFIG.short.color },
            { label: 'Long', value: `${settings.long}m`, color: MODE_CONFIG.long.color },
          ].map(stat => (
            <div key={stat.label} className="glass rounded-xl p-3 text-center">
              <div className="text-lg font-bold" style={{ color: stat.color }}>{stat.value}</div>
              <div className="text-white/30 text-xs mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PomodoroTimer;
