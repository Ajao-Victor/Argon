'use client';

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { memo, useEffect, useMemo, useRef } from 'react';

import { useSimulationLoop } from '@/hooks/useSimulationLoop';
import type { PolicyAction } from '@/types/forecast';
import { cn } from '@/utils/cn';
import { keeperEnergy, type KeeperState } from '@/utils/sim/keeper';

/**
 * The Keeper Avatar (design.md §7.1): the brain of the vault as an instrument.
 * Inline SVG + Framer Motion. Continuous motion is rotate / translate / scale /
 * opacity only. No SVG filters. Pointer tracking writes to MotionValues, never
 * to React state. Under reduced motion it is a static glyph in the state color.
 */
export interface KeeperAvatarProps {
  ethPctChange: number | null;
  action: PolicyAction | undefined;
  warmupComplete: boolean;
  reachable: boolean;
  mode: 'live' | 'fixture';
  hourId?: number | undefined;
  size?: number;
  className?: string;
  /** Viewport-space center of the avatar, for the particle attractor. Written on resize/scroll. */
  onCenterChange?: ((x: number, y: number) => void) | undefined;
}

const COLOR: Record<KeeperState, { halo: string; ring: string; eye: string }> = {
  dormant: { halo: 'var(--text-dim)', ring: 'var(--text-dim)', eye: 'var(--text-lo)' },
  warmup: { halo: 'var(--text-lo)', ring: 'var(--argon-600)', eye: 'var(--argon-400)' },
  calm: { halo: 'var(--argon-500)', ring: 'var(--argon-400)', eye: 'var(--argon-300)' },
  charged: { halo: 'var(--plasma-500)', ring: 'var(--plasma-400)', eye: 'var(--plasma-400)' },
  aggressive: { halo: 'var(--signal-warn)', ring: 'var(--plasma-500)', eye: 'var(--signal-warn)' },
};

const TRAINING = { halo: 'var(--ion-400)', ring: 'var(--ion-400)', eye: 'var(--ion-400)' };

