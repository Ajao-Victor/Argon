import { defineChain } from 'viem';
import { arbitrum } from 'wagmi/chains';

/**
 * Chains the dApp supports (doc/architecture-essentials.md §2).
 * Arbitrum comes from viem. Robinhood Chain is defined by hand.
 * Explorer URLs are built from these definitions, never from API payloads.
 */
export const ARB_RPC_DEFAULT = 'https://arb1.arbitrum.io/rpc';
export const RH_RPC_DEFAULT = 'https://rpc.mainnet.chain.robinhood.com';

export const robinhood = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [RH_RPC_DEFAULT] },
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://robinhoodchain.blockscout.com' },
  },
  // Multicall3 is deployed at the canonical address on Robinhood Chain; without this entry
  // wagmi falls back to one RPC round-trip per read.
  contracts: {
    multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' },
  },
});

export { arbitrum };

export const chains = [arbitrum, robinhood] as const;

export type SupportedChainId = (typeof chains)[number]['id'];

export const DEFAULT_CHAIN_ID: SupportedChainId = arbitrum.id;

export function isSupportedChainId(id: number): id is SupportedChainId {
  return chains.some((c) => c.id === id);
}
