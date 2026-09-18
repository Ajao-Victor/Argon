'use client';

import { useSyncExternalStore } from 'react';

/**
 * Resolves brand tokens from tokens.css at runtime so Framer Motion can
 * interpolate real colors (it cannot animate `var(--x)`). tokens.css stays the
 * single source of truth: no hex lives in components (CLAUDE.md §3.5).
 * Read once and cached; tokens never change at runtime (no light theme in v1).
 * Returns null on the server.
 */
const KEYS = ['argon-300', 'argon-400', 'argon-500', 'argon-600', 'plasma-400', 'plasma-500', 'ion-400', 'signal-down', 'signal-warn', 'text-dim', 'text-lo'] as const;
export type BrandKey = (typeof KEYS)[number];
export type BrandColors = Record<BrandKey, string>;

let cached: BrandColors | null = null;

function getSnapshot(): BrandColors | null {
  if (cached) return cached;
  if (typeof document === 'undefined') return null;
  const cs = getComputedStyle(document.documentElement);
  const out = {} as BrandColors;
  for (const k of KEYS) out[k] = cs.getPropertyValue(`--${k}`).trim();
  cached = out;
  return cached;
}

const getServerSnapshot = (): BrandColors | null => null;
const subscribe = () => () => {};

export function useBrandColors(): BrandColors | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
