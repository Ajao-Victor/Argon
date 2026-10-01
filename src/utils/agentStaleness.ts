import type { AgentStatus } from '@/types/forecast';

/**
 * How far the agent's last published forecast lags the current UTC hour. The clock job
 * runs every hour; a lag of 0 or 1 is normal (the current hour may not have printed yet),
 * anything beyond that means the Heroku clock has stalled and every "latest" number on
 * screen is old. Surfaced on every route so a stale print is never mistaken for live.
 */
export function forecastLagHours(status: Pick<AgentStatus, 'currentHourId' | 'lastHourId'>): number {
  return status.currentHourId - (status.lastHourId ?? status.currentHourId);
}

export const STALE_AFTER_HOURS = 1;

export function isForecastStale(status: Pick<AgentStatus, 'currentHourId' | 'lastHourId'>): boolean {
  return forecastLagHours(status) > STALE_AFTER_HOURS;
}
