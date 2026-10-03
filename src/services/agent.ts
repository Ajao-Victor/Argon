/**
 * @file agent — the single HTTP boundary between the browser and the Argon agent.
 *
 * Every fetcher validates its response with zod before it reaches a hook, honours
 * TanStack's AbortSignal, carries a per-endpoint timeout, sends `cache: 'no-store'`, and
 * retries once through the same-origin `/api/agent` proxy on a browser CORS failure. Reads
 * only, except the wallet-signed `POST /gates`. No secrets: the base URL is public.
 */
import { isAddress, type Address } from 'viem';
import type { z } from 'zod';

import { poolsResponseSchema, portfolioSchema, vaultSnapshotSchema, type Portfolio, type PoolsResponse, type VaultSnapshot } from '@/types/agentApi';
import { gateRowSchema, type GateRequest, type GateRow } from '@/types/gates';
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


/**
 * Typed REST client for the live Argon agent (FastAPI on Heroku).
 *
 * Architectural intent (doc/agents.md §2): the browser reads the agent and never writes
 * to it, with one explicit exception from the 2026-10-02 handoff: POST /gates, a
 * wallet-signed per-user gate (EIP-191 personal_sign over an exact string the agent
 * recovers and verifies). Every response is validated with zod at this boundary; a malformed payload is
 * surfaced as AgentError('INVALID') and the UI falls back to on-chain data rather than
 * rendering a bad number. Requests honour TanStack Query's AbortSignal so unmounts cancel
 * in-flight work, and every request has its own hard timeout.
 *
 * Modes:
 *   live     NEXT_PUBLIC_AGENT_URL is set → real requests
 *   fixture  NEXT_PUBLIC_AGENT_FIXTURE=true in a non-production build → sample rows, loaded
 *            through dynamic import() so production bundles contain no fixture data
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

/** Same-origin proxy (src/app/api/agent/[...path]/route.ts): server-to-server, so browser CORS does not apply. */
export const PROXY_BASE = '/api/agent';

