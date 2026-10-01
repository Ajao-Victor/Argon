'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import * as agent from '@/services/agent';
import type { LpPool, PoolsResponse } from '@/types/agentApi';
import type { SupportedChainId } from '@/services/chains';

import { agentKeys } from './useAgent';

/**
 * GET /pools — live APR and TVL per selectable vault, polled every 60 s (the agent's own
 * `pollSeconds`). Users pick exactly one chain before depositing (`selectOneChain`); the
 * selection itself lives in the UI store (selectedChainId), not here, so this hook is a
 * pure read with no local state (ENGINEERING.md §1.1).
 */
export const POLL_POOLS_MS = 60_000;

export function usePools(): UseQueryResult<PoolsResponse, Error> {
  return useQuery({
    queryKey: agentKeys.pools(),
    queryFn: ({ signal }) => agent.fetchPools(signal),
    enabled: agent.agentMode !== 'offline',
    refetchInterval: POLL_POOLS_MS,
    refetchIntervalInBackground: false,
    staleTime: POLL_POOLS_MS,
  });
}

/** The pool row for a chain id, if the agent lists it. */
export function poolForChain(pools: PoolsResponse | undefined, chainId: SupportedChainId): LpPool | undefined {
  return pools?.pools.find((p) => p.chainId === chainId);
}
