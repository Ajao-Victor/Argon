import type { ReactNode } from 'react';

import { AgentClock } from '@/components/modules/AgentClock';
import { Providers } from '@/components/ui/Providers';

import { AppNav } from './AppNav';

/** Providers mount here, not at the root, so the landing page ships no wallet code. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <AgentClock />
      <AppNav />
      <div className="mx-auto w-full max-w-7xl px-4 py-4">{children}</div>
    </Providers>
  );
}
