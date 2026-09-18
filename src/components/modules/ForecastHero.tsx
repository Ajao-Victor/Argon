'use client';

import { Banner, Chip, Panel, RevealItem, Skeleton, StaggerText, Term } from '@/components/ui';
import { useAgentMode, useHashMatch, useLatestForecast, useAgentStatus, usePoolStatuses, useVaultParams } from '@/hooks';
import type { SupportedChainId } from '@/services/chains';
import type { PolicyAction } from '@/types/forecast';
import { cn } from '@/utils/cn';
import { formatPct, formatUsd } from '@/utils/format';
import { formatHourUtc } from '@/utils/hourId';
import { GATE_PCT, gateChip, policyAction } from '@/utils/policy';

/**
 * The number is the hero (design.md §4.2). Renders the API `action`; falls back to
 * the registry row when the agent is down; never fabricates a percent (ENGINEERING.md §0.6).
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

void ACTION_TONE;

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
  const vaultParams = useVaultParams(chainId);
  const match = useHashMatch(chainId, latest.data);
  const agentMode = useAgentMode();

  const api = latest.data;
  const agentOffline = agentMode === 'offline';
  const agentDown = latest.status === 'error';
  // The gate shown is the one the API or the vault reports. No default.
  const gateBps = api?.gateBps ?? status.data?.gateBps ?? vaultParams.data?.gateBps;

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
      label={<Term id="gate">ETH · 8H AHEAD</Term>}
      meta={hourId !== undefined ? <Term id="hourId">{`hour ${hourId} · ${formatHourUtc(hourId)}`}</Term> : 'no hour'}
      active
      className="relative"
      glitch={agentDown && pct === null}
      delay={delay}
      glow={glow}
    >
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
                  {gate === 'IN' ? 'inside ±2%' : 'outside ±2%'}
                </Chip>
              </div>
            )}
          </RevealItem>
        </div>
      )}

      {action && (
        <RevealItem>
          <p className="mt-6 max-w-xl leading-6 text-text-mid">{ACTION_COPY[action]}</p>
        </RevealItem>
      )}

      <RevealItem className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-hairline pt-5 sm:grid-cols-4">
        {api && (
          <div className="flex flex-col gap-1">
            <span className="label leading-5"><Term id="spot">spot</Term></span>
            <span className="font-mono text-sm leading-5 text-text-hi">{formatUsd(api.spotUsd)}</span>
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
      </RevealItem>
    </Panel>
  );
}
