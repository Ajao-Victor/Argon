import type { ReactNode } from 'react';

import { AgentClock } from '@/components/modules/AgentClock';
import { Footer } from '@/components/ui/Footer';
import { Navbar } from '@/components/ui/Navbar';
import { Providers } from '@/components/ui/Providers';
import { ToastViewport } from '@/components/ui/Toasts';

/** Providers mount here, not at the root, so the landing page ships no wallet code. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <AgentClock />
      <div className="flex min-h-dvh w-full flex-col overflow-x-clip">
        <Navbar />
        <div className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</div>
        <Footer />
      </div>
      <ToastViewport />
    </Providers>
  );
}
