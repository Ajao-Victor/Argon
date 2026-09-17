'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';

import { wagmiConfig } from '@/services/wagmi';

/**
 * Root provider tree: wagmi + TanStack Query.
 * TanStack Query is the only cache for network and chain data (CLAUDE.md §1.1).
 * Defaults follow doc/agents.md §5: no polling under 30 s, retry 2, refetch on focus.
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        retry: 2,
        retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000),
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  // useState keeps one client per browser session and avoids sharing across SSR requests.
  const [queryClient] = useState(makeQueryClient);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
