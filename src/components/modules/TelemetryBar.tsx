'use client';

import { Telemetry, TickerTape, type TelemetryItem, type TickerItem } from '@/components/simulation';
import { useAgentMode, useAgentStatus, useForecastHistory, useLatestForecast, usePerfReadout, useWallet } from '@/hooks';
import { Term } from '@/components/ui';
import { arbitrum, robinhood } from '@/services/chains';
import { getVault } from '@/services/contracts';
import { cn } from '@/utils/cn';
import { formatPct } from '@/utils/format';

/** Ticker of the last 12 forecasts plus the telemetry strip (design.md §3.4, §4.6). */
export function TelemetryBar() {
  const status = useAgentStatus();
  const latest = useLatestForecast();
  const history = useForecastHistory(12);
  const mode = useAgentMode();
  const w = useWallet();
  const perf = usePerfReadout();

  const agentTone = status.status === 'error' ? 'down' : status.data?.ok ? 'up' : 'warn';
  const items: TelemetryItem[] = [
    { key: 'agent', label: 'agent', value: mode === 'offline' ? 'not configured' : status.status === 'error' ? 'down' : mode === 'fixture' ? <Term id="fixture">fixture</Term> : status.data?.ok ? 'ok' : '…', tone: mode === 'offline' ? 'idle' : agentTone },
    { key: 'warmup', label: 'warmup', value: status.data ? (status.data.warmupComplete ? '8/8' : `${8 - status.data.hoursUntilFirstDecision}/8`) : '—' },
    { key: 'hour', label: 'last hour', value: latest.data?.hourId ?? '—' },
    { key: 'arb', label: 'arb', value: getVault(arbitrum.id) ? arbitrum.id : 'no vault', tone: getVault(arbitrum.id) ? 'argon' : 'idle' },
    { key: 'rh', label: 'rh', value: getVault(robinhood.id) ? robinhood.id : 'no vault', tone: getVault(robinhood.id) ? 'argon' : 'idle' },
    { key: 'wallet', label: 'wallet', value: w.isConnected ? `${w.walletChainId}` : 'off', tone: w.isConnected ? 'up' : 'idle' },
    ...(perf
      ? [{ key: 'frame', label: 'frame', value: `${perf.avgMs.toFixed(1)}ms · drop ${perf.dropped}`, tone: perf.avgMs > 4 ? 'warn' : 'up' } as TelemetryItem]
      : []),
  ];

  const ticker: TickerItem[] = (history.data?.items ?? []).map((f) => ({
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
