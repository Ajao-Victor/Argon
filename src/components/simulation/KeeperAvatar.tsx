'use client';

import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { memo, useEffect, useId, useMemo, useRef } from 'react';

import { useBrandColors } from '@/hooks/useBrandColors';
import { useSimulationLoop } from '@/hooks/useSimulationLoop';
import type { PolicyAction } from '@/types/forecast';
import { cn } from '@/utils/cn';
import { keeperEnergy, type KeeperState } from '@/utils/sim/keeper';

/**
 * The Keeper Avatar (design.md §7.1): the brain of the vault as an instrument.
 * Inline SVG + Framer Motion. Every continuous animation is translate / rotate /
 * scale / opacity. No SVG filters, no box-shadow loops. Pointer tracking writes
 * to MotionValues on weighted springs (stiffness 100, damping 30), never to
 * React state. Under reduced motion it is a static glyph in the state color.
 *
 * Layers, back to front:
 *   halo (radial gradient, breathes)  →  inner core glow (breathes, offset phase)
 *   →  hover group (slow Y drift)  →  rings  →  arcs  →  core hex  →  eyes
 */
export interface KeeperAvatarProps {
  ethPctChange: number | null;
  action: PolicyAction | undefined;
  warmupComplete: boolean;
  reachable: boolean;
  /** 'offline' (agent not configured) renders like live with no data: dormant. */
  mode: 'live' | 'fixture' | 'offline';
  hourId?: number | undefined;
  /** px, or '100%' to fill the parent width (square via aspect-ratio). */
  size?: number | '100%';
  className?: string;
  /** Viewport-space center of the avatar, for the particle attractor. Written on resize/scroll. */
  onCenterChange?: ((x: number, y: number) => void) | undefined;
  /** True while any agent query is in flight: scan line + data-ring pulse ("thinking"). */
  thinking?: boolean;
  /** Wallet write in progress: 'signing' holds still and waits; 'mining' overclocks until the receipt. */
  activity?: 'idle' | 'signing' | 'mining';
}

const COLOR: Record<KeeperState, { halo: string; ring: string; eye: string }> = {
  dormant: { halo: 'var(--argon-600)', ring: 'var(--argon-500)', eye: 'var(--argon-400)' },
  warmup: { halo: 'var(--argon-600)', ring: 'var(--argon-500)', eye: 'var(--argon-300)' },
  calm: { halo: 'var(--argon-500)', ring: 'var(--argon-400)', eye: 'var(--argon-300)' },
  charged: { halo: 'var(--plasma-400)', ring: 'var(--plasma-400)', eye: 'var(--plasma-400)' },
  aggressive: { halo: 'var(--plasma-500)', ring: 'var(--plasma-500)', eye: 'var(--signal-down)' },
};

const TRAINING = { halo: 'var(--ion-400)', ring: 'var(--ion-400)', eye: 'var(--ion-400)' };
const OVERCLOCK = { halo: 'var(--ion-400)', ring: 'var(--argon-300)', eye: 'var(--ion-400)' };
const SIGNING = { halo: 'var(--signal-warn)', ring: 'var(--signal-warn)', eye: 'var(--signal-warn)' };

/** Aura recipe per state (tokens.css --aura-*). Applied as a static filter on the wrapper. */
const AURA: Record<KeeperState, string> = {
  dormant: 'var(--aura-dormant)',
  warmup: 'var(--aura-dormant)',
  calm: 'var(--aura-calm)',
  charged: 'var(--aura-charged)',
  aggressive: 'var(--aura-exit)',
};

const RING_BASE_SEC = 24; // one revolution at ringSpeed 1
const STATE_SPRING = { type: 'spring', stiffness: 220, damping: 24 } as const;
const TRACK_SPRING = { stiffness: 100, damping: 30, mass: 1.1 } as const;

/** Breathing period per state, seconds. Faster = more agitated. */
const BREATH_SEC: Record<KeeperState, number> = { dormant: 6, warmup: 4.5, calm: 3.4, charged: 2.2, aggressive: 1.3 };

