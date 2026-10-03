import type { KeyboardEvent } from 'react';

/**
 * Roving-tabindex keyboard handler for a `role="radiogroup"` of `role="radio"` buttons
 * (WAI-ARIA radio group pattern). Attach to the group container. Left / Up move to the
 * previous option, Right / Down to the next (wrapping), Home / End to the edges; the chosen
 * option is selected and focused. Returns true when the key was handled.
 */
export function rovingRadioKeyDown(e: KeyboardEvent<HTMLElement>, select: (index: number) => void): boolean {
  const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
  if (step === 0 && e.key !== 'Home' && e.key !== 'End') return false;
  const radios = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'));
  if (radios.length === 0) return false;
  const current = radios.findIndex((r) => r === document.activeElement || r.getAttribute('aria-checked') === 'true');
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? radios.length - 1 : (Math.max(current, 0) + step + radios.length) % radios.length;
  e.preventDefault();
  select(next);
  radios[next]?.focus();
  return true;
}
