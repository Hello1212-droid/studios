/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              DOCK — macOS-STYLE ANIMATED DOCK                 ║
 * ║                                                              ║
 * ║  Renders a floating glass bar at the bottom-center of the    ║
 * ║  screen with macOS-style magnification on hover.             ║
 * ║                                                              ║
 * ║  Features:                                                   ║
 * ║    • Spring-based magnification (items grow as cursor nears) ║
 * ║    • Open indicator dots (white = active, gray = open)       ║
 * ║    • Tooltip labels on hover                                 ║
 * ║    • Glass backdrop with blur                                ║
 * ║    • While-tap scale animation                               ║
 * ║                                                              ║
 * ║  The magnification math:                                     ║
 * ║    distance = |mouseX - itemCenter|                          ║
 * ║    width = mapRange(distance, [0, DISTANCE], [MAGNIFICATION, DOCK_ITEM_SIZE]) ║
 * ║    Items closer to the cursor grow bigger.                   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import React, { useState, useRef } from 'react';
import {
  motion,                    // Framer Motion for animations
  useSpring,                 // Spring physics (smooth magnification)
  useTransform,              // Map mouse distance → item width
  MotionValue                // Type for Framer Motion reactive values
} from 'framer-motion';

/** DockApp — Data for a single dock item. */
interface DockApp {
  id: string;                 // Unique app ID
  label: string;              // Tooltip text
  icon: React.ReactNode;      // Lucide icon (28px)
  isOpen: boolean;            // Is the app window open?
  isActive: boolean;          // Is this the focused app?
  color: string;              // Accent color for the icon background
  onClick: () => void;        // Click handler
}

/** DockItemProps — Props for a single dock icon. */
interface DockItemProps {
  app: DockApp;
  mouseX: MotionValue<number>; // Reactive mouse X position from parent
}

// ── Dock Sizing Constants ─────────────────────────────────────
const DOCK_ITEM_SIZE = 56;     // Default width/height in px
const MAGNIFICATION = 80;       // Max width/height when cursor is directly on item
const DISTANCE = 120;           // Mouse distance threshold (pixels) for magnification

/**
 * DockItem
 * A single animated icon in the dock with spring-based magnification.
 */
const DockItem: React.FC<DockItemProps> = ({ app, mouseX }) => {
  const ref = useRef<HTMLButtonElement>(null);
  const [tooltip, setTooltip] = useState(false);

  /**
   * distance — How far the mouse cursor is from this item's center.
   * useTransform recalculates this reactively as mouseX changes.
   * Returns DISTANCE+1 when the element isn't rendered yet (bounds check).
   */
  const distance = useTransform(mouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds) return DISTANCE + 1;
    const center = bounds.x + bounds.width / 2;
    return Math.abs(val - center);
  });

  /**
   * widthTransform — Maps distance → item width.
   * Closer = bigger (up to MAGNIFICATION), farther = normal (DOCK_ITEM_SIZE).
   */
  const widthTransform = useTransform(
    distance,
    [0, DISTANCE],
    [MAGNIFICATION, DOCK_ITEM_SIZE]
  );

  /** width — Spring-physics version of widthTransform. Smooth, bouncy feel. */
  const width = useSpring(widthTransform, {
    mass: 0.1,       // Low mass = fast response
    stiffness: 200,  // Medium stiffness
    damping: 12       // Slight bounce
  });

  return (
    <div
      className="relative flex flex-col items-center"
      onMouseEnter={() => setTooltip(true)}
      onMouseLeave={() => setTooltip(false)}
    >
      {/* ── Tooltip ──────────────────────────────────────────── */}
      {tooltip && (
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="absolute bottom-full mb-3 px-3 py-1.5 rounded-xl bg-[#1a1a1f]/95 border border-white/10 text-white text-xs font-semibold whitespace-nowrap backdrop-blur-xl shadow-xl tooltip z-50"
        >
          {app.label}
          {/* Arrow pointing down to the dock icon */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-[#1a1a1f]/95" />
        </motion.div>
      )}

      {/* ── Dock Icon Button ─────────────────────────────────── */}
      <motion.button
        ref={ref}
        style={{ width, height: width }}          // Reactive sizing
        onClick={app.onClick}
        className="relative flex items-center justify-center rounded-2xl transition-colors"
        whileTap={{ scale: 0.88 }}                // Squish on click
      >
        {/* Colored gradient background */}
        <div
          className={`absolute inset-0 rounded-2xl transition-all duration-200 ${
            app.isActive ? 'opacity-100' : 'opacity-80 hover:opacity-95'
          }`}
          style={{
            background: `linear-gradient(145deg, ${app.color}dd, ${app.color}99)`,
            boxShadow: app.isActive
              ? `0 0 0 2px rgba(255,255,255,0.2), 0 8px 20px ${app.color}50`
              : `0 4px 12px ${app.color}30`,
          }}
        />

        {/* Icon (on top of colored background) */}
        <div className="relative z-10 text-white flex items-center justify-center" style={{ fontSize: '1.5em' }}>
          {app.icon}
        </div>

        {/* Open indicator dot (below the icon) */}
        {app.isOpen && (
          <div
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
            style={{
              background: app.isActive ? 'white' : 'rgba(255,255,255,0.5)'
            }}
          />
        )}
      </motion.button>
    </div>
  );
};

/** DockProps — Array of dock items to render. */
interface DockProps {
  apps: DockApp[];
}

/**
 * Dock
 * The main dock container — a floating glass bar at the bottom of the screen.
 * Tracks the mouse X position and passes it to all DockItems for magnification.
 */
const Dock: React.FC<DockProps> = ({ apps }) => {
  /**
   * mouseX — A spring-animated value tracking the cursor's X position.
   * Starts at -Infinity (no magnification when mouse is outside).
   * useSpring smooths the value so items don't jump.
   */
  const mouseX = useSpring(-Infinity, { stiffness: 500, damping: 30 });

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
      <motion.div
        // ── Entry animation ─────────────────────────────────
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.3 }}

        // ── Mouse tracking ──────────────────────────────────
        onMouseMove={e => mouseX.set(e.clientX)}   // Update mouse position
        onMouseLeave={() => mouseX.set(-Infinity)}   // Reset when mouse leaves dock

        className="flex items-end gap-3 px-4 py-3 rounded-3xl"

        // ── Glass styling ──────────────────────────────────
        style={{
          background: 'rgba(20, 20, 25, 0.75)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow:
            '0 8px 32px rgba(0,0,0,0.5), ' +        // Main shadow
            '0 0 0 1px rgba(255,255,255,0.05), ' +    // Inner border
            'inset 0 1px 0 rgba(255,255,255,0.08)',    // Top highlight
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
