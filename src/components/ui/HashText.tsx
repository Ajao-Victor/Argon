'use client';

import { Copy, ExternalLink } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '@/utils/cn';
import { truncateHex } from '@/utils/format';

/** Truncated hex with copy flash and optional explorer link (design.md §1.1 principle 5, §3.5). */
export interface HashTextProps {
  value: string | null | undefined;
  href?: string | undefined;
  className?: string;
  head?: number;
  tail?: number;
}

export function HashText({ value, href, className, head = 6, tail = 4 }: HashTextProps) {
  const [copied, setCopied] = useState(false);
  const flash = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(flash.current), []);
  const copy = useCallback(() => {
    if (!value) return;
    navigator.clipboard
      ?.writeText(value)
      .then(() => {
        setCopied(true);
        clearTimeout(flash.current);
        flash.current = setTimeout(() => setCopied(false), 300);
      })
      .catch(() => {
        /* clipboard permission denied: the full value is still in the title attribute */
      });
  }, [value]);

  if (!value) return <span className={cn('text-text-dim', className)}>—</span>;

  return (
    <span className={cn('inline-flex items-center gap-1.5 font-mono', className)}>
      <span title={value} className={cn('transition-colors', copied && 'text-ion-400')}>
        {truncateHex(value, head, tail)}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          copy();
        }}
        aria-label="copy" className="-m-2 inline-flex h-8 w-8 items-center justify-center text-text-lo hover:text-ion-400 md:-m-1 md:h-5 md:w-5">
        <Copy size={12} strokeWidth={1.5} />
      </button>
      {href && (
        <a href={href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} aria-label="open in explorer" className="-m-2 inline-flex h-8 w-8 items-center justify-center text-text-lo hover:text-ion-400 md:-m-1 md:h-5 md:w-5">
          <ExternalLink size={12} strokeWidth={1.5} />
        </a>
      )}
    </span>
  );
}
