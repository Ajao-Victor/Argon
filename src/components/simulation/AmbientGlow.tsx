'use client';

import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { memo, useEffect } from 'react';

/**
 * Ambient mouse glow (design.md §7.2 spirit, §7.4 rules 1 and 7): a large,
 * pre-blurred radial gradient on a fixed layer, translated toward the pointer
 * through MotionValues + springs. No filter, no React state, transform only.
 * Under reduced motion it rests at the viewport center.
 */
function AmbientGlowImpl({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const x = useSpring(px, { stiffness: 40, damping: 18, mass: 1.2 });
  const y = useSpring(py, { stiffness: 40, damping: 18, mass: 1.2 });

  useEffect(() => {
    if (reduced) return;
    const center = () => {
      px.set(window.innerWidth / 2);
      py.set(window.innerHeight / 2);
    };
    center();
    const onMove = (e: PointerEvent) => {
      px.set(e.clientX);
      py.set(e.clientY);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('resize', center, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', center);
    };
  }, [px, py, reduced]);

  return (
    <div aria-hidden className={className ?? 'pointer-events-none fixed inset-0 -z-20 overflow-hidden'}>
      <motion.div
        className="absolute h-[70vmax] w-[70vmax] rounded-full will-change-transform"
        style={
          reduced
            ? { left: '50%', top: '50%', x: '-50%', y: '-50%', background: 'var(--ambient-glow)' }
            : { x, y, translateX: '-50%', translateY: '-50%', background: 'var(--ambient-glow)' }
        }
      />
    </div>
  );
}

export const AmbientGlow = memo(AmbientGlowImpl);
