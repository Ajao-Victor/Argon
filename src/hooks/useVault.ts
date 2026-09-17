'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { BaseError, erc20Abi, type Address, type Hash, type TransactionReceipt } from 'viem';
import { useAccount, useConfig, useReadContracts } from 'wagmi';
import {
  readContract,
  simulateContract,
  waitForTransactionReceipt,
  writeContract,
  type SimulateContractParameters,
} from 'wagmi/actions';

import type { SupportedChainId } from '@/services/chains';
import { getVault } from '@/services/contracts';
import { depositTokens, type TokenDef } from '@/services/tokens';
import { POOLS, type OnChainPoolStatus, type PoolId } from '@/types/pools';
import { pauseSimulation, resumeSimulation } from '@/utils/sim/scheduler';

/**
 * Vault hooks (doc/architecture.md §2.1, §2.5). Every read passes `chainId`
 * explicitly from the pool definition, never from the wallet's chain (CLAUDE.md §2).
 * Writes: simulate → sign → wait for receipt → invalidate. No optimistic balances.
 */
export const VAULT_READ_STALE_MS = 15_000;
export const VAULT_PARAMS_STALE_MS = 5 * 60_000;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function useVaultParams(chainId: SupportedChainId) {
  const vault = getVault(chainId);
  return useReadContracts({
    contracts: vault
      ? [
          { ...vault, functionName: 'gateBps' },
          { ...vault, functionName: 'warmupComplete' },
        ]
      : [],
    allowFailure: true,
    query: {
      enabled: Boolean(vault),
      staleTime: VAULT_PARAMS_STALE_MS,
      select: (rows) => ({
        gateBps: rows[0]?.status === 'success' ? Number(rows[0].result) : undefined,
        warmupComplete: rows[1]?.status === 'success' ? Boolean(rows[1].result) : undefined,
      }),
    },
  });
}

/** poolStatus for every pool on one chain, in one multicall. Keyed by poolId. */
export function usePoolStatuses(chainId: SupportedChainId) {
  const vault = getVault(chainId);
  const pools = POOLS.filter((p) => p.chainId === chainId);
  return useReadContracts({
    contracts: vault ? pools.map((p) => ({ ...vault, functionName: 'poolStatus' as const, args: [p.id] as const })) : [],
    allowFailure: true,
    query: {
      enabled: Boolean(vault),
      staleTime: VAULT_READ_STALE_MS,
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
      select: (rows) => {
        const out: Partial<Record<PoolId, OnChainPoolStatus>> = {};
        pools.forEach((p, i) => {
          const r = rows[i];
          if (r?.status === 'success') out[p.id] = (Number(r.result) === 1 ? 1 : 0) as OnChainPoolStatus;
        });
        return out;
      },
    },
  });
}

export interface VaultBalance {
  token: TokenDef;
  idle: bigint;
}

/** idleBalance per deposit token + shareBalance, for the connected user, on one chain. */
export function useVaultBalances(chainId: SupportedChainId, user: Address | undefined) {
  const vault = getVault(chainId);
  const tokens = depositTokens(chainId);
  const enabled = Boolean(vault && user);
  return useReadContracts({
    contracts:
      vault && user
        ? [
            ...tokens.map((t) => ({ ...vault, functionName: 'idleBalance' as const, args: [user, t.address] as const })),
            { ...vault, functionName: 'shareBalance' as const, args: [user] as const },
          ]
        : [],
    allowFailure: true,
    query: {
      enabled,
      staleTime: VAULT_READ_STALE_MS,
      select: (rows) => {
        const idle: VaultBalance[] = tokens.map((token, i) => {
          const r = rows[i];
          return { token, idle: r?.status === 'success' ? BigInt(r.result as bigint) : 0n };
        });
        const shareRow = rows[tokens.length];
        const shares = shareRow?.status === 'success' ? BigInt(shareRow.result as bigint) : 0n;
        const funded = shares > 0n || idle.some((b) => b.idle > 0n);
        return { idle, shares, funded };
      },
    },
  });
}

