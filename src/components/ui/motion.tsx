'use client';

import { motion, useMotionValue, useReducedMotion, useSpring, type HTMLMotionProps, type Variants } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/utils/cn';

/**
 * Tier-1 motion helpers (design.md §7.2). Every helper honours reduced motion and
 * animates transform / opacity only. Pointer handlers write to MotionValues.
 */

// ---------------------------------------------------------------------------
// Reveal: staggered entrance for panels and their children
// ---------------------------------------------------------------------------
/** Shared spring vocabulary (Phase 7 M4). Heavy = panels, snappy = chips/buttons, crisp = text. */
export const SPRING = {
  heavy: { type: 'spring', stiffness: 260, damping: 26, mass: 1 },
  snappy: { type: 'spring', stiffness: 300, damping: 20 },
  crisp: { type: 'spring', stiffness: 420, damping: 30 },
  tap: { type: 'spring', stiffness: 500, damping: 30 },
} as const;

export const revealContainer: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  show: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { ...SPRING.heavy, delay, staggerChildren: 0.05, delayChildren: delay + 0.08 },
  }),
};

export const revealItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: SPRING.snappy },
};

export interface RevealProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  delay?: number;
  children: ReactNode;
}

export function Reveal({ delay = 0, children, ...rest }: RevealProps) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={rest.className}>{children}</div>;
  return (
    <motion.div variants={revealContainer} initial="hidden" animate="show" custom={delay} {...rest}>
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div variants={revealItem} className={className}>
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// StaggerText: character-by-character reveal, ≤ 240 ms total, re-runs on `text` change
// ---------------------------------------------------------------------------
export function StaggerText({ text, className, glitch = false }: { text: string; className?: string; glitch?: boolean }) {
  const reduced = useReducedMotion();
  const chars = useMemo(() => Array.from(text), [text]);
  if (reduced) return <span className={className}>{text}</span>;
  const per = Math.min(0.02, 0.24 / Math.max(chars.length, 1));
  return (
    <span key={text} className={cn('inline-block whitespace-pre', glitch && 'animate-glitch', className)}>
      <span className="sr-only">{text}</span>
      {chars.map((c, i) => (
        <motion.span
          key={`${i}-${c}`}
          aria-hidden
          className="inline-block"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING.crisp, delay: i * per }}
        >
          {c}
        </motion.span>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Magnetic: translates toward the pointer by ≤ 6 px within the element (+ padding)
// ---------------------------------------------------------------------------
export function useMagnetic(strength = 6, enabled = true) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement | null>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 300, damping: 20 });
  const y = useSpring(my, { stiffness: 300, damping: 20 });
  const active = enabled && !reduced;

  // Geometry is read once on enter (one layout read per hover), never per move.
  const rect = useRef<DOMRect | null>(null);
  const onPointerEnter = useCallback(() => {
    if (active && ref.current) rect.current = ref.current.getBoundingClientRect();
  }, [active]);
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!active) return;
      const r = rect.current ?? (ref.current ? (rect.current = ref.current.getBoundingClientRect()) : null);
      if (!r) return;
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      mx.set(Math.max(-1, Math.min(1, dx)) * strength);
      my.set(Math.max(-1, Math.min(1, dy)) * strength);
    },
    [active, mx, my, strength],
  );
  const onPointerLeave = useCallback(() => {
    rect.current = null;
    mx.set(0);
    my.set(0);
  }, [mx, my]);

  return { ref, style: active ? { x, y } : {}, onPointerEnter, onPointerMove, onPointerLeave } as const;
}

// ---------------------------------------------------------------------------
// ScanLine: one sweep + flicker when `refreshKey` changes (not on first mount)
// ---------------------------------------------------------------------------
export function useRefreshTick(refreshKey: number | string | undefined): number {
  const [tick, setTick] = useState(0);
  const prev = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey !== undefined && prev.current !== undefined && refreshKey !== prev.current) setTick((t) => t + 1);
    prev.current = refreshKey;
  }, [refreshKey]);
  return tick;
}

export function ScanLine({ tick }: { tick: number }) {
  const reduced = useReducedMotion();
  if (reduced || tick === 0) return null;
  // Full-height element carrying a 1 px top edge, translated 0 → 100% of its own height.
  return <span key={tick} aria-hidden className="scan-edge pointer-events-none absolute inset-0 z-20 animate-scanline" />;
}

// ---------------------------------------------------------------------------
// Holographic sheen: writes --mx/--my/--ma to the element, no React state
// ---------------------------------------------------------------------------
export function useHoloSheen<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const rect = useRef<DOMRect | null>(null);
  // One layout read on enter; every move is pure arithmetic + three style-var writes.
  const onPointerEnter = useCallback(() => {
    if (ref.current) rect.current = ref.current.getBoundingClientRect();
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent<T>) => {
    const el = ref.current;
    if (!el) return;
    const r = rect.current ?? (rect.current = el.getBoundingClientRect());
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    el.style.setProperty('--mx', `${x}px`);
    el.style.setProperty('--my', `${y}px`);
    el.style.setProperty('--ma', `${Math.atan2(y - r.height / 2, x - r.width / 2) * (180 / Math.PI)}`);
  }, []);
  const onPointerLeave = useCallback(() => {
    rect.current = null;
  }, []);
  return { ref, onPointerEnter, onPointerMove, onPointerLeave } as const;
}
