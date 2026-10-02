import { describe, expect, it } from 'vitest';

import type { LpPool } from '@/types/agentApi';

import { compactUsd, poolMarketView } from './poolMarket';

/** Live example values (2026-10-02). No wallet, no chain read is involved anywhere in this module. */
const arbitrum: LpPool = {
  id: 'arbitrum', chainId: 42161, poolId: 1, pair: 'WETH/USDC', feePercent: 0.05, uniswapFee: 500,
  vault: '0x9F844b4D1b28Be7413067f9d4fC08Bc276fd1C60', pool: '0xC6962004f452bE9203591991D15f6b388e09E8D0',
  weth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', stable: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', stableSymbol: 'USDC',
  inPool: false, poolTvlUsd: 36913610.5, ethUsd: 2756.85, selectable: true, depositHint: '', aprPct: 26.65, aprBasePct: 26.65,
  aprSource: 'defillama', llamaTvlUsd: 36893245, volumeUsd1d: 53876598.52914,
};
const robinhood: LpPool = { ...arbitrum, id: 'robinhood', chainId: 4663, poolId: 4, pair: 'WETH/USDG', stableSymbol: 'USDG', poolTvlUsd: 5569932.65, aprPct: 35.51, aprBasePct: 35.51, aprSource: 'uniswap', llamaTvlUsd: null, volumeUsd1d: null };

describe('poolMarketView', () => {
  it('formats the three live Arbitrum lines', () => {
    const v = poolMarketView(arbitrum)!;
    expect(v.apr).toBe('26.65%');
    expect(v.aprNote).toBe('defillama');
    expect(v.tvl).toBe('$36.91M');
    expect(v.tvlFull).toBe('$36,913,610.50');
    expect(v.eth).toBe('$2,756.85');
    expect(v.volume24h).toBe('$53.88M');
  });
  it('formats the three live Robinhood lines with a uniswap APR source', () => {
    const v = poolMarketView(robinhood)!;
    expect(v.apr).toBe('35.51%');
    expect(v.aprNote).toBe('uniswap');
    expect(v.tvl).toBe('$5.57M');
    expect(v.eth).toBe('$2,756.85');
    expect(v.volume24h).toBeNull();
  });
  it('a null APR falls back on the APR line only; TVL and ETH still render', () => {
    const v = poolMarketView({ ...robinhood, aprPct: null, aprBasePct: null, aprSource: 'unavailable' })!;
    expect(v.apr).toBe('APR unavailable');
    expect(v.aprNote).toBe('not listed on DefiLlama');
    expect(v.tvl).toBe('$5.57M');
    expect(v.eth).toBe('$2,756.85');
  });
  it('null TVL / ETH degrade individually', () => {
    const v = poolMarketView({ ...arbitrum, poolTvlUsd: null, ethUsd: null })!;
    expect(v.apr).toBe('26.65%');
    expect(v.tvl).toBeNull();
    expect(v.eth).toBeNull();
  });
  it('no row → null view', () => {
    expect(poolMarketView(undefined)).toBeNull();
  });
  it('compactUsd', () => {
    expect(compactUsd(36913610.5)).toBe('$36.91M');
    expect(compactUsd(1_250_000_000)).toBe('$1.25B');
    expect(compactUsd(9_900)).toBe('$9.9K');
    expect(compactUsd(42)).toBe('$42.00');
  });
});
