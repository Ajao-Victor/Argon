'use client';

import { memo, useEffect, useRef } from 'react';

import { useSimulationLoop, usePrefersReducedMotion } from '@/hooks/useSimulationLoop';
import { cn } from '@/utils/cn';

/**
 * Terminal skeleton (Phase 8 M4). Instead of a grey pulse, a run of characters
 * cycles like a value still being computed, then a scanline sweeps it. Text is
 * written straight into the DOM from the shared scheduler at ~12 fps: no React
 * state, no interval. Under reduced motion it renders static block glyphs.
 */
const CHARSET = '0123456789ABCDEF·:+-%▒░';
const BLOCKS = '▒░▒▒░▒░▒▒░▒▒░▒░▒▒░▒░▒▒░▒';

export interface SkeletonProps {
  /** Width in characters. */
  chars?: number;
  className?: string;
  /** Slower cycle for large hero numerals. */
  slow?: boolean;
  scan?: boolean;
}

function SkeletonImpl({ chars = 12, className, slow = false, scan = true }: SkeletonProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const reduced = usePrefersReducedMotion();
  const acc = useRef(0);
  const interval = slow ? 140 : 80;

  useEffect(() => {
    if (ref.current) ref.current.textContent = BLOCKS.slice(0, chars);
  }, [chars]);

  useSimulationLoop((dt) => {
    acc.current += dt;
    if (acc.current < interval) return;
    acc.current = 0;
    const el = ref.current;
    if (!el) return;
    let out = '';
    for (let i = 0; i < chars; i++) {
      // Keep ~30% of glyphs as blocks so it reads as "encrypted", not noise.
      out += Math.random() < 0.3 ? '▒' : CHARSET[(Math.random() * CHARSET.length) | 0];
    }
    el.textContent = out;
  }, !reduced);

  return (
    <span className={cn('relative inline-block overflow-hidden align-baseline font-mono tabular-nums text-text-dim', className)} aria-busy="true" aria-label="loading">
      <span ref={ref} aria-hidden className="whitespace-pre opacity-70">
        {BLOCKS.slice(0, chars)}
      </span>
      {scan && !reduced && <span aria-hidden className="scan-edge pointer-events-none absolute inset-0 animate-scanline" />}
    </span>
  );
}

export const Skeleton = memo(SkeletonImpl);

/** A stack of skeleton lines for table bodies and lists. */
export function SkeletonLines({ lines = 3, chars = 32, className }: { lines?: number; chars?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} chars={Math.max(8, chars - i * 4)} scan={i === 0} />
      ))}
    </div>
  );
}
