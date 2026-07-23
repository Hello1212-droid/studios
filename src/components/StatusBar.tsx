import React, { useState, useEffect } from 'react';
import { Volume2, Sun, Apple, Sliders, Battery } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const StatusBar: React.FC = () => {
  const [time, setTime] = useState(new Date());
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [, setIsCharging] = useState(false);
  const [showControlCenter, setShowControlCenter] = useState(false);
  const [brightness, setBrightness] = useState(80);
  const [volume, setVolume] = useState(50);

  // @ts-ignore
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  useEffect(() => {
    const timerInterval = setInterval(() => setTime(new Date()), 1000);

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

    return () => clearInterval(timerInterval);
  }, []);

  const brightnessTimeout = React.useRef<any>(null);
  const handleBrightness = (val: number) => {
    setBrightness(val);
    if (isElectron) {
        if (brightnessTimeout.current) clearTimeout(brightnessTimeout.current);
        brightnessTimeout.current = setTimeout(() => {
            try {
                // @ts-ignore
                window.electronAPI.send('set-brightness', val);
            } catch (e) {}
        }, 150);
    }
  };

  const volumeTimeout = React.useRef<any>(null);
  const handleVolume = (val: number) => {
    setVolume(val);
    if (isElectron) {
        if (volumeTimeout.current) clearTimeout(volumeTimeout.current);
        volumeTimeout.current = setTimeout(() => {
            try {
                // @ts-ignore
                window.electronAPI.send('set-volume', val);
            } catch (e) {}
        }, 150);
    }
  };

  const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateStr = time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <>
      <div className="fixed top-0 left-0 right-0 h-7 flex items-center justify-between px-4 z-[60] status-bar bg-black/20 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Apple size={14} className="text-white/80" fill="currentColor" />
          <span className="text-white/80 text-[11px] font-black uppercase tracking-widest">StudyOS</span>
        </div>

        <div className="flex items-center gap-4 h-full">
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
          
          <div className="flex items-center gap-2 text-white/80 text-[10px] font-bold uppercase tracking-tighter">
            <span>{dateStr}</span>
            <span>{timeStr}</span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showControlCenter && (
            <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                className="fixed top-9 right-4 w-72 glass-dark rounded-3xl p-6 z-[70] shadow-2xl border border-white/10"
            >
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-6">System Controls</h3>
                
                <div className="space-y-6">
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
