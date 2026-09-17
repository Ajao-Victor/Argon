import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/utils/cn';

/** Terminal-grade button. Glow on hover, scale on press, indeterminate bar when pending (design.md §3.5, §4.9). */
export type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'link';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'border-argon-500 bg-argon-600/30 text-argon-300 hover:bg-argon-600/50 hover:shadow-glow-sm active:bg-argon-600/70',
  ghost: 'border-hairline bg-transparent text-text-mid hover:border-hairline-strong hover:text-text-hi',
  danger: 'border-signal-down/40 bg-transparent text-signal-down hover:bg-signal-down/10',
  link: 'border-transparent bg-transparent px-0 text-ion-400 hover:text-ion-400 hover:shadow-none underline-offset-4 hover:underline',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  pending?: boolean;
  reason?: ReactNode;
  size?: 'sm' | 'md';
}

export function Button({ variant = 'primary', pending = false, reason, size = 'md', className, children, disabled, ...rest }: ButtonProps) {
  const isDisabled = disabled || pending;
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={isDisabled}
        aria-busy={pending || undefined}
        className={cn(
          'relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-chip border font-mono uppercase tracking-[0.12em] transition-[box-shadow,background-color,transform] duration-120 active:scale-[0.98]',
          size === 'md' ? 'px-4 py-2 text-label' : 'px-2.5 py-1 text-[0.625rem]',
          VARIANTS[variant],
          isDisabled && 'cursor-not-allowed opacity-50 hover:shadow-none',
          className,
        )}
        {...rest}
      >
        {children}
        {pending && (
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-px overflow-hidden bg-surface-2">
            <span className="absolute inset-y-0 w-1/4 bg-argon-500 animate-pending-bar" />
          </span>
        )}
      </button>
      {reason !== undefined && <span className="text-[0.6875rem] text-signal-down">{reason}</span>}
    </div>
  );
}
