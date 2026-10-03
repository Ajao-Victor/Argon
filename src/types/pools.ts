import type { SupportedChainId } from '@/services/chains';

/** The four pools (spec §4.3). v1 gate applies to 1 and 4 only. */
export type PoolId = 1 | 2 | 3 | 4;
export type Dex = 'uniswap-v3' | 'uniswap-v4';
export type TokenSymbol = 'WETH' | 'USDC' | 'LINK' | 'USDG';

export interface PoolDef {
  id: PoolId;
  pair: readonly [TokenSymbol, TokenSymbol];
  chainId: SupportedChainId;
  dex: Dex;
  gated: boolean;
}

export const POOLS: readonly PoolDef[] = [
  { id: 1, pair: ['WETH', 'USDC'], chainId: 42161, dex: 'uniswap-v3', gated: true },
  { id: 2, pair: ['LINK', 'WETH'], chainId: 42161, dex: 'uniswap-v3', gated: false },
  { id: 3, pair: ['LINK', 'USDC'], chainId: 42161, dex: 'uniswap-v4', gated: false },
  { id: 4, pair: ['WETH', 'USDG'], chainId: 4663, dex: 'uniswap-v3', gated: true },
] as const;

/** What a pool card renders (product.md §3.3). */
export type PoolCardStatus = 'IN_POOL' | 'IDLE' | 'UNFUNDED' | 'LINK_SOON' | 'NOT_DEPLOYED';

/** On-chain poolStatus: 0 idle, 1 in pool. */
export type OnChainPoolStatus = 0 | 1;