async function agentGet<S extends z.ZodType>(path: string, schema: S, signal?: AbortSignal, timeoutMs = AGENT_TIMEOUT_MS): Promise<z.output<S>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onOuterAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onOuterAbort, { once: true });
  }
  const init: RequestInit = { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store', signal: controller.signal };

  let res: Response;
  try {
    try {
      res = await fetch(`${BASE}${path}`, init);
    } catch (err) {
      // A bare TypeError here is a browser network / CORS failure (Heroku's FRONTEND_ORIGIN
      // not matching this page). Retry once through the same-origin proxy, which forwards
      // server-to-server. Aborts and server-side calls are not retried.
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      if (isAbort || typeof window === 'undefined') throw err;
      res = await fetch(`${PROXY_BASE}${path}`, init);
    }
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
  if (agentMode === 'fixture') return (await import('./fixtures/forecasts')).fixtureHealth();
  return agentGet('/health', healthSchema, signal);
}

export async function fetchStatus(signal?: AbortSignal): Promise<AgentStatus> {
  if (agentMode === 'offline') offline();
  if (agentMode === 'fixture') return (await import('./fixtures/forecasts')).fixtureStatus();
  return agentGet('/status', agentStatusSchema, signal);
}

export async function fetchLatestForecast(signal?: AbortSignal): Promise<Forecast> {
  if (agentMode === 'offline') offline();
  if (agentMode === 'fixture') return (await import('./fixtures/forecasts')).fixtureLatest();
  return agentGet('/forecasts/latest', forecastSchema, signal);
}

export async function fetchForecastHistory(limit = 24, signal?: AbortSignal): Promise<ForecastList> {
  const n = Math.min(HISTORY_LIMIT_MAX, Math.max(1, Math.trunc(limit)));
  if (agentMode === 'offline') offline();
  if (agentMode === 'fixture') return { items: (await import('./fixtures/forecasts')).fixtureHistory(n) };
  const list = await agentGet(`/forecasts?limit=${n}`, forecastListSchema, signal);
  // Never trust ordering from the wire: newest first, always.
  return { items: [...list.items].sort((a, b) => b.hourId - a.hourId) };
}

export async function fetchForecast(hourId: number, signal?: AbortSignal): Promise<Forecast> {
  if (!Number.isInteger(hourId) || hourId < 0) throw new AgentError('NOT_FOUND', `invalid hourId ${hourId}`, 404);
  if (agentMode === 'offline') offline();
  if (agentMode === 'fixture') {
    const row = (await import('./fixtures/forecasts')).fixtureForecast(hourId);
    if (!row) throw new AgentError('NOT_FOUND', `no fixture row for hourId ${hourId}`, 404);
    return row;
  }
  return agentGet(`/forecasts/${hourId}`, forecastSchema, signal);
}

// ---------------------------------------------------------------------------
// Per-user gate: GET /gates/{address}, POST /gates (the only write; wallet-signed)
// ---------------------------------------------------------------------------

/** The signer's stored gate, or null when the agent answers 404 ("no gate stored"). */
export async function fetchGate(address: Address, signal?: AbortSignal): Promise<GateRow | null> {
  if (!isAddress(address)) throw new AgentError('BAD_REQUEST', `invalid address ${address}`, 400);
  if (agentMode === 'offline') offline();
  if (agentMode === 'fixture') return null;
  try {
    return await agentGet(`/gates/${address}`, gateRowSchema, signal);
  } catch (err) {
    if (err instanceof AgentError && err.code === 'NOT_FOUND') return null;
    throw err;
  }
}

/**
 * Store a signed gate. The body carries the signature the wallet produced over
 * gateMessage(...); the agent recovers the signer, checks the preset / band match, the
 * two-hour issuedAt window, and that issuedAt is newer than the stored gate (409).
 */
export async function submitGate(body: GateRequest, signal?: AbortSignal): Promise<GateRow> {
  if (agentMode === 'offline') offline();
  if (agentMode === 'fixture') throw new AgentError('OFFLINE', 'gates are not available in fixture mode');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);
  const onOuterAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onOuterAbort, { once: true });
  }
  const init: RequestInit = { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, cache: 'no-store', body: JSON.stringify(body), signal: controller.signal };
  let res: Response;
  try {
    try {
      res = await fetch(`${BASE}/gates`, init);
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      if (isAbort || typeof window === 'undefined') throw err;
      res = await fetch(`${PROXY_BASE}/gates`, init);
    }
  } catch (err) {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onOuterAbort);
    if (err instanceof DOMException && err.name === 'AbortError') throw new AgentError('TIMEOUT', 'gate request timed out');
    throw new AgentError('NETWORK', describeNetworkFailure(err, '/gates'));
  }
  clearTimeout(timer);
  signal?.removeEventListener('abort', onOuterAbort);
  if (!res.ok) {
    let message = `agent ${res.status} /gates`;
    try {
      const parsed = agentErrorBodySchema.safeParse(await res.json());
      if (parsed.success) message = parsed.data.detail;
    } catch {
      // keep status message
    }
    const code: AgentErrorCode = res.status === 409 ? 'CONFLICT' : res.status === 400 || res.status === 422 ? 'BAD_REQUEST' : 'INTERNAL';
    throw new AgentError(code, message, res.status);
  }
  const parsed = gateRowSchema.safeParse(await res.json());
  if (!parsed.success) throw new AgentError('INVALID', `agent /gates response failed validation: ${parsed.error.issues[0]?.message ?? ''}`);
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Pools, vault, portfolio (chain-reading endpoints; slow timeout)
// ---------------------------------------------------------------------------

/** GET /pools — APR + TVL per selectable vault. Poll 60 s. */
export async function fetchPools(signal?: AbortSignal): Promise<PoolsResponse> {
  if (agentMode === 'offline') offline();
  if (agentMode === 'fixture') return (await import('./fixtures/snapshots')).fixturePools();
  return agentGet('/pools', poolsResponseSchema, signal, AGENT_SLOW_TIMEOUT_MS);
}

/** GET /vault — global TVL and pool status, no wallet required. Poll 10 s. */
export async function fetchVault(signal?: AbortSignal): Promise<VaultSnapshot> {
  if (agentMode === 'offline') offline();
  if (agentMode === 'fixture') return (await import('./fixtures/snapshots')).fixtureVault();
  return agentGet('/vault', vaultSnapshotSchema, signal, AGENT_SLOW_TIMEOUT_MS);
}

/** GET /portfolio/{address} — the connected wallet's live vault USD. Poll 10 s. */
export async function fetchPortfolio(address: Address, signal?: AbortSignal): Promise<Portfolio> {
  if (!isAddress(address)) throw new AgentError('BAD_REQUEST', `invalid address ${address}`, 400);
  if (agentMode === 'offline') offline();
  if (agentMode === 'fixture') return (await import('./fixtures/snapshots')).fixturePortfolio(address);
  return agentGet(`/portfolio/${address}`, portfolioSchema, signal, AGENT_SLOW_TIMEOUT_MS);
}
