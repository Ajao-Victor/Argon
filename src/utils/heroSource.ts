import type { Forecast, HourId, PolicyAction } from '@/types/forecast';

import { policyAction } from './policy';
import type { Reconciliation } from './reconcile';

/**
 * What the hero renders, decided in one place (ENGINEERING.md §0.6).
 *
 * Priority is fixed: the agent row wins whenever it exists. An empty registry, a null
 * txHash, a dry-run keeper, or a missing chain number never hides or overrides it.
 * The chain is consulted only when there is no agent row at all, and only if the
 * registry actually holds a committed forecast. With neither, the hero is empty.
 */
export type HeroSource = 'api' | 'chain' | 'none';

export interface HeroView {
  source: HeroSource;
  pct: number | null;
  hourId: HourId | undefined;
  action: PolicyAction | undefined;
  /** Predicted ETH/USD at the 8 h target, agent rows only. */
  predUsd: number | null;
  spotUsd: number | null;
  warmupComplete: boolean;
}

export function selectHero(input: {
  api: Forecast | undefined;
  match: Pick<Reconciliation, 'chainPct' | 'registryLatestHourId'>;
  statusWarmupComplete: boolean | undefined;
  inPool: boolean;
}): HeroView {
  const { api, match, statusWarmupComplete, inPool } = input;
  if (api) {
    return {
      source: 'api',
      pct: api.ethPctChange,
      hourId: api.hourId,
      action: api.action,
      predUsd: api.predEthUsd8h ?? null,
      spotUsd: api.spotUsd,
      warmupComplete: api.warmupComplete,
    };
  }
  const warmupComplete = statusWarmupComplete ?? false;
  if (match.chainPct !== null && match.registryLatestHourId !== undefined && match.registryLatestHourId > 0) {
    return {
      source: 'chain',
      pct: match.chainPct,
      hourId: match.registryLatestHourId,
      action: policyAction({ ethPctChange: match.chainPct, warmupComplete, currentlyInPool: inPool }),
      predUsd: null,
      spotUsd: null,
      warmupComplete,
    };
  }
  return { source: 'none', pct: null, hourId: undefined, action: undefined, predUsd: null, spotUsd: null, warmupComplete };
}
