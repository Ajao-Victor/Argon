'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useId, useState } from 'react';

import { cn } from '@/utils/cn';

import { SPRING } from './motion';

/**
 * Mono amount input with symbol chip, MAX, balance line, and inline validation
 * (design.md §4.8). Tactile: the field settles to scale 0.98 while focused on a
 * spring, like a key under a fingertip (Phase 7 M4).
 */
export interface TokenInputProps {
  value: string;
  onChange: (v: string) => void;
  symbol: string;
  decimals: number;
  balanceLabel?: string | undefined;
  onMax?: (() => void) | undefined;
  error?: string | null | undefined;
  disabled?: boolean | undefined;
  label?: string;
}

const AMOUNT_RE = /^\d*(\.\d*)?$/;

export function TokenInput({ value, onChange, symbol, decimals, balanceLabel, onMax, error, disabled, label = 'amount' }: TokenInputProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const [focused, setFocused] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="label leading-5">
        {label}
      </label>
      <motion.div
        animate={reduced ? {} : { scale: focused && !disabled ? 0.98 : 1 }}
        transition={SPRING.tap}
        className={cn(
          'flex items-center gap-3 rounded-chip border bg-surface-0 px-4 py-3 transition-[border-color,box-shadow] duration-150',
          error ? 'border-signal-down/60' : focused ? 'border-hairline-strong shadow-glow-sm' : 'border-hairline',
          disabled && 'opacity-50',
        )}
      >
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          placeholder="0.00"
          disabled={disabled}
          value={value}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            const v = e.target.value.replace(',', '.');
            if (!AMOUNT_RE.test(v)) return;
            const [, frac] = v.split('.');
            if (frac && frac.length > decimals) return;
            onChange(v);
          }}
          className="min-w-0 flex-1 bg-transparent font-mono text-xl tabular-nums leading-7 text-text-hi outline-none placeholder:text-text-dim"
        />
        {onMax && (
          <motion.button type="button" onClick={onMax} disabled={disabled} whileTap={reduced ? {} : { scale: 0.96 }} transition={SPRING.tap} className="label text-ion-400 hover:underline">
            max
          </motion.button>
        )}
        <span className="rounded-chip border border-hairline px-2 py-0.5 text-label uppercase tracking-[0.12em] text-text-mid">{symbol}</span>
      </motion.div>
      <span className={cn('min-h-5 text-[0.6875rem] leading-5', error ? 'text-signal-down' : 'text-text-lo')}>{error ?? balanceLabel ?? ''}</span>
    </div>
  );
}
