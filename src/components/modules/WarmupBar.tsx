'use client';

import { useEffect, useState } from 'react';

import { Panel } from '@/components/ui';
import { useAgentStatus } from '@/hooks';
import { cn } from '@/utils/cn';
import { msUntilNextHour } from '@/utils/hourId';
import { WARMUP_HOURS } from '@/utils/policy';

/** Eight segments, n/8, countdown to the next :00 UTC (design.md §4.3). Hidden once warmup is complete. */
export function WarmupBar() {
  const status = useAgentStatus();
  // Countdown refreshes every 15 s (minutes precision); never a 1 s loop.
  const [minsToHour, setMinsToHour] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setMinsToHour(Math.ceil(msUntilNextHour() / 60_000));
    update();
    const t = setInterval(update, 15_000);
    return () => clearInterval(t);
  }, []);

  const s = status.data;
  if (!s || s.warmupComplete) return null;

  const remaining = Math.min(WARMUP_HOURS, Math.max(0, s.hoursUntilFirstDecision));
  const done = WARMUP_HOURS - remaining;

  return (
    <Panel label="WARMUP" meta={`${done} / ${WARMUP_HOURS} hours`}>
      <div className="grid grid-cols-8 gap-1">
        {Array.from({ length: WARMUP_HOURS }, (_, i) => (
          <span
            key={i}
            className={cn('h-2 rounded-sm border', i < done ? 'border-argon-500 bg-argon-500 shadow-glow-sm' : 'border-hairline bg-surface-1')}
          />
        ))}
      </div>
      <p className="mt-5 leading-6 text-text-mid">Collecting the first 8 hourly forecasts. No trades until hour 8.</p>
      <p className="mt-2 label leading-5">
        first decision in {remaining} h{minsToHour !== null && ` · next print in ~${minsToHour} min UTC`}
      </p>
    </Panel>
  );
}
