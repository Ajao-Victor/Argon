/**
 * @file useVault — reads and writes against the deployed ArgonVault.
 *
 * Reads (pool status, idle balances, shares, params) key on the pool's chain id, never the
 * wallet's. Writes follow one path: simulate → sign → wait for receipt → invalidate the
 * chain reads and the agent's portfolio and vault snapshots. Transaction state is a local
 * discriminated union mirrored into toasts; balances are never optimistic.
 */
'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { BaseError, UserRejectedRequestError, erc20Abi, type Address, type Hash, type TransactionReceipt } from 'viem';
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
import { toast } from '@/components/ui/Toasts';

/**
 * Vault hooks (doc/architecture.md §2.1, §2.5) against the deployed ArgonVault.
 * Every read passes `chainId` explicitly from the pool definition, never from the
 * wallet's chain (ENGINEERING.md §2). Writes: simulate → sign → wait for receipt →
 * invalidate. No optimistic balances.
 *
 * Deployed accounting: shares are USD-denominated; `withdraw(shares)` flattens any LP
 * position first and pays pro-rata WETH + stable; `emergencyWithdraw()` burns the whole
 * balance. There is no per-token withdraw on this contract.
 */
export const VAULT_READ_STALE_MS = 15_000;

/** readContracts with a conditional contracts array widens results to unknown; narrow at runtime, never cast. */
function asBigInt(v: unknown): bigint {
  return typeof v === 'bigint' ? v : 0n;
}
export const VAULT_PARAMS_STALE_MS = 5 * 60_000;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** warmupComplete (registry.forecastCount() >= 9), totalShares, and the two escrowed tokens. */
export function useVaultParams(chainId: SupportedChainId) {
  const vault = getVault(chainId);
  return useReadContracts({
    contracts: vault
      ? [
          { ...vault, functionName: 'warmupComplete' },
          { ...vault, functionName: 'totalShares' },
          { ...vault, functionName: 'weth' },
          { ...vault, functionName: 'stable' },
        ]
      : [],
    allowFailure: true,
    query: {
      enabled: Boolean(vault),
      staleTime: VAULT_PARAMS_STALE_MS,
      select: (rows) => ({
        warmupComplete: rows[0]?.status === 'success' ? Boolean(rows[0].result) : undefined,
        totalShares: rows[1]?.status === 'success' ? asBigInt(rows[1].result) : undefined,
        weth: rows[2]?.status === 'success' ? (rows[2].result as Address) : undefined,
        stable: rows[3]?.status === 'success' ? (rows[3].result as Address) : undefined,
      }),
    },
  });
}

/** poolStatus for every pool on one chain, in one multicall. Keyed by poolId. */
export function usePoolStatuses(chainId: SupportedChainId) {
  const vault = getVault(chainId);
  // Only gated pools are configured on-chain; poolStatus(2) / poolStatus(3) revert with UnknownPool.
  const pools = POOLS.filter((p) => p.chainId === chainId && p.gated);
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

/** idleBalance per deposit token + shareBalance + totalShares, for the connected user, on one chain. */
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
            { ...vault, functionName: 'totalShares' as const },
          ]
        : [],
    allowFailure: true,
    query: {
      enabled,
      staleTime: VAULT_READ_STALE_MS,
      select: (rows) => {
        const idle: VaultBalance[] = tokens.map((token, i) => {
          const r = rows[i];
          return { token, idle: r?.status === 'success' ? asBigInt(r.result) : 0n };
        });
        const shareRow = rows[tokens.length];
        const totalRow = rows[tokens.length + 1];
        const shares = shareRow?.status === 'success' ? asBigInt(shareRow.result) : 0n;
        const totalShares = totalRow?.status === 'success' ? asBigInt(totalRow.result) : 0n;
        const funded = shares > 0n || idle.some((b) => b.idle > 0n);
        return { idle, shares, totalShares, funded };
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
        balance: rows[0]?.status === 'success' ? asBigInt(rows[0].result) : 0n,
        allowance: rows[1]?.status === 'success' ? asBigInt(rows[1].result) : 0n,
      }),
    },
  });
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type TxStep = 'approve' | 'deposit' | 'depositETH' | 'withdraw' | 'emergencyWithdraw';

/** Local discriminated union per write (ENGINEERING.md §1.2, architecture.md §2.5). */
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

/** viem wraps wallet errors; walk the cause chain for the typed 4001 rejection. */
function isUserRejection(err: unknown): boolean {
  if (err instanceof BaseError) return err.walk((e) => e instanceof UserRejectedRequestError) !== null;
  return false;
}

