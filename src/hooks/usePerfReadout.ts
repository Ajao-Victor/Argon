'use client';

import { useEffect, useState } from 'react';

import { schedulerStats, subscribeFrame } from '@/utils/sim/scheduler';

/**
 * Development-only frame cost readout. Subscribes to the shared scheduler and
 * publishes a snapshot at most once per second. Returns null in production.
 */
export interface PerfSnapshot {
  avgMs: number;
  dropped: number;
  frames: number;
}

export function usePerfReadout(): PerfSnapshot | null {
  const [snap, setSnap] = useState<PerfSnapshot | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    let lastPublish = 0;
    return subscribeFrame((_dt, now) => {
      if (now - lastPublish < 1000) return;
      lastPublish = now;
      const s = schedulerStats();
      setSnap({ avgMs: s.avgMs, dropped: s.dropped, frames: s.frames });
    });
  }, []);
  return snap;
}
