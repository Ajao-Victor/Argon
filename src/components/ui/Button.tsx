'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/utils/cn';

import { SPRING, useMagnetic } from './motion';

/**
 * Terminal-grade button (design.md §3.5, §4.9, §7.2): magnetic within its bounds,
 * neon glow on hover (transition, not a loop), whileTap 0.97, indeterminate bar
 * while pending, confirm flash on success. Disabled buttons are not magnetic.
 */
export type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'link';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'border-argon-500 bg-argon-600/30 text-argon-300 hover:bg-argon-600/50 hover:shadow-neon focus-visible:shadow-neon-lg active:bg-argon-600/70',
  ghost: 'border-hairline bg-transparent text-text-mid hover:border-hairline-strong hover:text-text-hi hover:shadow-glow-sm',
  danger: 'border-signal-down/40 bg-transparent text-signal-down hover:bg-signal-down/10',
  link: 'border-transparent bg-transparent px-0 text-ion-400 hover:text-ion-400 hover:shadow-none underline-offset-4 hover:underline',
};

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onPointerMove' | 'onPointerLeave'> {
  variant?: ButtonVariant;
  pending?: boolean;
  success?: boolean;
  reason?: ReactNode;
  size?: 'sm' | 'md';
  magnetic?: boolean;
}

export function Button({
  variant = 'primary',
  pending = false,
  success = false,
  reason,
  size = 'md',
  magnetic = true,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const reduced = useReducedMotion();
  const isDisabled = disabled || pending;
  const m = useMagnetic(6, magnetic && !isDisabled && variant !== 'link');

  return (
    <div className="flex flex-col gap-1">
      <motion.button
        ref={m.ref as React.Ref<HTMLButtonElement>}
        type="button"
        disabled={isDisabled}
        aria-busy={pending || undefined}
        style={m.style}
        onPointerMove={m.onPointerMove}
        onPointerLeave={m.onPointerLeave}
        whileTap={reduced || isDisabled ? {} : { scale: 0.98 }}
        transition={SPRING.tap}
        className={cn(
          'relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-chip border font-mono uppercase tracking-[0.12em] transition-[box-shadow,background-color,border-color] duration-150',
          size === 'md' ? 'min-h-[44px] px-4 text-label' : 'min-h-[44px] px-3 text-[0.625rem] md:min-h-8 md:px-2.5',
          VARIANTS[variant],
          isDisabled && 'cursor-not-allowed opacity-50 hover:shadow-none',
          success && 'border-signal-up text-signal-up animate-confirm-flash',
          className,
        )}
        {...(rest as Record<string, unknown>)}
      >
        {children}
        {pending && (
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-px overflow-hidden bg-surface-2">
            <span className="absolute inset-y-0 w-1/4 bg-argon-500 animate-pending-bar" />
          </span>
        )}
      </motion.button>
      {reason !== undefined && <span className="text-[0.6875rem] text-signal-down">{reason}</span>}
    </div>
  );
}
