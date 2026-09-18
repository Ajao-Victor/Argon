'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';

import { useUiStore } from '@/stores/ui';
import { subscribeFrame, type FrameCallback } from '@/utils/sim/scheduler';

/**
 * Registers a frame callback with the single scheduler (doc/architecture.md §4.3).
 * The callback is read through a ref so React re-renders never restart the loop.
 * Disabled under prefers-reduced-motion or the user's `motion: reduced` setting.
 */
const REDUCED_MQ = '(prefers-reduced-motion: reduce)';
function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia(REDUCED_MQ);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}
const readReducedMotion = () => window.matchMedia(REDUCED_MQ).matches;
const readReducedMotionServer = () => false;

/** Live media-query value that re-renders on change (a ref read during render never would). */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, readReducedMotion, readReducedMotionServer);
}

export function useSimulationLoop(callback: FrameCallback, enabled = true): void {
  const cbRef = useRef(callback);
  // Latest-callback ref, written after commit rather than during render (react-hooks/refs).
  useEffect(() => {
    cbRef.current = callback;
  });
  const motion = useUiStore((s) => s.motion);

  useEffect(() => {
    if (!enabled || motion === 'reduced') return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const unsubscribe = subscribeFrame((dt, now) => cbRef.current(dt, now));
    return unsubscribe;
  }, [enabled, motion]);
}
