'use client';

import { useReadContracts } from 'wagmi';

import type { SupportedChainId } from '@/services/chains';
import { getRegistry } from '@/services/contracts';
import type { Forecast, Hex, HourId } from '@/types/forecast';
import { reconcileForecast, type Reconciliation, type RegistryRow } from '@/utils/reconcile';

/**
 * InferenceRegistry reads (doc/architecture.md §3.4) and the API ↔ chain match
 * (doc/agents.md §4.3, §6.3). Reads pass chainId explicitly and run as one multicall:
 * latestHourId, forecastCount, and getForecast(hourId). The last reverts with UnknownHour
 * until the keeper submits that hour, so it is read with allowFailure and a failure is
 * reported as "pending on chain", not as an error.
 */
export const REGISTRY_STALE_MS = 30_000;

export interface RegistryReadout {
  latestHourId: HourId | undefined;
  forecastCount: number | undefined;
  row: RegistryRow | undefined;
}

export function useRegistryForecast(chainId: SupportedChainId, hourId: HourId | number | undefined) {
  const registry = getRegistry(chainId);
  const enabled = Boolean(registry) && hourId !== undefined;
  return useReadContracts({
    contracts:
      registry && hourId !== undefined
        ? [
            { ...registry, functionName: 'latestHourId' as const },
            { ...registry, functionName: 'forecastCount' as const },
            { ...registry, functionName: 'getForecast' as const, args: [BigInt(hourId)] as const },
          ]
        : [],
    allowFailure: true,
    query: {
      enabled,
      staleTime: REGISTRY_STALE_MS,
      refetchInterval: REGISTRY_STALE_MS,
      refetchIntervalInBackground: false,
      select: (rows): RegistryReadout => {
        const latest = rows[0]?.status === 'success' ? (Number(rows[0].result) as HourId) : undefined;
        const count = rows[1]?.status === 'success' ? Number(rows[1].result) : undefined;
        const fc = rows[2]?.status === 'success' ? rows[2].result : undefined;
        const row: RegistryRow | undefined = fc
          ? {
              pct1hBps: fc.pct1hBps,
              pct2hBps: fc.pct2hBps,
              pct8hBps: fc.pct8hBps,
              forecastHash: fc.forecastHash as Hex,
              submittedAt: Number(fc.submittedAt),
              submitter: fc.submitter,
            }
          : undefined;
        return { latestHourId: latest, forecastCount: count, row };
      },
    },
  });
}

/** Full reconciliation for the HashMatch widget. Pure logic lives in utils/reconcile.ts. */
export function useHashMatch(chainId: SupportedChainId, api: Forecast | undefined): Reconciliation {
  const deployed = Boolean(getRegistry(chainId));
  const q = useRegistryForecast(chainId, api?.hourId);
  return reconcileForecast({
    api,
    deployed,
    queryStatus: q.status,
    registryLatestHourId: q.data?.latestHourId,
    registryRow: q.data?.row,
  });
}
