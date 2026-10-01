import { isAddress, type Address } from 'viem';
import type { z } from 'zod';

import { poolsResponseSchema, portfolioSchema, vaultSnapshotSchema, type ChainPortfolio, type Portfolio, type PoolsResponse, type VaultSnapshot } from '@/types/agentApi';
import {
  agentErrorBodySchema,
  agentStatusSchema,
  forecastListSchema,
  forecastSchema,
  healthSchema,
  type AgentErrorCode,
  type AgentStatus,
  type Forecast,
  type ForecastList,
  type Health,
} from '@/types/forecast';

import { fixtureForecast, fixtureHealth, fixtureHistory, fixtureLatest, fixtureStatus } from './fixtures/forecasts';

/**
 * Typed REST client for the live Argon agent (FastAPI on Heroku).
 *
 * Architectural intent (doc/agents.md §2): the browser reads the agent and never writes
 * to it. Every response is validated with zod at this boundary; a malformed payload is
 * surfaced as AgentError('INVALID') and the UI falls back to on-chain data rather than
 * rendering a bad number. Requests honour TanStack Query's AbortSignal so unmounts cancel
 * in-flight work, and every request has its own hard timeout.
 *
 * Modes:
 *   live     NEXT_PUBLIC_AGENT_URL is set → real requests
 *   fixture  NEXT_PUBLIC_AGENT_FIXTURE=true in a non-production build → sample rows
 *   offline  neither → every call throws AgentError('OFFLINE')
 *
 * Measured latency against Heroku on 2026-10-01: /health, /status and /forecasts/* answer
 * in about one second; /pools, /vault and /portfolio read two chains and DefiLlama and
 * take nine to thirteen seconds. Timeouts are sized per endpoint accordingly.
 */
const BASE = (process.env.NEXT_PUBLIC_AGENT_URL ?? '').trim().replace(/\/+$/, '');
const FIXTURE_FLAG = (process.env.NEXT_PUBLIC_AGENT_FIXTURE ?? '').trim().toLowerCase() === 'true';

export type AgentMode = 'live' | 'fixture' | 'offline';
export const agentMode: AgentMode = BASE ? 'live' : FIXTURE_FLAG && process.env.NODE_ENV !== 'production' ? 'fixture' : 'offline';

/** Fast endpoints (forecast feed, status, health). */
export const AGENT_TIMEOUT_MS = 15_000;
/** Chain-reading endpoints (/pools, /vault, /portfolio): observed 9–13 s, so 30 s. */
export const AGENT_SLOW_TIMEOUT_MS = 30_000;
export const HISTORY_LIMIT_MAX = 168;

export class AgentError extends Error {
  readonly code: AgentErrorCode;
  readonly status: number | undefined;
  constructor(code: AgentErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'AgentError';
    this.code = code;
    this.status = status;
  }
}

function offline(): never {
  throw new AgentError('OFFLINE', 'agent not configured: set NEXT_PUBLIC_AGENT_URL');
}

/**
 * Browsers hide the reason for a failed cross-origin fetch behind a bare TypeError.
 * When the agent is reachable from the server but not from the page, the cause is
 * almost always CORS: Heroku's FRONTEND_ORIGIN must equal this page's origin exactly.
 */
function describeNetworkFailure(err: unknown, path: string): string {
  const base = err instanceof Error ? err.message : 'network error';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'server';
  if (/failed to fetch|networkerror|load failed/i.test(base)) {
    return `could not reach ${BASE}${path} from ${origin}: network or CORS — the agent's FRONTEND_ORIGIN must include this origin`;
  }
  return base;
}