/** Wallet ERC-20 balance + allowance toward the vault, for the deposit form. */
export function useTokenAllowance(chainId: SupportedChainId, token: TokenDef | undefined, user: Address | undefined) {
  const vault = getVault(chainId);
  const enabled = Boolean(vault && user && token);
  return useReadContracts({
    contracts:
      vault && user && token
        ? [
            { address: token.address, abi: erc20Abi, chainId, functionName: 'balanceOf' as const, args: [user] as const },
            { address: token.address, abi: erc20Abi, chainId, functionName: 'allowance' as const, args: [user, vault.address] as const },
          ]
        : [],
    allowFailure: true,
    query: {
      enabled,
      staleTime: VAULT_READ_STALE_MS,
      select: (rows) => ({
        balance: rows[0]?.status === 'success' ? BigInt(rows[0].result as bigint) : 0n,
        allowance: rows[1]?.status === 'success' ? BigInt(rows[1].result as bigint) : 0n,
      }),
    },
  });
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type TxStep = 'approve' | 'deposit' | 'depositETH' | 'withdraw' | 'emergencyWithdraw';

/** Local discriminated union per write (CLAUDE.md §1.2, architecture.md §2.5). */
export type TxState =
  | { status: 'idle' }
  | { status: 'simulating'; step: TxStep }
  | { status: 'awaitingSignature'; step: TxStep }
  | { status: 'pending'; step: TxStep; hash: Hash }
  | { status: 'confirmed'; step: TxStep; hash: Hash; receipt: TransactionReceipt }
  | { status: 'failed'; step: TxStep; error: string; hash?: Hash | undefined };

export function txErrorMessage(err: unknown): string {
  if (err instanceof BaseError) return err.shortMessage;
  if (err instanceof Error) return err.message;
  return 'unknown error';
}

function isUserRejection(err: unknown): boolean {
  const msg = err instanceof BaseError ? err.shortMessage : err instanceof Error ? err.message : '';
  return /rejected|denied|cancel/i.test(msg);
}

function useInvalidateChainReads() {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['readContract'] }),
      queryClient.invalidateQueries({ queryKey: ['readContracts'] }),
      queryClient.invalidateQueries({ queryKey: ['balance'] }),
      queryClient.invalidateQueries({ queryKey: ['logs'] }),
    ]);
  }, [queryClient]);
}

/**
 * Runs one contract write end-to-end and drives `setState`. Shared by every write hook.
 * Returns the receipt or throws. Never mutates balances itself.
 */
type WriteArgs = SimulateContractParameters;

async function runWrite(
  config: ReturnType<typeof useConfig>,
  step: TxStep,
  args: WriteArgs,
  setState: (s: TxState) => void,
): Promise<{ hash: Hash; receipt: TransactionReceipt }> {
  setState({ status: 'simulating', step });
  let request: Awaited<ReturnType<typeof simulateContract>>['request'];
  try {
    ({ request } = await simulateContract(config, args));
  } catch (err) {
    setState({ status: 'failed', step, error: txErrorMessage(err) });
    throw err;
  }

  setState({ status: 'awaitingSignature', step });
  // Quiet main thread while the wallet prompt is up (doc/architecture.md §4.3).
  pauseSimulation('signing');
  let hash: Hash;
  try {
    hash = await writeContract(config, request);
  } catch (err) {
    setState({ status: 'failed', step, error: isUserRejection(err) ? 'signature rejected' : txErrorMessage(err) });
    throw err;
  } finally {
    resumeSimulation('signing');
  }

  setState({ status: 'pending', step, hash });
  try {
    const receipt = await waitForTransactionReceipt(config, { hash, chainId: args.chainId });
    if (receipt.status !== 'success') {
      setState({ status: 'failed', step, error: 'transaction reverted', hash });
      throw new Error('transaction reverted');
    }
    setState({ status: 'confirmed', step, hash, receipt });
    return { hash, receipt };
  } catch (err) {
    setState({ status: 'failed', step, error: txErrorMessage(err), hash });
    throw err;
  }
}

