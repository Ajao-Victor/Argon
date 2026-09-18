'use client';

/* eslint-disable react-hooks/immutability -- imperative canvas simulation: hundreds of particles are mutated in place every frame inside a ref; nothing here is React state */

import { memo, useEffect, useRef, type MutableRefObject } from 'react';

import { useSimulationLoop } from '@/hooks/useSimulationLoop';
import { useUiStore } from '@/stores/ui';
import type { PolicyAction } from '@/types/forecast';
import type { GateChip } from '@/utils/policy';
import { FRAME_BUDGET_MS, averageFrameCostMs } from '@/utils/sim/scheduler';

/**
 * Fluid flow field (design.md §7.3). Particles follow a smooth vector field built
 * from low-frequency sine terms with one attractor: the Keeper Avatar. Gate IN
 * spirals inward; gate OUT flings outward; an ENTER/EXIT change surges the
 * attractor for 1.4 s. Adaptive count: if frames run over budget the field
 * steps down 10%/s to a floor of 80. Pauses when off-screen or hidden.
 *
 * Canvas 2D, additive blending, DPR ≤ 2. Props enter through refs; the loop
 * never re-subscribes on data change. React.memo with primitive props.
 */
export type FieldMode = GateChip | 'WARMUP' | 'OFFLINE';

export interface Attractor {
  x: number; // viewport px
  y: number;
}

export interface ParticleFieldProps {
  ethPctChange: number | null;
  mode: FieldMode;
  action?: PolicyAction | undefined;
  fixture?: boolean;
  pulseKey?: number | string | undefined;
  /** Written by the Keeper Avatar. Read every frame. Never causes a render. */
  attractorRef?: MutableRefObject<Attractor | null> | undefined;
  className?: string;
}

interface Particle {
  x: number; // px
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: 0 | 1 | 2 | 3; // argon, plasma, ion, warn-mix
  life: number;
}

// RGB mirrors of tokens.css (canvas fillStyle cannot read CSS variables). Keep in sync with tokens.css §2.2–2.4.
const ARGON = [168, 85, 247] as const; // --argon-500
const ARGON_LIGHT = [216, 180, 254] as const; // --argon-300
const PLASMA = [232, 121, 249] as const; // --plasma-500
const ION = [34, 211, 238] as const; // --ion-400
const EXIT_BLAZE = [232, 121, 249] as const; // --plasma-500: the OUT / EXIT state snaps here
const EXIT_EDGE = [251, 113, 133] as const; // --signal-down for the hottest particles
const FLOOR = 80;

