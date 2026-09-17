import { getAddress, type Address } from 'viem';

import type { SupportedChainId } from './chains';
import type { TokenSymbol } from '@/types/pools';

/** Checksummed canonical tokens (spec §4.2). */
export interface TokenDef {
  symbol: TokenSymbol;
  address: Address;
  decimals: number;
  chainId: SupportedChainId;
}

export const TOKENS: Record<SupportedChainId, readonly TokenDef[]> = {
  42161: [
    { symbol: 'WETH', address: getAddress('0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'), decimals: 18, chainId: 42161 },
    { symbol: 'USDC', address: getAddress('0xaf88d065e77c8cC2239327C5EDb3A432268e5831'), decimals: 6, chainId: 42161 },
    { symbol: 'LINK', address: getAddress('0xf97f4df75117a78c1A5a0DBb814Af92458539FB4'), decimals: 18, chainId: 42161 },
  ],
  4663: [
    { symbol: 'WETH', address: getAddress('0x0bd7d308f8e1639fab988df18a8011f41eacad73'), decimals: 18, chainId: 4663 },
    { symbol: 'USDG', address: getAddress('0x5fc5360d0400a0fd4f2af552add042d716f1d168'), decimals: 6, chainId: 4663 },
  ],
};

/** Tokens a user can deposit into the vault on each chain (v1: the gated pools' legs). */
export const DEPOSIT_TOKENS: Record<SupportedChainId, readonly TokenSymbol[]> = {
  42161: ['WETH', 'USDC'],
  4663: ['WETH', 'USDG'],
};

export function tokenBySymbol(chainId: SupportedChainId, symbol: TokenSymbol): TokenDef {
  const t = TOKENS[chainId].find((x) => x.symbol === symbol);
  if (!t) throw new Error(`token ${symbol} not on chain ${chainId}`);
  return t;
}

export function tokenByAddress(chainId: SupportedChainId, address: Address): TokenDef | undefined {
  const target = address.toLowerCase();
  return TOKENS[chainId].find((x) => x.address.toLowerCase() === target);
}

export function depositTokens(chainId: SupportedChainId): readonly TokenDef[] {
  return DEPOSIT_TOKENS[chainId].map((s) => tokenBySymbol(chainId, s));
}