const RING_BASE_SEC = 24; // one revolution at ringSpeed 1

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
}: KeeperAvatarProps) {
  const reduced = useReducedMotion() ?? false;
  const energy = useMemo(
    () => keeperEnergy({ ethPctChange, warmupComplete, reachable, action }),
    [ethPctChange, warmupComplete, reachable, action],
  );
  const palette = mode === 'fixture' ? TRAINING : COLOR[energy.state];

  // ---- pointer → motion values (no React state) ----
  const rootRef = useRef<HTMLDivElement | null>(null);
  const center = useRef({ x: 0, y: 0, r: 1 });
  const px = useMotionValue(0); // -1 … 1
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 120, damping: 18 });
  const sy = useSpring(py, { stiffness: 120, damping: 18 });
  const eyeX = useTransform(sx, (v) => v * 6);
  const eyeY = useTransform(sy, (v) => v * 4);
  const tiltX = useTransform(sy, (v) => v * -6);
  const tiltY = useTransform(sx, (v) => v * 6);
  const finePointer = useRef(true);

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
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure, { passive: true });

    const onMove = (e: PointerEvent) => {
      if (!finePointer.current || reduced) return;
      const c = center.current;
      const dx = (e.clientX - c.x) / (c.r * 1.5);
      const dy = (e.clientY - c.y) / (c.r * 1.5);
      px.set(Math.max(-1, Math.min(1, dx)));
      py.set(Math.max(-1, Math.min(1, dy)));
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      window.removeEventListener('pointermove', onMove);
    };
  }, [onCenterChange, px, py, reduced]);

  // Touch devices idle on a slow figure-eight through the shared scheduler.
  useSimulationLoop((_dt, now) => {
    if (finePointer.current) return;
    const t = now / 1000;
    px.set(Math.sin(t * 0.5) * 0.6);
    py.set(Math.sin(t) * 0.3);
  }, !reduced);

  const R = 100; // viewBox radius
  const speed = reduced ? 0 : energy.ringSpeed;
  const ringDur = speed > 0 ? RING_BASE_SEC / speed : 0;
  const stateKey = `${energy.state}-${mode}`;

  return (
    <div
      ref={rootRef}
      className={cn('relative select-none', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`keeper ${energy.state}${mode === 'fixture' ? ' (training)' : ''}`}
      data-state={energy.state}
    >
      {/* Halo: pre-rendered radial gradient, opacity + scale only */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-[-25%] rounded-full"
        style={{ background: `radial-gradient(circle, ${palette.halo} 0%, transparent 60%)` }}
        animate={
          reduced
            ? { opacity: energy.halo * 0.6, scale: 1 }
            : mode === 'fixture'
              ? { opacity: [energy.halo * 0.5, energy.halo, energy.halo * 0.5], scale: [0.96, 1.04, 0.96] }
              : { opacity: [energy.halo * 0.7, energy.halo, energy.halo * 0.7], scale: [0.98, 1.02, 0.98] }
        }
        transition={reduced ? { duration: 0.6 } : { duration: mode === 'fixture' ? 1.2 : energy.state === 'dormant' ? 6 : 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.svg
        viewBox="-120 -120 240 240"
        className="absolute inset-0 h-full w-full"
        style={reduced ? {} : { rotateX: tiltX, rotateY: tiltY, transformPerspective: 600 }}
      >
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
              transition={ringDur > 0 ? { duration: ringDur * (1 + i * 0.35), repeat: Infinity, ease: 'linear' } : { duration: 0.6 }}
            >
              <circle r={ring.r} fill="none" stroke={palette.ring} strokeWidth={ring.w} strokeDasharray={ring.dash} opacity={energy.state === 'dormant' ? 0.25 : 0.7} />
            </motion.g>
          );
        })}

        {/* Energy arcs between core and rings */}
        {[0, 1, 2].map((i) => (
          <motion.path
            key={i}
            d={`M ${(Math.cos((i * 2 * Math.PI) / 3) * R * 0.42).toFixed(1)} ${(Math.sin((i * 2 * Math.PI) / 3) * R * 0.42).toFixed(1)} Q ${(Math.cos((i * 2 * Math.PI) / 3 + 0.5) * R * 0.6).toFixed(1)} ${(Math.sin((i * 2 * Math.PI) / 3 + 0.5) * R * 0.6).toFixed(1)} ${(Math.cos((i * 2 * Math.PI) / 3 + 0.2) * R * 0.8).toFixed(1)} ${(Math.sin((i * 2 * Math.PI) / 3 + 0.2) * R * 0.8).toFixed(1)}`}
            fill="none"
            stroke={palette.ring}
            strokeWidth={1.2}
            strokeLinecap="round"
            initial={false}
            animate={{ opacity: i < energy.arcs ? (reduced ? 0.8 : [0.2, 0.9, 0.2]) : 0 }}
            transition={i < energy.arcs && !reduced ? { duration: 0.45 + i * 0.12, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.4 }}
          />
        ))}

        {/* Core: hexagonal reactor. Jitter when charged; scale when aggressive. */}
        <motion.g
          style={{ originX: '0px', originY: '0px' }}
          animate={
            reduced
              ? { scale: energy.coreScale, x: 0, y: 0 }
              : energy.state === 'charged'
                ? { scale: energy.coreScale, x: [0, 1, -1, 0], y: [0, -1, 1, 0] }
                : { scale: energy.coreScale, x: 0, y: 0 }
          }
          transition={energy.state === 'charged' && !reduced ? { x: { duration: 0.125, repeat: Infinity }, y: { duration: 0.125, repeat: Infinity }, scale: { duration: 0.6 } } : { duration: 0.6, ease: 'easeOut' }}
        >
          <polygon points={hexPoints(R * 0.36)} fill="var(--surface-1)" stroke={palette.ring} strokeWidth={1.5} />
          <polygon points={hexPoints(R * 0.28)} fill="none" stroke={palette.ring} strokeWidth={0.6} opacity={0.6} />

          {/* Eyes: translate follows the pointer, scaleY is the aperture. Glitch keyed on hourId. */}
          <motion.g style={reduced ? {} : { x: eyeX, y: eyeY }}>
            <motion.g
              key={hourId ?? 'none'}
              className={hourId !== undefined && !reduced ? 'animate-glitch' : undefined}
              style={{ originX: '0px', originY: '0px' }}
              animate={{ scaleY: Math.max(0.06, energy.aperture) }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              <rect x={-16} y={-4} width={11} height={8} rx={1.5} fill={palette.eye} />
              <rect x={5} y={-4} width={11} height={8} rx={1.5} fill={palette.eye} />
            </motion.g>
          </motion.g>
        </motion.g>
      </motion.svg>

      {/* Label under the avatar */}
      <div className="pointer-events-none absolute inset-x-0 -bottom-5 text-center label">
        keeper · {energy.state}
        {mode === 'fixture' && <span className="text-ion-400"> · training</span>}
      </div>
    </div>
  );
}

export const KeeperAvatar = memo(KeeperAvatarImpl);
