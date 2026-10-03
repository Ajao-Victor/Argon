'use client';

import { Panel } from '@/components/ui';
import { useAgentStatus, useUtcClock } from '@/hooks';
import { cn } from '@/utils/cn';
import { WARMUP_HOURS } from '@/utils/policy';

/**
 * Nine segments driven by GET /status (handoff 2026-10-02):
 *   hours filled           = 9 − hoursUntilFirstDecision
 *   first decision in      = hoursUntilFirstDecision
 *   on-chain submits       = onchainForecastCount (0 for the whole dry run)
 *   stored inferences      = dbForecastCount
 * The bar never derives from the on-chain count: in dry-run that stays 0 while the
 * agent is already deciding. Hidden once warmup is complete.
 */
export function WarmupBar() {
  const status = useAgentStatus();
  // One clock for the app: the footer's UTC clock hook (self-aligning timeout, pauses when hidden).
  const clock = useUtcClock();
  const minsToHour = clock ? Math.ceil(clock.secondsToNextHour / 60) : null;

  const s = status.data;
  if (!s || s.warmupComplete) return null;

  const remaining = Math.min(WARMUP_HOURS, Math.max(0, s.hoursUntilFirstDecision));
  const done = WARMUP_HOURS - remaining;

  return (
    <Panel label="WARMUP" meta={`${done} / ${WARMUP_HOURS} hours`}>
      <div className="grid grid-cols-9 gap-1">
        {Array.from({ length: WARMUP_HOURS }, (_, i) => (
          <span
            key={i}
            className={cn('h-2 rounded-sm border', i < done ? 'border-argon-500 bg-argon-500 shadow-glow-sm' : 'border-hairline bg-surface-1')}
          />
        ))}
      </div>
      <p className="mt-5 leading-6 text-text-mid">Collecting the first {WARMUP_HOURS} hourly forecasts. The gate opens at forecast {WARMUP_HOURS}.</p>
      <dl className="mt-3 grid grid-cols-[9rem_1fr] gap-x-4 gap-y-1 text-[0.75rem] leading-5">
        <dt className="label leading-5">hours filled</dt>
        <dd className="font-mono text-text-hi">
          {done} / {WARMUP_HOURS}
        </dd>
        <dt className="label leading-5">first decision in</dt>
        <dd className="font-mono text-text-hi">
          {remaining}h{minsToHour !== null && <span className="text-text-dim"> · next print in ~{minsToHour} min UTC</span>}
        </dd>
        {s.onchainForecastCount !== undefined && (
          <>
            <dt className="label leading-5">on-chain submits</dt>
            <dd className="font-mono text-text-mid">
              {s.onchainForecastCount}
              {s.dryRun && s.onchainForecastCount === 0 && <span className="text-text-dim"> · dry-run, submission paused</span>}
            </dd>
          </>
        )}
        {s.dbForecastCount !== undefined && (
          <>
            <dt className="label leading-5">stored inferences</dt>
            <dd className="font-mono text-text-mid">{s.dbForecastCount}</dd>
          </>
        )}
      </dl>
    </Panel>
  );
}
