'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/utils/cn';

import { revealContainer, useHoloSheen } from './motion';

/**
 * Glass panel with a mandatory label (design.md §4.1, §4.10). Staggered entrance
 * and holographic hover sheen (§7.2). The sheen is CSS driven by variables written
 * in a pointer handler; no React state.
 */
export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'onPointerMove'> {
  label: ReactNode;
  meta?: ReactNode;
  active?: boolean;
  padded?: boolean;
  glitch?: boolean;
  /** Entrance delay in seconds for staggered grids. */
  delay?: number;
  reveal?: boolean;
  /** Stateful blurred glow (Phase 7 M1): enter = ion, exit = plasma, hold = argon. */
  glow?: 'enter' | 'exit' | 'hold' | 'warmup' | 'error' | 'none';
}

export function Panel({ label, meta, active = false, padded = true, glitch = false, delay = 0, reveal = true, glow = 'none', className, children, ...rest }: PanelProps) {
  const reduced = useReducedMotion();
  const holo = useHoloSheen<HTMLElement>();
  const classes = cn('panel flex flex-col overflow-hidden', active && glow === 'none' && 'panel-active', glow !== 'none' && `panel-glow-${glow}`, glitch && 'animate-glitch', className);

  const inner = (
    <>
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-3 py-2">
        <span className="label truncate">{label}</span>
        {meta !== undefined && <span className="label truncate text-text-dim">{meta}</span>}
      </header>
      <div className={cn('flex min-h-0 flex-1 flex-col', padded && 'p-3')}>{children}</div>
    </>
  );

  if (reduced || !reveal) {
    return (
      <section ref={holo.ref} onPointerMove={holo.onPointerMove} className={classes} {...rest}>
        {inner}
      </section>
    );
  }

  return (
    <motion.section
      ref={holo.ref as React.Ref<HTMLElement>}
      onPointerMove={holo.onPointerMove}
      className={classes}
      variants={revealContainer}
      initial="hidden"
      animate="show"
      custom={delay}
      {...(rest as Record<string, unknown>)}
    >
      {inner}
    </motion.section>
  );
}
