import { describe, expect, it } from 'vitest';

import { computeForecastHash, roundHalfEven, verifyForecastHash } from '@/utils/forecastHash';

import { agentStatusSchema, forecastListSchema, forecastSchema, healthSchema, isTransactionHash } from './forecast';

/**
 * The reference rows below are verbatim captures from the live Heroku agent on
 * 2026-10-01 (GET /forecasts/latest, /status, /health). The schemas must accept them
 * 100 %; malformed variants must be rejected without throwing (ENGINEERING.md §0.6).
 */
const LIVE_FORECAST = {
  hourId: 497434, targetHourId: 497442, submittedAt: '2026-09-30T10:00:12.238927+00:00',
  ethPct1h: -0.009529417765063997, ethPct2h: -0.13206519240578363, ethPct8h: -0.3860876579837247,
  ethPct1hSource: 'persistence', ethPct2hSource: 'persistence', ethPct8hSource: 'lgbm',
  spotUsd: 2688.2571423216777, modelId: 'eth-1-2-8h-v1', status: 'pending',
  realizedPctChange: null, realizedSpotUsd: null, action: 'warmup',
  gate1hBps: 100, gate2hBps: 250, gate8hBps: 200, warmupComplete: false,
  forecastHash: '0x1db0b9d6064bfcba03285dfb5430e357f10f61097ae726986e00319a6f04451e',
  txHash: null, txHashRh: null, rebalanceTx: 'warmup-skip', rebalanceTxRh: 'warmup-skip',
  poolStatusArb: 0, poolStatusRh: 0, trippedHorizons: [],
};

const LIVE_STATUS = {
  ok: true, warmupComplete: false, hoursUntilFirstDecision: 7, gate1hBps: 100, gate2hBps: 250, gate8hBps: 200,
  lastHourId: 497434, currentHourId: 497461, modelId: 'eth-1-2-8h-v1', modelLoaded: true, dryRun: 'true', database: 'postgres',
};

const LIVE_HEALTH = { ok: true, modelLoaded: true, database: 'postgres' };

describe('live payloads (captured 2026-10-01)', () => {
  it('accepts the live forecast row and derives the 8 h headline', () => {
    const res = forecastSchema.safeParse(LIVE_FORECAST);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.ethPctChange).toBe(LIVE_FORECAST.ethPct8h);
      expect(res.data.gateBps).toBe(200);
    }
  });
  it('accepts the live status row and coerces dryRun', () => {
    const res = agentStatusSchema.safeParse(LIVE_STATUS);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.dryRun).toBe(true);
      expect(res.data.gateBps).toBe(200);
    }
  });
  it('accepts the live health row', () => {
    expect(healthSchema.safeParse(LIVE_HEALTH).success).toBe(true);
  });
  it('recomputes the published forecastHash from the published numbers', () => {
    // keccak256(abi.encode(uint64 hourId, int256 bps1h, int256 bps2h, int256 bps8h, keccak256("eth-1-2-8h-v1")))
    expect(computeForecastHash(LIVE_FORECAST)).toBe(LIVE_FORECAST.forecastHash);
    expect(verifyForecastHash(LIVE_FORECAST)).toBe(true);
  });
  it('detects a tampered number', () => {
    expect(verifyForecastHash({ ...LIVE_FORECAST, ethPct8h: -0.4 })).toBe(false);
  });
});

describe('forecastSchema rejects malformed rows', () => {
  it.each([
    ['short hash', { forecastHash: '0xabc' }],
    ['non-hex tx hash', { txHash: '0x' + 'zz'.repeat(32) }],
    ['string percent', { ethPct8h: '-0.38' }],
    ['NaN percent', { ethPct1h: Number.NaN }],
    ['impossible percent', { ethPct2h: -150 }],
    ['unknown action', { action: 'yolo' }],
    ['unknown horizon', { trippedHorizons: ['4h'] }],
    ['pool status out of range', { poolStatusArb: 2 }],
    ['target hour mismatch', { targetHourId: 497441 }],
    ['non-integer hourId', { hourId: 1.5 }],
    ['bad timestamp', { submittedAt: 'yesterday' }],
    ['zero spot', { spotUsd: 0 }],
    ['warmup incomplete but action enter', { warmupComplete: false, action: 'enter' }],
    ['missing field', { status: undefined }],
  ])('rejects %s', (_label, patch) => {
    expect(forecastSchema.safeParse({ ...LIVE_FORECAST, ...patch }).success).toBe(false);
  });
  it('rejects non-objects without throwing', () => {
    expect(() => forecastSchema.safeParse(null)).not.toThrow();
    expect(forecastSchema.safeParse(null).success).toBe(false);
    expect(forecastSchema.safeParse('<html>').success).toBe(false);
  });
  it('rejects a list containing one bad row', () => {
    expect(forecastListSchema.safeParse({ items: [LIVE_FORECAST, { ...LIVE_FORECAST, forecastHash: '0x1' }] }).success).toBe(false);
  });
});