/** A dropped or replaced transaction must not leave the UI mining forever. */
export const RECEIPT_TIMEOUT_MS = 5 * 60_000;

function useInvalidateChainReads() {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['readContract'] }),
      queryClient.invalidateQueries({ queryKey: ['readContracts'] }),
      queryClient.invalidateQueries({ queryKey: ['balance'] }),
      queryClient.invalidateQueries({ queryKey: ['logs'] }),
      // Agent-side USD views (HANDOVER: refetch portfolio on tx receipt)
      queryClient.invalidateQueries({ queryKey: ['agent', 'portfolio'] }),
      queryClient.invalidateQueries({ queryKey: ['agent', 'vault'] }),
    ]);
  }, [queryClient]);
}

/**
 * Runs one contract write end-to-end and drives `setState`. Shared by every write hook.
 * Returns the receipt or throws. Never mutates balances itself.
 */
type WriteArgs = SimulateContractParameters;

const STEP_TITLE: Record<TxStep, string> = {
  approve: 'approve token',
  deposit: 'deposit to vault',
  depositETH: 'deposit ETH to vault',
  withdraw: 'withdraw idle',
  emergencyWithdraw: 'emergency idle withdraw',
};

async function runWrite(
  config: ReturnType<typeof useConfig>,
  step: TxStep,
  args: WriteArgs,
  setState: (s: TxState) => void,
): Promise<{ hash: Hash; receipt: TransactionReceipt }> {
  const chainId = args.chainId as SupportedChainId | undefined;
  const toastId = `tx-${step}-${Date.now()}`;
  const title = STEP_TITLE[step];

  setState({ status: 'simulating', step });
  toast.push({ id: toastId, kind: 'info', title, detail: 'simulating…' });
  let request: Awaited<ReturnType<typeof simulateContract>>['request'];
  try {
    ({ request } = await simulateContract(config, args));
  } catch (err) {
    const error = txErrorMessage(err);
    setState({ status: 'failed', step, error });
    toast.update(toastId, { kind: 'error', detail: `simulation reverted · ${error}`, ttl: 8_000 });
    throw err;
  }

  setState({ status: 'awaitingSignature', step });
  toast.update(toastId, { kind: 'signing', detail: 'confirm in your wallet' });
  // Quiet main thread while the wallet prompt is up (doc/architecture.md §4.3).
  pauseSimulation('signing');
  let hash: Hash;
  try {
    hash = await writeContract(config, request);
  } catch (err) {
    const error = isUserRejection(err) ? 'signature rejected' : txErrorMessage(err);
    setState({ status: 'failed', step, error });
    toast.update(toastId, { kind: 'error', detail: error, ttl: 6_000 });
    throw err;
  } finally {
    resumeSimulation('signing');
  }

  setState({ status: 'pending', step, hash });
  toast.update(toastId, { kind: 'mining', detail: 'waiting for receipt', hash, chainId });
  try {
    const receipt = await waitForTransactionReceipt(config, { hash, chainId: args.chainId, timeout: RECEIPT_TIMEOUT_MS });
    if (receipt.status !== 'success') {
      setState({ status: 'failed', step, error: 'transaction reverted', hash });
      toast.update(toastId, { kind: 'error', detail: 'transaction reverted on-chain', hash, chainId, ttl: 10_000 });
      throw new Error('transaction reverted');
    }
    setState({ status: 'confirmed', step, hash, receipt });
    toast.update(toastId, { kind: 'success', detail: `confirmed in block ${receipt.blockNumber.toString()}`, hash, chainId, ttl: 7_000 });
    return { hash, receipt };
  } catch (err) {
    const error = /timed out|timeout/i.test(txErrorMessage(err))
      ? `no receipt after ${RECEIPT_TIMEOUT_MS / 60_000} min — check the explorer; the transaction may have been dropped or replaced`
      : txErrorMessage(err);
    setState({ status: 'failed', step, error, hash });
    toast.update(toastId, { kind: 'error', detail: error, hash, chainId, ttl: 12_000 });
    throw err;
  }
}

/**
 * Wraps a write hook body: refuses re-entry while busy, and guarantees that any
 * failure outside runWrite (a pre-read RPC error, a thrown invariant) still lands
 * in the failed state instead of leaving the form silently idle.
 */
