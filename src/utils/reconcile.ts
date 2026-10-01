import type { Forecast, Hex, HourId } from '@/types/forecast';

import { toBps } from './bps';
import { verifyForecastHash } from './forecastHash';

/**
 * API ↔ registry reconciliation (doc/agents.md §6.3), three horizons.
 *
 * Two independent checks feed the HashMatch widget:
 *   1. apiHashVerified — the browser recomputes keccak256(hourId, bps1h, bps2h, bps8h,
 *      modelId) from the API's own numbers and compares it to the API's published hash.
 *      This needs no chain and proves the agent did not publish a hash of other numbers.
 *   2. kind === 'match' — the registry's stored bps triple and hash equal the API's.
 * Pure, so it is unit-tested with fixture rows.
 */
export interface RegistryRow {
  pct1hBps: bigint;
  pct2hBps: bigint;
  pct8hBps: bigint;
  forecastHash: Hex;
  submittedAt: number;
  submitter: `0x${string}`;
}

export type ReconciliationKind =
  | 'not-deployed' // registry address missing
  | 'no-api' // nothing from the agent to compare
  | 'loading'
  | 'error' // chain read failed
  | 'pending-chain' // keeper has not submitted this hour (latestHourId behind, or UnknownHour)
  | 'agent-stale' // API hourId behind registry.latestHourId
  | 'match'
  | 'mismatch';

export interface Reconciliation {
  kind: ReconciliationKind;
  apiHash: Hex | null;
  chainHash: Hex | null;
  apiBps: { h1: bigint; h2: bigint; h8: bigint } | null;
  chainBps: { h1: bigint; h2: bigint; h8: bigint } | null;
  registryLatestHourId: HourId | undefined;
  /** Convenience for the hero fallback: the chain's 8 h number in percent. */
  chainPct: number | null;
  /** keccak recomputed in the browser from the API row equals the API's published hash. */
  apiHashVerified: boolean;
}

const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';

export function reconcileForecast(input: {
  api: Forecast | undefined;
  deployed: boolean;
  queryStatus: 'pending' | 'error' | 'success';
  registryLatestHourId: HourId | undefined;
  registryRow: RegistryRow | undefined;
}): Reconciliation {
  const { api, deployed, queryStatus, registryLatestHourId, registryRow } = input;
  const base: Reconciliation = {
    kind: 'loading',
    apiHash: api?.forecastHash ?? null,
    chainHash: registryRow?.forecastHash ?? null,
    apiBps: api ? { h1: toBps(api.ethPct1h), h2: toBps(api.ethPct2h), h8: toBps(api.ethPct8h) } : null,
    chainBps: registryRow ? { h1: registryRow.pct1hBps, h2: registryRow.pct2hBps, h8: registryRow.pct8hBps } : null,
    registryLatestHourId,
    chainPct: registryRow ? Number(registryRow.pct8hBps) / 100 : null,
    apiHashVerified: api ? verifyForecastHash(api) : false,
  };

  if (!deployed) return { ...base, kind: 'not-deployed' };
  if (!api) return { ...base, kind: 'no-api' };
  if (queryStatus === 'pending') return { ...base, kind: 'loading' };
  if (queryStatus === 'error') return { ...base, kind: 'error' };

  if (registryLatestHourId !== undefined) {
    if (api.hourId > registryLatestHourId) return { ...base, kind: 'pending-chain' };
    if (api.hourId < registryLatestHourId) return { ...base, kind: 'agent-stale' };
  }

  // Same hour on both sides. An empty or reverted registry row for this hour also means pending.
  if (!registryRow || registryRow.forecastHash === ZERO_HASH) return { ...base, kind: 'pending-chain' };

  const hashOk = api.forecastHash !== null && api.forecastHash.toLowerCase() === registryRow.forecastHash.toLowerCase();
  const bpsOk = base.apiBps !== null && base.apiBps.h1 === registryRow.pct1hBps && base.apiBps.h2 === registryRow.pct2hBps && base.apiBps.h8 === registryRow.pct8hBps;
  return { ...base, kind: hashOk && bpsOk ? 'match' : 'mismatch' };
}
