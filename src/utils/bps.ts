import { roundHalfEven } from './forecastHash';

/**
 * Percent ↔ basis points, encoded exactly as the agent and registry do:
 * bps = round-half-even(pct × 100). -2.41 % → -241. -2.419 % → -242.
 */
export function toBps(pct: number): bigint {
  return BigInt(roundHalfEven(pct * 100));
}

export function fromBps(bps: bigint | number): number {
  return Number(bps) / 100;
}

