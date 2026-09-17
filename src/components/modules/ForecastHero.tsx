'use client';

import { Banner, Chip, Panel, RevealItem, StaggerText } from '@/components/ui';
import { useHashMatch, useLatestForecast, useAgentStatus, usePoolStatuses } from '@/hooks';
import type { SupportedChainId } from '@/services/chains';
import type { PolicyAction } from '@/types/forecast';
import { cn } from '@/utils/cn';
import { formatPct, formatUsd } from '@/utils/format';
import { formatHourUtc } from '@/utils/hourId';
import { GATE_PCT, gateChip, policyAction } from '@/utils/policy';

/**
 * The number is the hero (design.md §4.2). Renders the API `action`; falls back to
 * the registry row when the agent is down; never fabricates a percent (CLAUDE.md §0.6).
 */
const ACTION_COPY: Record<PolicyAction, string> = {
  exit: `Model expects |ETH| move ≥ ${GATE_PCT}% over 8h. Positions flattened.`,
  enter: `Model expects ETH within ±${GATE_PCT}% over 8h. Liquidity in range.`,
  hold: `Model expects ETH within ±${GATE_PCT}% over 8h. Liquidity in range.`,
  warmup: 'Collecting the first 8 hourly forecasts. No trades until hour 8.',
};

const ACTION_TONE: Record<PolicyAction, 'down' | 'up' | 'argon' | 'idle'> = {
  exit: 'down',
  enter: 'up',
  hold: 'argon',
  warmup: 'idle',
};

export function ForecastHero({ chainId, delay = 0 }: { chainId: SupportedChainId; delay?: number }) {
  const latest = useLatestForecast();
  const status = useAgentStatus();
  const pools = usePoolStatuses(chainId);
  const match = useHashMatch(chainId, latest.data);

  const agentDown = latest.status === 'error';
  const api = latest.data;

  // Source of the number: API, else registry, else nothing.
  const pct = api ? api.ethPctChange : match.chainPct;
  const hourId = api?.hourId ?? match.registryLatestHourId;
  const warmupComplete = api?.warmupComplete ?? status.data?.warmupComplete ?? false;
  const inPool = Object.values(pools.data ?? {}).some((s) => s === 1);
  const action: PolicyAction | undefined =
    api?.action ?? (pct !== null && pct !== undefined ? policyAction({ ethPctChange: pct, warmupComplete, currentlyInPool: inPool }) : undefined);

  const gate = pct !== null && pct !== undefined ? gateChip(pct) : undefined;
  const glow: NonNullable<Parameters<typeof Panel>[0]['glow']> =
    agentDown && (pct === null || pct === undefined) ? 'error' : action === 'exit' ? 'exit' : action === 'enter' ? 'enter' : action === 'hold' ? 'hold' : action === 'warmup' ? 'warmup' : 'none';
  const signClass = pct === null || pct === undefined ? 'text-text-hi' : pct < 0 ? 'text-signal-down' : pct > 0 ? 'text-signal-up' : 'text-text-hi';

  return (
    <Panel
      label="ETH · 8H AHEAD"
      meta={hourId !== undefined ? `hour ${hourId} · ${formatHourUtc(hourId)}` : 'no hour'}
      active
      className="relative"
      glitch={agentDown && pct === null}
      delay={delay}
      glow={glow}
    >
      {agentDown && (
        <Banner tone={pct !== null && pct !== undefined ? 'warn' : 'down'} className="mb-3" glitch>
          {pct !== null && pct !== undefined ? 'live agent unreachable — showing last on-chain forecast' : 'live agent unreachable — no on-chain forecast available'}
        </Banner>
      )}

      {pct === null || pct === undefined ? (
        <div className="flex flex-col gap-2 py-6">
          <span className="font-display text-3xl text-text-dim">no forecast available</span>
          <span className="text-text-lo">{latest.status === 'pending' ? 'waiting for the agent…' : 'agent and registry both unavailable'}</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <RevealItem>
            <StaggerText
              text={formatPct(pct)}
              glitch
              className={cn('font-mono text-7xl font-medium leading-none tracking-tight glow-text sm:text-8xl lg:text-9xl', signClass)}
            />
          </RevealItem>
          <RevealItem className="flex flex-col gap-2 pb-2">
            {gate && (
              <Chip tone={gate === 'IN' ? 'argon' : 'warn'} dot flipKey={gate} className="w-fit">
                gate {gate}
              </Chip>
            )}
            {action && (
              <Chip tone={ACTION_TONE[action]} flipKey={action} className="w-fit">
                → {action}
              </Chip>
            )}
          </RevealItem>
        </div>
      )}

      {action && (
        <RevealItem>
          <p className="mt-6 max-w-xl leading-6 text-text-mid">{ACTION_COPY[action]}</p>
        </RevealItem>
      )}

      <RevealItem className="mt-5 flex flex-wrap gap-x-6 gap-y-2 label leading-5">
        {api && <span>spot <span className="text-text-mid">{formatUsd(api.spotUsd)}</span></span>}
        <span>model <span className="text-text-mid">{api?.modelId ?? status.data?.modelId ?? '—'}</span></span>
        <span>gate <span className="text-text-mid">{((api?.gateBps ?? status.data?.gateBps ?? 200) / 100).toFixed(2)}%</span></span>
        {api && <span>target <span className="text-text-mid">hour {api.targetHourId}</span></span>}
      </RevealItem>
    </Panel>
  );
}
