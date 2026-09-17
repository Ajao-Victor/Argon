'use client';

import { useState } from 'react';

import { Chip, DataTable, HashText, Panel, type ChipTone, type Column } from '@/components/ui';
import { useForecastHistory } from '@/hooks';
import type { SupportedChainId } from '@/services/chains';
import { txUrl } from '@/services/explorer';
import type { Forecast, PolicyAction } from '@/types/forecast';
import { cn } from '@/utils/cn';
import { formatPct } from '@/utils/format';
import { formatDateHourUtc } from '@/utils/hourId';

import { HashMatch } from './HashMatch';

/** Last 24 hours, predicted vs realized after hourId+8 (design.md §4.7). Row click opens the hash-match detail. */
const ACTION_TONE: Record<PolicyAction, ChipTone> = { exit: 'down', enter: 'up', hold: 'argon', warmup: 'idle' };

function pctClass(v: number | null): string {
  if (v === null) return 'text-text-dim';
  return v < 0 ? 'text-signal-down' : v > 0 ? 'text-signal-up' : 'text-text-hi';
}

export function ForecastTable({ chainId, limit = 24 }: { chainId: SupportedChainId; limit?: number }) {
  const history = useForecastHistory(limit);
  const [selected, setSelected] = useState<Forecast | undefined>(undefined);
  const rows = history.data?.items ?? [];

  const columns: readonly Column<Forecast>[] = [
    { key: 'hour', header: 'hour', render: (r) => <span className="text-text-hi">{r.hourId}</span> },
    { key: 'utc', header: 'utc', render: (r) => <span className="text-text-lo">{formatDateHourUtc(r.hourId)}</span> },
    { key: 'pred', header: 'pred %', align: 'right', render: (r) => <span className={pctClass(r.ethPctChange)}>{formatPct(r.ethPctChange)}</span> },
    { key: 'real', header: 'real %', align: 'right', render: (r) => <span className={pctClass(r.realizedPctChange)}>{r.realizedPctChange === null ? '—' : formatPct(r.realizedPctChange)}</span> },
    { key: 'status', header: 'status', render: (r) => <span className={cn(r.status === 'matured' ? 'text-text-mid' : 'text-text-dim')}>{r.status}</span> },
    { key: 'action', header: 'action', render: (r) => <Chip tone={ACTION_TONE[r.action]}>{r.action}</Chip> },
    { key: 'hash', header: 'hash', render: (r) => <HashText value={r.forecastHash} /> },
    { key: 'tx', header: 'tx', render: (r) => <HashText value={r.txHash} href={r.txHash ? txUrl(chainId, r.txHash) : undefined} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Panel label="FORECASTS · LAST 24H" meta={history.status === 'error' ? 'agent unreachable' : `${rows.length} rows`} padded={false}>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.hourId}
          refreshKey={history.dataUpdatedAt}
          onRowClick={(r) => setSelected((s) => (s?.hourId === r.hourId ? undefined : r))}
          empty={history.status === 'pending' ? 'loading…' : history.status === 'error' ? 'live agent unreachable' : 'no forecasts yet'}
        />
      </Panel>
      {selected && <HashMatch chainId={chainId} api={selected} />}
    </div>
  );
}
