import { getAddress, type Address } from 'viem';

import type { SupportedChainId } from './chains';
import type { TokenSymbol } from '@/types/pools';

/**
 * Canonical ERC-20s per chain, written as EIP-55 checksummed literals and re-validated
 * through viem's `getAddress()` at module load so a typo can never ship as a lowercase
 * lookalike. These are the exact tokens the deployed vaults escrow (contracts/deployments.md).
 */
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
    { symbol: 'WETH', address: getAddress('0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73'), decimals: 18, chainId: 4663 },
    { symbol: 'USDG', address: getAddress('0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168'), decimals: 6, chainId: 4663 },
  ],
};

/** Tokens a user can deposit into the vault on each chain (v1: the gated pools' legs). */
export const DEPOSIT_TOKENS: Record<SupportedChainId, readonly TokenSymbol[]> = {
  42161: ['WETH', 'USDC'],
  4663: ['WETH', 'USDG'],
};

/**
 * Native ETH is a deposit asset without an ERC-20 contract: the vault takes it through the
 * payable `depositETH()` and wraps it itself, so there is no allowance step. Both chains
 * use ETH as the gas token.
 */
export interface NativeEthDef {
  symbol: 'ETH';
  decimals: 18;
  native: true;
}
export const NATIVE_ETH: NativeEthDef = { symbol: 'ETH', decimals: 18, native: true };

/** What the deposit form can take on a chain: native ETH, then the vault's escrowed ERC-20s. */
export type DepositAsset = NativeEthDef | TokenDef;

export function isNativeEth(asset: DepositAsset): asset is NativeEthDef {
  return 'native' in asset && asset.native === true;
}

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

/** Native ETH first, then the ERC-20 legs: the order the deposit form shows. */
export function depositAssets(chainId: SupportedChainId): readonly DepositAsset[] {
  return [NATIVE_ETH, ...depositTokens(chainId)];
}
