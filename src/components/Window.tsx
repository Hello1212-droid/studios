import React, { useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Minus, Maximize2, Minimize2 } from 'lucide-react';

export interface WindowProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isActive: boolean;
  isMinimized: boolean;
  zIndex: number;
  initialPosition?: { x: number; y: number };
  initialSize?: { width: number; height: number };
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  minWidth?: number;
  minHeight?: number;
  accentColor?: string;
}

const Window: React.FC<WindowProps> = ({
  title, icon, children, isActive, isMinimized, zIndex,
  initialPosition, initialSize, onFocus, onClose, onMinimize,
  minWidth = 400, minHeight = 300, accentColor = '#007AFF'
}) => {
  const [position, setPosition] = useState(initialPosition || { x: 80, y: 60 });
  const [size, setSize] = useState(initialSize || { width: 800, height: 560 });
  const [isMaximized, setIsMaximized] = useState(false);
  const [prevState, setPrevState] = useState({ position, size });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const resizing = useRef(false);
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const handleTitlebarMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMaximized) return;
    e.preventDefault();
    onFocus();
    dragging.current = true;
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const newX = Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - dragStart.current.x));
      const newY = Math.max(24, Math.min(window.innerHeight - 80, e.clientY - dragStart.current.y));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [position, size, isMaximized, onFocus]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = true;
    resizeStart.current = { x: e.clientX, y: e.clientY, w: size.width, h: size.height };

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing.current) return;
      const newW = Math.max(minWidth, resizeStart.current.w + e.clientX - resizeStart.current.x);
      const newH = Math.max(minHeight, resizeStart.current.h + e.clientY - resizeStart.current.y);
      setSize({ width: newW, height: newH });
    };

    const handleMouseUp = () => {
      resizing.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [size, minWidth, minHeight]);

  const toggleMaximize = () => {
    if (isMaximized) {
      setPosition(prevState.position);
      setSize(prevState.size);
      setIsMaximized(false);
    } else {
      setPrevState({ position, size });
      setPosition({ x: 0, y: 28 });
      setSize({ width: window.innerWidth, height: window.innerHeight - 28 - 88 });
      setIsMaximized(true);
    }
  };

  if (isMinimized) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: 30 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{
        position: 'fixed',
        left: isMaximized ? 0 : position.x,
        top: isMaximized ? 28 : position.y,
        width: isMaximized ? '100vw' : size.width,
        height: isMaximized ? `calc(100vh - 28px - 88px)` : size.height,
        zIndex,
        userSelect: dragging.current ? 'none' : 'auto',
      }}
      onMouseDown={onFocus}
      className="flex flex-col rounded-2xl overflow-hidden window-shadow"
    >
      {/* Window chrome */}
      <div
        className="window-titlebar flex items-center gap-3 px-4 py-3 shrink-0"
        style={{
          background: isActive
            ? 'rgba(28, 28, 32, 0.95)'
            : 'rgba(20, 20, 24, 0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${isActive ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'}`,
        }}
        onMouseDown={handleTitlebarMouseDown}
        onDoubleClick={toggleMaximize}
      >
        {/* Traffic lights */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={onClose}
            className="w-3 h-3 rounded-full bg-[#FF5F57] hover:bg-[#ff4444] transition-colors group flex items-center justify-center"
            title="Close"
          >
            <X size={7} className="opacity-0 group-hover:opacity-100 text-[#8B0000]" />
          </button>
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={onMinimize}
            className="w-3 h-3 rounded-full bg-[#FFBD2E] hover:bg-[#ffaa00] transition-colors group flex items-center justify-center"
            title="Minimize"
          >
            <Minus size={7} className="opacity-0 group-hover:opacity-100 text-[#8B5800]" />
          </button>
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={toggleMaximize}
            className="w-3 h-3 rounded-full bg-[#28CA42] hover:bg-[#1ea832] transition-colors group flex items-center justify-center"
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized
              ? <Minimize2 size={6} className="opacity-0 group-hover:opacity-100 text-[#006000]" />
              : <Maximize2 size={6} className="opacity-0 group-hover:opacity-100 text-[#006000]" />
            }
          </button>
        </div>

        {/* Title */}
        <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
          <span className="text-white/50 shrink-0" style={{ fontSize: 14 }}>{icon}</span>
          <span className={`text-sm font-semibold truncate transition-colors ${isActive ? 'text-white/85' : 'text-white/40'}`}>
            {title}
          </span>
        </div>

        {/* Spacer for symmetry */}
        <div className="w-16 shrink-0" />
      </div>

      {/* Window content */}
      <div className="flex-1 overflow-hidden relative" style={{ background: 'rgba(12, 12, 16, 0.98)' }}>
        {children}

        {/* Active border glow */}
        {isActive && (
          <div
            className="absolute inset-0 pointer-events-none rounded-b-2xl"
            style={{ boxShadow: `inset 0 0 0 1px ${accentColor}15` }}
          />
        )}
      </div>

      {/* Resize handle */}
      {!isMaximized && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10"
          onMouseDown={handleResizeMouseDown}
          style={{
            background: 'linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.08) 50%)',
          }}
        />
      )}
    </motion.div>
  );
};

export default Window;
