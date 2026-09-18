import type { PolicyAction } from '@/types/forecast';
import { GATE_PCT } from '@/utils/policy';

/**
 * Keeper Avatar energy model (design.md §7.1). Pure so it is unit-tested.
 * k = min(|pct| / gate, 1.5); the gate is k = 1.
 */
export type KeeperState = 'dormant' | 'warmup' | 'calm' | 'charged' | 'aggressive';

export interface KeeperInput {
  ethPctChange: number | null | undefined;
  warmupComplete: boolean;
  reachable: boolean;
  action?: PolicyAction | undefined;
}

export interface KeeperEnergy {
  state: KeeperState;
  /** 0 … 1.5 */
  k: number;
  /** ring angular speed multiplier */
  ringSpeed: number;
  /** eye aperture 0 (closed) … 1 (open) */
  aperture: number;
  /** number of energy arcs 0 … 3 */
  arcs: 0 | 1 | 2 | 3;
  /** halo opacity 0 … 1 */
  halo: number;
  /** core scale */
  coreScale: number;
  counterRotate: boolean;
}

export function keeperEnergy(input: KeeperInput): KeeperEnergy {
  const { ethPctChange, warmupComplete, reachable } = input;
  if (!reachable || ethPctChange === null || ethPctChange === undefined) {
    // Resting, not dead: threads keep orbiting slowly and the glow keeps oozing.
    return { state: 'dormant', k: 0, ringSpeed: 0.35, aperture: 0.12, arcs: 0, halo: 0.55, coreScale: 1, counterRotate: false };
  }
  const k = Math.min(Math.abs(ethPctChange) / GATE_PCT, 1.5);
  if (!warmupComplete) {
    return { state: 'warmup', k, ringSpeed: 0.5, aperture: 0.5, arcs: 0, halo: 0.6, coreScale: 1, counterRotate: false };
  }
  if (k >= 1) {
    return { state: 'aggressive', k, ringSpeed: 3.5, aperture: 0.22, arcs: k >= 1.25 ? 3 : 2, halo: 0.9, coreScale: 1.06, counterRotate: true };
  }
  if (k >= 0.6) {
    return { state: 'charged', k, ringSpeed: 2, aperture: 0.6, arcs: 1, halo: 0.7, coreScale: 1.02, counterRotate: false };
  }
  return { state: 'calm', k, ringSpeed: 1, aperture: 1, arcs: 0, halo: 0.45, coreScale: 1, counterRotate: false };
}
