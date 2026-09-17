'use client';

import dynamic from 'next/dynamic';
import { useCallback, useRef } from 'react';

import { ForecastHero, HashMatch, PoolCard, TelemetryBar, WalletStrip, WarmupBar } from '@/components/modules';
import { KeeperAvatar, type Attractor, type FieldMode } from '@/components/simulation';
import { useAgentMode, useAgentStatus, useHashMatch, useLatestForecast } from '@/hooks';
import { useUiStore } from '@/stores/ui';
import { POOLS } from '@/types/pools';
import { gateChip } from '@/utils/policy';

// Simulation loads after the data widgets and never on the server (architecture.md §4.7).
const ParticleField = dynamic(() => import('@/components/simulation/ParticleField').then((m) => m.ParticleField), {
  ssr: false,
});

/** Dense tactical grid (design.md §4.10): hero 6 / keeper 2 / hash 4, pools 3 each, wallet + warmup. */
export function Dashboard() {
  const chainId = useUiStore((s) => s.selectedChainId);
  const latest = useLatestForecast();
  const status = useAgentStatus();
  const mode = useAgentMode();
  const match = useHashMatch(chainId, latest.data);

  const pct = latest.data?.ethPctChange ?? match.chainPct;
  const warmupComplete = latest.data?.warmupComplete ?? status.data?.warmupComplete ?? false;
  const fieldMode: FieldMode = pct === null || pct === undefined ? 'OFFLINE' : !warmupComplete ? 'WARMUP' : gateChip(pct);

  // The avatar writes its viewport center here; the field reads it every frame. No render.
  const attractorRef = useRef<Attractor | null>(null);
  const onCenterChange = useCallback((x: number, y: number) => {
    attractorRef.current = { x, y };
  }, []);

  return (
    <div className="relative">
      <ParticleField
        ethPctChange={pct ?? null}
        mode={fieldMode}
        action={latest.data?.action}
        fixture={mode === 'fixture'}
        pulseKey={latest.data?.hourId}
        attractorRef={attractorRef}
        className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
      />

      <div className="flex flex-col gap-4">
        <TelemetryBar />

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-6">
            <ForecastHero chainId={chainId} delay={0} />
          </div>
          <div className="col-span-12 flex items-center justify-center py-4 sm:col-span-6 lg:col-span-2 lg:py-0">
            <KeeperAvatar
              ethPctChange={pct ?? null}
              action={latest.data?.action}
              warmupComplete={warmupComplete}
              reachable={latest.status !== 'error' || match.chainPct !== null}
              mode={mode}
              hourId={latest.data?.hourId}
              size={180}
              onCenterChange={onCenterChange}
            />
          </div>
          <div className="col-span-12 sm:col-span-6 lg:col-span-4">
            <HashMatch chainId={chainId} api={latest.data} delay={0.08} />
          </div>

          <div className="col-span-12">
            <WarmupBar />
          </div>

          {POOLS.map((p, i) => (
            <div key={p.id} className="col-span-12 sm:col-span-6 lg:col-span-3">
              <PoolCard pool={p} delay={0.16 + i * 0.04} />
            </div>
          ))}

          <div className="col-span-12">
            <WalletStrip delay={0.36} />
          </div>
        </div>

        <p className="text-center label text-text-dim">custody on-chain · judgment off-chain · the website is not the keeper</p>
      </div>
    </div>
  );
}
