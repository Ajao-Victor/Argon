import type { PolicyAction } from '@/types/forecast';

/** The gate, in percent. Vault param gateBps = 200. There is no second threshold. */
export const GATE_PCT = 2;
export const GATE_BPS = 200;
export const WARMUP_HOURS = 8;

/**
 * Display-only mirror of the keeper rule (spec §3.2).
 * Render the API `action` when present; use this as fallback and in tests.
 */
export function policyAction(opts: {
  ethPctChange: number;
  warmupComplete: boolean;
  currentlyInPool: boolean;
}): PolicyAction {
  if (!opts.warmupComplete) return 'warmup';
  if (Math.abs(opts.ethPctChange) >= GATE_PCT) return 'exit';
  return opts.currentlyInPool ? 'hold' : 'enter';
}

export type GateChip = 'IN' | 'OUT';

export function gateChip(ethPctChange: number): GateChip {
  return Math.abs(ethPctChange) >= GATE_PCT ? 'OUT' : 'IN';
}
