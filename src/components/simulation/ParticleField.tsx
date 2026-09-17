'use client';

import { useEffect, useRef } from 'react';

import { useSimulationLoop } from '@/hooks/useSimulationLoop';
import { useUiStore } from '@/stores/ui';
import type { GateChip } from '@/utils/policy';

/**
 * Ionized argon inside the tube (design.md §3.2). Canvas 2D, additive blending,
 * ≤ 400 particles desktop / 150 mobile, DPR ≤ 2, ≤ 4 ms per frame.
 * Props enter through a ref; the loop never re-subscribes on data change.
 *
 * |ethPctChange| → speed. IN → converge on a central band. OUT → pull to edges,
 * warn tint. warmup → sparse and slow. New pulseKey → one expanding ring.
 */
export type FieldMode = GateChip | 'WARMUP' | 'OFFLINE';

export interface ParticleFieldProps {
  ethPctChange: number | null;
  mode: FieldMode;
  pulseKey?: number | string | undefined;
  className?: string;
}

interface Particle {
  x: number; // 0..1
  y: number; // 0..1
  vx: number;
  vy: number;
  r: number;
  hue: 0 | 1 | 2; // 0 argon, 1 plasma, 2 ion
  phase: number;
}

interface Ring {
  t: number; // 0..1
}

const ARGON = [168, 85, 247] as const;
const PLASMA = [232, 121, 249] as const;
const ION = [34, 211, 238] as const;
const WARN = [251, 191, 36] as const;

function mix(a: readonly [number, number, number], b: readonly [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function ParticleField({ ethPctChange, mode, pulseKey, className }: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fieldOn = useUiStore((s) => s.field);

  const state = useRef({
    pct: 0,
    mode: 'WARMUP' as FieldMode,
    particles: [] as Particle[],
    rings: [] as Ring[],
    w: 0,
    h: 0,
    dpr: 1,
    lastPulseKey: undefined as number | string | undefined,
    warnMix: 0,
  });

  // Push props into the ref. No effect deps on the loop.
  state.current.pct = Math.abs(ethPctChange ?? 0);
  state.current.mode = mode;
  if (pulseKey !== undefined && pulseKey !== state.current.lastPulseKey) {
    if (state.current.lastPulseKey !== undefined) state.current.rings.push({ t: 0 });
    state.current.lastPulseKey = pulseKey;
  }

  // Size, DPR, and particle population. Debounced ResizeObserver. Cleanup releases the context.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !fieldOn) return;
    const s = state.current;
    let raf: number | null = null;

    const populate = () => {
      const mobile = s.w < 640;
      const target = mobile ? 150 : 400;
      const ps = s.particles;
      while (ps.length < target) {
        ps.push({
          x: Math.random(), y: Math.random(),
          vx: (Math.random() - 0.5) * 0.02, vy: (Math.random() - 0.5) * 0.02,
          r: 0.6 + Math.random() * 1.6,
          hue: Math.random() < 0.08 ? 2 : Math.random() < 0.35 ? 1 : 0,
          phase: Math.random() * Math.PI * 2,
        });
      }
      ps.length = target;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      s.dpr = Math.min(window.devicePixelRatio || 1, 2);
      s.w = Math.max(1, Math.floor(rect.width));
      s.h = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(s.w * s.dpr);
      canvas.height = Math.floor(s.h * s.dpr);
      populate();
    };

    let debounce: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver(() => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(resize, 120);
    });
    ro.observe(canvas);
    resize();

    return () => {
      ro.disconnect();
      if (debounce) clearTimeout(debounce);
      if (raf !== null) cancelAnimationFrame(raf);
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
      s.particles.length = 0;
      s.rings.length = 0;
    };
  }, [fieldOn]);

  useSimulationLoop((dt) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const s = state.current;
    if (s.w === 0 || s.h === 0) return;

    const step = dt / 1000;
    const { mode: m } = s;
    // Energy: 0% near-still, 2% agitated, ≥2% turbulent. Warmup/offline: calm.
    const energy = m === 'WARMUP' || m === 'OFFLINE' ? 0.15 : Math.min(1.4, 0.2 + s.pct / 2);
    const targetWarn = m === 'OUT' ? 1 : 0;
    s.warnMix += (targetWarn - s.warnMix) * Math.min(1, step * 2);

    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    // Trail: fade instead of clear.
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(0, 0, s.w, s.h);
    ctx.globalCompositeOperation = 'lighter';

    const cx = 0.5;
    const cy = 0.5;
    const bandHalf = 0.12;

    for (const p of s.particles) {
      // Drift
      p.phase += step * (0.6 + energy);
      p.vx += Math.cos(p.phase) * 0.0006 * energy;
      p.vy += Math.sin(p.phase * 1.3) * 0.0006 * energy;

      if (m === 'IN') {
        // converge toward the central band (liquidity in range)
        const dy = cy - p.y;
        p.vy += dy * 0.004 * (Math.abs(dy) > bandHalf ? 1 : 0.15);
        p.vx += (cx - p.x) * 0.0004;
      } else if (m === 'OUT') {
        // pull to edges (liquidity leaving the pool)
        const dx = p.x - cx;
        const dy = p.y - cy;
        const d = Math.hypot(dx, dy) + 1e-3;
        p.vx += (dx / d) * 0.003 * energy;
        p.vy += (dy / d) * 0.003 * energy;
      }

      // damping and speed cap
      p.vx *= 0.985;
      p.vy *= 0.985;
      const vmax = 0.012 * energy + 0.002;
      const v = Math.hypot(p.vx, p.vy);
      if (v > vmax) {
        p.vx = (p.vx / v) * vmax;
        p.vy = (p.vy / v) * vmax;
      }

      p.x += p.vx * step * 60;
      p.y += p.vy * step * 60;
      if (p.x < -0.02) p.x = 1.02;
      if (p.x > 1.02) p.x = -0.02;
      if (p.y < -0.02) p.y = 1.02;
      if (p.y > 1.02) p.y = -0.02;

      const base = p.hue === 2 ? ION : p.hue === 1 ? PLASMA : ARGON;
      const [r, g, b] = mix(base, WARN, s.warnMix * 0.7);
      const alpha = m === 'WARMUP' || m === 'OFFLINE' ? 0.25 : 0.35 + Math.min(0.45, energy * 0.3);
      ctx.fillStyle = `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x * s.w, p.y * s.h, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hour pulse rings (design.md §3.3): 900 ms, plasma, then settle.
    if (s.rings.length) {
      const maxR = Math.hypot(s.w, s.h) * 0.6;
      ctx.lineWidth = 1.2;
      for (const ring of s.rings) {
        ring.t += step / 0.9;
        const ease = 1 - Math.pow(1 - Math.min(ring.t, 1), 3);
        ctx.strokeStyle = `rgba(${PLASMA[0]}, ${PLASMA[1]}, ${PLASMA[2]}, ${(1 - ease) * 0.8})`;
        ctx.beginPath();
        ctx.arc(cx * s.w, cy * s.h, ease * maxR, 0, Math.PI * 2);
        ctx.stroke();
      }
      s.rings = s.rings.filter((r) => r.t < 1);
    }
  }, fieldOn);

  if (!fieldOn) {
    return <div aria-hidden className={className} style={{ background: 'radial-gradient(60% 50% at 50% 50%, rgba(168,85,247,0.10), transparent)' }} />;
  }

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}
