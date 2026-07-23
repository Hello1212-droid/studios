import React, { useState, useRef } from 'react';
import { motion, useSpring, useTransform, MotionValue } from 'framer-motion';

interface DockApp {
  id: string;
  label: string;
  icon: React.ReactNode;
  isOpen: boolean;
  isActive: boolean;
  color: string;
  onClick: () => void;
}

interface DockItemProps {
  app: DockApp;
  mouseX: MotionValue<number>;
}

const DOCK_ITEM_SIZE = 56;
const MAGNIFICATION = 80;
const DISTANCE = 120;

const DockItem: React.FC<DockItemProps> = ({ app, mouseX }) => {
  const ref = useRef<HTMLButtonElement>(null);
  const [tooltip, setTooltip] = useState(false);

  const distance = useTransform(mouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds) return DISTANCE + 1;
    const center = bounds.x + bounds.width / 2;
    return Math.abs(val - center);
  });

  const widthTransform = useTransform(distance, [0, DISTANCE], [MAGNIFICATION, DOCK_ITEM_SIZE]);
  const width = useSpring(widthTransform, { mass: 0.1, stiffness: 200, damping: 12 });

  return (
    <div className="relative flex flex-col items-center" onMouseEnter={() => setTooltip(true)} onMouseLeave={() => setTooltip(false)}>
      {/* Tooltip */}
      {tooltip && (
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="absolute bottom-full mb-3 px-3 py-1.5 rounded-xl bg-[#1a1a1f]/95 border border-white/10 text-white text-xs font-semibold whitespace-nowrap backdrop-blur-xl shadow-xl tooltip z-50"
        >
          {app.label}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-[#1a1a1f]/95" />
        </motion.div>
      )}

      <motion.button
        ref={ref}
        style={{ width, height: width }}
        onClick={app.onClick}
        className="relative flex items-center justify-center rounded-2xl transition-colors"
        whileTap={{ scale: 0.88 }}
      >
        {/* Icon background with glass effect */}
        <div
          className={`absolute inset-0 rounded-2xl transition-all duration-200 ${
            app.isActive
              ? 'opacity-100'
              : 'opacity-80 hover:opacity-95'
          }`}
          style={{
            background: `linear-gradient(145deg, ${app.color}dd, ${app.color}99)`,
            boxShadow: app.isActive
              ? `0 0 0 2px rgba(255,255,255,0.2), 0 8px 20px ${app.color}50`
              : `0 4px 12px ${app.color}30`,
          }}
        />

        {/* Icon */}
        <div className="relative z-10 text-white flex items-center justify-center" style={{ fontSize: '1.5em' }}>
          {app.icon}
        </div>

        {/* Open indicator dot */}
        {app.isOpen && (
          <div
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
            style={{ background: app.isActive ? 'white' : 'rgba(255,255,255,0.5)' }}
          />
        )}
      </motion.button>
    </div>
  );
};

interface DockProps {
  apps: DockApp[];
}

const Dock: React.FC<DockProps> = ({ apps }) => {
  const mouseX = useSpring(-Infinity, { stiffness: 500, damping: 30 });

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.3 }}
        onMouseMove={e => mouseX.set(e.clientX)}
        onMouseLeave={() => mouseX.set(-Infinity)}
        className="flex items-end gap-3 px-4 py-3 rounded-3xl"
        style={{
          background: 'rgba(20, 20, 25, 0.75)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        {apps.map(app => (
          <DockItem key={app.id} app={app} mouseX={mouseX} />
        ))}
      </motion.div>
    </div>
  );
};

export default Dock;
