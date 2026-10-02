'use client';

import { useIsFetching } from '@tanstack/react-query';
import Link from 'next/link';

import { KeeperAvatar } from '@/components/simulation/KeeperAvatar';
import { Reveal, RevealItem, StaggerText } from '@/components/ui/motion';
import { agentKeys, useAgentMode, useAgentStatus, useLatestForecast } from '@/hooks/useAgent';
import { formatPct, formatUsd } from '@/utils/format';
import { WARMUP_HOURS, gateChip } from '@/utils/policy';

/**
 * Landing hero for traders, not contract engineers. The Keeper Avatar reads the live
 * forecast through a query-only provider (no wallet code). Every number shown comes
 * from GET /forecasts/latest; nothing is computed client-side except the plain-English
 * state line, which mirrors the agent's own `action`.
 */
function stateLine(action: string | undefined, warmupComplete: boolean, gatePct: number): { text: string; tone: string } {
  if (!warmupComplete || action === 'warmup') {
    return { text: `Warming up — the AI observes the first ${WARMUP_HOURS} hours before it trades`, tone: 'text-text-mid' };
  }
  if (action === 'exit') return { text: 'High volatility predicted — vault steps aside into cash', tone: 'text-signal-warn' };
  if (action === 'hold' || action === 'enter') return { text: `Market looks calm (within ±${gatePct}%) — vault stays active to earn fees`, tone: 'text-signal-up' };
  return { text: 'Reading the market…', tone: 'text-text-lo' };
}

export function LandingHero() {
  const latest = useLatestForecast();
  const status = useAgentStatus();
  const mode = useAgentMode();
  const thinking = useIsFetching({ queryKey: agentKeys.latest() }) + useIsFetching({ queryKey: agentKeys.status() }) > 0;
  const f = latest.data;
  const pct = f?.ethPctChange ?? null;
  const warmupComplete = f?.warmupComplete ?? status.data?.warmupComplete ?? false;
  const gatePct = (f?.gate8hBps ?? status.data?.gate8hBps ?? 200) / 100;
  const state = stateLine(f?.action, warmupComplete, gatePct);

  return (
    <div className="flex w-full flex-col items-center gap-10">
      <KeeperAvatar
        ethPctChange={pct}
        action={f?.action}
        warmupComplete={warmupComplete}
        reachable={latest.status !== 'error'}
        mode={mode}
        hourId={f?.hourId}
        size={240}
        thinking={thinking}
      />

      <Reveal delay={0.18} className="flex w-full flex-col items-center gap-5 text-center">
        <RevealItem>
          <h1 className="font-display text-4xl font-medium leading-tight tracking-tight text-text-hi sm:text-6xl">
            Yield on autopilot.{' '}
            <br className="hidden sm:block" />
            <span className="text-argon-400 glow-text">Safety built in.</span>
          </h1>
        </RevealItem>

        <RevealItem>
          <p className="mx-auto max-w-2xl text-[0.9375rem] leading-6 text-text-mid sm:text-base">
            Argon puts your crypto to work when ETH is calm and puts it to cash when it isn&apos;t. No charts, no clicking.
          </p>
        </RevealItem>

        {/* Live forecast card: plain trading labels, every value straight from the agent */}
        <RevealItem className="w-full max-w-xl">
          <div className="panel panel-active p-5 text-left sm:p-6">
            <div className="label mb-4 flex items-center justify-between">
              <span>live forecast</span>
              <span className="text-text-dim">{f ? `hour ${f.hourId} · ${new Date(f.submittedAt).toISOString().slice(11, 16)} UTC` : mode === 'fixture' ? 'sample data' : ''}</span>
            </div>
            {pct !== null && f ? (
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="label-lg">8-hour ETH forecast</dt>
                  <dd className="mt-1 flex flex-wrap items-baseline gap-x-3">
                    <StaggerText text={formatPct(pct)} className={`data-hero text-4xl sm:text-5xl ${pct < 0 ? 'text-signal-down' : pct > 0 ? 'text-signal-up' : 'text-text-hi'}`} />
                    <span className="font-mono text-[0.75rem] leading-5 text-text-lo">
                      {f.predEthUsd8h !== null && f.predEthUsd8h !== undefined ? `→ ${formatUsd(f.predEthUsd8h)} predicted` : ''}
                      {f.spotUsd !== null ? ` · ${formatUsd(f.spotUsd)} now` : ''}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="label-lg">safe trading range (gate)</dt>
                  <dd className="mt-1">
                    <span className={`font-mono text-lg ${gateChip(pct) === 'IN' ? 'text-argon-300' : 'text-signal-warn'}`}>
                      {gateChip(pct) === 'IN' ? `Within ±${gatePct.toFixed(2)}%` : `Outside ±${gatePct.toFixed(2)}%`}
                    </span>
                    <p className={`mt-1 text-[0.8125rem] leading-5 ${state.tone}`}>{state.text}</p>
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-text-dim">{mode === 'offline' ? 'Forecast feed not configured on this deployment.' : latest.status === 'error' ? 'The forecast service is unreachable right now.' : 'Reading the latest forecast…'}</p>
            )}
          </div>
        </RevealItem>

        <RevealItem>
          <Link
            href="/app"
            className="mt-1 inline-flex min-h-[44px] items-center rounded-chip border border-argon-500 bg-argon-600/30 px-6 text-label uppercase tracking-[0.12em] text-argon-300 transition-[box-shadow,background-color] hover:bg-argon-600/50 hover:shadow-glow-sm"
          >
            open the vault →
          </Link>
        </RevealItem>
      </Reveal>
    </div>
  );
}
