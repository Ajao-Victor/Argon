'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { Address } from 'viem';

import * as agent from '@/services/agent';
import type { Portfolio } from '@/types/agentApi';

import { agentKeys } from './useAgent';

/**
 * GET /portfolio/{address} — the connected wallet's live vault USD across both chains,
 * polled every 30 s. The backend handover suggests 10 s, but the endpoint reads two
 * chains and answers in 9.6–12.7 s on Heroku, so a 10 s cadence never settles and only
 * stacks requests; 30 s is the app's polling floor (ENGINEERING.md §0.7). Disabled with
 * no wallet, so a visitor never generates portfolio traffic. Every deposit / withdraw
 * receipt invalidates this query immediately, which is where freshness actually matters.
 *
 * On-chain shares remain the source of truth for money (useVaultBalances); this feed
 * supplies USD valuation and per-chain breakdown.
 */
export const POLL_PORTFOLIO_MS = 30_000;

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