async function agentGet<S extends z.ZodType>(path: string, schema: S, signal?: AbortSignal, timeoutMs = AGENT_TIMEOUT_MS): Promise<z.output<S>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onOuterAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onOuterAbort, { once: true });
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onOuterAbort);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AgentError('TIMEOUT', signal?.aborted ? 'request cancelled' : `agent ${path} timed out after ${timeoutMs / 1000}s`);
    }
    throw new AgentError('NETWORK', describeNetworkFailure(err, path));
  }
  clearTimeout(timer);
  signal?.removeEventListener('abort', onOuterAbort);

  if (!res.ok) {
    // FastAPI envelope: { "detail": "unknown hourId" }. Map HTTP status → code.
    let message = `agent ${res.status} ${path}`;
    try {
      const body: unknown = await res.json();
      const parsed = agentErrorBodySchema.safeParse(body);
      if (parsed.success) message = parsed.data.detail;
    } catch {
      // non-JSON error body; keep the status message
    }
    const code: AgentErrorCode = res.status === 404 ? 'NOT_FOUND' : res.status === 400 || res.status === 422 ? 'BAD_REQUEST' : res.status === 503 ? 'MODEL_NOT_LOADED' : 'INTERNAL';
    throw new AgentError(code, message, res.status);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new AgentError('INVALID', `agent ${path} returned non-JSON`);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new AgentError('INVALID', `agent ${path} payload failed validation: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).slice(0, 3).join('; ')}`);
  }
  return parsed.data as z.output<S>;
}

// ---------------------------------------------------------------------------
// Forecast feed (poll 30 s)
// ---------------------------------------------------------------------------

export async function fetchHealth(signal?: AbortSignal): Promise<Health> {
  if (agentMode === 'offline') offline();
  if (agentMode === 'fixture') return fixtureHealth();
  return agentGet('/health', healthSchema, signal);
}

export async function fetchStatus(signal?: AbortSignal): Promise<AgentStatus> {
  if (agentMode === 'offline') offline();
  if (agentMode === 'fixture') return fixtureStatus();
  return agentGet('/status', agentStatusSchema, signal);
}

export async function fetchLatestForecast(signal?: AbortSignal): Promise<Forecast> {
  if (agentMode === 'offline') offline();
  if (agentMode === 'fixture') return fixtureLatest();
  return agentGet('/forecasts/latest', forecastSchema, signal);
}

export async function fetchForecastHistory(limit = 24, signal?: AbortSignal): Promise<ForecastList> {
  const n = Math.min(HISTORY_LIMIT_MAX, Math.max(1, Math.trunc(limit)));
  if (agentMode === 'offline') offline();
  if (agentMode === 'fixture') return { items: fixtureHistory(n) };
  const list = await agentGet(`/forecasts?limit=${n}`, forecastListSchema, signal);
  // Never trust ordering from the wire: newest first, always.
  return { items: [...list.items].sort((a, b) => b.hourId - a.hourId) };
}

export async function fetchForecast(hourId: number, signal?: AbortSignal): Promise<Forecast> {
  if (!Number.isInteger(hourId) || hourId < 0) throw new AgentError('NOT_FOUND', `invalid hourId ${hourId}`, 404);
  if (agentMode === 'offline') offline();
  if (agentMode === 'fixture') {
    const row = fixtureForecast(hourId);
    if (!row) throw new AgentError('NOT_FOUND', `no fixture row for hourId ${hourId}`, 404);
    return row;
  }
  return agentGet(`/forecasts/${hourId}`, forecastSchema, signal);
}

// ---------------------------------------------------------------------------
// Pools, vault, portfolio (chain-reading endpoints; slow timeout)
// ---------------------------------------------------------------------------

/** GET /pools — APR + TVL per selectable vault. Poll 60 s. */
export async function fetchPools(signal?: AbortSignal): Promise<PoolsResponse> {
  if (agentMode === 'offline') offline();
  if (agentMode === 'fixture') return fixturePools();
  return agentGet('/pools', poolsResponseSchema, signal, AGENT_SLOW_TIMEOUT_MS);
}

