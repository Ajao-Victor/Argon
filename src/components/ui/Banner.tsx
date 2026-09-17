import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

import { StatusDot, type ChipTone } from './Chip';

/** One-line inline notice inside the panel shape (design.md §4.10 empty states). */
export function Banner({ tone = 'warn', children, className, glitch = false }: { tone?: ChipTone; children: ReactNode; className?: string; glitch?: boolean }) {
  const border: Record<ChipTone, string> = {
    argon: 'border-hairline-strong', up: 'border-signal-up/40', down: 'border-signal-down/40', warn: 'border-signal-warn/40',
    idle: 'border-hairline', soon: 'border-hairline', ion: 'border-ion-400/40', plain: 'border-hairline',
  };
  return (
    <div
      role="status"
      className={cn('flex items-center gap-2 rounded-chip border bg-surface-0/60 px-3 py-2 text-[0.75rem] text-text-mid', border[tone], glitch && 'animate-glitch', className)}
    >
      <StatusDot tone={tone} />
      <span>{children}</span>
    </div>
  );
}
