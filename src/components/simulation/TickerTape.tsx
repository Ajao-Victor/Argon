import { memo, type ReactNode } from 'react';

import { cn } from '@/utils/cn';

/**
 * CSS transform marquee (design.md §3.4). Content is duplicated once for a seamless
 * loop. Paused on hover. No JavaScript interval.
 */
export interface TickerItem {
  key: string | number;
  node: ReactNode;
}

function TickerTapeImpl({ items, className }: { items: readonly TickerItem[]; className?: string }) {
  if (items.length === 0) return null;
  const strip = (suffix: string) => (
    <ul className="flex shrink-0 items-center gap-6 pr-6" aria-hidden={suffix === 'b' || undefined}>
      {items.map((it) => (
        <li key={`${it.key}-${suffix}`} className="flex items-center gap-6 whitespace-nowrap">
          {it.node}
          <span className="text-plasma-500">◆</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className={cn('overflow-hidden border-y border-hairline bg-surface-0/70 text-[0.75rem] tabular-nums', className)}>
      <div className="ticker-track flex w-max animate-ticker">
        {strip('a')}
        {strip('b')}
      </div>
    </div>
  );
}

export const TickerTape = memo(TickerTapeImpl);
