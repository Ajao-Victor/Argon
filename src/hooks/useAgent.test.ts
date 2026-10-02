import { describe, expect, it } from 'vitest';

import type { PoolsResponse } from '@/types/agentApi';

import { agentKeys } from './useAgent';
import { POLL_POOLS_MS, poolForChain, poolsById } from './usePools';

/** Query-key and selector helpers the new hooks depend on. */
describe('agentKeys', () => {
  it('portfolio keys are case-insensitive on the address so a checksummed and a lowercase wallet share one cache entry', () => {
    const a = agentKeys.portfolio('0x9642b6D1Db5D1A3B0A61a831099568bbCbC04D4E');
    const b = agentKeys.portfolio('0x9642b6d1db5d1a3b0a61a831099568bbcbc04d4e');
    expect(a).toEqual(b);
    expect(agentKeys.portfolio(null)).toEqual(['agent', 'portfolio', null]);
  });
  it('every agent key is namespaced under "agent" so one invalidation refreshes the feed', () => {
    for (const k of [agentKeys.latest(), agentKeys.status(), agentKeys.health(), agentKeys.history(24), agentKeys.forecast(1), agentKeys.pools(), agentKeys.vault(), agentKeys.portfolio('0x1')]) {
      expect(k[0]).toBe('agent');
    }
  });
});

describe('poolForChain', () => {
  const pools = {
    updatedAt: '2026-10-01T13:53:17.551436+00:00', pollSeconds: 60, selectOneChain: true,
    pools: [
      { id: 'arbitrum', chainId: 42161, poolId: 1 } as PoolsResponse['pools'][number],
      { id: 'robinhood', chainId: 4663, poolId: 4 } as PoolsResponse['pools'][number],
    ],
  } satisfies PoolsResponse;
  it('selects by chain id', () => {
    expect(poolForChain(pools, 42161)?.poolId).toBe(1);
    expect(poolForChain(pools, 4663)?.poolId).toBe(4);
  });
  it('is undefined with no data', () => {
    expect(poolForChain(undefined, 42161)).toBeUndefined();
  });
  it('poolsById keys rows by the agent id, ignoring order and unknown ids', () => {
    const shuffled = { ...pools, pools: [pools.pools[1]!, { id: 'base', chainId: 8453, poolId: 9 } as unknown as PoolsResponse['pools'][number], pools.pools[0]!] };
    const m = poolsById(shuffled);
    expect(m.arbitrum?.poolId).toBe(1);
    expect(m.robinhood?.poolId).toBe(4);
    expect(Object.keys(m)).toEqual(['robinhood', 'arbitrum']);
  });
  it('polls every 15 s as the agent advertises', () => {
    expect(POLL_POOLS_MS).toBe(15_000);
  });
});
