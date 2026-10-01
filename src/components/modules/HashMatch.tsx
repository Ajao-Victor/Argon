'use client';

import { Chip, HashText, Panel, RevealItem, Skeleton, Term, type ChipTone } from '@/components/ui';
import { useHashMatch } from '@/hooks';
import type { SupportedChainId } from '@/services/chains';
import { getRegistry } from '@/services/contracts';
import { addressUrl, explorerName } from '@/services/explorer';
import type { Forecast } from '@/types/forecast';
import type { ReconciliationKind } from '@/utils/reconcile';

/** API hash vs registry hash, side by side (design.md §4.5, agents.md §6.3). Never auto-hides a mismatch. */
const LABEL: Record<ReconciliationKind, { text: string; tone: ChipTone }> = {
  'not-deployed': { text: 'registry not deployed', tone: 'idle' },
  'no-api': { text: 'no api row', tone: 'idle' },
  loading: { text: 'reading chain…', tone: 'plain' },
  error: { text: 'chain read failed', tone: 'warn' },
  'pending-chain': { text: 'pending on chain', tone: 'warn' },
  'agent-stale': { text: 'agent stale', tone: 'warn' },
  match: { text: 'matches chain', tone: 'up' },
  mismatch: { text: 'API ≠ registry', tone: 'down' },
};

export function HashMatch({ chainId, api, delay = 0 }: { chainId: SupportedChainId; api: Forecast | undefined; delay?: number }) {
  const r = useHashMatch(chainId, api);
  const registry = getRegistry(chainId);
  const l = LABEL[r.kind];

  return (
    <Panel label="ON-CHAIN MATCH" meta={explorerName(chainId)} glitch={r.kind === 'mismatch'} active={r.kind === 'match'} delay={delay}>
      <RevealItem>
      <dl className="grid grid-cols-[5.5rem_1fr] items-baseline gap-x-4 gap-y-2 text-[0.75rem] leading-5">
        <dt className="label leading-5"><Term id="apiHash">api hash</Term></dt>
        <dd>
          <HashText value={r.apiHash} />
        </dd>
        <dt className="label leading-5"><Term id="registryHash">registry</Term></dt>
        <dd>
          {r.kind === 'loading' ? <Skeleton chars={11} /> : <HashText value={r.chainHash} href={registry ? addressUrl(chainId, registry.address) : undefined} />}
        </dd>
        <dt className="label leading-5"><Term id="bps">bps 1h·2h·8h</Term></dt>
        <dd className="text-text-mid">
          {r.apiBps ? `${r.apiBps.h1}·${r.apiBps.h2}·${r.apiBps.h8}` : '—'}
          <span className="text-text-dim"> vs </span>
          {r.kind === 'loading' ? <Skeleton chars={10} scan={false} /> : r.chainBps ? `${r.chainBps.h1}·${r.chainBps.h2}·${r.chainBps.h8}` : '—'}
        </dd>
        <dt className="label leading-5"><Term id="apiHash">recompute</Term></dt>
        <dd className={r.apiHashVerified ? 'text-signal-up' : api ? 'text-signal-down' : 'text-text-dim'}>
          {api ? (r.apiHashVerified ? 'keccak of the published numbers = published hash' : 'published hash ≠ keccak of its numbers') : '—'}
        </dd>
      </dl>
      </RevealItem>
      <RevealItem className="mt-5">
        <Chip tone={l.tone} dot flipKey={r.kind}>
          {l.text}
        </Chip>
      </RevealItem>
    </Panel>
  );
}
