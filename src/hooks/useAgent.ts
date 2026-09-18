'use client';

import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import * as agent from '@/services/agent';
import type { AgentStatus, Forecast, ForecastList, Health, HourId } from '@/types/forecast';
import { msUntilNextMinuteOne } from '@/utils/hourId';

/**
 * Agent query hooks (doc/agents.md §5, doc/architecture.md §2.1).
 * One cache: TanStack Query. Polling never below 30 s. The :01 UTC refetch is a
 * single scheduled timeout in useAgentClock, not an interval.
 */
export const agentKeys = {
  all: ['agent'] as const,
  latest: () => ['agent', 'latest'] as const,
  status: () => ['agent', 'status'] as const,
  health: () => ['agent', 'health'] as const,
  history: (limit: number) => ['agent', 'history', limit] as const,
  forecast: (hourId: number) => ['agent', 'forecast', hourId] as const,
};

const AGENT_ENABLED = agent.agentMode !== 'offline';

export const POLL_LATEST_MS = 30_000;
export const POLL_STATUS_MS = 30_000;
export const POLL_HISTORY_MS = 60_000;

/**
 * Latest forecast with the monotonic guard (agents.md §6.4): a row whose hourId is
 * lower than the last accepted one is a lagging replica and is ignored.
 */
export function useLatestForecast(): UseQueryResult<Forecast, Error> {
  const lastAccepted = useRef<Forecast | null>(null);

  return useQuery({
    queryKey: agentKeys.latest(),
    queryFn: agent.getLatestForecast,
    enabled: AGENT_ENABLED,
    refetchInterval: POLL_LATEST_MS,
    refetchIntervalInBackground: false,
    staleTime: POLL_LATEST_MS,
    select: (row) => {
      const prev = lastAccepted.current;
      if (prev && row.hourId < prev.hourId) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[agent] ignored out-of-order row hourId=${row.hourId} < ${prev.hourId}`);
        }
        return prev;
      }
      lastAccepted.current = row;
      return row;
    },
  });
}

export function useAgentStatus(): UseQueryResult<AgentStatus, Error> {
  return useQuery({
    queryKey: agentKeys.status(),
    queryFn: agent.getStatus,
    enabled: AGENT_ENABLED,
    refetchInterval: POLL_STATUS_MS,
    refetchIntervalInBackground: false,
    staleTime: POLL_STATUS_MS,
  });
}

export function useAgentHealth(): UseQueryResult<Health, Error> {
  return useQuery({
    queryKey: agentKeys.health(),
    queryFn: agent.getHealth,
    enabled: AGENT_ENABLED,
    staleTime: 5 * 60_000,
    refetchInterval: false,
  });
}

export function useForecastHistory(limit = 24): UseQueryResult<ForecastList, Error> {
  return useQuery({
    queryKey: agentKeys.history(limit),
    queryFn: () => agent.getForecastHistory(limit),
    enabled: AGENT_ENABLED,
    refetchInterval: POLL_HISTORY_MS,
    refetchIntervalInBackground: false,
    staleTime: POLL_HISTORY_MS,
  });
}

/** Single row. Once matured it never changes, so it is cached forever. */
export function useForecast(hourId: HourId | number | undefined): UseQueryResult<Forecast, Error> {
  return useQuery({
    queryKey: agentKeys.forecast(hourId ?? -1),
    queryFn: () => agent.getForecast(hourId as number),
    enabled: AGENT_ENABLED && hourId !== undefined && hourId >= 0,
    staleTime: (query) => (query.state.data?.status === 'matured' ? Infinity : POLL_LATEST_MS),
    refetchInterval: (query) => (query.state.data?.status === 'matured' ? false : POLL_LATEST_MS),
    refetchIntervalInBackground: false,
  });
}

/**
 * Schedules one invalidation of every agent query at the next hh:01:00Z, then
 * reschedules. Mount once under /app. Never a setInterval.
 */
export function useAgentClock(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const schedule = () => {
      if (cancelled) return;
      timer = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: agentKeys.all });
        schedule();
      }, msUntilNextMinuteOne());
    };

    schedule();
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [queryClient]);
}

/** True when the agent client is serving the development fixture. */
export function useAgentMode(): agent.AgentMode {
  return agent.agentMode;
}
