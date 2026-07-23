import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';

interface AnimatedClockProps {
  value: string; // "8:00 PM" format
  onChange: (value: string) => void;
  label: string;
}

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const AnimatedClock: React.FC<AnimatedClockProps> = ({ value, onChange, label }) => {
  const [textInput, setTextInput] = useState(value);
  const [activeTab, setActiveTab] = useState<'clock' | 'text'>('clock');
  const svgRef = useRef<SVGSVGElement>(null);
  const CX = 150, CY = 150, HOUR_R = 105, MIN_R = 75;

  const parseValue = (v: string): { hours: number; minutes: number; isPM: boolean } => {
    const match = v.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (match) {
      let h = parseInt(match[1]);
      const m = parseInt(match[2]);
      const isPM = match[3].toUpperCase() === 'PM';
      return { hours: h, minutes: m, isPM };
    }
    // Default fallback
    return { hours: 8, minutes: 0, isPM: true };
  };

  const { hours, minutes, isPM } = parseValue(value);
  const hour12 = hours; // 1-12

  // SVG coordinate for an hour position (0-11, where 0=12 o'clock at top)
  const getHourPos = (h: number) => {
    const angle = ((h % 12) / 12) * 2 * Math.PI - Math.PI / 2;
    return { x: CX + HOUR_R * Math.cos(angle), y: CY + HOUR_R * Math.sin(angle) };
  };

  const getMinPos = (m: number) => {
    const angle = (m / 60) * 2 * Math.PI - Math.PI / 2;
    return { x: CX + MIN_R * Math.cos(angle), y: CY + MIN_R * Math.sin(angle) };
  };

  // Hand angles
  const hourAngle = ((hour12 % 12) / 12) * 360 - 90;
  const minAngle = (minutes / 60) * 360 - 90;

  const handleHourClick = (h: number) => {
    const newIsPM = isPM;
    onChange(`${h}:${String(minutes).padStart(2, '0')} ${newIsPM ? 'PM' : 'AM'}`);
  };

  const handleMinuteClick = (m: number) => {
    onChange(`${hour12}:${String(m).padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`);
  };

  const toggleAMPM = () => {
    const newIsPM = !isPM;
    onChange(`${hour12}:${String(minutes).padStart(2, '0')} ${newIsPM ? 'PM' : 'AM'}`);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTextInput(e.target.value);
    // Auto-detect time format and update if valid
    const match = e.target.value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (match) {
      onChange(e.target.value);
    }
  };

  const handleTextBlur = () => {
    const match = textInput.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (match) {
      onChange(textInput);
    } else {
      // Try to fix common inputs like "8pm" or "20:00"
      const simple = textInput.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
      if (simple) {
        let h = parseInt(simple[1]);
        const m = simple[2] ? parseInt(simple[2]) : 0;
        const ap = simple[3]?.toUpperCase() || (h >= 12 ? 'PM' : 'AM');
        if (ap === 'PM' && h > 12) { /* already 24h */ }
        const formatted = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`;
        onChange(formatted);
        setTextInput(formatted);
      }
    }
  };

  // Sync text input with value
  useEffect(() => {
    setTextInput(value);
  }, [value]);

  return (
    <div className="flex flex-col items-center w-full">
      <div className="flex items-center gap-2 mb-3 self-start">
        <Clock size={14} className="text-blue-400" />
        <label className="text-[10px] font-black uppercase text-white/40 tracking-widest">{label}</label>
      </div>

      {/* Tab toggle */}
      <div className="flex bg-white/5 rounded-xl p-1 mb-4 w-full">
        <button
          onClick={() => setActiveTab('clock')}
          className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
            activeTab === 'clock' ? 'bg-blue-600 text-white shadow-lg' : 'text-white/40 hover:text-white/70'
          }`}
        >
          Clock
        </button>
        <button
          onClick={() => setActiveTab('text')}
          className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
            activeTab === 'text' ? 'bg-blue-600 text-white shadow-lg' : 'text-white/40 hover:text-white/70'
          }`}
        >
          Type
        </button>
      </div>

      {activeTab === 'clock' ? (
        <div className="relative w-full flex flex-col items-center">
          {/* SVG Clock Face */}
          <svg
            ref={svgRef}
            viewBox="0 0 300 300"
            className="w-64 h-64"
          >
            {/* Clock face background */}
            <circle cx={CX} cy={CY} r={130} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <circle cx={CX} cy={CY} r={118} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />

            {/* Hour markers */}
            {HOURS.map((h, idx) => {
              const pos = getHourPos(idx);
              const isActive = (idx === 0 ? 12 : idx) === hour12;
              return (
                <g key={h} onClick={() => handleHourClick(idx === 0 ? 12 : idx)} className="cursor-pointer">
                  <circle
                    cx={pos.x} cy={pos.y} r={isActive ? 22 : 18}
                    fill={isActive ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.05)'}
                    stroke={isActive ? '#3b82f6' : 'rgba(255,255,255,0.1)'}
                    strokeWidth={isActive ? 2 : 1}
                    className="transition-all duration-200 hover:fill-blue-500/20"
                  />
                  <text
                    x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
                    fill={isActive ? '#60a5fa' : 'rgba(255,255,255,0.6)'}
                    fontSize="16" fontWeight="700"
                    className="pointer-events-none select-none"
                  >
                    {h}
                  </text>
                </g>
              );
            })}

            {/* Minute markers - inner ring */}
            {MINUTES.map((m) => {
              const pos = getMinPos(m);
              const isActive = minutes === m;
              return (
                <g key={m} onClick={() => handleMinuteClick(m)} className="cursor-pointer">
                  <circle
                    cx={pos.x} cy={pos.y} r={isActive ? 14 : 10}
                    fill={isActive ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.03)'}
                    stroke={isActive ? '#a855f7' : 'rgba(255,255,255,0.06)'}
                    strokeWidth={isActive ? 1.5 : 0.5}
                    className="transition-all duration-200 hover:fill-purple-500/20"
                  />
                  <text
                    x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
                    fill={isActive ? '#c084fc' : 'rgba(255,255,255,0.35)'}
                    fontSize="9" fontWeight="600"
                    className="pointer-events-none select-none"
                  >
                    {String(m).padStart(2, '0')}
                  </text>
                </g>
              );
            })}

            {/* Hour hand */}
            <line
              x1={CX} y1={CY}
              x2={CX + 55 * Math.cos(hourAngle * Math.PI / 180)}
              y2={CY + 55 * Math.sin(hourAngle * Math.PI / 180)}
              stroke="#3b82f6" strokeWidth="3" strokeLinecap="round"
              className="transition-all duration-300"
            />
            {/* Minute hand */}
            <line
              x1={CX} y1={CY}
              x2={CX + 70 * Math.cos(minAngle * Math.PI / 180)}
              y2={CY + 70 * Math.sin(minAngle * Math.PI / 180)}
              stroke="#a855f7" strokeWidth="2" strokeLinecap="round"
              className="transition-all duration-300"
            />
            {/* Center dot */}
            <circle cx={CX} cy={CY} r={5} fill="#3b82f6" />
            <circle cx={CX} cy={CY} r={2} fill="#fff" />

            {/* Labels */}
            <text x={CX} y={CY - 140} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="9" fontWeight="600" className="select-none">
              Hours (Outer)
            </text>
            <text x={CX} y={CY + 145} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="9" fontWeight="600" className="select-none">
              Minutes (Inner)
            </text>
          </svg>

          {/* Digital time display */}
          <motion.div
            key={`${hour12}-${minutes}-${isPM ? 'PM' : 'AM'}`}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mt-4 text-3xl font-black tracking-tighter text-white flex items-center gap-2"
          >
            <span className="text-blue-400">{hour12}</span>
            <span className="text-white/40">:</span>
            <span className="text-purple-400">{String(minutes).padStart(2, '0')}</span>
            <button
              onClick={toggleAMPM}
              className="ml-2 px-3 py-1 rounded-xl text-sm font-black bg-white/10 hover:bg-blue-600/30 transition-all"
            >
              <span className={isPM ? 'text-blue-400' : 'text-white/40'}>{isPM ? 'PM' : 'AM'}</span>
            </button>
          </motion.div>
        </div>
      ) : (
        /* Text input mode */
        <div className="w-full space-y-3">
          <input
            value={textInput}
            onChange={handleTextChange}
            onBlur={handleTextBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleTextBlur()}
            placeholder="e.g. 8:00 PM"
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-center text-2xl font-black outline-none focus:border-blue-500/50 transition-all tracking-tight"
          />
          <div className="flex justify-center gap-4 text-[10px] text-white/20 font-bold uppercase tracking-wider">
            <span>Format: HH:MM AM/PM</span>
            <span className="text-blue-400/40">e.g. 8:00 PM, 01:30 AM</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnimatedClock;
