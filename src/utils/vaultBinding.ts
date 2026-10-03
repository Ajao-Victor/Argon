import type { Address } from 'viem';

/**
 * Does the vault this build is bound to (NEXT_PUBLIC_VAULT_*) match the vault the agent says
 * it manages for that chain (GET /pools → `vault`)? After the 2026-10-02 redeploy the old
 * vault still exists on-chain with zero shares, so a stale env would accept deposits into a
 * contract the keeper never touches. 'unknown' while the agent row has not arrived.
 */
export type VaultBindingState = 'match' | 'mismatch' | 'unknown';

export function vaultBindingState(bound: Address | undefined, agentVault: Address | undefined | null): VaultBindingState {
  if (!bound || !agentVault) return 'unknown';
  return bound.toLowerCase() === agentVault.toLowerCase() ? 'match' : 'mismatch';
}
