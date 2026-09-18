import { describe, expect, it } from 'vitest';

import { agentStatusSchema, forecastListSchema, forecastSchema } from './forecast';

/** Malformed agent payloads must fail validation, never reach the UI (CLAUDE.md §0.6, agents.md §4). */
const H = 497104;
const HASH = '0x' + 'ab'.repeat(32);
const valid = {
  hourId: H, targetHourId: H + 8, submittedAt: '2026-09-16T16:00:00.000Z', horizonHours: 8,
  ethPctChange: -2.41, ethLogReturn: -0.0244, spotUsd: 2410.12, modelId: 'eth-8h-v1', status: 'pending',
  realizedPctChange: null, realizedSpotUsd: null, action: 'exit', gateBps: 200, warmupComplete: true,
  txHash: HASH, forecastHash: HASH,
};

describe('forecastSchema', () => {
  it('accepts the reference payload', () => {
    expect(forecastSchema.safeParse(valid).success).toBe(true);
  });
  it('ignores extra fields', () => {
    expect(forecastSchema.safeParse({ ...valid, extra: 1 }).success).toBe(true);
  });
  it.each([
    ['short hash', { forecastHash: '0xabc' }],
    ['non-hex hash', { txHash: '0x' + 'zz'.repeat(32) }],
    ['string percent', { ethPctChange: '-2.41' }],
    ['NaN percent', { ethPctChange: Number.NaN }],
    ['Infinity percent', { ethPctChange: Number.POSITIVE_INFINITY }],
    ['impossible percent', { ethPctChange: -150 }],
    ['unknown action', { action: 'yolo' }],
    ['wrong horizon', { horizonHours: 1 }],
    ['target hour mismatch', { targetHourId: H + 7 }],
    ['non-integer hourId', { hourId: 1.5 }],
    ['negative hourId', { hourId: -1 }],
    ['bad timestamp', { submittedAt: 'yesterday' }],
    ['zero spot', { spotUsd: 0 }],
    ['warmup incomplete but action enter', { warmupComplete: false, action: 'enter' }],
    ['missing field', { status: undefined }],
  ])('rejects %s', (_label, patch) => {
    expect(forecastSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
  it('rejects non-objects without throwing', () => {
    expect(() => forecastSchema.safeParse(null)).not.toThrow();
    expect(forecastSchema.safeParse(null).success).toBe(false);
    expect(forecastSchema.safeParse('<html>').success).toBe(false);
  });
});

describe('agentStatusSchema / forecastListSchema', () => {
  it('bounds hoursUntilFirstDecision to the 8 h warmup', () => {
    expect(agentStatusSchema.safeParse({ ok: true, warmupComplete: false, hoursUntilFirstDecision: 9, gateBps: 200, lastHourId: H, modelId: 'x', modelLoaded: true }).success).toBe(false);
  });
  it('rejects a list containing one bad row', () => {
    expect(forecastListSchema.safeParse({ items: [valid, { ...valid, forecastHash: '0x1' }] }).success).toBe(false);
  });
});

describe('development fixture', () => {
  it('every generated row satisfies the strict schema', async () => {
    const { buildFixture } = await import('@/services/fixtures/forecasts');
    const rows = buildFixture(new Date('2026-09-18T12:00:00Z'));
    expect(rows).toHaveLength(24);
    for (const r of rows) {
      const res = forecastSchema.safeParse(r);
      expect(res.success, `hourId ${r.hourId}: ${res.success ? '' : res.error.message}`).toBe(true);
    }
    expect(forecastListSchema.safeParse({ items: rows }).success).toBe(true);
  });
});
