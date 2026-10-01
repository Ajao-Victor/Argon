'use client';

import { useIsFetching } from '@tanstack/react-query';
import Link from 'next/link';

import { KeeperAvatar } from '@/components/simulation/KeeperAvatar';
import { Reveal, RevealItem, StaggerText } from '@/components/ui/motion';
import { agentKeys, useAgentMode, useAgentStatus, useLatestForecast } from '@/hooks/useAgent';
import { formatPct } from '@/utils/format';
import { gateChip } from '@/utils/policy';

/** The Keeper is the landing hero (design.md §7.1 placement). Query-only, no wallet code. */
export function LandingHero() {
  const latest = useLatestForecast();
  const status = useAgentStatus();
  const mode = useAgentMode();
  const thinking = useIsFetching({ queryKey: agentKeys.latest() }) + useIsFetching({ queryKey: agentKeys.status() }) > 0;
  const f = latest.data;
  const pct = f?.ethPctChange ?? null;
  const warmupComplete = f?.warmupComplete ?? status.data?.warmupComplete ?? false;

  return (
    <div className="flex flex-col items-center gap-10">
      <KeeperAvatar
        ethPctChange={pct}
        action={f?.action}
        warmupComplete={warmupComplete}
        reachable={latest.status !== 'error'}
        mode={mode}
        hourId={f?.hourId}
        size={260}
        thinking={thinking}
      />

      <Reveal delay={0.18} className="flex flex-col items-center gap-4 text-center">
        <RevealItem>
          <h1 className="font-display text-4xl font-medium leading-tight tracking-tight text-text-hi sm:text-6xl">
            In the pool when the next eight hours look calm.
            <br />
            <span className="text-argon-400 glow-text">In cash when they don&apos;t.</span>
          </h1>
        </RevealItem>

        <RevealItem className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 label">
          {pct !== null ? (
            <>
              <span>
                eth 8h <StaggerText text={formatPct(pct)} className={pct < 0 ? 'text-signal-down' : pct > 0 ? 'text-signal-up' : 'text-text-hi'} />
              </span>
              <span>
                gate <span className={gateChip(pct) === 'IN' ? 'text-argon-300' : 'text-signal-warn'}>{gateChip(pct)}</span>
              </span>
              {f && (
                <span>
                  next <span className="text-text-mid">{f.action}</span>
                </span>
              )}
            </>
          ) : (
            <span className="text-text-dim">{mode === 'offline' ? 'waiting for agent telemetry' : latest.status === 'error' ? 'agent unreachable' : 'reading the keeper…'}</span>
          )}
        </RevealItem>

        <RevealItem>
        <Link
          href="/app"
          className="mt-2 inline-flex items-center rounded-chip border border-argon-500 bg-argon-600/30 px-5 py-2.5 text-label uppercase tracking-[0.12em] text-argon-300 transition-[box-shadow,background-color] hover:bg-argon-600/50 hover:shadow-glow-sm"
        >
          launch app →
        </Link>
        </RevealItem>
      </Reveal>
    </div>
  );
}
