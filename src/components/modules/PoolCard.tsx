'use client';

import { Chip, HashText, Panel, type ChipTone } from '@/components/ui';
import { useLatestForecast, usePoolStatuses, useVaultBalances, useWallet } from '@/hooks';
import { getVault } from '@/services/contracts';
import { chainName, txUrl } from '@/services/explorer';
import type { PoolCardStatus, PoolDef } from '@/types/pools';
import { cn } from '@/utils/cn';
import { formatToken } from '@/utils/format';

/**
 * Pool status panel (design.md §4.4, product.md §3.3). Status is a function of the
 * vault read and funding, never of the forecast alone (CLAUDE.md §1.7).
 */
const TONE: Record<PoolCardStatus, ChipTone> = {
  IN_POOL: 'up',
  IDLE: 'idle',
  UNFUNDED: 'idle',
  LINK_SOON: 'soon',
  NOT_DEPLOYED: 'idle',
};

export function PoolCard({ pool }: { pool: PoolDef }) {
  const { address } = useWallet();
  const statuses = usePoolStatuses(pool.chainId);
  const balances = useVaultBalances(pool.chainId, address);
  const latest = useLatestForecast();
  const deployed = Boolean(getVault(pool.chainId));

  let status: PoolCardStatus;
  if (!pool.gated) status = 'LINK_SOON';
  else if (!deployed) status = 'NOT_DEPLOYED';
  else if (balances.data && !balances.data.funded) status = 'UNFUNDED';
  else status = statuses.data?.[pool.id] === 1 ? 'IN_POOL' : 'IDLE';

  const exitPending = status === 'IN_POOL' && latest.data?.action === 'exit' && latest.data.txHash !== null;
  const legs = balances.data?.idle.filter((b) => pool.pair.includes(b.token.symbol)) ?? [];

  return (
    <Panel
      label={`POOL ${pool.id}`}
      meta={`${chainName(pool.chainId)} · ${pool.dex === 'uniswap-v3' ? 'v3' : 'v4'}`}
      className={cn(status === 'LINK_SOON' && 'opacity-60')}
      active={status === 'IN_POOL'}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-display text-lg text-text-hi">
          {pool.pair[0]} / {pool.pair[1]}
        </span>
        <div className="flex flex-col items-end gap-1">
          <Chip tone={TONE[status]} dot flipKey={status}>
            {status === 'NOT_DEPLOYED' ? 'not deployed' : status.replace('_', ' ')}
          </Chip>
          {exitPending && <Chip tone="warn">exit pending</Chip>}
        </div>
      </div>

      {status === 'LINK_SOON' ? (
        <p className="mt-3 text-text-lo">LINK — model later</p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-[4ch_1fr] gap-x-3 gap-y-1 text-[0.75rem]">
            <dt className="label">idle</dt>
            <dd className="text-text-mid">
              {legs.length === 0 || !address
                ? '—'
                : legs.map((b) => `${formatToken(b.idle, b.token.decimals)} ${b.token.symbol}`).join(' · ')}
            </dd>
            <dt className="label">last</dt>
            <dd className="text-text-mid">
              {latest.data?.txHash ? (
                <HashText value={latest.data.txHash} href={txUrl(pool.chainId, latest.data.txHash)} />
              ) : (
                '— no rebalance yet'
              )}
              {latest.data && <span className="ml-2 text-text-dim">hour {latest.data.hourId}</span>}
            </dd>
          </dl>
        </>
      )}
    </Panel>
  );
}
