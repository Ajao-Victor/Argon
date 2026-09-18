'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

import { useWallet } from '@/hooks/useWallet';
import { cn } from '@/utils/cn';

import { Button } from './Button';

/**
 * Disconnected / offline state (Phase 8 M4). Rendered inside a Panel body so the
 * surface never looks broken: a dim reactor glyph, one line of copy, and a
 * magnetic connect button. Opacity/scale only; static under reduced motion.
 */
export function OfflineGlyph({ className }: { className?: string | undefined }) {
  const reduced = useReducedMotion();
  return (
    <motion.svg
      viewBox="-60 -60 120 120"
      className={cn('h-16 w-16 text-text-dim', className)}
      aria-hidden
      animate={reduced ? {} : { opacity: [0.45, 0.8, 0.45] }}
      transition={reduced ? {} : { duration: 4, repeat: Infinity, ease: 'easeInOut' }}
    >
      <circle r={52} fill="none" stroke="currentColor" strokeWidth={0.8} strokeDasharray="4 8" />
      <circle r={38} fill="none" stroke="currentColor" strokeWidth={0.6} strokeDasharray="2 6" />
      <polygon points="0,-18 15.6,-9 15.6,9 0,18 -15.6,9 -15.6,-9" fill="none" stroke="currentColor" strokeWidth={1} />
      <rect x={-9} y={-1} width={6} height={2} fill="currentColor" />
      <rect x={3} y={-1} width={6} height={2} fill="currentColor" />
    </motion.svg>
  );
}

export interface DisconnectedStateProps {
  title?: string;
  copy?: ReactNode;
  cta?: string;
  compact?: boolean;
  className?: string;
}

export function DisconnectedState({
  title = 'telemetry offline',
  copy = 'Connect a wallet to read your vault balances and activity. Forecasts and pool status stay public.',
  cta = 'connect wallet to initialize telemetry',
  compact = false,
  className,
}: DisconnectedStateProps) {
  const w = useWallet();
  return (
    <div className={cn('flex flex-1 flex-col items-center justify-center gap-4 text-center', compact ? 'py-4' : 'py-8', className)}>
      <OfflineGlyph className={compact ? 'h-12 w-12' : undefined} />
      <div className="flex flex-col gap-1">
        <span className="label-lg">{title}</span>
        {!compact && <p className="max-w-xs text-[0.75rem] leading-5 text-text-lo">{copy}</p>}
      </div>
      <Button size={compact ? 'sm' : 'md'} onClick={w.connect} pending={w.isConnecting} reason={w.error?.message}>
        {cta}
      </Button>
    </div>
  );
}
