'use client';

import dynamic from 'next/dynamic';

import { ForecastHero, HashMatch, PoolCard, TelemetryBar, WalletStrip, WarmupBar } from '@/components/modules';
import type { FieldMode } from '@/components/simulation';
import { useAgentStatus, useHashMatch, useLatestForecast } from '@/hooks';
import { useUiStore } from '@/stores/ui';
import { POOLS } from '@/types/pools';
import { gateChip } from '@/utils/policy';

// Simulation loads after the data widgets and never on the server (architecture.md §4.7).
const ParticleField = dynamic(() => import('@/components/simulation/ParticleField').then((m) => m.ParticleField), {
  ssr: false,
});

/** Dense tactical grid (design.md §4.10): hero 8 / hash 4, pools 3 each, wallet + warmup. */
export function Dashboard() {
  const chainId = useUiStore((s) => s.selectedChainId);
  const latest = useLatestForecast();
  const status = useAgentStatus();
  const match = useHashMatch(chainId, latest.data);

  const pct = latest.data?.ethPctChange ?? match.chainPct;
  const warmupComplete = latest.data?.warmupComplete ?? status.data?.warmupComplete ?? false;
  const mode: FieldMode =
    pct === null || pct === undefined ? 'OFFLINE' : !warmupComplete ? 'WARMUP' : gateChip(pct);

  return (
    <div className="relative">
      <ParticleField
        ethPctChange={pct ?? null}
        mode={mode}
        pulseKey={latest.data?.hourId}
        className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
      />

      <div className="flex flex-col gap-4">
        <TelemetryBar />

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8">
            <ForecastHero chainId={chainId} />
          </div>
          <div className="col-span-12 lg:col-span-4">
            <HashMatch chainId={chainId} api={latest.data} />
          </div>

          <div className="col-span-12">
            <WarmupBar />
          </div>

          {POOLS.map((p) => (
            <div key={p.id} className="col-span-12 sm:col-span-6 lg:col-span-3">
              <PoolCard pool={p} />
            </div>
          ))}

          <div className="col-span-12">
            <WalletStrip />
          </div>
        </div>

        <p className="text-center label text-text-dim">
          custody on-chain · judgment off-chain · the website is not the keeper
        </p>
      </div>
    </div>
  );
}