/** GET /vault — global TVL and pool status, no wallet required. Poll 10 s. */
export async function fetchVault(signal?: AbortSignal): Promise<VaultSnapshot> {
  if (agentMode === 'offline') offline();
  if (agentMode === 'fixture') return fixtureVault();
  return agentGet('/vault', vaultSnapshotSchema, signal, AGENT_SLOW_TIMEOUT_MS);
}

/** GET /portfolio/{address} — the connected wallet's live vault USD. Poll 10 s. */
export async function fetchPortfolio(address: Address, signal?: AbortSignal): Promise<Portfolio> {
  if (!isAddress(address)) throw new AgentError('BAD_REQUEST', `invalid address ${address}`, 400);
  if (agentMode === 'offline') offline();
  if (agentMode === 'fixture') return fixturePortfolio(address);
  return agentGet(`/portfolio/${address}`, portfolioSchema, signal, AGENT_SLOW_TIMEOUT_MS);
}

// ---------------------------------------------------------------------------
// Fixture rows for the three snapshot endpoints (development only)
// ---------------------------------------------------------------------------

const FIXTURE_VAULT = '0x9F844b4D1b28Be7413067f9d4fC08Bc276fd1C60' as const;

function fixtureChain(name: 'arbitrum' | 'robinhood'): ChainPortfolio {
  const arb = name === 'arbitrum';
  return {
    name,
    chainId: arb ? 42161 : 4663,
    vault: FIXTURE_VAULT,
    poolId: arb ? 1 : 4,
    pair: arb ? 'WETH/USDC' : 'WETH/USDG',
    inPool: false,
    ethUsd: 2690,
    totalShares: '0',
    tvlUsd: 0,
    shares: '0',
    shareUsd: 0,
    idleWeth: '0',
    idleStable: '0',
    idleWethFormatted: 0,
    idleStableFormatted: 0,
    walletWeth: '0',
    walletStable: '0',
    walletWethFormatted: 0,
    walletStableFormatted: 0,
    stableSymbol: arb ? 'USDC' : 'USDG',
    stableDecimals: 6,
  };
}

function fixturePools(): PoolsResponse {
  return {
    updatedAt: new Date().toISOString(),
    pollSeconds: 60,
    selectOneChain: true,
    pools: [
      {
        id: 'arbitrum', chainId: 42161, poolId: 1, pair: 'WETH/USDC', feePercent: 0.05, uniswapFee: 500, vault: FIXTURE_VAULT,
        pool: '0xC6962004f452bE9203591991D15f6b388e09E8D0', weth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', stable: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        stableSymbol: 'USDC', inPool: false, poolTvlUsd: 36_600_000, ethUsd: 2690, selectable: true,
        depositHint: 'Switch wallet to arbitrum then deposit WETH + USDC', aprPct: 24.6, aprBasePct: 24.6, aprSource: 'defillama', llamaTvlUsd: 36_588_001, volumeUsd1d: 49_398_159,
      },
      {
        id: 'robinhood', chainId: 4663, poolId: 4, pair: 'WETH/USDG', feePercent: 0.05, uniswapFee: 500, vault: FIXTURE_VAULT,
        pool: '0x69BfaF19C9f377BB306a89aEd9F6B07e2c1a8d9a', weth: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73', stable: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
        stableSymbol: 'USDG', inPool: false, poolTvlUsd: 5_300_000, ethUsd: 2690, selectable: true,
        depositHint: 'Switch wallet to robinhood then deposit WETH + USDG', aprPct: null, aprBasePct: null, aprSource: 'unavailable', llamaTvlUsd: null, volumeUsd1d: null,
      },
    ],
  };
}

function fixtureVault(): VaultSnapshot {
  return { address: null, updatedAt: new Date().toISOString(), pollSeconds: 10, totalUsd: 0, chains: { arbitrum: fixtureChain('arbitrum'), robinhood: fixtureChain('robinhood') } };
}

function fixturePortfolio(address: Address): Portfolio {
  return { ...fixtureVault(), address, forecast: fixtureLatest() };
}
