import { describe, expect, it } from 'vitest';

import { chainPortfolioSchema, lpPoolSchema, poolsResponseSchema, portfolioSchema, vaultSnapshotSchema } from './agentApi';

/** Verbatim captures from the live Heroku agent, 2026-10-01. */
const LIVE_POOLS = {
  updatedAt: '2026-10-01T13:53:17.551436+00:00', pollSeconds: 60, selectOneChain: true,
  pools: [
    { id: 'arbitrum', chainId: 42161, poolId: 1, pair: 'WETH/USDC', feePercent: 0.05, uniswapFee: 500,
      vault: '0x9F844b4D1b28Be7413067f9d4fC08Bc276fd1C60', pool: '0xC6962004f452bE9203591991D15f6b388e09E8D0',
      weth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', stable: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', stableSymbol: 'USDC',
      inPool: false, poolTvlUsd: 36620363.97838525, ethUsd: 2693.57, selectable: true,
      depositHint: 'Switch wallet to arbitrum then deposit WETH + USDC', aprPct: 24.63967, aprBasePct: 24.63967, aprSource: 'defillama',
      llamaTvlUsd: 36588001.0, volumeUsd1d: 49398159.0213 },
    { id: 'robinhood', chainId: 4663, poolId: 4, pair: 'WETH/USDG', feePercent: 0.05, uniswapFee: 500,
      vault: '0x9F844b4D1b28Be7413067f9d4fC08Bc276fd1C60', pool: '0x69BfaF19C9f377BB306a89aEd9F6B07e2c1a8d9a',
      weth: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73', stable: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168', stableSymbol: 'USDG',
      inPool: false, poolTvlUsd: 5309047.16922889, ethUsd: 2691.70223591, selectable: true,
      depositHint: 'Switch wallet to robinhood then deposit WETH + USDG', aprPct: null, aprBasePct: null, aprSource: 'unavailable',
      llamaTvlUsd: null, volumeUsd1d: null },
  ],
};

const LIVE_CHAIN = {
  name: 'arbitrum', chainId: 42161, vault: '0x9F844b4D1b28Be7413067f9d4fC08Bc276fd1C60', poolId: 1, pair: 'WETH/USDC', inPool: false,
  ethUsd: 2695.3549, totalShares: '0', tvlUsd: 0.0, shares: '0', shareUsd: 0.0, idleWeth: '0', idleStable: '0',
  idleWethFormatted: 0.0, idleStableFormatted: 0.0, walletWeth: '0', walletStable: '0', walletWethFormatted: 0.0, walletStableFormatted: 0.0,
  stableSymbol: 'USDC', stableDecimals: 6,
};

const LIVE_VAULT = {
  address: null, updatedAt: '2026-10-01T13:53:26.847130+00:00', pollSeconds: 10, totalUsd: 0.0,
  chains: { arbitrum: LIVE_CHAIN, robinhood: { ...LIVE_CHAIN, name: 'robinhood', chainId: 4663, poolId: 4, pair: 'WETH/USDG', stableSymbol: 'USDG', ethUsd: 2691.70223591 } },
};

const LIVE_FORECAST = {
  hourId: 497434, targetHourId: 497442, submittedAt: '2026-09-30T10:00:12.238927+00:00',
  ethPct1h: -0.009529417765063997, ethPct2h: -0.13206519240578363, ethPct8h: -0.3860876579837247,
  ethPct1hSource: 'persistence', ethPct2hSource: 'persistence', ethPct8hSource: 'lgbm', spotUsd: 2688.2571423216777,
  modelId: 'eth-1-2-8h-v1', status: 'pending', realizedPctChange: null, realizedSpotUsd: null, action: 'warmup',
  gate1hBps: 100, gate2hBps: 250, gate8hBps: 200, warmupComplete: false,
  forecastHash: '0x1db0b9d6064bfcba03285dfb5430e357f10f61097ae726986e00319a6f04451e', txHash: null, txHashRh: null,
  rebalanceTx: 'warmup-skip', rebalanceTxRh: 'warmup-skip', poolStatusArb: 0, poolStatusRh: 0, trippedHorizons: [],
};

const LIVE_PORTFOLIO = { ...LIVE_VAULT, address: '0x9642b6D1Db5D1A3B0A61a831099568bbCbC04D4E', updatedAt: '2026-10-01T13:53:39.414480+00:00', forecast: LIVE_FORECAST };

describe('live /pools', () => {
  it('accepts the capture and normalises addresses to EIP-55', () => {
    const r = poolsResponseSchema.safeParse(LIVE_POOLS);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.pools).toHaveLength(2);
      expect(r.data.pools[1]?.aprSource).toBe('unavailable');
      expect(r.data.pools[1]?.aprPct).toBeNull();
    }
  });
  it('rejects a lowercase or malformed vault address', () => {
    const bad = { ...LIVE_POOLS.pools[0], vault: '0x9f844b4d1b28be7413067f9d4fc08bc276fd1c6' };
    expect(lpPoolSchema.safeParse(bad).success).toBe(false);
  });
  it('lowercase but valid addresses are accepted and checksummed', () => {
    const lower = { ...LIVE_POOLS.pools[0], vault: '0x9f844b4d1b28be7413067f9d4fc08bc276fd1c60' };
    const r = lpPoolSchema.safeParse(lower);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.vault).toBe('0x9F844b4D1b28Be7413067f9d4fC08Bc276fd1C60');
  });
  it('rejects an unknown chain key or apr source', () => {
    expect(lpPoolSchema.safeParse({ ...LIVE_POOLS.pools[0], id: 'base' }).success).toBe(false);
    expect(lpPoolSchema.safeParse({ ...LIVE_POOLS.pools[0], aprSource: 'guess' }).success).toBe(false);
  });
});

describe('live /vault and /portfolio', () => {
  it('accepts the vault snapshot (address null)', () => {
    expect(vaultSnapshotSchema.safeParse(LIVE_VAULT).success).toBe(true);
  });
  it('accepts the portfolio with its embedded forecast', () => {
    const r = portfolioSchema.safeParse(LIVE_PORTFOLIO);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.totalUsd).toBe(0);
      expect(r.data.forecast?.ethPctChange).toBe(LIVE_FORECAST.ethPct8h);
      expect(r.data.chains.robinhood?.stableSymbol).toBe('USDG');
    }
  });
  it('keeps uint256 money fields as decimal strings and rejects floats there', () => {
    expect(chainPortfolioSchema.safeParse({ ...LIVE_CHAIN, shares: '123456789012345678901234567890' }).success).toBe(true);
    expect(chainPortfolioSchema.safeParse({ ...LIVE_CHAIN, shares: '1.5' }).success).toBe(false);
    expect(chainPortfolioSchema.safeParse({ ...LIVE_CHAIN, shares: 1 }).success).toBe(false);
  });
  it('rejects negative USD and a vault snapshot with an address', () => {
    expect(chainPortfolioSchema.safeParse({ ...LIVE_CHAIN, tvlUsd: -1 }).success).toBe(false);
    expect(vaultSnapshotSchema.safeParse({ ...LIVE_VAULT, address: '0x9642b6D1Db5D1A3B0A61a831099568bbCbC04D4E' }).success).toBe(false);
  });
  it('a portfolio whose forecast is malformed is rejected as a whole', () => {
    expect(portfolioSchema.safeParse({ ...LIVE_PORTFOLIO, forecast: { ...LIVE_FORECAST, action: 'nope' } }).success).toBe(false);
  });
});