describe('idempotent on-chain submission markers', () => {
  it('accepts the live already:<hourId> result without discarding the forecast', () => {
    const res = forecastSchema.safeParse({
      ...LIVE_FORECAST,
      warmupComplete: true,
      action: 'hold',
      txHash: 'already:497526',
      txHashRh: 'already:497526',
    });
    expect(res.success, res.success ? '' : res.error.message).toBe(true);
    if (res.success) {
      expect(res.data.txHash).toBe('already:497526');
      expect(isTransactionHash(res.data.txHash)).toBe(false);
    }
  });

  it('links only genuine 32-byte transaction hashes', () => {
    expect(isTransactionHash('0x' + 'ab'.repeat(32))).toBe(true);
    expect(isTransactionHash('already:497526')).toBe(false);
    expect(isTransactionHash('0xnot-a-hash')).toBe(false);
  });

  it('still rejects arbitrary status strings in transaction fields', () => {
    expect(forecastSchema.safeParse({ ...LIVE_FORECAST, txHash: 'submitted somehow' }).success).toBe(false);
  });
});

describe('bps rounding matches the agent (Python round = half to even)', () => {
  it.each([
    [-0.95, -1],
    [-13.2, -13],
    [-38.6, -39],
    [0.5, 0],
    [1.5, 2],
    [2.5, 2],
    [-0.5, 0],
    [-1.5, -2],
  ])('roundHalfEven(%s) = %s', (x, expected) => {
    expect(roundHalfEven(x)).toBe(expected);
  });
});

describe('development fixture', () => {
  it('every generated row satisfies the live schema and its hash verifies', async () => {
    const { buildFixture } = await import('@/services/fixtures/forecasts');
    const rows = buildFixture(new Date('2026-10-01T12:00:00Z'));
    expect(rows).toHaveLength(24);
    for (const r of rows) {
      const res = forecastSchema.safeParse(r);
      expect(res.success, `hourId ${r.hourId}: ${res.success ? '' : res.error.message}`).toBe(true);
      expect(verifyForecastHash(r)).toBe(true);
    }
    expect(forecastListSchema.safeParse({ items: rows }).success).toBe(true);
  });
});

describe('live row captured 2026-10-02 (new agent fields, catchup sources, empty registry)', () => {
  const ROW = {
    hourId: 497478, targetHourId: 497486, submittedAt: '2026-10-02T06:00:28.109665+00:00',
    predEthUsd8h: 2714.7483669398653, barCloseUsd: 2719.5, expectedEthUsd1h: 2739.2112715175417,
    ethPct1h: -0.7195966124446285, ethPct2h: 0.07506381106900939, ethPct8h: -0.1747245103928985,
    ethPct1hSource: 'catchup', ethPct2hSource: 'catchup', ethPct8hSource: 'lgbm',
    spotUsd: 2717.565566787006, modelId: 'eth-1-2-8h-v1', status: 'pending', realizedPctChange: null, realizedSpotUsd: null,
    action: 'warmup', gate1hBps: 100, gate2hBps: 250, gate8hBps: 200, warmupComplete: false,
    forecastHash: '0x0ef143e4d2207e7dd7dd513e1b3f8de43f7b254658dba513dabcda28dda1b90f', txHash: null, txHashRh: null,
    rebalanceTx: 'warmup-skip', rebalanceTxRh: 'warmup-skip', poolStatusArb: 0, poolStatusRh: 0,
    barTime: '2026-10-02T05:00:00+00:00', barHourId: 497477, live: true, trippedHorizons: [],
  };
  const STATUS = {
    ok: true, warmupComplete: false, hoursUntilFirstDecision: 9, gate1hBps: 100, gate2hBps: 250, gate8hBps: 200,
    lastHourId: 497478, currentHourId: 497478, liveForecast: true, modelId: 'eth-1-2-8h-v1', modelLoaded: true, dryRun: 'true',
    database: 'postgres', onchainForecastCount: 0, dbForecastCount: 15,
  };
  it('validates with txHash null, a new source label, and the new price fields', () => {
    const r = forecastSchema.safeParse(ROW);
    expect(r.success, r.success ? '' : r.error.message).toBe(true);
    if (r.success) {
      expect(r.data.predEthUsd8h).toBe(ROW.predEthUsd8h);
      expect(r.data.ethPctChange).toBe(ROW.ethPct8h);
    }
  });
  it('validates the status row with the new counters', () => {
    const r = agentStatusSchema.safeParse(STATUS);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.onchainForecastCount).toBe(0);
  });
  it('the published hash still recomputes from its numbers', () => {
    expect(computeForecastHash(ROW)).toBe(ROW.forecastHash);
  });
  it('a future unknown source label still validates', () => {
    expect(forecastSchema.safeParse({ ...ROW, ethPct8hSource: 'ensemble-v2' }).success).toBe(true);
  });
});

