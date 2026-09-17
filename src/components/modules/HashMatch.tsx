'use client';

import { Chip, HashText, Panel, RevealItem, type ChipTone } from '@/components/ui';
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
      <dl className="grid grid-cols-[8ch_1fr] gap-x-3 gap-y-1.5 text-[0.75rem]">
        <dt className="label">api</dt>
        <dd>
          <HashText value={r.apiHash} />
        </dd>
        <dt className="label">registry</dt>
        <dd>
          <HashText value={r.chainHash} href={registry ? addressUrl(chainId, registry.address) : undefined} />
        </dd>
        <dt className="label">bps</dt>
        <dd className="text-text-mid">
          {r.apiBps?.toString() ?? '—'} · {r.chainBps?.toString() ?? '—'}
        </dd>
      </dl>
      </RevealItem>
      <RevealItem className="mt-3">
        <Chip tone={l.tone} dot flipKey={r.kind}>
          {l.text}
        </Chip>
      </RevealItem>
    </Panel>
  );
}
