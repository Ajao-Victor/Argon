'use client';

import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { WagmiProvider, type State } from 'wagmi';

import { wagmiConfig } from '@/services/wagmi';
import { useUiStore } from '@/stores/ui';

import { makeQueryClient } from './QueryProvider';

/**
 * /app provider tree: wagmi + TanStack Query. TanStack Query is the only cache
 * for network and chain data (ENGINEERING.md §1.1).
 */
/** `initialState` comes from the request cookie (cookieToInitialState) so the first render already knows the wallet. */
export function Providers({ children, initialState }: { children: ReactNode; initialState?: State | undefined }) {
  const [queryClient] = useState<QueryClient>(makeQueryClient);

  // Rehydrate the persisted UI store only on the client, after the first paint.
  useEffect(() => {
    void useUiStore.persist.rehydrate();
  }, []);

  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
