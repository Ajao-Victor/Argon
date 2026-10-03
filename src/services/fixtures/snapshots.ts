import type { Address } from 'viem';

import type { ChainPortfolio, Portfolio, PoolsResponse, VaultSnapshot } from '@/types/agentApi';

import { fixtureLatest } from './forecasts';

/**
 * Development fixtures for the three snapshot endpoints (/pools, /vault, /portfolio).
 * Loaded only through a dynamic import behind NEXT_PUBLIC_AGENT_FIXTURE=true in
 * non-production builds, so none of this reaches a production bundle.
 */

const FIXTURE_VAULT = '0xe0eb546A1F8dcEc7B124cF8fE253de34d54A6c61' as const;

function fixtureChain(name: 'arbitrum' | 'robinhood'): ChainPortfolio {
  const arb = name === 'arbitrum';
  return {
    name,
    chainId: arb ? 42161 : 4663,
    vault: FIXTURE_VAULT,
    poolId: arb ? 1 : 4,
    pair: arb ? 'WETH/USDC' : 'WETH/USDG',
    inPool: false,
    ethUsd: 2690,
    totalShares: '0',
    tvlUsd: 0,
    shares: '0',
    shareUsd: 0,
    idleWeth: '0',
    idleStable: '0',
    idleWethFormatted: 0,
    idleStableFormatted: 0,
    walletWeth: '0',
    walletStable: '0',
    walletWethFormatted: 0,
    walletStableFormatted: 0,
    stableSymbol: arb ? 'USDC' : 'USDG',
    stableDecimals: 6,
  };
}

export function fixturePools(): PoolsResponse {
  return {
    updatedAt: new Date().toISOString(),
    pollSeconds: 60,
    selectOneChain: true,
    pools: [
      {
        id: 'arbitrum', chainId: 42161, poolId: 1, pair: 'WETH/USDC', feePercent: 0.05, uniswapFee: 500, vault: FIXTURE_VAULT,
        pool: '0xC6962004f452bE9203591991D15f6b388e09E8D0', weth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', stable: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        stableSymbol: 'USDC', inPool: false, poolTvlUsd: 36_600_000, ethUsd: 2690, selectable: true,
        depositHint: 'Switch wallet to arbitrum then deposit WETH + USDC', aprPct: 24.6, aprBasePct: 24.6, aprSource: 'defillama', llamaTvlUsd: 36_588_001, volumeUsd1d: 49_398_159,
      },
      {
        id: 'robinhood', chainId: 4663, poolId: 4, pair: 'WETH/USDG', feePercent: 0.05, uniswapFee: 500, vault: FIXTURE_VAULT,
        pool: '0x69BfaF19C9f377BB306a89aEd9F6B07e2c1a8d9a', weth: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73', stable: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
        stableSymbol: 'USDG', inPool: false, poolTvlUsd: 5_300_000, ethUsd: 2690, selectable: true,
        depositHint: 'Switch wallet to robinhood then deposit WETH + USDG', aprPct: null, aprBasePct: null, aprSource: 'unavailable', llamaTvlUsd: null, volumeUsd1d: null,
      },
    ],
  };
}

export function fixtureVault(): VaultSnapshot {
  return { address: null, updatedAt: new Date().toISOString(), pollSeconds: 10, totalUsd: 0, chains: { arbitrum: fixtureChain('arbitrum'), robinhood: fixtureChain('robinhood') } };
}

export function fixturePortfolio(address: Address): Portfolio {
  return { ...fixtureVault(), address, forecast: fixtureLatest() };
}
