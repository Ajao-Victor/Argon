'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { HTMLAttributes } from 'react';

import { cn } from '@/utils/cn';

/** Rectilinear status chip. 3D flip when `flipKey` changes (design.md §3.5). Text is always present. */
export type ChipTone = 'argon' | 'up' | 'down' | 'warn' | 'idle' | 'soon' | 'ion' | 'plain';

const TONES: Record<ChipTone, string> = {
  argon: 'border-hairline-strong text-argon-300',
  up: 'border-signal-up/40 text-signal-up',
  down: 'border-signal-down/40 text-signal-down',
  warn: 'border-signal-warn/40 text-signal-warn',
  idle: 'border-hairline text-signal-idle',
  soon: 'border-hairline text-signal-soon',
  ion: 'border-ion-400/40 text-ion-400',
  plain: 'border-hairline text-text-lo',
};

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: ChipTone;
  dot?: boolean;
  flipKey?: string | number;
}

export function Chip({ tone = 'plain', dot = false, flipKey, className, children, ...rest }: ChipProps) {
  const reduced = useReducedMotion();
  const classes = cn(
    'inline-flex items-center gap-1.5 rounded-chip border px-2 py-0.5 text-label uppercase tracking-[0.12em]',
    TONES[tone],
    className,
  );
  const body = (
    <>
      {dot && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </>
  );
  if (reduced || flipKey === undefined) {
    return (
      <span className={classes} {...rest}>
        {body}
      </span>
    );
  }
  return (
    <motion.span
      key={flipKey}
      className={classes}
      initial={{ rotateX: -90, opacity: 0 }}
      animate={{ rotateX: 0, opacity: 1 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={{ transformPerspective: 400, transformOrigin: 'center bottom' }}
      {...(rest as Record<string, unknown>)}
    >
      {body}
    </motion.span>
  );
}

export function StatusDot({ tone = 'plain', className }: { tone?: ChipTone; className?: string }) {
  const color: Record<ChipTone, string> = {
    argon: 'bg-argon-500', up: 'bg-signal-up', down: 'bg-signal-down', warn: 'bg-signal-warn',
    idle: 'bg-signal-idle', soon: 'bg-signal-soon', ion: 'bg-ion-400', plain: 'bg-text-lo',
  };
  return <span aria-hidden className={cn('inline-block h-1.5 w-1.5 rounded-full', color[tone], className)} />;
}
