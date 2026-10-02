import type { LpPool } from '@/types/agentApi';

import { formatUsd } from './format';

/**
 * The three market lines on a pool card, computed from a GET /pools row only. No wallet,
 * no chain read. Each line degrades on its own: a null APR never hides TVL or ETH.
 */
export interface PoolMarketView {
  apr: string;
  /** Secondary note on the APR line: the source, or why it is unavailable. */
  aprNote: string | null;
  tvl: string | null;
  tvlFull: string | null;
  volume24h: string | null;
  eth: string | null;
}

export function compactUsd(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return formatUsd(v);
}

export function poolMarketView(pool: LpPool | undefined): PoolMarketView | null {
  if (!pool) return null;
  const hasApr = pool.aprPct !== null && Number.isFinite(pool.aprPct);
  return {
    // Handoff 2026-10-02: a null aprPct leaves the APR value empty; TVL and ETH still render.
    apr: hasApr ? `${(pool.aprPct as number).toFixed(2)}%` : '',
    aprNote: hasApr ? pool.aprSource : pool.aprSource === 'unavailable' ? 'not listed on DefiLlama' : pool.aprSource,
    tvl: pool.poolTvlUsd === null ? null : compactUsd(pool.poolTvlUsd),
    tvlFull: pool.poolTvlUsd === null ? null : formatUsd(pool.poolTvlUsd),
    volume24h: pool.volumeUsd1d === null ? null : compactUsd(pool.volumeUsd1d),
    eth: pool.ethUsd === null ? null : formatUsd(pool.ethUsd),
  };
}
