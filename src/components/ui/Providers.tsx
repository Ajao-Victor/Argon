'use client';

import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';

import { wagmiConfig } from '@/services/wagmi';
import { useUiStore } from '@/stores/ui';

import { makeQueryClient } from './QueryProvider';

/**
 * /app provider tree: wagmi + TanStack Query. TanStack Query is the only cache
 * for network and chain data (ENGINEERING.md §1.1).
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState<QueryClient>(makeQueryClient);

  // Rehydrate the persisted UI store only on the client, after the first paint.
  useEffect(() => {
    void useUiStore.persist.rehydrate();
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
