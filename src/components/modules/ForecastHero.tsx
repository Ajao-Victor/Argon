'use client';

import { Banner, Chip, Panel, RevealItem, Skeleton, StaggerText, Term } from '@/components/ui';
import { useAgentMode, useHashMatch, useLatestForecast, useAgentStatus, usePoolStatuses, useVaultTelemetry } from '@/hooks';
import type { SupportedChainId } from '@/services/chains';
import type { PolicyAction } from '@/types/forecast';
import { cn } from '@/utils/cn';
import { formatPct, formatUsd } from '@/utils/format';
import { formatHourUtc } from '@/utils/hourId';
import { GATES_PCT, WARMUP_HOURS, gateChip } from '@/utils/policy';
import { forecastLagHours, isForecastStale } from '@/utils/agentStaleness';
import { selectHero } from '@/utils/heroSource';

/**
 * The number is the hero (design.md §4.2). Renders the API `action`; falls back to
 * the registry row when the agent is down; never fabricates a percent (ENGINEERING.md §0.6).
 */
/** Gate percentages from the agent payload, falling back to the contract constants. */
interface Gates {
  g1: number;
  g2: number;
  g8: number;
}
function gatesFrom(api: { gate1hBps: number; gate2hBps: number; gate8hBps: number } | undefined): Gates {
  return { g1: api ? api.gate1hBps / 100 : GATES_PCT['1h'], g2: api ? api.gate2hBps / 100 : GATES_PCT['2h'], g8: api ? api.gate8hBps / 100 : GATES_PCT['8h'] };
}

function actionCopy(action: PolicyAction, g: Gates, tripped: readonly string[]): string {
  const which = tripped.length ? tripped.join(' + ') : 'a short horizon';
  switch (action) {
    case 'exit':
      return `Model expects ETH to move past its gate on ${which} (1h ≥ ${g.g1}%, 2h ≥ ${g.g2}%, 8h ≥ ${g.g8}%). Positions flattened.`;
    case 'enter':
    case 'hold':
      return `Model expects ETH inside every gate (1h ±${g.g1}%, 2h ±${g.g2}%, 8h ±${g.g8}%). Liquidity in range.`;
    case 'warmup':
      return `Collecting the first ${WARMUP_HOURS} hourly submits. No trades until the registry opens at submit ${WARMUP_HOURS}.`;
  }
}

const ACTION_CLASS: Record<PolicyAction, string> = {
  exit: 'text-signal-down',
  enter: 'text-signal-up',
  hold: 'text-argon-300',
  warmup: 'text-text-lo',
};

