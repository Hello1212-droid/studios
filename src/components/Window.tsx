/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              WINDOW — macOS-STYLE WINDOW CHROME               ║
 * ║                                                              ║
 * ║  Wraps every app in a draggable, resizable window with       ║
 * ║  traffic-light buttons (close, minimize, maximize).          ║
 * ║                                                              ║
 * ║  Features:                                                   ║
 * ║    • Drag to move (via title bar)                            ║
 * ║    • Resize from bottom-right corner                         ║
 * ║    • Maximize / restore (fills screen minus dock + status)   ║
 * ║    • Close and minimize with animations                      ║
 * ║    • Z-index management (focus brings to front)              ║
 * ║    • Glass/chrome styling with accent border on focus        ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import React, { useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  X,           // Close button (red traffic light)
  Minus,       // Minimize button (yellow traffic light)
  Maximize2,   // Maximize button (green traffic light)
  Minimize2    // Restore button (when maximized)
} from 'lucide-react';

/** WindowProps — All configuration and callbacks for a window instance. */
export interface WindowProps {
  id: string;                       // Unique window ID (used in App.tsx)
  title: string;                    // Title bar text
  icon: React.ReactNode;            // Small icon next to the title
  children: React.ReactNode;        // The app content rendered inside
  isActive: boolean;                // Is this window focused? (affects styling)
  isMinimized: boolean;             // Is this window hidden to the dock?
  zIndex: number;                   // Stacking order
  initialPosition?: { x: number; y: number };   // Starting screen position
  initialSize?: { width: number; height: number }; // Starting dimensions
  onFocus: () => void;              // Called when the window is clicked
  onClose: () => void;              // Called when close button is clicked
  onMinimize: () => void;           // Called when minimize button is clicked
  minWidth?: number;                // Minimum resize width (default: 400)
  minHeight?: number;               // Minimum resize height (default: 300)
  accentColor?: string;             // Border color when focused (default: #007AFF)
}

