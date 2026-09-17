'use client';

import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';
import { usePublicClient } from 'wagmi';

import type { SupportedChainId } from '@/services/chains';
import { getVault } from '@/services/contracts';
import { fetchVaultActivity, type ActivityEvent } from '@/services/logs';

/** Deposit / withdraw / rebalance events for this wallet on one chain (spec §5.1 /app/activity). */
export function useActivity(chainId: SupportedChainId, user: Address | undefined) {
  const client = usePublicClient({ chainId });
  const vault = getVault(chainId);
  return useQuery<ActivityEvent[], Error>({
    queryKey: ['logs', chainId, vault?.address ?? null, user ?? null],
    queryFn: () => {
      if (!client || !vault) return Promise.resolve([]);
      return fetchVaultActivity({ client, chainId, vault: vault.address, user });
    },
    enabled: Boolean(client && vault),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}
