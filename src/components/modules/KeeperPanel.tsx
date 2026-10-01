'use client';

import { HashText, Panel, RevealItem } from '@/components/ui';
import { useAgentStatus, useRegistryForecast, useVaultParams, useWallet } from '@/hooks';
import { arbitrum, robinhood } from '@/services/chains';
import { getRegistry, getVault } from '@/services/contracts';
import { addressUrl } from '@/services/explorer';

/**
 * Read-only keeper diagnostics, rendered only when the connected wallet equals
 * NEXT_PUBLIC_ADMIN_ADDRESS (the vault owner / keeper). Nothing here writes: it exists
 * so the operator can see DRY_RUN, clock position, and registry submit counts on both
 * chains without opening Heroku. Default users never see this panel.
 */
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <>
      <dt className="label leading-5">{k}</dt>
      <dd className="font-mono text-[0.75rem] leading-5 text-text-mid">{v}</dd>
    </>
  );
}

export function KeeperPanel({ delay = 0 }: { delay?: number }) {
  const w = useWallet();
  const status = useAgentStatus();
  const regArb = useRegistryForecast(arbitrum.id, status.data?.lastHourId ?? undefined);
  const regRh = useRegistryForecast(robinhood.id, status.data?.lastHourId ?? undefined);
  const vaultArb = useVaultParams(arbitrum.id);
  const vaultRh = useVaultParams(robinhood.id);
  if (!w.isAdmin) return null;
  const s = status.data;

  return (
    <Panel label="KEEPER · ADMIN" meta="read-only diagnostics" delay={delay} glow="hold">
      <RevealItem>
        <dl className="grid grid-cols-[8rem_1fr] items-baseline gap-x-4 gap-y-2">
          <Row k="dry run" v={s ? (s.dryRun ? <span className="text-signal-warn">true · keeper sends no txs</span> : <span className="text-signal-up">false · live</span>) : '—'} />
          <Row k="model" v={s?.modelId ?? '—'} />
          <Row k="clock" v={s ? `last ${s.lastHourId ?? '—'} · now ${s.currentHourId} · ${s.currentHourId - (s.lastHourId ?? s.currentHourId)} h behind` : '—'} />
          <Row k="warmup" v={s ? (s.warmupComplete ? 'complete' : `${s.hoursUntilFirstDecision} submits to go`) : '—'} />
          <Row k="database" v={s?.database ?? '—'} />
          <Row k="registry · arb" v={`${regArb.data?.forecastCount ?? '—'} submits · latest hour ${regArb.data?.latestHourId ?? '—'}`} />
          <Row k="registry · rh" v={`${regRh.data?.forecastCount ?? '—'} submits · latest hour ${regRh.data?.latestHourId ?? '—'}`} />
          <Row k="vault · arb" v={`${vaultArb.data?.totalShares !== undefined ? (Number(vaultArb.data.totalShares) / 1e18).toFixed(4) : '—'} total shares · warmup ${vaultArb.data?.warmupComplete ?? '—'}`} />
          <Row k="vault · rh" v={`${vaultRh.data?.totalShares !== undefined ? (Number(vaultRh.data.totalShares) / 1e18).toFixed(4) : '—'} total shares · warmup ${vaultRh.data?.warmupComplete ?? '—'}`} />
          <Row k="contracts" v={<span className="flex flex-wrap gap-3">{getVault(arbitrum.id) && <HashText value={getVault(arbitrum.id)?.address} href={addressUrl(arbitrum.id, getVault(arbitrum.id)!.address)} />}{getRegistry(arbitrum.id) && <HashText value={getRegistry(arbitrum.id)?.address} href={addressUrl(arbitrum.id, getRegistry(arbitrum.id)!.address)} />}</span>} />
        </dl>
      </RevealItem>
    </Panel>
  );
}
