import type { ReactNode } from 'react';

import { AgentClock } from '@/components/modules/AgentClock';
import { Navbar } from '@/components/ui/Navbar';
import { Providers } from '@/components/ui/Providers';

/** Providers mount here, not at the root, so the landing page ships no wallet code. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <AgentClock />
      <div className="flex min-h-dvh flex-col">
        <Navbar />
        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      </div>
    </Providers>
  );
}
