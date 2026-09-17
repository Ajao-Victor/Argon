import { describe, expect, it } from 'vitest';

import type { Forecast, Hex, HourId } from '@/types/forecast';

import { reconcileForecast, type RegistryRow } from './reconcile';

const H = 497104 as HourId;
const HASH = ('0x' + 'ab'.repeat(32)) as Hex;
const OTHER = ('0x' + 'cd'.repeat(32)) as Hex;

const api: Forecast = {
  hourId: H, targetHourId: (H + 8) as HourId, submittedAt: '2026-09-16T16:00:00.000Z', horizonHours: 8,
  ethPctChange: -2.41, ethLogReturn: -0.0244, spotUsd: 2410.12, modelId: 'eth-8h-v1', status: 'pending',
  realizedPctChange: null, realizedSpotUsd: null, action: 'exit', gateBps: 200, warmupComplete: true,
  txHash: null, forecastHash: HASH,
};

const row = (over: Partial<RegistryRow> = {}): RegistryRow => ({
  ethPctBps: -241n, targetHourId: (H + 8) as HourId, forecastHash: HASH, submittedAt: 0, submitter: '0x0000000000000000000000000000000000000001', ...over,
});

describe('reconcileForecast', () => {
  it('not deployed', () => {
    expect(reconcileForecast({ api, deployed: false, queryStatus: 'success', registryLatestHourId: H, registryRow: row() }).kind).toBe('not-deployed');
  });
  it('match on hash and bps', () => {
    expect(reconcileForecast({ api, deployed: true, queryStatus: 'success', registryLatestHourId: H, registryRow: row() }).kind).toBe('match');
  });
  it('mismatch on hash', () => {
    expect(reconcileForecast({ api, deployed: true, queryStatus: 'success', registryLatestHourId: H, registryRow: row({ forecastHash: OTHER }) }).kind).toBe('mismatch');
  });
  it('mismatch on bps even if hash matches', () => {
    expect(reconcileForecast({ api, deployed: true, queryStatus: 'success', registryLatestHourId: H, registryRow: row({ ethPctBps: -240n }) }).kind).toBe('mismatch');
  });
  it('api ahead of chain → pending, not red', () => {
    expect(reconcileForecast({ api, deployed: true, queryStatus: 'success', registryLatestHourId: (H - 1) as HourId, registryRow: undefined }).kind).toBe('pending-chain');
  });
  it('api behind chain → agent stale', () => {
    expect(reconcileForecast({ api, deployed: true, queryStatus: 'success', registryLatestHourId: (H + 1) as HourId, registryRow: row() }).kind).toBe('agent-stale');
  });
  it('chain read error', () => {
    expect(reconcileForecast({ api, deployed: true, queryStatus: 'error', registryLatestHourId: undefined, registryRow: undefined }).kind).toBe('error');
  });
  it('exposes chainPct for the fallback hero', () => {
    const r = reconcileForecast({ api, deployed: true, queryStatus: 'success', registryLatestHourId: H, registryRow: row() });
    expect(r.chainPct).toBe(-2.41);
  });
});
