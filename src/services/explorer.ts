import { arbitrum, robinhood, type SupportedChainId } from './chains';

/** Explorer links are built from the chain-id map, never from API payloads (product.md §4.6). */
const EXPLORERS: Record<SupportedChainId, { name: string; url: string }> = {
  [arbitrum.id]: { name: 'Arbiscan', url: 'https://arbiscan.io' },
  [robinhood.id]: { name: 'Blockscout', url: 'https://robinhoodchain.blockscout.com' },
};

export function explorerName(chainId: SupportedChainId): string {
  return EXPLORERS[chainId].name;
}

export function txUrl(chainId: SupportedChainId, hash: string): string {
  return `${EXPLORERS[chainId].url}/tx/${hash}`;
}

export function addressUrl(chainId: SupportedChainId, address: string): string {
  return `${EXPLORERS[chainId].url}/address/${address}`;
}

export function chainName(chainId: SupportedChainId): string {
  return chainId === arbitrum.id ? 'Arbitrum' : 'Robinhood';
}