const Window: React.FC<WindowProps> = ({
  title, icon, children, isActive, isMinimized, zIndex,
  initialPosition, initialSize, onFocus, onClose, onMinimize,
  minWidth = 400, minHeight = 300, accentColor = '#007AFF'
}) => {
  // ── Position State ───────────────────────────────────────
  /** position — Current x/y screen coordinates of the window. */
  const [position, setPosition] = useState(initialPosition || { x: 80, y: 60 });

  /** size — Current width/height of the window. */
  const [size, setSize] = useState(initialSize || { width: 800, height: 560 });

  /** isMaximized — Whether the window fills the workspace. */
  const [isMaximized, setIsMaximized] = useState(false);

  /** prevState — Saved position/size before maximize, used for restore. */
  const [prevState, setPrevState] = useState({ position, size });

  // ── Drag Refs ────────────────────────────────────────────
  /** dragging — True while the user is dragging the window. */
  const dragging = useRef(false);

  /** dragStart — Mouse offset from window top-left at drag start. */
  const dragStart = useRef({ x: 0, y: 0 });

  // ── Resize Refs ──────────────────────────────────────────
  /** resizing — True while the user is dragging the resize handle. */
  const resizing = useRef(false);

  /** resizeStart — Mouse position and window size at resize start. */
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  /**
   * handleTitlebarMouseDown(e)
   * ──────────────────────────────────────────────────────────
   * Starts a window drag operation.
   *
   * Flow:
   *   1. Don't drag if maximized (maximized windows can't be moved)
   *   2. Calculate the mouse offset from the window's top-left corner
   *   3. Attach global mousemove/mouseup listeners
   *   4. On mousemove: update position, clamped to screen bounds
   *   5. On mouseup: clean up listeners
   */
  const handleTitlebarMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMaximized) return;        // Can't drag maximized windows
    e.preventDefault();
    onFocus();                       // Bring this window to front

    dragging.current = true;

    // Calculate offset: how far into the title bar the user clicked
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;

      // Clamp to screen bounds (28px top for status bar, 88px bottom for dock)
      const newX = Math.max(0, Math.min(
        window.innerWidth - size.width,
        e.clientX - dragStart.current.x
      ));
      const newY = Math.max(24, Math.min(
        window.innerHeight - 80,
        e.clientY - dragStart.current.y
      ));

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

  /**
   * handleResizeMouseDown(e)
   * ──────────────────────────────────────────────────────────
   * Starts a resize operation from the bottom-right corner handle.
   *
   * Flow:
   *   1. Record the starting mouse position and window size
   *   2. Attach global mousemove/mouseup listeners
   *   3. On mousemove: calculate new size (delta from start)
   *   4. Clamp to minWidth/minHeight
   *   5. On mouseup: clean up listeners
   */
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();             // Don't trigger window focus

    resizing.current = true;
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      w: size.width,
      h: size.height
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing.current) return;

      // Calculate new dimensions from the drag delta
      const newW = Math.max(
        minWidth,
        resizeStart.current.w + e.clientX - resizeStart.current.x
      );
      const newH = Math.max(
        minHeight,
        resizeStart.current.h + e.clientY - resizeStart.current.y
      );

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

  /**
   * toggleMaximize()
   * ──────────────────────────────────────────────────────────
   * Maximize: saves current position/size, then fills the screen.
   * Restore: returns to the saved position/size.
   *
   * The maximized size accounts for:
   *   28px  → status bar at top
   *   88px  → dock at bottom
   */
  const toggleMaximize = () => {
    if (isMaximized) {
      // Restore: go back to saved position/size
      setPosition(prevState.position);
      setSize(prevState.size);
      setIsMaximized(false);
    } else {
      // Maximize: save current state, then fill screen
      setPrevState({ position, size });
      setPosition({ x: 0, y: 28 }); // Below status bar
      setSize({
        width: window.innerWidth,
        height: window.innerHeight - 28 - 88 // Minus status bar and dock
      });
      setIsMaximized(true);
    }
  };

  // Don't render if minimized (parent handles the chip display)
  if (isMinimized) return null;

  return (
    <motion.div
      // ── Entry/exit animations ──────────────────────────────
      initial={{ opacity: 0, scale: 0.85, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: 30 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}

      // ── Positioning ──────────────────────────────────────
      style={{
        position: 'fixed',
        left: isMaximized ? 0 : position.x,
        top: isMaximized ? 28 : position.y,
        width: isMaximized ? '100vw' : size.width,
        height: isMaximized ? `calc(100vh - 28px - 88px)` : size.height,
        zIndex,
        userSelect: dragging.current ? 'none' : 'auto', // Prevent text selection during drag
      }}

      onMouseDown={onFocus}  // Click anywhere = focus this window
      className="flex flex-col rounded-2xl overflow-hidden window-shadow"
    >
      {/* ══════════════════════════════════════════════════════
          WINDOW CHROME (TITLE BAR)
          ══════════════════════════════════════════════════════ */}
      <div
        className="window-titlebar flex items-center gap-3 px-4 py-3 shrink-0"
        style={{
          background: isActive
            ? 'rgba(28, 28, 32, 0.95)'       // Active: brighter
            : 'rgba(20, 20, 24, 0.92)',       // Inactive: dimmer
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',  // Safari support
          borderBottom: `1px solid ${
            isActive ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'
          }`,
        }}
        onMouseDown={handleTitlebarMouseDown}    // Drag handler
        onDoubleClick={toggleMaximize}            // Double-click = maximize
      >
        {/* ═══ Traffic Light Buttons (macOS style) ═══ */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Close (Red) — reveals X on hover */}
          <button
            onMouseDown={e => e.stopPropagation()} // Don't trigger drag
            onClick={onClose}
            className="w-3 h-3 rounded-full bg-[#FF5F57] hover:bg-[#ff4444] transition-colors group flex items-center justify-center"
            title="Close"
          >
            <X size={7} className="opacity-0 group-hover:opacity-100 text-[#8B0000]" />
          </button>

          {/* Minimize (Yellow) — reveals minus on hover */}
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={onMinimize}
            className="w-3 h-3 rounded-full bg-[#FFBD2E] hover:bg-[#ffaa00] transition-colors group flex items-center justify-center"
            title="Minimize"
          >
            <Minus size={7} className="opacity-0 group-hover:opacity-100 text-[#8B5800]" />
          </button>

          {/* Maximize (Green) — reveals expand/contract on hover */}
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

        {/* ═══ Title (centered) ═══ */}
        <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
          {/* Icon (15px, semi-transparent) */}
          <span className="text-white/50 shrink-0" style={{ fontSize: 14 }}>
            {icon}
          </span>
          {/* Title text — dims when window is inactive */}
          <span className={`text-sm font-semibold truncate transition-colors ${
            isActive ? 'text-white/85' : 'text-white/40'
          }`}>
            {title}
          </span>
        </div>

        {/* Spacer for symmetry (matches traffic light width) */}
        <div className="w-16 shrink-0" />
      </div>

      {/* ══════════════════════════════════════════════════════
          WINDOW CONTENT AREA
          ══════════════════════════════════════════════════════ */}
      <div
        className="flex-1 overflow-hidden relative"
        style={{ background: 'rgba(12, 12, 16, 0.98)' }}
      >
        {children}  {/* The actual app component (Browser, Scheduler, etc.) */}

        {/* Subtle accent border when window is focused */}
        {isActive && (
          <div
            className="absolute inset-0 pointer-events-none rounded-b-2xl"
            style={{ boxShadow: `inset 0 0 0 1px ${accentColor}15` }}
          />
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          RESIZE HANDLE (BOTTOM-RIGHT CORNER)
          ══════════════════════════════════════════════════════ */}
      {!isMaximized && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10"
          onMouseDown={handleResizeMouseDown}
          style={{
            // Diagonal gradient for the resize affordance
            background: 'linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.08) 50%)',
          }}
        />
      )}
    </motion.div>
  );
};

export default Window;
