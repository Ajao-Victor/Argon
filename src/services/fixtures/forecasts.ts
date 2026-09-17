import { keccak256, toHex } from 'viem';

import type { AgentStatus, Forecast, Health, HourId } from '@/types/forecast';
import { toBps } from '@/utils/bps';
import { hourIdFromDate } from '@/utils/hourId';
import { GATE_BPS, GATE_PCT, WARMUP_HOURS } from '@/utils/policy';

/**
 * Development fixture (doc/agents.md §7). Served when NEXT_PUBLIC_AGENT_URL is unset.
 * 24 rows shaped exactly like the contract, advancing with the real clock so the
 * :01 refetch path is exercised. Includes the partner's committed +0.50 output,
 * an out-of-gate −2.41 row, warmup rows, and matured rows.
 */
export const FIXTURE_MODEL_ID = 'eth-8h-v1';

// Oldest → newest. Index 0 is 23 hours ago. Last is the current hour.
const PCT_SERIES: readonly number[] = [
  0.12, -0.35, 0.8, 1.1, -0.6, 0.3, -1.2, 0.9, // warmup 0–7
  1.4, -2.41, -2.9, -0.4, 0.7, 1.8, 2.15, 0.2, //
  -0.9, 0.45, 1.05, -1.6, 0.05, 0.62, -0.28, 0.5, // latest = +0.50 (notebook output)
];

const SPOT_SERIES: readonly number[] = PCT_SERIES.map((_, i) => 2380 + Math.sin(i / 3) * 40 + i * 1.5);

function fixtureHash(hourId: number, pct: number): `0x${string}` {
  return keccak256(toHex(`${FIXTURE_MODEL_ID}:${hourId}:${toBps(pct)}`));
}

function fixtureTx(hourId: number): `0x${string}` {
  return keccak256(toHex(`tx:${hourId}`));
}

export function buildFixture(now: Date = new Date()): Forecast[] {
  const latest = hourIdFromDate(now);
  const nowHour = latest;
  const n = PCT_SERIES.length;
  const rows: Forecast[] = [];
  let inPool = false;

  for (let i = 0; i < n; i++) {
    const hourId = (latest - (n - 1 - i)) as HourId;
    const targetHourId = (hourId + 8) as HourId;
    const pct = PCT_SERIES[i] ?? 0;
    const spot = SPOT_SERIES[i] ?? 2400;
    const warmupComplete = i >= WARMUP_HOURS;

    let action: Forecast['action'];
    if (!warmupComplete) action = 'warmup';
    else if (Math.abs(pct) >= GATE_PCT) {
      action = 'exit';
      inPool = false;
    } else if (inPool) action = 'hold';
    else {
      action = 'enter';
      inPool = true;
    }

    const matured = nowHour >= targetHourId;
    const realizedIdx = i + 8;
    const realizedPct = matured ? (PCT_SERIES[realizedIdx] ?? pct * 0.6) : null;
    const realizedSpot = matured ? spot * (1 + (realizedPct ?? 0) / 100) : null;

    rows.push({
      hourId,
      targetHourId,
      submittedAt: new Date(hourId * 3600 * 1000).toISOString(),
      horizonHours: 8,
      ethPctChange: pct,
      ethLogReturn: Math.log(1 + pct / 100),
      spotUsd: Number(spot.toFixed(2)),
      modelId: FIXTURE_MODEL_ID,
      status: matured ? 'matured' : 'pending',
      realizedPctChange: realizedPct === null ? null : Number(realizedPct.toFixed(2)),
      realizedSpotUsd: realizedSpot === null ? null : Number(realizedSpot.toFixed(2)),
      action,
      gateBps: GATE_BPS,
      warmupComplete,
      txHash: warmupComplete ? fixtureTx(hourId) : null,
      forecastHash: fixtureHash(hourId, pct),
    });
  }

  return rows.reverse(); // newest first, like the API
}

export function fixtureLatest(now?: Date): Forecast {
  const rows = buildFixture(now);
  const first = rows[0];
  if (!first) throw new Error('fixture empty');
  return first;
}

export function fixtureHistory(limit: number, now?: Date): Forecast[] {
  return buildFixture(now).slice(0, Math.max(1, limit));
}

export function fixtureForecast(hourId: number, now?: Date): Forecast | undefined {
  return buildFixture(now).find((r) => r.hourId === hourId);
}

export function fixtureStatus(now?: Date): AgentStatus {
  const latest = fixtureLatest(now);
  return {
    ok: true,
    warmupComplete: true,
    hoursUntilFirstDecision: 0,
    gateBps: GATE_BPS,
    lastHourId: latest.hourId,
    modelId: FIXTURE_MODEL_ID,
    modelLoaded: true,
    lastError: null,
  };
}

export function fixtureHealth(): Health {
  return { ok: true, modelLoaded: true, version: 'fixture' };
}
