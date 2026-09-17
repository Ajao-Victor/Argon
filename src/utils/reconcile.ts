import type { Forecast, Hex, HourId } from '@/types/forecast';

import { toBps } from './bps';

/**
 * API ↔ registry reconciliation (doc/agents.md §6.3). Pure, so it is unit-tested
 * with fixture rows and reused by the HashMatch widget through useHashMatch.
 */
export interface RegistryRow {
  ethPctBps: bigint;
  targetHourId: HourId;
  forecastHash: Hex;
  submittedAt: number;
  submitter: `0x${string}`;
}

export type ReconciliationKind =
  | 'not-deployed' // registry address missing
  | 'no-api' // nothing from the agent to compare
  | 'loading'
  | 'error' // chain read failed
  | 'pending-chain' // API hourId ahead of registry.latestHourId: keeper has not submitted yet
  | 'agent-stale' // API hourId behind registry.latestHourId
  | 'match'
  | 'mismatch';

export interface Reconciliation {
  kind: ReconciliationKind;
  apiHash: Hex | null;
  chainHash: Hex | null;
  apiBps: bigint | null;
  chainBps: bigint | null;
  registryLatestHourId: HourId | undefined;
  /** Convenience for the hero: the number the chain says, in percent. */
  chainPct: number | null;
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
    apiBps: api ? toBps(api.ethPctChange) : null,
    chainBps: registryRow?.ethPctBps ?? null,
    registryLatestHourId,
    chainPct: registryRow ? Number(registryRow.ethPctBps) / 100 : null,
  };

  if (!deployed) return { ...base, kind: 'not-deployed' };
  if (!api) return { ...base, kind: 'no-api' };
  if (queryStatus === 'pending') return { ...base, kind: 'loading' };
  if (queryStatus === 'error') return { ...base, kind: 'error' };

  if (registryLatestHourId !== undefined) {
    if (api.hourId > registryLatestHourId) return { ...base, kind: 'pending-chain' };
    if (api.hourId < registryLatestHourId) return { ...base, kind: 'agent-stale' };
  }

  // Same hour on both sides. An empty registry row for this hour also means pending.
  if (!registryRow || registryRow.forecastHash === ZERO_HASH) return { ...base, kind: 'pending-chain' };

  const hashOk = api.forecastHash !== null && api.forecastHash.toLowerCase() === registryRow.forecastHash.toLowerCase();
  const bpsOk = toBps(api.ethPctChange) === registryRow.ethPctBps;
  return { ...base, kind: hashOk && bpsOk ? 'match' : 'mismatch' };
}