describe('handoff 2026-10-02: last stored hour (live:false), residual sources, status counters', () => {
  const STORED_ROW = {
    hourId: 497479, targetHourId: 497487, submittedAt: '2026-10-02T07:00:30.000000+00:00',
    predEthUsd8h: 2701.12, barCloseUsd: 2705.0, expectedEthUsd1h: 2698.4,
    ethPct1h: -0.22, ethPct2h: 0.05, ethPct8h: -0.1434,
    ethPct1hSource: 'residual', ethPct2hSource: 'residual', ethPct8hSource: 'lgbm',
    spotUsd: 2703.1, modelId: 'eth-1-2-8h-v1', status: 'pending', realizedPctChange: null, realizedSpotUsd: null,
    action: 'warmup', gate1hBps: 100, gate2hBps: 250, gate8hBps: 200, warmupComplete: false,
    forecastHash: null, txHash: null, txHashRh: null, rebalanceTx: 'warmup-skip', rebalanceTxRh: 'warmup-skip',
    poolStatusArb: 0, poolStatusRh: 0, barTime: '2026-10-02T06:00:00+00:00', barHourId: 497478, live: false, trippedHorizons: [],
  };
  it('a 200 with live:false is a valid row — the hero renders it with a stale banner, never "no forecast"', () => {
    const r = forecastSchema.safeParse(STORED_ROW);
    expect(r.success, r.success ? '' : r.error.message).toBe(true);
    if (r.success) {
      expect(r.data.live).toBe(false);
      expect(r.data.predEthUsd8h).toBe(2701.12);
      expect(r.data.barCloseUsd).toBe(2705.0);
      expect(r.data.expectedEthUsd1h).toBe(2698.4);
      expect(r.data.ethPct1hSource).toBe('residual');
    }
  });
  it('txHash null and onchainForecastCount 0 only mean dry-run; the numbers stay valid', () => {
    const status = agentStatusSchema.safeParse({
      ok: true, warmupComplete: false, hoursUntilFirstDecision: 0, gate1hBps: 100, gate2hBps: 250, gate8hBps: 200,
      lastHourId: 497479, currentHourId: 497479, liveForecast: true, modelId: 'eth-1-2-8h-v1', modelLoaded: true, dryRun: 'true',
      database: 'postgres', onchainForecastCount: 0, dbForecastCount: 19,
    });
    expect(status.success).toBe(true);
    if (status.success) {
      // Warmup bar inputs (handoff): filled = 9 − hoursUntilFirstDecision; countdown = hoursUntilFirstDecision; submits = onchainForecastCount.
      expect(9 - status.data.hoursUntilFirstDecision).toBe(9);
      expect(status.data.onchainForecastCount).toBe(0);
      expect(status.data.dbForecastCount).toBe(19);
      expect(status.data.dryRun).toBe(true);
    }
  });
});

describe('/status.newsPause (added by the agent on 2026-10-03)', () => {
  const BASE = {
    ok: true, warmupComplete: false, hoursUntilFirstDecision: 0, gate1hBps: 100, gate2hBps: 250, gate8hBps: 200,
    lastHourId: 497508, currentHourId: 497508, liveForecast: true, modelId: 'eth-1-2-8h-v1', modelLoaded: true, dryRun: 'true',
    database: 'postgres', onchainForecastCount: 0, dbForecastCount: 45,
  };
  const WINDOW = { fromHourId: 497771, untilHourId: 497776, exitAt: '2026-10-14T11:00:00+00:00', resumesAt: '2026-10-14T16:00:00+00:00', events: [{ title: 'CPI', at: '2026-10-14T12:30:00+00:00', source: 'official' }] };
  it('parses the live object with a scheduled next window', () => {
    const r = agentStatusSchema.safeParse({ ...BASE, newsPause: { active: false, current: null, next: WINDOW, rule: 'exit 1h before the release hour; no entries until 4h after it' } });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.newsPause?.active).toBe(false);
      expect(r.data.newsPause?.next?.events[0]?.title).toBe('CPI');
    }
  });
  it('parses an active window', () => {
    const r = agentStatusSchema.safeParse({ ...BASE, newsPause: { active: true, current: WINDOW, next: null, rule: 'x' } });
    expect(r.success && r.data.newsPause?.active).toBe(true);
  });
  it('a malformed pause object never invalidates /status', () => {
    const r = agentStatusSchema.safeParse({ ...BASE, newsPause: { active: 'yes' } });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.newsPause).toBeUndefined();
  });
  it('status without the field still parses', () => {
    expect(agentStatusSchema.safeParse(BASE).success).toBe(true);
  });
});
