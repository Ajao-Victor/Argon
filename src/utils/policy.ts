import type { Horizon, PolicyAction } from '@/types/forecast';

/**
 * Display-only mirror of the on-chain gate (contracts/src/libraries/DualHorizonGate.sol)
 * and the agent's policy.py. The UI renders the API `action`; these helpers exist for
 * the registry-fallback path and for unit tests. Never introduce a second rule.
 *
 *   EXIT   if |1h| ≥ 1.00 % or |2h| ≥ 2.50 %
 *   HOLD   if in pool and not EXIT
 *   ENTER  if idle and |1h| < 1.00 % and |2h| < 2.50 % and |8h| < 2.00 %
 *   EXIT   if idle and the 8 h horizon alone is outside (stay flat)
 */
export const GATES_PCT: Record<Horizon, number> = { '1h': 1.0, '2h': 2.5, '8h': 2.0 };
export const GATES_BPS: Record<Horizon, number> = { '1h': 100, '2h': 250, '8h': 200 };

/** The headline (8 h) gate, used by the hero chip and the avatar energy model. */
export const GATE_PCT = GATES_PCT['8h'];
export const GATE_BPS = GATES_BPS['8h'];

/** Registry warmup: the first nine submits are observation only (InferenceRegistry.WARMUP_SUBMITS). */
export const WARMUP_HOURS = 9;

export interface DualHorizonInput {
  ethPct1h: number;
  ethPct2h: number;
  ethPct8h: number;
  warmupComplete: boolean;
  currentlyInPool: boolean;
}

export function dualHorizonAction(o: DualHorizonInput): PolicyAction {
  if (!o.warmupComplete) return 'warmup';
  const mustExit = Math.abs(o.ethPct1h) >= GATES_PCT['1h'] || Math.abs(o.ethPct2h) >= GATES_PCT['2h'];
  if (mustExit) return 'exit';
  if (o.currentlyInPool) return 'hold';
  const canEnter = Math.abs(o.ethPct1h) < GATES_PCT['1h'] && Math.abs(o.ethPct2h) < GATES_PCT['2h'] && Math.abs(o.ethPct8h) < GATES_PCT['8h'];
  return canEnter ? 'enter' : 'exit';
}

/** Which horizons are outside their gate, in the agent's order. */
export function trippedHorizons(o: Pick<DualHorizonInput, 'ethPct1h' | 'ethPct2h' | 'ethPct8h'>): Horizon[] {
  const out: Horizon[] = [];
  if (Math.abs(o.ethPct1h) >= GATES_PCT['1h']) out.push('1h');
  if (Math.abs(o.ethPct2h) >= GATES_PCT['2h']) out.push('2h');
  if (Math.abs(o.ethPct8h) >= GATES_PCT['8h']) out.push('8h');
  return out;
}

/**
 * Legacy single-horizon helper (spec §3.2). Kept for the registry fallback when only the
 * 8 h number is available on-chain for the hour. Prefer dualHorizonAction.
 */
export function policyAction(opts: { ethPctChange: number; warmupComplete: boolean; currentlyInPool: boolean }): PolicyAction {
  if (!opts.warmupComplete) return 'warmup';
  if (Math.abs(opts.ethPctChange) >= GATE_PCT) return 'exit';
  return opts.currentlyInPool ? 'hold' : 'enter';
}

export type GateChip = 'IN' | 'OUT';

export function gateChip(ethPctChange: number): GateChip {
  return Math.abs(ethPctChange) >= GATE_PCT ? 'OUT' : 'IN';
}