/** approve (if needed) → deposit(token, amount). */
export function useDeposit(chainId: SupportedChainId) {
  const config = useConfig();
  const { address: user } = useAccount();
  const invalidate = useInvalidateChainReads();
  const [state, setState] = useState<TxState>({ status: 'idle' });

  const write = useCallback(
    async (token: TokenDef, amount: bigint) => {
      const vault = getVault(chainId);
      if (!vault || !user) {
        setState({ status: 'failed', step: 'deposit', error: vault ? 'wallet not connected' : 'vault not deployed' });
        return;
      }
      if (amount <= 0n) {
        setState({ status: 'failed', step: 'deposit', error: 'amount must be greater than zero' });
        return;
      }
      try {
        const allowance = await readContract(config, {
          address: token.address, abi: erc20Abi, chainId, functionName: 'allowance', args: [user, vault.address],
        });
        if (allowance < amount) {
          await runWrite(config, 'approve', {
            address: token.address, abi: erc20Abi, chainId, functionName: 'approve', args: [vault.address, amount], account: user,
          }, setState);
        }
        await runWrite(config, 'deposit', {
          ...vault, functionName: 'deposit', args: [token.address, amount], account: user,
        }, setState);
        await invalidate();
      } catch {
        // state already reflects the failure
      }
    },
    [chainId, config, user, invalidate],
  );

  const reset = useCallback(() => setState({ status: 'idle' }), []);
  return { state, write, reset } as const;
}

/** depositETH() with value. Fails cleanly if the vault does not expose it. */
export function useDepositEth(chainId: SupportedChainId) {
  const config = useConfig();
  const { address: user } = useAccount();
  const invalidate = useInvalidateChainReads();
  const [state, setState] = useState<TxState>({ status: 'idle' });

  const write = useCallback(
    async (value: bigint) => {
      const vault = getVault(chainId);
      if (!vault || !user) {
        setState({ status: 'failed', step: 'depositETH', error: vault ? 'wallet not connected' : 'vault not deployed' });
        return;
      }
      try {
        await runWrite(config, 'depositETH', { ...vault, functionName: 'depositETH', value, account: user }, setState);
        await invalidate();
      } catch {
        // state already reflects the failure
      }
    },
    [chainId, config, user, invalidate],
  );

  const reset = useCallback(() => setState({ status: 'idle' }), []);
  return { state, write, reset } as const;
}

/** withdraw(token, amount) — idle balances only (product.md §3.6). */
export function useWithdraw(chainId: SupportedChainId) {
  const config = useConfig();
  const { address: user } = useAccount();
  const invalidate = useInvalidateChainReads();
  const [state, setState] = useState<TxState>({ status: 'idle' });

  const write = useCallback(
    async (token: TokenDef, amount: bigint) => {
      const vault = getVault(chainId);
      if (!vault || !user) {
        setState({ status: 'failed', step: 'withdraw', error: vault ? 'wallet not connected' : 'vault not deployed' });
        return;
      }
      if (amount <= 0n) {
        setState({ status: 'failed', step: 'withdraw', error: 'amount must be greater than zero' });
        return;
      }
      try {
        const idle = await readContract(config, { ...vault, functionName: 'idleBalance', args: [user, token.address] });
        if (amount > idle) {
          setState({ status: 'failed', step: 'withdraw', error: 'amount exceeds idle balance' });
          return;
        }
        await runWrite(config, 'withdraw', { ...vault, functionName: 'withdraw', args: [token.address, amount], account: user }, setState);
        await invalidate();
      } catch {
        // state already reflects the failure
      }
    },
    [chainId, config, user, invalidate],
  );

  const reset = useCallback(() => setState({ status: 'idle' }), []);
  return { state, write, reset } as const;
}

/** emergencyWithdraw() — all idle balances, always available. */
export function useEmergencyWithdraw(chainId: SupportedChainId) {
  const config = useConfig();
  const { address: user } = useAccount();
  const invalidate = useInvalidateChainReads();
  const [state, setState] = useState<TxState>({ status: 'idle' });

  const write = useCallback(async () => {
    const vault = getVault(chainId);
    if (!vault || !user) {
      setState({ status: 'failed', step: 'emergencyWithdraw', error: vault ? 'wallet not connected' : 'vault not deployed' });
      return;
    }
    try {
      await runWrite(config, 'emergencyWithdraw', { ...vault, functionName: 'emergencyWithdraw', account: user }, setState);
      await invalidate();
    } catch {
      // state already reflects the failure
    }
  }, [chainId, config, user, invalidate]);

  const reset = useCallback(() => setState({ status: 'idle' }), []);
  return { state, write, reset } as const;
}
