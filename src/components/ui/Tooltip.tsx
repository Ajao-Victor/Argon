'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useId, useState, type ReactNode } from 'react';

import { cn } from '@/utils/cn';

import { GLOSSARY, type TermId } from './glossary';

/** Hover / focus tooltip. Spring in, fades out. Transform + opacity only. */
export function Tooltip({ content, children, className }: { content: ReactNode; children: ReactNode; className?: string | undefined }) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const id = useId();
  return (
    <span
      className={cn('relative inline-flex', className)}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined} tabIndex={0} className="outline-none">
        {children}
      </span>
      <AnimatePresence>
        {open && (
          <motion.span
            id={id}
            role="tooltip"
            className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-64 -translate-x-1/2 rounded-panel border border-hairline-strong bg-surface-1/95 px-3 py-2 text-left text-[0.75rem] normal-case leading-5 tracking-normal text-text-mid shadow-glow-sm backdrop-blur-glass"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 400, damping: 26 }}
          >
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/** A glossary term: dotted underline + tooltip from GLOSSARY. */
export function Term({ id, children, className }: { id: TermId; children: ReactNode; className?: string | undefined }) {
  return (
    <Tooltip content={GLOSSARY[id]} className={className}>
      <span className="cursor-help underline decoration-dotted decoration-text-dim underline-offset-4 hover:decoration-argon-400">{children}</span>
    </Tooltip>
  );
}
