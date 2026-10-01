import { getAddress, isAddress, type Address } from 'viem';

import { registryAbi } from '@/types/abi/Registry';
import { vaultAbi } from '@/types/abi/Vault';

import type { SupportedChainId } from './chains';

/**
 * Contract bindings from env (doc/architecture.md §3.4). A missing or invalid
 * address yields `undefined`, which the UI renders as "not deployed". Nothing throws
 * at import time. Env keys must be literal for Next.js inlining.
 *
 * Live deployments (same deployer nonce on both chains, so the addresses match):
 *   ArgonVault         0x9F844b4D1b28Be7413067f9d4fC08Bc276fd1C60   Arbitrum One 42161 · Robinhood 4663
 *   InferenceRegistry  0xbAf00c0aCa440337d43495c7de661A0AC2E01e8f   Arbitrum One 42161 · Robinhood 4663
 * Every address is normalised to EIP-55 through viem's getAddress() before use.
 */
function envAddress(raw: string | undefined): Address | undefined {
  const v = raw?.trim();
  if (!v || !isAddress(v)) return undefined;
  return getAddress(v);
}

const VAULT_ADDRESSES: Record<SupportedChainId, Address | undefined> = {
  42161: envAddress(process.env.NEXT_PUBLIC_VAULT_ARB),
  4663: envAddress(process.env.NEXT_PUBLIC_VAULT_RH),
};

const REGISTRY_ADDRESSES: Record<SupportedChainId, Address | undefined> = {
  42161: envAddress(process.env.NEXT_PUBLIC_REGISTRY_ARB),
  4663: envAddress(process.env.NEXT_PUBLIC_REGISTRY_RH),
};

export interface VaultBinding {
  address: Address;
  abi: typeof vaultAbi;
  chainId: SupportedChainId;
}

export interface RegistryBinding {
  address: Address;
  abi: typeof registryAbi;
  chainId: SupportedChainId;
}

export function getVault(chainId: SupportedChainId): VaultBinding | undefined {
  const address = VAULT_ADDRESSES[chainId];
  return address ? { address, abi: vaultAbi, chainId } : undefined;
}

export function getRegistry(chainId: SupportedChainId): RegistryBinding | undefined {
  const address = REGISTRY_ADDRESSES[chainId];
  return address ? { address, abi: registryAbi, chainId } : undefined;
}

export const ADMIN_ADDRESS: Address | undefined = envAddress(process.env.NEXT_PUBLIC_ADMIN_ADDRESS);

export function isAdmin(address: Address | undefined): boolean {
  return Boolean(address && ADMIN_ADDRESS && address.toLowerCase() === ADMIN_ADDRESS.toLowerCase());
}
