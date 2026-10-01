import { keccak256, toHex } from 'viem';

import type { AgentStatus, Forecast, Health, Horizon, HourId } from '@/types/forecast';
import { computeForecastHash } from '@/utils/forecastHash';
import { hourIdFromDate } from '@/utils/hourId';
import { GATES_BPS, WARMUP_HOURS, dualHorizonAction, trippedHorizons } from '@/utils/policy';

/**
 * Development fixture (doc/agents.md §7). Served only behind NEXT_PUBLIC_AGENT_FIXTURE=true
 * in non-production builds. 24 rows in the live three-horizon shape, advancing with the
 * real clock. Hashes are computed with the real keccak scheme, so the hash-match and
 * client-side verification paths exercise exactly what they do against Heroku.
 */
export const FIXTURE_MODEL_ID = 'eth-1-2-8h-v1';

// Oldest → newest. Index 0 is 23 hours ago. Last is the current hour.
const PCT_8H: readonly number[] = [
  0.12, -0.35, 0.8, 1.1, -0.6, 0.3, -1.2, 0.9, 0.4, // warmup 0–8
  1.4, -2.41, -2.9, -0.4, 0.7, 1.8, 2.15, 0.2, //
  -0.9, 0.45, 1.05, -1.6, 0.05, 0.62, -0.39, // latest ≈ the live row's -0.39
];
const PCT_1H: readonly number[] = PCT_8H.map((p, i) => Number((p * 0.12 + Math.sin(i) * 0.3).toFixed(4)));
const PCT_2H: readonly number[] = PCT_8H.map((p, i) => Number((p * 0.35 + Math.cos(i) * 0.4).toFixed(4)));
const SPOT: readonly number[] = PCT_8H.map((_, i) => 2660 + Math.sin(i / 3) * 40 + i * 1.5);

function fixtureTx(hourId: number, chain: string): `0x${string}` {
  return keccak256(toHex(`tx:${chain}:${hourId}`));
}

export function buildFixture(now: Date = new Date()): Forecast[] {
  const latest = hourIdFromDate(now);
  const n = PCT_8H.length;
  const rows: Forecast[] = [];
  let inPool = false;

  for (let i = 0; i < n; i++) {
    const hourId = (latest - (n - 1 - i)) as HourId;
    const targetHourId = (hourId + 8) as HourId;
    const p1 = PCT_1H[i] ?? 0;
    const p2 = PCT_2H[i] ?? 0;
    const p8 = PCT_8H[i] ?? 0;
    const spot = SPOT[i] ?? 2680;
    const warmupComplete = i >= WARMUP_HOURS;

    const action = dualHorizonAction({ ethPct1h: p1, ethPct2h: p2, ethPct8h: p8, warmupComplete, currentlyInPool: inPool });
    if (action === 'exit') inPool = false;
    if (action === 'enter') inPool = true;
    const tripped: Horizon[] = trippedHorizons({ ethPct1h: p1, ethPct2h: p2, ethPct8h: p8 });

    const matured = latest >= targetHourId;
    const realizedPct = matured ? (PCT_8H[i + 8] ?? p8 * 0.6) : null;
    const realizedSpot = matured ? spot * (1 + (realizedPct ?? 0) / 100) : null;
    const traded = warmupComplete && (action === 'enter' || action === 'exit');

    const base = {
      hourId,
      targetHourId,
      submittedAt: new Date(hourId * 3600 * 1000 + 12_000).toISOString(),
      ethPct1h: p1,
      ethPct2h: p2,
      ethPct8h: p8,
      ethPct1hSource: 'persistence' as const,
      ethPct2hSource: 'persistence' as const,
      ethPct8hSource: 'lgbm' as const,
      spotUsd: Number(spot.toFixed(4)),
      modelId: FIXTURE_MODEL_ID,
      status: matured ? ('matured' as const) : ('pending' as const),
      realizedPctChange: realizedPct === null ? null : Number(realizedPct.toFixed(2)),
      realizedSpotUsd: realizedSpot === null ? null : Number(realizedSpot.toFixed(2)),
      action,
      gate1hBps: GATES_BPS['1h'],
      gate2hBps: GATES_BPS['2h'],
      gate8hBps: GATES_BPS['8h'],
      warmupComplete,
      forecastHash: computeForecastHash({ hourId, ethPct1h: p1, ethPct2h: p2, ethPct8h: p8, modelId: FIXTURE_MODEL_ID }),
      txHash: warmupComplete ? fixtureTx(hourId, 'arb') : null,
      txHashRh: warmupComplete ? fixtureTx(hourId, 'rh') : null,
      rebalanceTx: !warmupComplete ? 'warmup-skip' : traded ? fixtureTx(hourId, 'arb') : 'hold',
      rebalanceTxRh: !warmupComplete ? 'warmup-skip' : traded ? fixtureTx(hourId, 'rh') : 'hold',
      poolStatusArb: (inPool ? 1 : 0) as 0 | 1,
      poolStatusRh: (inPool ? 1 : 0) as 0 | 1,
      trippedHorizons: tripped,
    };
    rows.push({ ...base, ethPctChange: base.ethPct8h, gateBps: base.gate8hBps });
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
    gate1hBps: GATES_BPS['1h'],
    gate2hBps: GATES_BPS['2h'],
    gate8hBps: GATES_BPS['8h'],
    lastHourId: latest.hourId,
    currentHourId: latest.hourId,
    modelId: FIXTURE_MODEL_ID,
    modelLoaded: true,
    dryRun: true,
    database: 'fixture',
    gateBps: GATES_BPS['8h'],
  };
}

export function fixtureHealth(): Health {
  return { ok: true, modelLoaded: true, database: 'fixture', version: 'fixture' };
}