function hexPoints(r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return `${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`;
  }).join(' ');
}

function KeeperAvatarImpl({
  ethPctChange,
  action,
  warmupComplete,
  reachable,
  mode,
  hourId,
  size = 220,
  className,
  onCenterChange,
  thinking = false,
  activity = 'idle',
}: KeeperAvatarProps) {
  const reduced = useReducedMotion() ?? false;
  const energy = useMemo(
    () => keeperEnergy({ ethPctChange, warmupComplete, reachable, action }),
    [ethPctChange, warmupComplete, reachable, action],
  );
  const overclocked = activity === 'mining';
  const signing = activity === 'signing';
  const palette = overclocked ? OVERCLOCK : signing ? SIGNING : mode === 'fixture' ? TRAINING : COLOR[energy.state];
  const breath = overclocked ? 0.7 : signing ? 2.6 : mode === 'fixture' ? 1.2 : BREATH_SEC[energy.state];
  const aura = overclocked ? 'var(--aura-overclock)' : mode === 'fixture' ? 'var(--aura-training)' : AURA[energy.state];

  // Color breathing keyframes from resolved tokens. EXIT blazes plasma → signal-down;
  // ENTER / HOLD breathe deep argon-600 → argon-300 → plasma-400; training breathes ion.
  const c = useBrandColors();
  const coreFill = !c
    ? undefined
    : overclocked
      ? [c['ion-400'], c['argon-300'], c['plasma-400']]
      : mode === 'fixture'
        ? [c['ion-400'], c['argon-300']]
        : energy.state === 'aggressive'
          ? [c['plasma-500'], c['signal-down'], c['plasma-400']]
          : energy.state === 'charged'
            ? [c['argon-500'], c['plasma-400'], c['argon-300']]
            : energy.state === 'dormant'
              ? [c['text-dim'], c['argon-600']]
              : [c['argon-600'], c['argon-300'], c['plasma-400']];
  const ringStroke = !c
    ? undefined
    : energy.state === 'aggressive' && !overclocked
      ? [c['plasma-500'], c['signal-down']]
      : overclocked
        ? [c['argon-300'], c['ion-400']]
        : mode === 'fixture'
          ? [c['ion-400'], c['argon-400']]
          : [c['argon-500'], c['plasma-400']];
  const colorLoop = reduced ? { duration: 0.4 } : { duration: breath, repeat: Infinity, repeatType: 'mirror' as const, ease: 'easeInOut' as const };

  // ---- pointer → motion values → weighted springs (no React state) ----
  const rootRef = useRef<HTMLDivElement | null>(null);
  const center = useRef({ x: 0, y: 0, r: 1 });
  const px = useMotionValue(0); // -1 … 1
  const py = useMotionValue(0);
  const sx = useSpring(px, TRACK_SPRING);
  const sy = useSpring(py, TRACK_SPRING);
  const panX = useTransform(sx, (v) => v * 8); // whole core drifts toward the cursor
  const panY = useTransform(sy, (v) => v * 8);
  const eyeX = useTransform(sx, (v) => v * 6); // eyes lead the pan
  const eyeY = useTransform(sy, (v) => v * 4);
  const tiltX = useTransform(sy, (v) => v * -7);
  const tiltY = useTransform(sx, (v) => v * 7);
  const finePointer = useRef(true);
  const dirty = useRef(false);
  const measureRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    finePointer.current = window.matchMedia('(pointer: fine)').matches;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      center.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, r: Math.max(rect.width, 1) };
      onCenterChange?.(center.current.x, center.current.y);
    };
    measure();
    measureRef.current = measure;
    // Scroll and resize only mark the geometry dirty; the frame loop measures once, so no
    // layout read happens inside a scroll event (design.md §7.4 rule 7).
    const markDirty = () => {
      dirty.current = true;
    };
    const ro = new ResizeObserver(markDirty);
    ro.observe(el);
    window.addEventListener('scroll', markDirty, { passive: true });
    window.addEventListener('resize', markDirty, { passive: true });

    const onMove = (e: PointerEvent) => {
      if (!finePointer.current || reduced) return;
      const c = center.current;
      // Full deflection at ~1.5 avatar widths; farther cursors still pull, gently.
      const dx = (e.clientX - c.x) / (c.r * 1.5);
      const dy = (e.clientY - c.y) / (c.r * 1.5);
      px.set(Math.max(-1, Math.min(1, dx)));
      py.set(Math.max(-1, Math.min(1, dy)));
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', markDirty);
      window.removeEventListener('resize', markDirty);
      window.removeEventListener('pointermove', onMove);
      measureRef.current = null;
    };
  }, [onCenterChange, px, py, reduced]);

  // Per-frame tick: re-measure when scroll/resize marked us dirty; on touch, idle on a figure-eight.
  useSimulationLoop((_dt, now) => {
    if (dirty.current) {
      dirty.current = false;
      measureRef.current?.();
    }
    if (finePointer.current) return;
    const t = now / 1000;
    px.set(Math.sin(t * 0.5) * 0.6);
    py.set(Math.sin(t) * 0.3);
  }, !reduced);

  const R = 100; // viewBox radius
  const speed = reduced ? 0 : overclocked ? Math.max(energy.ringSpeed, 1) * 6 : signing ? 0 : energy.ringSpeed;
  const ringDur = speed > 0 ? RING_BASE_SEC / speed : 0;
  const gradId = useId();
  // Oozing light: three colors per state. Threads: spin period from the ring speed.
  const ooze = overclocked
    ? { c1: 'var(--ion-400)', c2: 'var(--argon-300)', c3: 'var(--plasma-500)' }
    : signing
      ? { c1: 'var(--signal-warn)', c2: 'var(--argon-500)', c3: 'var(--signal-warn)' }
      : mode === 'fixture'
        ? { c1: 'var(--ion-400)', c2: 'var(--argon-500)', c3: 'var(--ion-400)' }
        : energy.state === 'aggressive'
          ? { c1: 'var(--plasma-500)', c2: 'var(--signal-down)', c3: 'var(--plasma-400)' }
          : energy.state === 'charged'
            ? { c1: 'var(--plasma-400)', c2: 'var(--argon-500)', c3: 'var(--plasma-500)' }
            : { c1: 'var(--argon-500)', c2: 'var(--plasma-500)', c3: 'var(--argon-300)' };
  const spinBase = speed > 0 ? RING_BASE_SEC / speed : signing ? 0 : RING_BASE_SEC / 0.35;
  const rootVars = {
    '--ooze-dur': `${breath * 1.3}s`,
    '--ooze-c1': ooze.c1,
    '--ooze-c2': ooze.c2,
    '--ooze-c3': ooze.c3,
    '--spin-dur': `${spinBase}s`,
    '--flow-dur': `${Math.max(0.6, breath)}s`,
  } as React.CSSProperties;
  const stateKey = `${energy.state}-${mode}-${activity}`;
  const aperture = signing ? 1 : overclocked ? 0.5 : energy.aperture;
  const arcs = overclocked ? 3 : energy.arcs;
  const hoverAmp = energy.state === 'dormant' ? 3 : energy.state === 'aggressive' ? 7 : 5;

  return (
    <div
      ref={rootRef}
      className={cn('relative select-none', className)}
      style={{ ...rootVars, ...(size === '100%' ? { width: '100%', aspectRatio: '1 / 1' } : { width: size, height: size }) }}
      role="img"
      aria-label={`keeper ${energy.state}${mode === 'fixture' ? ' (training)' : ''}`}
      data-state={energy.state}
    >
      {/* Oozing light: three out-of-phase radial blobs + a luminous rim (pure CSS, transform/opacity) */}
      {!reduced && (
        <>
          <div aria-hidden className="ooze ooze-a" />
          <div aria-hidden className="ooze ooze-b" />
          <div aria-hidden className="ooze ooze-c" />
        </>
      )}
      <div aria-hidden className="ooze-rim" style={{ opacity: reduced ? 0.2 : signing ? 0.22 : 0.3 + energy.halo * 0.25 }} />

      {/* Outer halo: radial gradient, breathes on opacity + scale (mirror) */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-[-28%] rounded-full will-change-transform"
        style={{ background: `radial-gradient(circle, ${palette.halo} 0%, transparent 62%)` }}
        initial={false}
        animate={reduced ? { opacity: energy.halo * 0.6, scale: 1 } : { opacity: [energy.halo * 0.55, energy.halo], scale: [0.96, 1.06] }}
        transition={reduced ? STATE_SPRING : { duration: breath, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
      />
      {/* Inner core glow: tighter, brighter, offset phase so the two layers beat against each other */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-[18%] rounded-full will-change-transform"
        style={{ background: `radial-gradient(circle, ${palette.ring} 0%, transparent 70%)`, mixBlendMode: 'screen' }}
        initial={false}
        animate={reduced ? { opacity: energy.halo * 0.35, scale: 1 } : { opacity: [energy.halo * 0.25, energy.halo * 0.6], scale: [1.08, 0.94] }}
        transition={reduced ? STATE_SPRING : { duration: breath * 0.8, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut', delay: breath * 0.3 }}
      />

      {/* Aura: layered drop-shadows from tokens.css; static per state, transitions on change only */}
      <div className="keeper-aura absolute inset-0" style={{ filter: aura }}>
      {/* Hover group: the whole body drifts on Y like something heavy floating */}
      <motion.div
        className="absolute inset-0 will-change-transform"
        initial={false}
        animate={reduced ? { y: 0 } : { y: [hoverAmp, -hoverAmp] }}
        transition={reduced ? STATE_SPRING : { duration: breath * 1.6, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
      >
        <motion.svg
          viewBox="-120 -120 240 240"
          className="absolute inset-0 h-full w-full"
          style={reduced ? {} : { rotateX: tiltX, rotateY: tiltY, x: panX, y: panY, transformPerspective: 600 }}
        >
          {/* Thinking: a data ring expands from the core on every fetch cycle */}
          <AnimatePresence>
            {thinking && !reduced && (
              <motion.circle
                key="think-ring"
                r={R * 0.4}
                fill="none"
                stroke={palette.ring}
                strokeWidth={1}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: [0.6, 2.4], opacity: [0.7, 0] }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }}
                style={{ originX: '0px', originY: '0px' }}
              />
            )}
          </AnimatePresence>

          {/* Orbiting energy threads: tilted ellipses spinning (transform) with light travelling along them (dashoffset) */}
          <defs>
            <linearGradient id={`${gradId}-t1`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={ooze.c1} stopOpacity="0" />
              <stop offset="0.5" stopColor={ooze.c1} stopOpacity="1" />
              <stop offset="1" stopColor={ooze.c3} stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${gradId}-t2`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={ooze.c2} stopOpacity="0" />
              <stop offset="0.5" stopColor={ooze.c2} stopOpacity="1" />
              <stop offset="1" stopColor={ooze.c1} stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${gradId}-t3`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={ooze.c3} stopOpacity="0" />
              <stop offset="0.5" stopColor={ooze.c3} stopOpacity="1" />
              <stop offset="1" stopColor={ooze.c2} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[
            { rx: R * 1.02, ry: R * 0.34, tilt: -22, dur: 1, reverse: false, grad: 't1', width: 1.4 },
            { rx: R * 0.9, ry: R * 0.42, tilt: 48, dur: 1.45, reverse: true, grad: 't2', width: 1.1 },
            { rx: R * 0.76, ry: R * 0.3, tilt: 112, dur: 0.8, reverse: false, grad: 't3', width: 1.2 },
          ].map((o, i) => (
            <g key={`orbit-${i}-${stateKey}`} transform={`rotate(${o.tilt})`}>
              <g
                className={cn('orbit', o.reverse && 'orbit-reverse')}
                style={{ '--spin-dur': `${spinBase * o.dur}s` } as React.CSSProperties}
              >
                {/* faint full thread */}
                <ellipse rx={o.rx} ry={o.ry} fill="none" stroke={palette.ring} strokeWidth={o.width * 0.5} opacity={energy.state === 'dormant' ? 0.18 : 0.28} />
                {/* travelling light: gradient stroke, dashed, offset animated */}
                <ellipse
                  className="thread"
                  rx={o.rx}
                  ry={o.ry}
                  fill="none"
                  stroke={`url(#${gradId}-${o.grad})`}
                  strokeWidth={o.width * 1.6}
                  strokeLinecap="round"
                  strokeDasharray="140 380"
                  style={{ '--flow-dur': `${Math.max(0.8, breath) * (1 + i * 0.35)}s` } as React.CSSProperties}
                  opacity={0.95}
                />
                {/* comet head */}
                <ellipse
                  className="thread-comet"
                  rx={o.rx}
                  ry={o.ry}
                  fill="none"
                  stroke={ooze.c3}
                  strokeWidth={o.width * 2.4}
                  strokeLinecap="round"
                  strokeDasharray="6 514"
                  style={{ '--flow-dur': `${Math.max(0.8, breath) * (1 + i * 0.35)}s` } as React.CSSProperties}
                  opacity={energy.state === 'dormant' ? 0.6 : 0.95}
                />
              </g>
            </g>
          ))}

          {/* Orbital rings */}
          {[
            { r: R * 0.98, dash: '6 10', w: 1, dir: 1 },
            { r: R * 0.82, dash: '2 6', w: 0.8, dir: -1 },
            { r: R * 0.66, dash: '14 8', w: 1.2, dir: 1 },
          ].map((ring, i) => {
            const dir = energy.counterRotate && i === 1 ? -ring.dir : ring.dir;
            return (
              <motion.g
                key={`${i}-${stateKey}`}
                style={{ originX: '0px', originY: '0px' }}
                animate={ringDur > 0 ? { rotate: 360 * dir } : { rotate: 0 }}
                transition={ringDur > 0 ? { duration: ringDur * (1 + i * 0.35), repeat: Infinity, ease: 'linear' } : STATE_SPRING}
              >
                <motion.circle
                r={ring.r}
                fill="none"
                stroke={palette.ring}
                strokeWidth={ring.w}
                strokeDasharray={ring.dash}
                opacity={energy.state === 'dormant' ? 0.25 : 0.7}
                animate={ringStroke ? { stroke: ringStroke } : {}}
                transition={{ ...colorLoop, delay: i * 0.2 }}
              />
              </motion.g>
            );
          })}

          {/* Energy arcs between core and rings (all three when overclocked) */}
          {[0, 1, 2].map((i) => (
            <motion.path
              key={i}
              d={`M ${(Math.cos((i * 2 * Math.PI) / 3) * R * 0.42).toFixed(1)} ${(Math.sin((i * 2 * Math.PI) / 3) * R * 0.42).toFixed(1)} Q ${(Math.cos((i * 2 * Math.PI) / 3 + 0.5) * R * 0.6).toFixed(1)} ${(Math.sin((i * 2 * Math.PI) / 3 + 0.5) * R * 0.6).toFixed(1)} ${(Math.cos((i * 2 * Math.PI) / 3 + 0.2) * R * 0.8).toFixed(1)} ${(Math.sin((i * 2 * Math.PI) / 3 + 0.2) * R * 0.8).toFixed(1)}`}
              fill="none"
              stroke={palette.ring}
              strokeWidth={1.2}
              strokeLinecap="round"
              initial={false}
              animate={{ opacity: i < arcs ? (reduced ? 0.8 : [0.2, 0.9]) : 0 }}
              transition={i < arcs && !reduced ? { duration: (overclocked ? 0.18 : 0.45) + i * 0.12, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' } : STATE_SPRING}
            />
          ))}

          {/* Core: hexagonal reactor. Jitter when charged; scale when aggressive. */}
          <motion.g
            style={{ originX: '0px', originY: '0px' }}
            initial={false}
            animate={
              reduced
                ? { scale: energy.coreScale, x: 0, y: 0 }
                : overclocked
                  ? { scale: 1.08, x: [0, 1.6, -1.6, 0], y: [0, -1.2, 1.2, 0] }
                  : energy.state === 'charged'
                    ? { scale: energy.coreScale, x: [0, 1, -1, 0], y: [0, -1, 1, 0] }
                    : { scale: energy.coreScale, x: 0, y: 0 }
            }
            transition={
              overclocked && !reduced
                ? { x: { duration: 0.06, repeat: Infinity }, y: { duration: 0.06, repeat: Infinity }, scale: STATE_SPRING }
                : energy.state === 'charged' && !reduced
                  ? { x: { duration: 0.125, repeat: Infinity }, y: { duration: 0.125, repeat: Infinity }, scale: STATE_SPRING }
                  : STATE_SPRING
            }
          >
            <polygon points={hexPoints(R * 0.36)} fill="var(--surface-1)" stroke={palette.ring} strokeWidth={1.5} />
            {/* Reactor core: color breathes; paint-only, no layout */}
            <motion.polygon
              points={hexPoints(R * 0.3)}
              stroke="none"
              style={{ mixBlendMode: 'screen' }}
              initial={false}
              animate={coreFill ? { fill: coreFill, opacity: [0.35, 0.75] } : { opacity: 0.35 }}
              transition={colorLoop}
            />
            <motion.polygon
              points={hexPoints(R * 0.28)}
              fill="none"
              strokeWidth={0.8}
              opacity={0.8}
              stroke={palette.ring}
              animate={ringStroke ? { stroke: ringStroke } : {}}
              transition={colorLoop}
            />

            {/* Eyes: translate follows the pointer, scaleY is the aperture. Glitch keyed on hourId. */}
            <motion.g style={reduced ? {} : { x: eyeX, y: eyeY }}>
              <motion.g
                key={`${hourId ?? 'none'}-${thinking ? 't' : 'i'}`}
                className={(hourId !== undefined || thinking) && !reduced ? 'animate-glitch' : undefined}
                style={{ originX: '0px', originY: '0px' }}
                initial={false}
                animate={{ scaleY: Math.max(0.06, aperture) }}
                transition={STATE_SPRING}
              >
                <motion.rect x={-16} y={-4} width={11} height={8} rx={1.5} fill={palette.eye} animate={c ? { fill: energy.state === 'aggressive' && !overclocked ? [c['signal-down'], c['plasma-400']] : [palette.eye, c['argon-300']] } : {}} transition={colorLoop} />
                <motion.rect x={5} y={-4} width={11} height={8} rx={1.5} fill={palette.eye} animate={c ? { fill: energy.state === 'aggressive' && !overclocked ? [c['signal-down'], c['plasma-400']] : [palette.eye, c['argon-300']] } : {}} transition={colorLoop} />
              </motion.g>
            </motion.g>
          </motion.g>
        </motion.svg>
      </motion.div>
      </div>

      {/* Thinking: scan line sweeps the body while an agent query is in flight */}
      <AnimatePresence>
        {thinking && !reduced && (
          <motion.div
            key="scan"
            aria-hidden
            className="pointer-events-none absolute inset-x-[8%] top-0 h-px will-change-transform"
            style={{ background: `linear-gradient(90deg, transparent, ${palette.ring}, transparent)` }}
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: ['0%', '10000%'], opacity: [0, 0.9, 0.9, 0] }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
          />
        )}
      </AnimatePresence>

      {/* Label under the avatar */}
      <div className="pointer-events-none absolute inset-x-0 -bottom-6 text-center label leading-5">
        keeper ·{' '}
        {overclocked ? <span className="text-ion-400">overclocked</span> : signing ? <span className="text-signal-warn">awaiting signature</span> : energy.state}
        {thinking && !overclocked && !signing && <span className="text-text-mid"> · syncing</span>}
        {mode === 'fixture' && <span className="text-ion-400"> · training</span>}
      </div>
    </div>
  );
}

export const KeeperAvatar = memo(KeeperAvatarImpl);
