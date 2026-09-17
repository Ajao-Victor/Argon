import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/utils/cn';

/** Glass panel with a mandatory label (design.md §4.1, §4.10 "every panel has a label"). */
export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  meta?: ReactNode;
  active?: boolean;
  padded?: boolean;
  glitch?: boolean;
}

export function Panel({ label, meta, active = false, padded = true, glitch = false, className, children, ...rest }: PanelProps) {
  return (
    <section
      className={cn('panel flex flex-col overflow-hidden', active && 'panel-active', glitch && 'animate-glitch', className)}
      {...rest}
    >
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-3 py-2">
        <span className="label truncate">{label}</span>
        {meta !== undefined && <span className="label truncate text-text-dim">{meta}</span>}
      </header>
      <div className={cn('flex min-h-0 flex-1 flex-col', padded && 'p-3')}>{children}</div>
    </section>
  );
}
