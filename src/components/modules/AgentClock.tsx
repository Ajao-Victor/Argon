'use client';

import { useAgentClock } from '@/hooks';

/** Mounts the :01 UTC invalidation once under /app. Renders nothing. */
export function AgentClock() {
  useAgentClock();
  return null;
}