function mix(a: readonly [number, number, number], b: readonly [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function ParticleFieldImpl({ ethPctChange, mode, action, fixture = false, pulseKey, attractorRef, className }: ParticleFieldProps) {
  // The field is an imperative simulation: hundreds of particles mutated in place every frame
  // inside a ref. The React Compiler cannot model that (react-hooks/immutability), so this one
  // component opts out. Nothing here is React state; memoization is React.memo on the props.
  'use no memo';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fieldOn = useUiStore((s) => s.field);

  const s = useRef({
    pct: 0,
    mode: 'WARMUP' as FieldMode,
    fixture: false,
    particles: [] as Particle[],
    rings: [] as { t: number }[],
    w: 0,
    h: 0,
    dpr: 1,
    visible: true,
    target: 400,
    costEma: 0,
    lastAdapt: 0,
    lastPulseKey: undefined as number | string | undefined,
    lastAction: undefined as PolicyAction | undefined,
    surge: 0, // 0 … 1, decays over 1.4 s
    warnMix: 0,
    t: 0,
  });

  // Props enter the loop through the ref, written after commit (never during render).
  useEffect(() => {
    const st = s.current;
    st.pct = Math.abs(ethPctChange ?? 0);
    st.mode = mode;
    st.fixture = fixture;
    if (pulseKey !== undefined && pulseKey !== st.lastPulseKey) {
      if (st.lastPulseKey !== undefined) st.rings.push({ t: 0 });
      st.lastPulseKey = pulseKey;
    }
    if (action !== st.lastAction) {
      if (st.lastAction !== undefined && (action === 'enter' || action === 'exit')) st.surge = 1;
      st.lastAction = action;
    }
  }, [ethPctChange, mode, fixture, pulseKey, action]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !fieldOn) return;
    const st = s.current;

    const spawn = (p: Particle | undefined = undefined): Particle => {
      const np: Particle = p ?? { x: 0, y: 0, vx: 0, vy: 0, r: 1, hue: 0, life: 1 };
      np.x = Math.random() * st.w;
      np.y = Math.random() * st.h;
      np.vx = (Math.random() - 0.5) * 20;
      np.vy = (Math.random() - 0.5) * 20;
      np.r = 0.6 + Math.random() * 1.5;
      const roll = Math.random();
      np.hue = st.fixture && roll < 0.2 ? 2 : roll < 0.06 ? 2 : roll < 0.4 ? 1 : 0;
      np.life = 0.6 + Math.random() * 0.4;
      return np;
    };

    const populate = () => {
      const mobile = st.w < 640;
      st.target = mobile ? 150 : 400;
      const ps = st.particles;
      while (ps.length < st.target) ps.push(spawn());
      ps.length = Math.min(ps.length, st.target);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      st.dpr = Math.min(window.devicePixelRatio || 1, 2);
      st.w = Math.max(1, Math.floor(rect.width));
      st.h = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(st.w * st.dpr);
      canvas.height = Math.floor(st.h * st.dpr);
      populate();
    };

    let debounce: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver(() => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(resize, 120);
    });
    ro.observe(canvas);
    resize();

    // Pause when the canvas leaves the viewport (design.md §7.4 rule 4).
    const io = new IntersectionObserver(
      (entries) => {
        st.visible = entries.some((e) => e.isIntersecting);
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    return () => {
      ro.disconnect();
      io.disconnect();
      if (debounce) clearTimeout(debounce);
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
      st.particles.length = 0;
      st.rings.length = 0;
    };
  }, [fieldOn]);

  useSimulationLoop((dt, now) => {
    const st = s.current;
    if (!st.visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || st.w === 0 || st.h === 0) return;

    const step = Math.min(dt, 50) / 1000;
    st.t += step;

    // Adaptive particle count from the scheduler's rolling frame cost (design.md §7.3).
    if (now - st.lastAdapt > 1000) {
      st.lastAdapt = now;
      st.costEma = averageFrameCostMs();
      const cap = st.w < 640 ? 150 : 400;
      if (st.costEma > FRAME_BUDGET_MS && st.particles.length > FLOOR) {
        st.particles.length = Math.max(FLOOR, Math.floor(st.particles.length * 0.9));
      } else if (st.costEma < FRAME_BUDGET_MS * 0.6 && st.particles.length < cap) {
        const add = Math.min(cap - st.particles.length, Math.ceil(st.particles.length * 0.05));
        for (let i = 0; i < add; i++) {
          st.particles.push({ x: Math.random() * st.w, y: Math.random() * st.h, vx: 0, vy: 0, r: 0.6 + Math.random() * 1.5, hue: 0, life: 1 });
        }
      }
    }

    const m = st.mode;
    const calm = m === 'WARMUP' || m === 'OFFLINE';
    const energy = calm ? 0.15 : Math.min(1.4, 0.2 + st.pct / 2);
    st.warnMix += ((m === 'OUT' ? 1 : 0) - st.warnMix) * Math.min(1, step * (m === 'OUT' ? 6 : 1.5));
    if (st.surge > 0) st.surge = Math.max(0, st.surge - step / 1.4);

    const a = attractorRef?.current ?? null;
    const ax = a ? a.x : st.w * 0.5;
    const ay = a ? a.y : st.h * 0.5;
    // Attractor sign: IN pulls in, OUT flings out. Surge triples it.
    const attract = calm ? 0 : (m === 'OUT' ? -1 : 1) * (0.35 + energy * 0.4) * (1 + st.surge * 2);

    ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(0, 0, 0, ${0.14 + (1 - Math.min(energy, 1)) * 0.08})`;
    ctx.fillRect(0, 0, st.w, st.h);
    ctx.globalCompositeOperation = 'lighter';

    const t = st.t;
    const scale = 1 / Math.max(st.w, st.h);
    const speedPx = 60 * (0.4 + energy);

    for (const p of st.particles) {
      // Flow field: two low-frequency sine terms → smooth plasma-like motion.
      const nx = p.x * scale * 4;
      const ny = p.y * scale * 4;
      const fx = Math.sin(ny * 1.7 + t * 0.35) + 0.6 * Math.cos(nx * 1.1 - t * 0.22);
      const fy = Math.cos(nx * 1.5 - t * 0.3) - 0.6 * Math.sin(ny * 1.2 + t * 0.27);

      // Attractor: spiral toward (or away from) the keeper.
      const dx = ax - p.x;
      const dy = ay - p.y;
      const d = Math.hypot(dx, dy) + 1;
      const ux = dx / d;
      const uy = dy / d;
      const falloff = Math.min(1, 320 / d);
      const tangential = m === 'IN' ? 0.8 : 0;
      const gx = (ux * attract + -uy * tangential * attract) * falloff;
      const gy = (uy * attract + ux * tangential * attract) * falloff;

      // Erratic when OUT: random kicks scaled by the warn mix (design.md §7.3, M3 forecast reaction).
      const jitter = st.warnMix * 1.6;
      p.vx += (fx * 0.8 + gx * 2.2 + (Math.random() - 0.5) * jitter) * speedPx * step;
      p.vy += (fy * 0.8 + gy * 2.2 + (Math.random() - 0.5) * jitter) * speedPx * step;
      p.vx *= 0.94;
      p.vy *= 0.94;

      const vmax = speedPx * (1 + st.surge);
      const v = Math.hypot(p.vx, p.vy);
      if (v > vmax) {
        p.vx = (p.vx / v) * vmax;
        p.vy = (p.vy / v) * vmax;
      }
      p.x += p.vx * step;
      p.y += p.vy * step;

      // Wrap; particles flung off-screen by OUT re-enter from the far side.
      if (p.x < -4) p.x = st.w + 4;
      else if (p.x > st.w + 4) p.x = -4;
      if (p.y < -4) p.y = st.h + 4;
      else if (p.y > st.h + 4) p.y = -4;

      const base = p.hue === 2 ? ION : p.hue === 1 ? PLASMA : ARGON;
      // EXIT: snap toward blazing plasma-500, hottest particles (near the core) edge into signal-down.
      const near = 1 - Math.min(1, d / 260);
      const blazed = mix(base, EXIT_BLAZE, st.warnMix);
      const [r, g, b] = st.warnMix > 0 ? mix(blazed, EXIT_EDGE, st.warnMix * near * 0.6) : mix(base, ARGON_LIGHT, near * 0.35);
      const alpha = (calm ? 0.22 : 0.3 + Math.min(0.4, energy * 0.28)) * p.life + near * 0.3 + st.warnMix * 0.12;
      ctx.fillStyle = `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + near * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hour pulse rings from the attractor (design.md §3.3).
    if (st.rings.length) {
      const maxR = Math.hypot(st.w, st.h) * 0.6;
      ctx.lineWidth = 1.2;
      for (const ring of st.rings) {
        ring.t += step / 0.9;
        const ease = 1 - Math.pow(1 - Math.min(ring.t, 1), 3);
        ctx.strokeStyle = `rgba(${PLASMA[0]}, ${PLASMA[1]}, ${PLASMA[2]}, ${((1 - ease) * 0.8).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(ax, ay, ease * maxR, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Prune finished rings in place (no reassignment of the ref field).
      for (let i = st.rings.length - 1; i >= 0; i--) if ((st.rings[i]?.t ?? 1) >= 1) st.rings.splice(i, 1);
    }
  }, fieldOn);

  if (!fieldOn) {
    return <div aria-hidden className={className} style={{ background: 'radial-gradient(60% 50% at 50% 50%, rgba(168,85,247,0.10), transparent)' }} />;
  }
  return <canvas ref={canvasRef} aria-hidden className={className} />;
}

export const ParticleField = memo(ParticleFieldImpl);
