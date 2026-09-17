import type { ReactNode } from 'react';

import { StatusDot, type ChipTone } from '@/components/ui/Chip';
import { cn } from '@/utils/cn';

/** Single-row telemetry strip (design.md §4.6). Label + value in mono, semantic dots. */
export interface TelemetryItem {
  key: string;
  label: string;
  value: ReactNode;
  tone?: ChipTone;
}

export function Telemetry({ items, trailing, className }: { items: readonly TelemetryItem[]; trailing?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 label', className)}>
      {items.map((it) => (
        <span key={it.key} className="flex items-center gap-1.5">
          {it.tone && <StatusDot tone={it.tone} />}
          <span>{it.label}</span>
          <span className="text-text-mid">{it.value}</span>
        </span>
      ))}
      {trailing !== undefined && <span className="ml-auto text-text-dim">{trailing}</span>}
    </div>
  );
}
