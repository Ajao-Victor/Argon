'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import * as agent from '@/services/agent';
import type { VaultSnapshot } from '@/types/agentApi';

import { agentKeys } from './useAgent';

/**
 * GET /vault — global TVL, share supply and pool status per chain with no wallet, so a
 * judge sees live vault telemetry before connecting. The agent advertises 10 s, but the
 * endpoint reads two chains and answers in 9.6–12.7 s on Heroku, so a 10 s poll never
 * settles; 30 s (the app's polling floor, ENGINEERING.md §0.7) is used instead. This is
 * the agent's USD view; the on-chain wagmi reads in useVault.ts stay authoritative.
 */
export const POLL_VAULT_MS = 30_000;

export function useVaultTelemetry(): UseQueryResult<VaultSnapshot, Error> {
  return useQuery({
    queryKey: agentKeys.vault(),
    queryFn: ({ signal }) => agent.fetchVault(signal),
    enabled: agent.agentMode !== 'offline',
    refetchInterval: POLL_VAULT_MS,
    refetchIntervalInBackground: false,
    staleTime: POLL_VAULT_MS,
  });
}
