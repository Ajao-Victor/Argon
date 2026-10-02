'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { Address } from 'viem';
import { useSignMessage } from 'wagmi';

import { toast } from '@/components/ui/Toasts';
import * as agent from '@/services/agent';
import { gateMessage, resolveGate, type GatePreset, type GateRow } from '@/types/gates';

import { agentKeys } from './useAgent';

/**
 * Per-user gate (handoff 2026-10-02).
 *   useGate(address)  → GET /gates/{address} every 30 s; null when the signer has no gate.
 *   useSetGate()      → resolve bands locally (same rules as the agent), ask the wallet to
 *                       personal_sign the exact gate string, POST it, then refresh the row.
 * The wallet signature is the authorisation; no key ever leaves the wallet.
 */
export const POLL_GATE_MS = 30_000;

export function useGate(address: Address | undefined): UseQueryResult<GateRow | null, Error> {
  return useQuery({
    queryKey: agentKeys.gate(address ?? null),
    queryFn: ({ signal }) => agent.fetchGate(address as Address, signal),
    enabled: agent.agentMode === 'live' && Boolean(address),
    refetchInterval: POLL_GATE_MS,
    refetchIntervalInBackground: false,
    staleTime: POLL_GATE_MS,
  });
}

export interface SetGateInput {
  address: Address;
  preset: GatePreset;
  /** Only read for 'custom'; presets send their fixed 1 h band. */
  topBps?: number | undefined;
  bottomBps?: number | undefined;
}

export function useSetGate() {
  const queryClient = useQueryClient();
  const { signMessageAsync } = useSignMessage();

  const mutation = useMutation({
    mutationFn: async (input: SetGateInput): Promise<GateRow> => {
      const resolved = resolveGate(input.preset, input.topBps ?? 0, input.bottomBps ?? 0);
      const topBps = resolved.top1hBps;
      const bottomBps = resolved.bottom1hBps;
      const issuedAt = Math.floor(Date.now() / 1000);
      const message = gateMessage(input.address, resolved.preset, topBps, bottomBps, issuedAt);
      const signature = await signMessageAsync({ message });
      return agent.submitGate({ address: input.address, preset: resolved.preset, topBps, bottomBps, issuedAt, signature });
    },
    onSuccess: (row) => {
      queryClient.setQueryData(agentKeys.gate(row.address), row);
      void queryClient.invalidateQueries({ queryKey: agentKeys.gate(row.address) });
      toast.push({ id: 'gate-saved', kind: 'success', title: `gate saved · ${row.preset}`, detail: `1h ±${row.top1hBps} bps · 2h ±${row.top2hBps} bps · 8h ±${row.top8hBps} bps`, ttl: 7_000 });
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'unknown error';
      if (/rejected|denied|cancel/i.test(msg)) {
        toast.push({ id: 'gate-cancel', kind: 'info', title: 'gate signature cancelled', ttl: 5_000 });
        return;
      }
      toast.push({ id: 'gate-error', kind: 'error', title: 'could not save gate', detail: msg.split('\n')[0] ?? msg, ttl: 10_000 });
    },
  });

  const setGate = useCallback((input: SetGateInput) => mutation.mutateAsync(input).catch(() => undefined), [mutation]);
  return { setGate, isPending: mutation.isPending, error: mutation.error } as const;
}
