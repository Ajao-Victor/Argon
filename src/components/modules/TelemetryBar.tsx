'use client';

import { Telemetry, TickerTape, type TelemetryItem, type TickerItem } from '@/components/simulation';
import { useAgentMode, useAgentStatus, useForecastHistory, useLatestForecast, usePerfReadout, useVaultTelemetry, useWallet } from '@/hooks';
import { Term } from '@/components/ui';
import { arbitrum, robinhood } from '@/services/chains';
import { getVault } from '@/services/contracts';
import { cn } from '@/utils/cn';
import { formatPct, formatUsd } from '@/utils/format';
import { WARMUP_HOURS } from '@/utils/policy';
import { forecastLagHours, isForecastStale } from '@/utils/agentStaleness';

/** Ticker of the last 12 forecasts plus the telemetry strip (design.md §3.4, §4.6). */
export function TelemetryBar() {
  const status = useAgentStatus();
  const latest = useLatestForecast();
  // Same query key as the forecasts table (limit 24); the ticker slices, it does not refetch.
  const history = useForecastHistory(24);
  const mode = useAgentMode();
  const w = useWallet();
  const perf = usePerfReadout();
  const vault = useVaultTelemetry();
  const stale = status.data ? isForecastStale(status.data) : false;
  const lag = status.data ? forecastLagHours(status.data) : undefined;
  const tvl = vault.data ? Object.values(vault.data.chains).reduce((acc, c) => acc + (c?.tvlUsd ?? 0), 0) : undefined;

  const agentTone = status.status === 'error' ? 'down' : status.data?.ok ? 'up' : 'warn';
  const items: TelemetryItem[] = [
    { key: 'agent', label: 'agent', value: mode === 'offline' ? 'not configured' : status.status === 'error' ? 'down' : mode === 'fixture' ? <Term id="fixture">fixture</Term> : status.data?.ok ? 'ok' : '…', tone: mode === 'offline' ? 'idle' : agentTone },
    { key: 'warmup', label: 'warmup', value: status.data ? (status.data.warmupComplete ? `${WARMUP_HOURS}/${WARMUP_HOURS}` : `${WARMUP_HOURS - status.data.hoursUntilFirstDecision}/${WARMUP_HOURS}`) : '—' },
    { key: 'tvl', label: 'vault tvl', value: vault.status === 'error' ? 'unavailable' : tvl === undefined ? '…' : formatUsd(tvl), tone: vault.status === 'error' ? 'warn' : 'argon' },
    { key: 'hour', label: 'last hour', value: latest.data?.hourId ?? '—' },
    { key: 'print', label: 'last print', value: lag === undefined ? '—' : lag === 0 ? 'this hour' : `${lag}h ago`, tone: stale ? 'warn' : 'up' },
    ...(status.data ? [{ key: 'keeper', label: 'keeper', value: status.data.dryRun ? 'dry-run · no on-chain submits' : 'live', tone: status.data.dryRun ? 'warn' : 'up' } as TelemetryItem] : []),
    // Scheduled news pause: shown while active (exit-only), and as the next window when one is scheduled.
    ...(status.data?.newsPause?.active && status.data.newsPause.current
      ? [{ key: 'news', label: 'news pause', value: `${status.data.newsPause.current.events.map((e) => e.title).join(', ') || 'release'} · exit-only until ${status.data.newsPause.current.resumesAt.slice(11, 16)} UTC`, tone: 'warn' } as TelemetryItem]
      : status.data?.newsPause?.next
        ? [{ key: 'news', label: 'next news pause', value: `${status.data.newsPause.next.events.map((e) => e.title).join(', ') || 'release'} · ${status.data.newsPause.next.exitAt.slice(5, 16).replace('T', ' ')} UTC`, tone: 'idle' } as TelemetryItem]
        : []),
    { key: 'arb', label: 'arb', value: getVault(arbitrum.id) ? arbitrum.id : 'no vault', tone: getVault(arbitrum.id) ? 'argon' : 'idle' },
    { key: 'rh', label: 'rh', value: getVault(robinhood.id) ? robinhood.id : 'no vault', tone: getVault(robinhood.id) ? 'argon' : 'idle' },
    { key: 'wallet', label: 'wallet', value: w.isConnected ? `${w.walletChainId ?? '?'}` : 'off', tone: w.isConnected ? 'up' : 'idle' },
    ...(perf
      ? [{ key: 'frame', label: 'frame', value: `${perf.avgMs.toFixed(1)}ms · drop ${perf.dropped}`, tone: perf.avgMs > 4 ? 'warn' : 'up' } as TelemetryItem]
      : []),
  ];

  const ticker: TickerItem[] = (history.data?.items ?? []).slice(0, 12).map((f) => ({
    key: f.hourId,
    node: (
      <span className="flex items-center gap-2">
        <span className="text-text-lo">{f.hourId}</span>
        <span className={cn(f.ethPctChange < 0 ? 'text-signal-down' : f.ethPctChange > 0 ? 'text-signal-up' : 'text-text-hi')}>{formatPct(f.ethPctChange)}</span>
        <span className="label">{f.action}</span>
      </span>
    ),
  }));

  return (
    <div className="flex flex-col gap-2">
      <TickerTape items={ticker} />
      <Telemetry items={items} trailing="utc" />
    </div>
  );
}
