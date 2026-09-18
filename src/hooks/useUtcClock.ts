'use client';

import { useEffect, useState } from 'react';

/**
 * Live UTC clock for the footer. Not polling: a self-rescheduling timeout aligned
 * to the next whole second, paused while the tab is hidden. Returns null on the
 * server and on the first client render so hydration matches.
 */
export interface UtcClock {
  hhmmss: string;
  hourId: number;
  secondsToNextHour: number;
}

function read(): UtcClock {
  const d = new Date();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  const secs = d.getUTCMinutes() * 60 + d.getUTCSeconds();
  return { hhmmss: `${hh}:${mm}:${ss}`, hourId: Math.floor(d.getTime() / 3_600_000), secondsToNextHour: 3600 - secs };
}

export function useUtcClock(): UtcClock | null {
  const [clock, setClock] = useState<UtcClock | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const schedule = () => {
      if (stopped || document.hidden) return;
      setClock(read());
      timer = setTimeout(schedule, 1000 - (Date.now() % 1000));
    };
    const onVisibility = () => {
      if (timer) clearTimeout(timer);
      if (!document.hidden) schedule();
    };

    schedule();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return clock;
}
