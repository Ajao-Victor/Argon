/** On-chain ethPctBps = trunc(ethPctChange * 100). -2.41% → -241 (spec §7). */
export function toBps(pct: number): bigint {
  return BigInt(Math.trunc(pct * 100));
}

export function fromBps(bps: bigint | number): number {
  return Number(bps) / 100;
}

/** gateBps 200 → 2 (percent). */
export function gatePctFromBps(gateBps: number | bigint): number {
  return Number(gateBps) / 100;
}
