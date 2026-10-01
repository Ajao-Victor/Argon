import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { cookieToInitialState } from 'wagmi';

import { AgentClock } from '@/components/modules/AgentClock';
import { ConnectPicker } from '@/components/ui/ConnectPicker';
import { Footer } from '@/components/ui/Footer';
import { Navbar } from '@/components/ui/Navbar';
import { Providers } from '@/components/ui/Providers';
import { ToastViewport } from '@/components/ui/Toasts';
import { wagmiConfig } from '@/services/wagmi';

/**
 * Providers mount here, not at the root, so the landing page ships no wallet code.
 * wagmi state is rehydrated from the request cookie on the server, so a reload renders
 * the connected wallet immediately instead of flashing "connect wallet" first.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const initialState = cookieToInitialState(wagmiConfig, (await headers()).get('cookie'));
  return (
    <Providers initialState={initialState}>
      <AgentClock />
      <div className="flex min-h-dvh w-full flex-col overflow-x-clip">
        <Navbar />
        <div className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</div>
        <Footer />
      </div>
      <ConnectPicker />
      <ToastViewport />
    </Providers>
  );
}