function useGuardedWrite(step: TxStep) {
  const busy = useRef(false);
  const [state, setState] = useState<TxState>({ status: 'idle' });
  const run = useCallback(
    async (body: () => Promise<void>) => {
      if (busy.current) return;
      busy.current = true;
      try {
        await body();
      } catch (err) {
        setState((prev) => (prev.status === 'failed' ? prev : { status: 'failed', step, error: txErrorMessage(err) }));
      } finally {
        busy.current = false;
      }
    },
    [step],
  );
  const reset = useCallback(() => {
    if (!busy.current) setState({ status: 'idle' });
  }, []);
  return { state, setState, run, reset } as const;
}

/** approve (if needed) → deposit(token, amount). */
export function useDeposit(chainId: SupportedChainId) {
  const config = useConfig();
  const { address: user } = useAccount();
  const invalidate = useInvalidateChainReads();
  const { state, setState, run, reset } = useGuardedWrite('deposit');

  const write = useCallback(
    (token: TokenDef, amount: bigint) =>
      run(async () => {
        const vault = getVault(chainId);
        if (!vault || !user) {
          setState({ status: 'failed', step: 'deposit', error: vault ? 'wallet not connected' : 'vault not deployed' });
          return;
        }
        if (amount <= 0n) {
          setState({ status: 'failed', step: 'deposit', error: 'amount must be greater than zero' });
          return;
        }
        setState({ status: 'simulating', step: 'approve' });
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
      }),
    [chainId, config, user, invalidate, run, setState],
  );

  return { state, write, reset } as const;
}

/** depositETH() with value. Spec §4.5 optional; not wired into a form until the vault exposes it. */
export function useDepositEth(chainId: SupportedChainId) {
  const config = useConfig();
  const { address: user } = useAccount();
  const invalidate = useInvalidateChainReads();
  const { state, setState, run, reset } = useGuardedWrite('depositETH');

  const write = useCallback(
    (value: bigint) =>
      run(async () => {
        const vault = getVault(chainId);
        if (!vault || !user) {
          setState({ status: 'failed', step: 'depositETH', error: vault ? 'wallet not connected' : 'vault not deployed' });
          return;
        }
        if (value <= 0n) {
          setState({ status: 'failed', step: 'depositETH', error: 'amount must be greater than zero' });
          return;
        }
        await runWrite(config, 'depositETH', { ...vault, functionName: 'depositETH', value, account: user }, setState);
        await invalidate();
      }),
    [chainId, config, user, invalidate, run, setState],
  );

  return { state, write, reset } as const;
}

/**
 * withdraw(shares) — burns shares and pays pro-rata WETH + stable (the vault flattens
 * LP first if needed). The share balance is re-read on-chain right before signing so a
 * stale UI can never over-burn: fail closed (ENGINEERING.md §0.6).
 */
export function useWithdraw(chainId: SupportedChainId) {
  const config = useConfig();
  const { address: user } = useAccount();
  const invalidate = useInvalidateChainReads();
  const { state, setState, run, reset } = useGuardedWrite('withdraw');

  const write = useCallback(
    (shares: bigint) =>
      run(async () => {
        const vault = getVault(chainId);
        if (!vault || !user) {
          setState({ status: 'failed', step: 'withdraw', error: vault ? 'wallet not connected' : 'vault not deployed' });
          return;
        }
        if (shares <= 0n) {
          setState({ status: 'failed', step: 'withdraw', error: 'shares must be greater than zero' });
          return;
        }
        setState({ status: 'simulating', step: 'withdraw' });
        const balance = await readContract(config, { ...vault, functionName: 'shareBalance', args: [user] });
        if (shares > balance) {
          setState({ status: 'failed', step: 'withdraw', error: 'shares exceed your balance' });
          return;
        }
        await runWrite(config, 'withdraw', { ...vault, functionName: 'withdraw', args: [shares], account: user }, setState);
        await invalidate();
      }),
    [chainId, config, user, invalidate, run, setState],
  );

  return { state, write, reset } as const;
}

/** emergencyWithdraw() — burns the caller's entire share balance; allowed while the keeper is paused. */
export function useEmergencyWithdraw(chainId: SupportedChainId) {
  const config = useConfig();
  const { address: user } = useAccount();
  const invalidate = useInvalidateChainReads();
  const { state, setState, run, reset } = useGuardedWrite('emergencyWithdraw');

  const write = useCallback(
    () =>
      run(async () => {
        const vault = getVault(chainId);
        if (!vault || !user) {
          setState({ status: 'failed', step: 'emergencyWithdraw', error: vault ? 'wallet not connected' : 'vault not deployed' });
          return;
        }
        await runWrite(config, 'emergencyWithdraw', { ...vault, functionName: 'emergencyWithdraw', account: user }, setState);
        await invalidate();
      }),
    [chainId, config, user, invalidate, run, setState],
  );

  return { state, write, reset } as const;
}
