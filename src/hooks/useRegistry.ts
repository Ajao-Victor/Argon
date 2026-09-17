'use client';

import { useReadContract, useReadContracts } from 'wagmi';

import type { SupportedChainId } from '@/services/chains';
import { getRegistry } from '@/services/contracts';
import type { Forecast, Hex, HourId } from '@/types/forecast';
import { reconcileForecast, type RegistryRow, type Reconciliation } from '@/utils/reconcile';

/**
 * InferenceRegistry reads (doc/architecture.md §3.4) and the API↔chain match
 * (doc/agents.md §4.3, §6.3). Reads pass chainId explicitly.
 */
export const REGISTRY_STALE_MS = 30_000;

export function useRegistryLatestHourId(chainId: SupportedChainId) {
  const registry = getRegistry(chainId);
  return useReadContract({
    ...(registry ?? { address: undefined, abi: undefined }),
    chainId,
    functionName: 'latestHourId',
    query: {
      enabled: Boolean(registry),
      staleTime: REGISTRY_STALE_MS,
      refetchInterval: REGISTRY_STALE_MS,
      refetchIntervalInBackground: false,
      select: (v) => Number(v) as HourId,
    },
  });
}

/** getForecast(hourId) → RegistryRow, plus latestHourId in the same multicall. */
export function useRegistryForecast(chainId: SupportedChainId, hourId: HourId | number | undefined) {
  const registry = getRegistry(chainId);
  const enabled = Boolean(registry) && hourId !== undefined;
  return useReadContracts({
    contracts:
      registry && hourId !== undefined
        ? [
            { ...registry, functionName: 'latestHourId' as const },
            { ...registry, functionName: 'getForecast' as const, args: [BigInt(hourId)] as const },
          ]
        : [],
    allowFailure: true,
    query: {
      enabled,
      staleTime: REGISTRY_STALE_MS,
      refetchInterval: REGISTRY_STALE_MS,
      refetchIntervalInBackground: false,
      select: (rows) => {
        const latest = rows[0]?.status === 'success' ? (Number(rows[0].result) as HourId) : undefined;
        const fc = rows[1]?.status === 'success' ? rows[1].result : undefined;
        const row: RegistryRow | undefined = fc
          ? {
              ethPctBps: fc[0],
              targetHourId: Number(fc[1]) as HourId,
              forecastHash: fc[2] as Hex,
              submittedAt: Number(fc[3]),
              submitter: fc[4],
            }
          : undefined;
        return { latestHourId: latest, row };
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