export function ForecastHero({ chainId, delay = 0 }: { chainId: SupportedChainId; delay?: number }) {
  const latest = useLatestForecast();
  const status = useAgentStatus();
  const pools = usePoolStatuses(chainId);
  const match = useHashMatch(chainId, latest.data);
  const agentMode = useAgentMode();
  const vault = useVaultTelemetry();
  const tvl = vault.data ? Object.values(vault.data.chains).reduce((acc, c) => acc + (c?.tvlUsd ?? 0), 0) : undefined;

  const api = latest.data;
  const agentOffline = agentMode === 'offline';
  const agentDown = latest.status === 'error';
  // The gate shown is the one the API reports (the deployed vault exposes no gate getter). No default.
  const gateBps = api?.gateBps ?? status.data?.gateBps;

  // Source of the number: API, else registry, else nothing.
  // One rule, tested in utils/heroSource.test.ts: the agent row always wins; the chain is
  // consulted only when there is no agent row and the registry holds a committed forecast.
  const inPool = Object.values(pools.data ?? {}).some((s) => s === 1);
  const hero = selectHero({ api, match, statusWarmupComplete: status.data?.warmupComplete, inPool });
  const pct = hero.pct;
  const hourId = hero.hourId;
  const action: PolicyAction | undefined = hero.action;

  const gate = pct !== null && pct !== undefined ? gateChip(pct) : undefined;
  const gates = gatesFrom(api ?? status.data);
  const glow: NonNullable<Parameters<typeof Panel>[0]['glow']> =
    agentDown && (pct === null || pct === undefined) ? 'error' : action === 'exit' ? 'exit' : action === 'enter' ? 'enter' : action === 'hold' ? 'hold' : action === 'warmup' ? 'warmup' : 'none';
  const signClass = pct === null || pct === undefined ? 'text-text-hi' : pct < 0 ? 'text-signal-down' : pct > 0 ? 'text-signal-up' : 'text-text-hi';

  return (
    <Panel
      label={<Term id="gate">ETH · 8H AHEAD</Term>}
      meta={hourId !== undefined ? <Term id="hourId">{`hour ${hourId} · ${formatHourUtc(hourId)}`}</Term> : 'no hour'}
      active
      className="relative"
      glitch={agentDown && pct === null}
      delay={delay}
      glow={glow}
    >
      {status.data && isForecastStale(status.data) && (
        <Banner tone="warn" className="mb-3">
          last print was {forecastLagHours(status.data)} h ago (hour {status.data.lastHourId ?? '—'}, now {status.data.currentHourId}) — the agent clock is behind; this forecast is stale
        </Banner>
      )}
      {status.data?.dryRun && (
        <Banner tone="idle" className="mb-3">
          keeper in dry-run: forecasts are published and hashed off-chain, on-chain submission and rebalancing are paused
        </Banner>
      )}
      {agentOffline && !agentDown && (
        <Banner tone="idle" className="mb-3">
          waiting for agent telemetry — NEXT_PUBLIC_AGENT_URL is not set
        </Banner>
      )}
      {agentDown && (
        <Banner tone={pct !== null && pct !== undefined ? 'warn' : 'down'} className="mb-3" glitch>
          {pct !== null && pct !== undefined ? 'live agent unreachable — showing last on-chain forecast' : 'live agent unreachable — no on-chain forecast available'}
        </Banner>
      )}

      {pct === null || pct === undefined ? (
        agentOffline && match.chainPct === null ? (
          <div className="flex flex-col gap-2 py-6">
            <span className="font-display text-3xl text-text-dim">waiting for agent telemetry</span>
            <span className="leading-5 text-text-lo">
              {match.kind === 'not-deployed' ? 'registry not deployed either — nothing to show yet' : 'the on-chain registry has no forecast for this hour'}
            </span>
          </div>
        ) : latest.status === 'pending' ? (
          <div className="flex flex-col gap-6">
            <div>
              <div className="label-lg mb-3">predicted eth move · next 8 hours</div>
              <Skeleton chars={7} slow className="data-hero text-6xl sm:text-8xl lg:text-[8.5rem]" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="label-lg">next action</div>
              <Skeleton chars={5} slow className="data-hero text-5xl sm:text-6xl lg:text-7xl" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 py-6">
            <span className="font-display text-3xl text-text-dim">no forecast available</span>
            <span className="text-text-lo">agent and registry both unavailable</span>
          </div>
        )
      ) : (
        <div className="flex flex-col gap-6">
          <RevealItem>
            <div className="label-lg mb-3">predicted eth move · next 8 hours</div>
            <StaggerText
              text={formatPct(pct)}
              glitch
              className={cn('data-hero break-all text-6xl glow-text sm:text-8xl lg:text-[8.5rem]', signClass)}
            />
          </RevealItem>
          <RevealItem className="flex flex-wrap items-end gap-x-8 gap-y-4">
            {action && (
              <div className="flex flex-col gap-2">
                <div className="label-lg">
                  <Term id="action">next action</Term>
                </div>
                <StaggerText text={action.toUpperCase()} className={cn('data-hero text-5xl sm:text-6xl lg:text-7xl', ACTION_CLASS[action])} />
              </div>
            )}
            {gate && (
              <div className="flex flex-col gap-2 pb-1">
                <div className="label-lg">gate</div>
                <Chip tone={gate === 'IN' ? 'argon' : 'warn'} dot flipKey={gate} className="w-fit">
                  {gate === 'IN' ? `inside ±${gates.g8}%` : `outside ±${gates.g8}%`}
                </Chip>
              </div>
            )}
            {api && (
              <div className="flex flex-col gap-2 pb-1">
                <div className="label-lg">horizons · gate</div>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['1h', api.ethPct1h, api.ethPct1hSource],
                      ['2h', api.ethPct2h, api.ethPct2hSource],
                      ['8h', api.ethPct8h, api.ethPct8hSource],
                    ] as const
                  ).map(([h, v, src]) => {
                    const tripped = api.trippedHorizons.includes(h);
                    return (
                      <Chip key={h} tone={tripped ? 'down' : 'plain'} flipKey={`${h}-${tripped}`} title={`source: ${src}`}>
                        {h} <span className={cn('normal-case tracking-normal', v < 0 ? 'text-signal-down' : v > 0 ? 'text-signal-up' : '')}>{formatPct(v)}</span>
                        <span className="text-text-dim">/ ±{h === '1h' ? gates.g1 : h === '2h' ? gates.g2 : gates.g8}%</span>
                      </Chip>
                    );
                  })}
                </div>
              </div>
            )}
          </RevealItem>
        </div>
      )}

      {action && (
        <RevealItem>
          <p className="mt-6 max-w-xl leading-6 text-text-mid">{actionCopy(action, gates, api?.trippedHorizons ?? [])}</p>
        </RevealItem>
      )}

      <RevealItem className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-hairline pt-5 sm:grid-cols-4">
        {api && (
          <div className="flex flex-col gap-1">
            <span className="label leading-5"><Term id="spot">spot</Term></span>
            <span className="font-mono text-sm leading-5 text-text-hi">{api.spotUsd === null ? '—' : formatUsd(api.spotUsd)}</span>
          </div>
        )}
        {hero.predUsd !== null && (
          <div className="flex flex-col gap-1">
            <span className="label leading-5">8h target</span>
            <span className={cn('font-mono text-sm leading-5', pct !== null && pct < 0 ? 'text-signal-down' : 'text-signal-up')}>{formatUsd(hero.predUsd)}</span>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <span className="label leading-5"><Term id="model">model</Term></span>
          <span className="font-mono text-sm leading-5 text-text-hi">{api?.modelId ?? status.data?.modelId ?? '—'}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="label leading-5"><Term id="gate">gate</Term></span>
          <span className="font-mono text-sm leading-5 text-text-hi">{gateBps === undefined ? '—' : `±${(gateBps / 100).toFixed(2)}%`}</span>
        </div>
        {api && (
          <div className="flex flex-col gap-1">
            <span className="label leading-5"><Term id="targetHour">target</Term></span>
            <span className="font-mono text-sm leading-5 text-text-hi">hour {api.targetHourId}</span>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <span className="label leading-5">vault tvl · live</span>
          <span className="font-mono text-sm leading-5 text-text-hi">{vault.status === 'error' ? 'unavailable' : tvl === undefined ? '…' : formatUsd(tvl)}</span>
        </div>
      </RevealItem>
    </Panel>
  );
}
