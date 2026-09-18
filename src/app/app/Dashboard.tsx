'use client';

import dynamic from 'next/dynamic';
import { useCallback, useRef } from 'react';

import { ActivityFeed, ForecastHero, HashMatch, PoolCard, TelemetryBar, WalletStrip, WarmupBar } from '@/components/modules';
import { KeeperAvatar, type Attractor, type FieldMode } from '@/components/simulation';
import { Panel } from '@/components/ui';
import { useAgentMode, useAgentStatus, useHashMatch, useLatestForecast } from '@/hooks';
import { useUiStore } from '@/stores/ui';
import { POOLS } from '@/types/pools';
import { gateChip } from '@/utils/policy';

// Simulation loads after the data widgets and never on the server (architecture.md §4.7).
const ParticleField = dynamic(() => import('@/components/simulation/ParticleField').then((m) => m.ParticleField), {
  ssr: false,
});

/**
 * Bento grid (Phase 7 M2). 12 columns at xl, 6 at md, 1 on mobile. gap-6.
 *
 *   xl:  ┌──────── hero 8 ────────┬─ keeper 4 ─┐
 *        │        (row-span 2)     ├─ hash 4 ───┤
 *        ├──────────── warmup 12 ──────────────┤
 *        ├ pool 3 ┬ pool 3 ┬ pool 3 ┬ pool 3 ──┤
 *        ├── wallet 5 ──┬──── activity 7 ──────┤
 *        └──────────────┴──────────────────────┘
 */
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
    <div className="relative w-full min-w-0">
      <ParticleField
        ethPctChange={pct ?? null}
        mode={fieldMode}
        action={latest.data?.action}
        fixture={mode === 'fixture'}
        pulseKey={latest.data?.hourId}
        attractorRef={attractorRef}
        className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
      />

      <div className="flex flex-col gap-6">
        <TelemetryBar />

        <div className="grid w-full min-w-0 grid-cols-1 gap-4 md:grid-cols-6 md:gap-6 xl:grid-cols-12 xl:auto-rows-min [&>*]:min-w-0">
          {/* Hero: massive spanning slot */}
          <div className="md:col-span-6 xl:col-span-8 xl:row-span-2">
            <ForecastHero chainId={chainId} delay={0} />
          </div>

          {/* Keeper */}
          <Panel label="KEEPER" meta={mode === 'fixture' ? 'training' : 'live'} delay={0.16} className="md:col-span-3 xl:col-span-4">
            <div className="flex flex-1 items-center justify-center py-2">
              <KeeperAvatar
                ethPctChange={pct ?? null}
                action={latest.data?.action}
                warmupComplete={warmupComplete}
                reachable={latest.status !== 'error' || match.chainPct !== null}
                mode={mode}
                hourId={latest.data?.hourId}
                size={168}
                onCenterChange={onCenterChange}
              />
            </div>
          </Panel>

          {/* Hash match */}
          <div className="md:col-span-3 xl:col-span-4">
            <HashMatch chainId={chainId} api={latest.data} delay={0.26} />
          </div>

          {/* Warmup (hidden once complete) */}
          <div className="md:col-span-6 xl:col-span-12 empty:hidden">
            <WarmupBar />
          </div>

          {/* Pools */}
          {POOLS.map((p, i) => (
            <div key={p.id} className="md:col-span-3 xl:col-span-3">
              <PoolCard pool={p} delay={0.38 + i * 0.06} />
            </div>
          ))}

          {/* Wallet + activity */}
          <div className="md:col-span-6 xl:col-span-5">
            <WalletStrip delay={0.66} />
          </div>
          <div className="md:col-span-6 xl:col-span-7">
            <ActivityFeed chainId={chainId} delay={0.74} />
          </div>
        </div>

      </div>
    </div>
  );
}
