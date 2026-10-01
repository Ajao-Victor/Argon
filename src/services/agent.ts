import type { z } from 'zod';

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

import {
  fixtureForecast,
  fixtureHealth,
  fixtureHistory,
  fixtureLatest,
  fixtureStatus,
} from './fixtures/forecasts';

/**
 * Agent REST client (doc/agents.md §2–§3). GET only. 10 s abort. zod at the boundary.
 * Modes:
 *   live     NEXT_PUBLIC_AGENT_URL is set → real requests
 *   fixture  NEXT_PUBLIC_AGENT_FIXTURE=true in a non-production build → sample rows,
 *            labelled 'fixture' everywhere it is shown
 *   offline  neither → every call throws AgentError('OFFLINE'); the UI renders
 *            'waiting for agent telemetry'. No number is ever fabricated.
 * The web never POSTs an inference.
 */
const BASE = (process.env.NEXT_PUBLIC_AGENT_URL ?? '').trim().replace(/\/+$/, '');
const FIXTURE_FLAG = (process.env.NEXT_PUBLIC_AGENT_FIXTURE ?? '').trim().toLowerCase() === 'true';
export const AGENT_TIMEOUT_MS = 10_000;
export type AgentMode = 'live' | 'fixture' | 'offline';
export const agentMode: AgentMode = BASE ? 'live' : FIXTURE_FLAG && process.env.NODE_ENV !== 'production' ? 'fixture' : 'offline';

function offline(): never {
  throw new AgentError('OFFLINE', 'agent not configured: set NEXT_PUBLIC_AGENT_URL');
}

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

async function agentGet<S extends z.ZodType>(path: string, schema: S, signal?: AbortSignal): Promise<z.output<S>> {
  // Abort on our 10 s budget, or as soon as TanStack cancels the query (unmount, key change).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);
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
      throw new AgentError('TIMEOUT', signal?.aborted ? 'request cancelled' : `agent timed out after ${AGENT_TIMEOUT_MS}ms`);
    }
    throw new AgentError('NETWORK', err instanceof Error ? err.message : 'network error');
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
    throw new AgentError('INVALID', 'agent returned non-JSON');
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new AgentError('INVALID', `agent payload failed validation: ${parsed.error.message}`);
  }
  return parsed.data as z.output<S>;
}

export async function getHealth(signal?: AbortSignal): Promise<Health> {
  if (agentMode === 'offline') offline();
  if (agentMode === 'fixture') return fixtureHealth();
  return agentGet('/health', healthSchema, signal);
}

export async function getStatus(signal?: AbortSignal): Promise<AgentStatus> {
  if (agentMode === 'offline') offline();
  if (agentMode === 'fixture') return fixtureStatus();
  return agentGet('/status', agentStatusSchema, signal);
}

export async function getLatestForecast(signal?: AbortSignal): Promise<Forecast> {
  if (agentMode === 'offline') offline();
  if (agentMode === 'fixture') return fixtureLatest();
  return agentGet('/forecasts/latest', forecastSchema, signal);
}

export const HISTORY_LIMIT_MAX = 200;

export async function getForecastHistory(limit = 24, signal?: AbortSignal): Promise<ForecastList> {
  const n = Math.min(HISTORY_LIMIT_MAX, Math.max(1, Math.trunc(limit)));
  if (agentMode === 'offline') offline();
  if (agentMode === 'fixture') return { items: fixtureHistory(n) };
  const list = await agentGet(`/forecasts?limit=${n}`, forecastListSchema, signal);
  // Never trust ordering from the wire: newest first, always.
  return { items: [...list.items].sort((a, b) => b.hourId - a.hourId) };
}

export async function getForecast(hourId: number, signal?: AbortSignal): Promise<Forecast> {
  if (!Number.isInteger(hourId) || hourId < 0) throw new AgentError('NOT_FOUND', `invalid hourId ${hourId}`, 404);
  if (agentMode === 'offline') offline();
  if (agentMode === 'fixture') {
    const row = fixtureForecast(hourId);
    if (!row) throw new AgentError('NOT_FOUND', `no fixture row for hourId ${hourId}`, 404);
    return row;
  }
  return agentGet(`/forecasts/${hourId}`, forecastSchema, signal);
}
