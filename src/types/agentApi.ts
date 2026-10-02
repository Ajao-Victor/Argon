import { getAddress, isAddress, type Address } from 'viem';
import { z } from 'zod';

import { forecastSchema, type Forecast } from './forecast';

/**
 * Live agent endpoints beyond the forecast feed, aligned 1:1 with the Heroku service
 * (captured 2026-10-01):
 *
 *   GET /pools                 APR + TVL per selectable vault, poll 60 s
 *   GET /vault                 global vault snapshot (TVL, pool status) with no wallet, poll 10 s
 *   GET /portfolio/{address}   the same snapshot scoped to a wallet, plus the latest forecast, poll 10 s
 *
 * Money fields that are on-chain integers (`shares`, `idleWeth`, …) arrive as decimal
 * strings and are kept as strings here; the *Formatted siblings are floats for display.
 * Every address is validated with viem isAddress and normalised to EIP-55 so a
 * lowercase or malformed address can never flow into a contract call.
 */

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export type ChainKey = 'arbitrum' | 'robinhood';
/** Where the APR came from. Seen: 'defillama', 'uniswap', 'unavailable'. Open string: a new source must never invalidate the pool. */
export type AprSource = string;

export interface LpPool {
  id: ChainKey;
  chainId: number;
  poolId: number;
  pair: string;
  feePercent: number;
  uniswapFee: number;
  vault: Address;
  pool: Address;
  weth: Address;
  stable: Address;
  stableSymbol: string;
  inPool: boolean;
  poolTvlUsd: number | null;
  ethUsd: number | null;
  selectable: boolean;
  depositHint: string;
  aprPct: number | null;
  aprBasePct: number | null;
  aprSource: AprSource;
  llamaTvlUsd: number | null;
  volumeUsd1d: number | null;
  uniswapTick?: number | null | undefined;
  /** uint128 as a decimal string. */
  uniswapLiquidity?: string | null | undefined;
  error?: string | undefined;
}

export interface PoolsResponse {
  updatedAt: string;
  pollSeconds: number;
  selectOneChain: true;
  pools: LpPool[];
}

export interface ChainPortfolio {
  name: ChainKey;
  chainId: number;
  vault: Address;
  poolId: number;
  pair: string;
  inPool: boolean;
  ethUsd: number;
  /** Vault-wide share supply, decimal string of a uint256. */
  totalShares: string;
  tvlUsd: number;
  /** The wallet's shares (zero for /vault), decimal string of a uint256. */
  shares: string;
  shareUsd: number;
  idleWeth: string;
  idleStable: string;
  idleWethFormatted: number;
  idleStableFormatted: number;
  walletWeth: string;
  walletStable: string;
  walletWethFormatted: number;
  walletStableFormatted: number;
  stableSymbol: string;
  stableDecimals: number;
  error?: string | undefined;
}

/** Per-chain snapshot; a chain is absent (or undefined) when the agent could not read it. */
export interface ChainMap {
  arbitrum?: ChainPortfolio | undefined;
  robinhood?: ChainPortfolio | undefined;
}

export interface VaultSnapshot {
  address: null;
  updatedAt: string;
  pollSeconds: number;
  totalUsd: number;
  chains: ChainMap;
}

export interface Portfolio {
  address: Address;
  updatedAt: string;
  pollSeconds: number;
  totalUsd: number;
  chains: ChainMap;
  forecast: Forecast | null;
}

// ---------------------------------------------------------------------------
// zod
// ---------------------------------------------------------------------------

const addressSchema = z
  .string()
  .refine((s) => isAddress(s), 'EVM address')
  .transform((s) => getAddress(s));

const chainKeySchema = z.enum(['arbitrum', 'robinhood']);
const chainIdSchema = z.union([z.literal(42161), z.literal(4663)]).or(z.number().int().positive());
const usd = z.number().finite().nonnegative();
const uintString = z.string().regex(/^\d+$/, 'uint256 decimal string');
const isoDate = z.string().datetime({ offset: true });

export const lpPoolSchema = z.object({
  id: chainKeySchema,
  chainId: chainIdSchema,
  poolId: z.number().int().min(1).max(255),
  pair: z.string().min(3).max(32),
  feePercent: z.number().finite().nonnegative().max(100),
  uniswapFee: z.number().int().nonnegative().max(1_000_000),
  vault: addressSchema,
  pool: addressSchema,
  weth: addressSchema,
  stable: addressSchema,
  stableSymbol: z.string().min(1).max(16),
  inPool: z.boolean(),
  poolTvlUsd: usd.nullable(),
  ethUsd: z.number().finite().positive().nullable(),
  selectable: z.boolean(),
  depositHint: z.string().max(200),
  aprPct: z.number().finite().nullable(),
  aprBasePct: z.number().finite().nullable(),
  aprSource: z.string().min(1).max(32),
  llamaTvlUsd: usd.nullable(),
  volumeUsd1d: usd.nullable(),
  uniswapTick: z.number().int().nullable().optional(),
  uniswapLiquidity: z.string().regex(/^\d+$/).nullable().optional(),
  error: z.string().max(500).optional(),
});

export const poolsResponseSchema = z.object({
  updatedAt: isoDate,
  pollSeconds: z.number().int().positive(),
  selectOneChain: z.literal(true),
  pools: z.array(lpPoolSchema).max(8),
});

export const chainPortfolioSchema = z.object({
  name: chainKeySchema,
  chainId: chainIdSchema,
  vault: addressSchema,
  poolId: z.number().int().min(1).max(255),
  pair: z.string().min(3).max(32),
  inPool: z.boolean(),
  ethUsd: z.number().finite().positive(),
  totalShares: uintString,
  tvlUsd: usd,
  shares: uintString,
  shareUsd: usd,
  idleWeth: uintString,
  idleStable: uintString,
  idleWethFormatted: usd,
  idleStableFormatted: usd,
  walletWeth: uintString,
  walletStable: uintString,
  walletWethFormatted: usd,
  walletStableFormatted: usd,
  stableSymbol: z.string().min(1).max(16),
  stableDecimals: z.number().int().min(0).max(36),
  error: z.string().max(500).optional(),
});

const chainsSchema = z.object({
  arbitrum: chainPortfolioSchema.optional(),
  robinhood: chainPortfolioSchema.optional(),
});

export const vaultSnapshotSchema = z.object({
  address: z.null(),
  updatedAt: isoDate,
  pollSeconds: z.number().int().positive(),
  totalUsd: usd,
  chains: chainsSchema,
});

export const portfolioSchema = z.object({
  address: addressSchema,
  updatedAt: isoDate,
  pollSeconds: z.number().int().positive(),
  totalUsd: usd,
  chains: chainsSchema,
  forecast: forecastSchema.nullable(),
});

// Compile-time guarantee that the schemas and the interfaces agree.
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const _pool: Equals<z.infer<typeof lpPoolSchema>, LpPool> = true;
const _pools: Equals<z.infer<typeof poolsResponseSchema>, PoolsResponse> = true;
const _chain: Equals<z.infer<typeof chainPortfolioSchema>, ChainPortfolio> = true;
const _vault: Equals<z.infer<typeof vaultSnapshotSchema>, VaultSnapshot> = true;
const _portfolio: Equals<z.infer<typeof portfolioSchema>, Portfolio> = true;
void _pool;
void _pools;
void _chain;
void _vault;
void _portfolio;
