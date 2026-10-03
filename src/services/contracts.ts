import { getAddress, isAddress, type Address } from 'viem';

import { registryAbi } from '@/types/abi/Registry';
import { vaultAbi } from '@/types/abi/Vault';

import type { SupportedChainId } from './chains';

/**
 * Contract bindings from env (doc/architecture.md §3.4). A missing or invalid
 * address yields `undefined`, which the UI renders as "not deployed". Nothing throws
 * at import time. Env keys must be literal for Next.js inlining.
 *
 * Live deployments (redeployed 2026-10-02 with the scheduled-news pause; addresses differ per chain):
 *   Arbitrum One 42161   ArgonVault 0xe0eb546A1F8dcEc7B124cF8fE253de34d54A6c61 · InferenceRegistry 0x8F288a7a6E28a5d44980De19502522C376965afe
 *   Robinhood Chain 4663 ArgonVault 0x89403CA4AdB3A89A0173B7494903B4247881966f · InferenceRegistry 0x256A61b459BFdb48B4C04DE5Ba13E0dFBC326508
 * Retired with zero shares: 0x9F844b4D1b28Be7413067f9d4fC08Bc276fd1C60 / 0xbAf00c0aCa440337d43495c7de661A0AC2E01e8f (both chains).
 * The agent publishes the vault it manages in GET /pools; utils/vaultBinding.ts compares it with
 * these env bindings so a stale deployment can never accept a deposit into a retired vault.
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

/** Block at which ArgonVault was deployed per chain (from the Foundry broadcasts). Log scans start here. */
export const VAULT_DEPLOY_BLOCK: Record<SupportedChainId, bigint> = { 42161: 511142126n, 4663: 78649595n };

export const ADMIN_ADDRESS: Address | undefined = envAddress(process.env.NEXT_PUBLIC_ADMIN_ADDRESS);

export function isAdmin(address: Address | undefined): boolean {
  return Boolean(address && ADMIN_ADDRESS && address.toLowerCase() === ADMIN_ADDRESS.toLowerCase());
}
