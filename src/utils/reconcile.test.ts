import { describe, expect, it } from 'vitest';

import type { Forecast, Hex, HourId } from '@/types/forecast';

import { reconcileForecast, type RegistryRow } from './reconcile';

const H = 497104 as HourId;
const HASH = ('0x' + 'ab'.repeat(32)) as Hex;
const OTHER = ('0x' + 'cd'.repeat(32)) as Hex;

const api: Forecast = {
  hourId: H, targetHourId: (H + 8) as HourId, submittedAt: '2026-09-16T16:00:00.000Z',
  ethPct1h: -0.3, ethPct2h: -0.9, ethPct8h: -2.41, ethPct1hSource: 'persistence', ethPct2hSource: 'persistence', ethPct8hSource: 'lgbm',
  spotUsd: 2410.12, modelId: 'eth-1-2-8h-v1', status: 'pending', realizedPctChange: null, realizedSpotUsd: null, action: 'exit',
  gate1hBps: 100, gate2hBps: 250, gate8hBps: 200, warmupComplete: true, forecastHash: HASH, txHash: null, txHashRh: null,
  rebalanceTx: null, rebalanceTxRh: null, poolStatusArb: 0, poolStatusRh: 0, trippedHorizons: ['8h'],
  ethPctChange: -2.41, gateBps: 200,
};

const row = (over: Partial<RegistryRow> = {}): RegistryRow => ({
  pct1hBps: -30n, pct2hBps: -90n, pct8hBps: -241n, forecastHash: HASH, submittedAt: 0, submitter: '0x0000000000000000000000000000000000000001', ...over,
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
  it('mismatch on any horizon bps even if hash matches', () => {
    expect(reconcileForecast({ api, deployed: true, queryStatus: 'success', registryLatestHourId: H, registryRow: row({ pct8hBps: -240n }) }).kind).toBe('mismatch');
    expect(reconcileForecast({ api, deployed: true, queryStatus: 'success', registryLatestHourId: H, registryRow: row({ pct1hBps: -31n }) }).kind).toBe('mismatch');
  });
  it('reports browser-side hash verification independently of the chain', () => {
    const r = reconcileForecast({ api, deployed: false, queryStatus: 'pending', registryLatestHourId: undefined, registryRow: undefined });
    // HASH is a dummy constant, so the recomputation must say "not verified" — never a false positive.
    expect(r.apiHashVerified).toBe(false);
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
