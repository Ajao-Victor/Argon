'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import * as agent from '@/services/agent';
import type { SupportedChainId } from '@/services/chains';
import type { ChainKey, LpPool, PoolsResponse } from '@/types/agentApi';

import { agentKeys } from './useAgent';

/**
 * GET /pools — live APR, pool TVL and ETH price per selectable vault, polled every 15 s
 * (the agent's advertised `pollSeconds`, and the one explicit exception to the 30 s floor
 * in ENGINEERING.md §0.7). The request is `cache: 'no-store'` end to end, TanStack
 * de-duplicates a tick that fires while the previous request is still in flight, and the
 * query needs no wallet: every visitor sees the market lines as soon as it resolves.
 * The chain selection lives in the UI store; this hook is a pure read.
 */
export const POLL_POOLS_MS = 15_000;

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

/** The agent keys pools by chain name; the frontend keys vaults by chain id. */
export const POOL_ID_BY_CHAIN: Record<SupportedChainId, ChainKey> = { 42161: 'arbitrum', 4663: 'robinhood' };

/** Keyed map so a card looks up its row by id ('arbitrum' | 'robinhood'), never by array index. */
export function poolsById(pools: PoolsResponse | undefined): Partial<Record<ChainKey, LpPool>> {
  const out: Partial<Record<ChainKey, LpPool>> = {};
  for (const p of pools?.pools ?? []) {
    if (p.id === 'arbitrum' || p.id === 'robinhood') out[p.id] = p;
  }
  return out;
}

/** The pool row for a chain id: 42161 → 'arbitrum', 4663 → 'robinhood'. */
export function poolForChain(pools: PoolsResponse | undefined, chainId: SupportedChainId): LpPool | undefined {
  return poolsById(pools)[POOL_ID_BY_CHAIN[chainId]];
}
