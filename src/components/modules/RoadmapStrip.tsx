'use client';

import { Chip, Panel, RevealItem } from '@/components/ui';
import { chainName } from '@/services/explorer';
import { POOLS } from '@/types/pools';

/** Upcoming (ungated) pools in one quiet strip, so the two live vaults keep the stage. */
export function RoadmapStrip({ delay = 0 }: { delay?: number }) {
  const upcoming = POOLS.filter((p) => !p.gated);
  if (upcoming.length === 0) return null;
  return (
    <Panel label="ROADMAP" meta="LINK pools · model later" delay={delay} padded={false}>
      <RevealItem>
        <ul className="divide-y divide-hairline">
          {upcoming.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 sm:px-6">
              <span className="font-mono text-[0.75rem] text-text-dim">pool {p.id}</span>
              <span className="label-lg text-text-mid">
                {p.pair[0]} / {p.pair[1]}
              </span>
              <span className="text-[0.6875rem] leading-5 text-text-lo">
                {chainName(p.chainId)} · {p.dex === 'uniswap-v3' ? 'Uniswap v3' : 'Uniswap v4'}
              </span>
              <Chip tone="soon" className="ml-auto">
                link model · later
              </Chip>
            </li>
          ))}
        </ul>
      </RevealItem>
    </Panel>
  );
}
