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

async function agentGet<S extends z.ZodTypeAny>(path: string, schema: S): Promise<z.output<S>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);
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
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AgentError('TIMEOUT', `agent timed out after ${AGENT_TIMEOUT_MS}ms`);
    }
    throw new AgentError('NETWORK', err instanceof Error ? err.message : 'network error');
  }
  clearTimeout(timer);

  if (!res.ok) {
    let code: AgentErrorCode = 'INTERNAL';
    let message = `agent ${res.status}`;
    try {
      const body: unknown = await res.json();
      const parsed = agentErrorBodySchema.safeParse(body);
      if (parsed.success) {
        code = parsed.data.code;
        message = parsed.data.error;
      }
    } catch {
      // non-JSON error body; keep defaults
    }
    if (res.status === 404) code = 'NOT_FOUND';
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

export async function getHealth(): Promise<Health> {
  if (agentMode === 'offline') offline();
  if (agentMode === 'fixture') return fixtureHealth();
  return agentGet('/health', healthSchema);
}

export async function getStatus(): Promise<AgentStatus> {
  if (agentMode === 'offline') offline();
  if (agentMode === 'fixture') return fixtureStatus();
  return agentGet('/status', agentStatusSchema);
}

export async function getLatestForecast(): Promise<Forecast> {
  if (agentMode === 'offline') offline();
  if (agentMode === 'fixture') return fixtureLatest();
  return agentGet('/forecasts/latest', forecastSchema);
}

export async function getForecastHistory(limit = 24): Promise<ForecastList> {
  if (agentMode === 'offline') offline();
  if (agentMode === 'fixture') return { items: fixtureHistory(limit) };
  return agentGet(`/forecasts?limit=${encodeURIComponent(limit)}`, forecastListSchema);
}

export async function getForecast(hourId: number): Promise<Forecast> {
  if (agentMode === 'offline') offline();
  if (agentMode === 'fixture') {
    const row = fixtureForecast(hourId);
    if (!row) throw new AgentError('NOT_FOUND', `no fixture row for hourId ${hourId}`, 404);
    return row;
  }
  return agentGet(`/forecasts/${encodeURIComponent(hourId)}`, forecastSchema);
}
