'use client';

import { useEffect, useRef } from 'react';

import { useUiStore } from '@/stores/ui';
import { subscribeFrame, type FrameCallback } from '@/utils/sim/scheduler';

/**
 * Registers a frame callback with the single scheduler (doc/architecture.md §4.3).
 * The callback is read through a ref so React re-renders never restart the loop.
 * Disabled under prefers-reduced-motion or the user's `motion: reduced` setting.
 */
export function usePrefersReducedMotion(): boolean {
  const ref = useRef(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    ref.current = mq.matches;
    const onChange = (e: MediaQueryListEvent) => {
      ref.current = e.matches;
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return ref.current;
}

export function useSimulationLoop(callback: FrameCallback, enabled = true): void {
  const cbRef = useRef(callback);
  cbRef.current = callback;
  const motion = useUiStore((s) => s.motion);

  useEffect(() => {
    if (!enabled || motion === 'reduced') return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const unsubscribe = subscribeFrame((dt, now) => cbRef.current(dt, now));
    return unsubscribe;
  }, [enabled, motion]);
}
