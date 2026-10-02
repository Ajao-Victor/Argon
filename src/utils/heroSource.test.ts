import { describe, expect, it } from 'vitest';

import type { Forecast, HourId } from '@/types/forecast';

import { selectHero } from './heroSource';

/** Live row captured 2026-10-02 06:00 UTC: txHash null, registry empty, keeper in dry-run. */
const H = 497478 as HourId;
const api: Forecast = {
  hourId: H, targetHourId: (H + 8) as HourId, submittedAt: '2026-10-02T06:00:28.109665+00:00',
  ethPct1h: -0.7195966124446285, ethPct2h: 0.07506381106900939, ethPct8h: -0.1747245103928985,
  ethPct1hSource: 'catchup', ethPct2hSource: 'catchup', ethPct8hSource: 'lgbm',
  spotUsd: 2717.565566787006, modelId: 'eth-1-2-8h-v1', status: 'pending', realizedPctChange: null, realizedSpotUsd: null,
  action: 'warmup', gate1hBps: 100, gate2hBps: 250, gate8hBps: 200, warmupComplete: false,
  forecastHash: '0x0ef143e4d2207e7dd7dd513e1b3f8de43f7b254658dba513dabcda28dda1b90f', txHash: null, txHashRh: null,
  rebalanceTx: 'warmup-skip', rebalanceTxRh: 'warmup-skip', poolStatusArb: 0, poolStatusRh: 0, trippedHorizons: [],
  predEthUsd8h: 2714.7483669398653, expectedEthUsd1h: 2739.2112715175417, barCloseUsd: 2719.5, live: true,
  ethPctChange: -0.1747245103928985, gateBps: 200,
};
const emptyRegistry = { chainPct: null, registryLatestHourId: 0 as HourId };

describe('selectHero', () => {
  it('renders the agent row even when the registry is empty and txHash is null', () => {
    const v = selectHero({ api, match: emptyRegistry, statusWarmupComplete: false, inPool: false });
    expect(v.source).toBe('api');
    expect(v.pct).toBe(api.ethPct8h);
    expect(v.predUsd).toBe(api.predEthUsd8h);
    expect(v.spotUsd).toBe(api.spotUsd);
    expect(v.action).toBe('warmup');
    expect(v.hourId).toBe(H);
  });
  it('a committed chain number never overrides a present agent row', () => {
    const v = selectHero({ api, match: { chainPct: 9.99, registryLatestHourId: H }, statusWarmupComplete: true, inPool: true });
    expect(v.source).toBe('api');
    expect(v.pct).toBe(api.ethPct8h);
  });
  it('falls back to the chain only without an agent row and with a committed registry forecast', () => {
    const v = selectHero({ api: undefined, match: { chainPct: -2.41, registryLatestHourId: H }, statusWarmupComplete: true, inPool: false });
    expect(v.source).toBe('chain');
    expect(v.pct).toBe(-2.41);
    expect(v.action).toBe('exit');
    expect(v.predUsd).toBeNull();
  });
  it('is empty with no agent row and an empty registry (never a fabricated number)', () => {
    const v = selectHero({ api: undefined, match: emptyRegistry, statusWarmupComplete: undefined, inPool: false });
    expect(v.source).toBe('none');
    expect(v.pct).toBeNull();
  });
});
