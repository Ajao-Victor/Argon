'use client';

import { Banner, Button, Panel } from '@/components/ui';

/** Dashboard error boundary (CLAUDE.md §3.4): a panel, not a blank page. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl py-12">
      <Panel label="RENDER ERROR" meta={error.digest ?? 'client'}>
        <Banner tone="down" glitch>
          {error.message || 'something in the dashboard tree threw'}
        </Banner>
        <p className="mt-3 text-text-mid">
          The agent and chain reads are unaffected. Reload the dashboard; if it repeats, the last on-chain forecast is
          still visible on the explorer.
        </p>
        <div className="mt-4">
          <Button onClick={reset}>reload dashboard</Button>
        </div>
      </Panel>
    </div>
  );
}
