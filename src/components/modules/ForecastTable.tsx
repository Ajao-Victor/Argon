'use client';

import { useCallback, useMemo, useState } from 'react';

import { Chip, DataTable, HashText, Panel, Skeleton, Term, type ChipTone, type Column } from '@/components/ui';
import { useAgentMode, useForecastHistory } from '@/hooks';
import type { SupportedChainId } from '@/services/chains';
import { txUrl } from '@/services/explorer';
import { isSubmissionFailure, isTransactionHash, type Forecast, type PolicyAction } from '@/types/forecast';
import { cn } from '@/utils/cn';
import { formatPct } from '@/utils/format';
import { formatDateHourUtc, formatSettlementHour, hourIdFromDate } from '@/utils/hourId';

import { HashMatch } from './HashMatch';

/** Last 24 hours, predicted vs realized after hourId+8 (design.md §4.7). Row click opens the hash-match detail. */
const ACTION_TONE: Record<PolicyAction, ChipTone> = { exit: 'down', enter: 'up', hold: 'argon', warmup: 'idle' };

function pctClass(v: number | null): string {
  if (v === null) return 'text-text-dim';
  return v < 0 ? 'text-signal-down' : v > 0 ? 'text-signal-up' : 'text-text-hi';
}

export function ForecastTable({ chainId, limit = 24 }: { chainId: SupportedChainId; limit?: number }) {
  const history = useForecastHistory(limit);
  const mode = useAgentMode();
  const [selected, setSelected] = useState<Forecast | undefined>(undefined);
  const rows = history.data?.items ?? [];

  // One "now" per data refresh so every row's countdown agrees: the fetch timestamp is pure, re-read on each 60 s tick.
  const nowHourId = history.dataUpdatedAt ? hourIdFromDate(new Date(history.dataUpdatedAt)) : 0;
  const columns: readonly Column<Forecast>[] = useMemo(() => [
    { key: 'hour', header: 'hour', render: (r) => <span className="text-text-hi">{r.hourId}</span> },
    { key: 'utc', header: 'utc', render: (r) => <span className="text-text-lo">{formatDateHourUtc(r.hourId)}</span> },
    {
      key: 'settles',
      header: <Term id="targetHour">understandable hour</Term>,
      render: (r) => <span className={cn(r.targetHourId > nowHourId ? 'text-text-mid' : 'text-text-dim')} title={`hour ${r.targetHourId}`}>{formatSettlementHour(r.targetHourId, nowHourId)}</span>,
    },
    { key: 'pred', header: 'pred %', align: 'right', render: (r) => <span className={pctClass(r.ethPctChange)}>{formatPct(r.ethPctChange)}</span> },
    { key: 'real', header: 'real %', align: 'right', render: (r) => <span className={pctClass(r.realizedPctChange)}>{r.realizedPctChange === null ? '—' : formatPct(r.realizedPctChange)}</span> },
    { key: 'status', header: 'status', render: (r) => <span className={cn(r.status === 'matured' ? 'text-text-mid' : 'text-text-dim')}>{r.status}</span> },
    { key: 'action', header: 'action', render: (r) => <Chip tone={ACTION_TONE[r.action]}>{r.action}</Chip> },
    { key: 'hash', header: 'hash', render: (r) => <HashText value={r.forecastHash} /> },
    {
      key: 'tx',
      header: 'tx',
      render: (r) =>
        isTransactionHash(r.txHash) ? (
          <HashText value={r.txHash} href={txUrl(chainId, r.txHash)} />
        ) : isSubmissionFailure(r.txHash) ? (
          <span className="text-signal-down">submission failed</span>
        ) : r.txHash ? (
          <span className="text-signal-up" title={r.txHash}>already on-chain</span>
        ) : (
          <HashText value={null} />
        ),
    },
  ], [chainId, nowHourId]);
  const rowKey = useCallback((r: Forecast) => r.hourId, []);
  const onRowClick = useCallback((r: Forecast) => setSelected((s) => (s?.hourId === r.hourId ? undefined : r)), []);

  return (
    <div className="flex flex-col gap-4">
      <Panel label="FORECASTS · LAST 24H" meta={mode === 'offline' ? 'agent not configured' : history.status === 'error' ? 'agent unreachable' : `${rows.length} rows`} padded={mode === 'offline' || history.status === 'pending'}>
        {mode === 'offline' ? (
          <div className="flex flex-col gap-2 py-6 text-center">
            <span className="font-display text-2xl text-text-dim">waiting for agent telemetry</span>
            <span className="leading-5 text-text-lo">Set NEXT_PUBLIC_AGENT_URL and rebuild. History fills from the first hourly print.</span>
          </div>
        ) : history.status === 'pending' ? (
          /* Header line plus eight 32 px rows: the shape of the loaded table, not a short stub. */
          <div className="flex flex-col gap-3" aria-busy="true">
            <span className="label leading-5">computing history</span>
            <div className="flex flex-col divide-y divide-hairline">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="flex h-8 items-center">
                  <Skeleton chars={72} scan={i === 0} className="max-w-full" />
                </div>
              ))}
            </div>
          </div>
        ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={rowKey}
          refreshKey={history.dataUpdatedAt}
          onRowClick={onRowClick}
          empty={history.status === 'error' ? 'live agent unreachable' : 'no forecasts yet'}
        />
        )}
      </Panel>
      {selected && <HashMatch chainId={chainId} api={selected} />}
    </div>
  );
}
