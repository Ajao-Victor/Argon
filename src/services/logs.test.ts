import { describe, expect, it, vi } from 'vitest';
import type { PublicClient } from 'viem';

import { VAULT_DEPLOY_BLOCK } from './contracts';
import { MAX_LOG_WINDOW_BLOCKS, fetchVaultActivity, logWindows, sortNewestFirst, type ActivityEvent } from './logs';

const VAULT = '0x9F844b4D1b28Be7413067f9d4fC08Bc276fd1C60';
const USER = '0x9642b6D1Db5D1A3B0A61a831099568bbCbC04D4E';

/** A PublicClient stub that records every getLogs range and returns canned logs. */
function fakeClient(latest: bigint, logsByEvent: Record<string, unknown[]> = {}) {
  const calls: Array<{ event: string; fromBlock: bigint; toBlock: bigint }> = [];
  const client = {
    getBlockNumber: vi.fn(async () => latest),
    getLogs: vi.fn(async (p: { event: { name: string }; fromBlock: bigint; toBlock: bigint }) => {
      calls.push({ event: p.event.name, fromBlock: p.fromBlock, toBlock: p.toBlock });
      return logsByEvent[p.event.name] ?? [];
    }),
  } as unknown as PublicClient;
  return { client, calls };
}

describe('logWindows', () => {
  it('one window when the span fits', () => {
    expect(logWindows(100n, 100n + MAX_LOG_WINDOW_BLOCKS)).toEqual([{ fromBlock: 100n, toBlock: 100n + MAX_LOG_WINDOW_BLOCKS }]);
  });
  it('splits above the max into consecutive, non-overlapping windows ending at head', () => {
    const from = 0n;
    const to = MAX_LOG_WINDOW_BLOCKS * 2n + 5n; // 3 windows
    const w = logWindows(from, to);
    expect(w).toHaveLength(3);
    expect(w[0]).toEqual({ fromBlock: 0n, toBlock: MAX_LOG_WINDOW_BLOCKS - 1n });
    expect(w[1]?.fromBlock).toBe(MAX_LOG_WINDOW_BLOCKS);
    expect(w[2]?.toBlock).toBe(to);
    for (let i = 1; i < w.length; i++) expect(w[i]?.fromBlock).toBe((w[i - 1]?.toBlock ?? 0n) + 1n);
  });
  it('empty when head is behind the start', () => {
    expect(logWindows(10n, 5n)).toEqual([]);
  });
});

describe('fetchVaultActivity', () => {
  it('scans from the deployment block to head in one call per event type', async () => {
    const latest = VAULT_DEPLOY_BLOCK[42161] + 1_000_000n;
    const { client, calls } = fakeClient(latest);
    await fetchVaultActivity({ client, chainId: 42161, vault: VAULT, user: USER });
    expect(calls).toHaveLength(3);
    for (const c of calls) {
      expect(c.fromBlock).toBe(VAULT_DEPLOY_BLOCK[42161]);
      expect(c.toBlock).toBe(latest);
    }
    expect(new Set(calls.map((c) => c.event))).toEqual(new Set(['Deposited', 'Withdrawn', 'Rebalanced']));
  });
  it('splits into parallel windows when the span exceeds 9.5 M blocks', async () => {
    const latest = VAULT_DEPLOY_BLOCK[4663] + MAX_LOG_WINDOW_BLOCKS * 2n + 1n; // 3 windows
    const { client, calls } = fakeClient(latest);
    await fetchVaultActivity({ client, chainId: 4663, vault: VAULT, user: USER });
    expect(calls).toHaveLength(9); // 3 windows × 3 events
    expect(Math.max(...calls.map((c) => Number(c.toBlock - c.fromBlock)))).toBeLessThanOrEqual(Number(MAX_LOG_WINDOW_BLOCKS));
  });
  it('skips user-scoped events without a wallet', async () => {
    const { client, calls } = fakeClient(VAULT_DEPLOY_BLOCK[42161] + 10n);
    await fetchVaultActivity({ client, chainId: 42161, vault: VAULT, user: undefined });
    expect(calls.map((c) => c.event)).toEqual(['Rebalanced']);
  });
  it('orders newest block first, then highest log index', () => {
    const e = (blockNumber: bigint, logIndex: number): ActivityEvent => ({ kind: 'Rebalanced', chainId: 42161, blockNumber, txHash: '0x', logIndex });
    const sorted = sortNewestFirst([e(5n, 0), e(7n, 1), e(7n, 3), e(6n, 0)]);
    expect(sorted.map((x) => [x.blockNumber, x.logIndex])).toEqual([[7n, 3], [7n, 1], [6n, 0], [5n, 0]]);
  });
});
