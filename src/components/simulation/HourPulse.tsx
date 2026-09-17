'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { memo } from 'react';

/** DOM ring that fires once when `hourId` changes (design.md §3.3). Framer, transform+opacity only. */
function HourPulseImpl({ hourId, className }: { hourId: number | undefined; className?: string }) {
  const reduced = useReducedMotion();
  if (reduced || hourId === undefined) return null;
  return (
    <AnimatePresence>
      <motion.span
        key={hourId}
        aria-hidden
        className={className ?? 'pointer-events-none absolute left-1/2 top-1/2 h-32 w-32 rounded-full border border-plasma-500'}
        initial={{ scale: 0.2, opacity: 0.9, x: '-50%', y: '-50%' }}
        animate={{ scale: 3, opacity: 0, x: '-50%', y: '-50%' }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />
    </AnimatePresence>
  );
}

export const HourPulse = memo(HourPulseImpl);
