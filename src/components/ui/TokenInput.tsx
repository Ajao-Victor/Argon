'use client';

import { useId } from 'react';

import { cn } from '@/utils/cn';

/** Mono amount input with symbol chip, MAX, balance line, and inline validation (design.md §4.8). */
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
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div
        className={cn(
          'flex items-center gap-2 rounded-chip border bg-surface-0 px-3 py-2',
          error ? 'border-signal-down/60' : 'border-hairline focus-within:border-hairline-strong',
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
          onChange={(e) => {
            const v = e.target.value.replace(',', '.');
            if (!AMOUNT_RE.test(v)) return;
            const [, frac] = v.split('.');
            if (frac && frac.length > decimals) return;
            onChange(v);
          }}
          className="min-w-0 flex-1 bg-transparent font-mono text-lg tabular-nums text-text-hi outline-none placeholder:text-text-dim"
        />
        {onMax && (
          <button type="button" onClick={onMax} disabled={disabled} className="label text-ion-400 hover:underline">
            max
          </button>
        )}
        <span className="rounded-chip border border-hairline px-2 py-0.5 text-label uppercase tracking-[0.12em] text-text-mid">
          {symbol}
        </span>
      </div>
      <span className={cn('min-h-4 text-[0.6875rem]', error ? 'text-signal-down' : 'text-text-lo')}>
        {error ?? balanceLabel ?? ''}
      </span>
    </div>
  );
}
