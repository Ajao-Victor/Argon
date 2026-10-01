'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import * as agent from '@/services/agent';
import type { VaultSnapshot } from '@/types/agentApi';

import { agentKeys } from './useAgent';

/**
 * GET /vault — global TVL, share supply and pool status per chain with no wallet, so a
 * judge sees live vault telemetry before connecting. Polled every 10 s to match the
 * agent's `pollSeconds`; de-duplicated in flight. This is the agent's USD view; the
 * on-chain wagmi reads in useVault.ts stay authoritative for balances.
 */
export const POLL_VAULT_MS = 10_000;

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
