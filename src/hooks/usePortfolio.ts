'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { Address } from 'viem';

import * as agent from '@/services/agent';
import type { Portfolio } from '@/types/agentApi';

import { agentKeys } from './useAgent';

/**
 * GET /portfolio/{address} — the connected wallet's live vault USD across both chains,
 * polled every 10 s. This is the one place the 30 s floor in ENGINEERING.md §0.7 is
 * relaxed, by explicit requirement of the backend linkage spec (apps/web/HANDOVER.md):
 * near-real-time equity for an active user. Disabled with no wallet, so a visitor never
 * generates portfolio traffic. The endpoint reads two chains and can take ~10 s; TanStack
 * de-duplicates in-flight requests, so overlapping ticks never stack.
 *
 * On-chain shares remain the source of truth for money (useVaultBalances); this feed
 * supplies USD valuation and per-chain breakdown.
 */
export const POLL_PORTFOLIO_MS = 10_000;

export function usePortfolio(address: Address | undefined): UseQueryResult<Portfolio, Error> {
  return useQuery({
    queryKey: agentKeys.portfolio(address ?? null),
    queryFn: ({ signal }) => agent.fetchPortfolio(address as Address, signal),
    enabled: agent.agentMode !== 'offline' && Boolean(address),
    refetchInterval: POLL_PORTFOLIO_MS,
    refetchIntervalInBackground: false,
    staleTime: POLL_PORTFOLIO_MS,
  });
}
