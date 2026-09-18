'use client';

import { Chip, DisconnectedState, HashText, Panel, RevealItem, Skeleton, Term, type ChipTone } from '@/components/ui';
import { useLatestForecast, usePoolStatuses, useVaultBalances, useWallet } from '@/hooks';
import { getVault } from '@/services/contracts';
import { chainName, txUrl } from '@/services/explorer';
import type { PoolCardStatus, PoolDef } from '@/types/pools';
import { cn } from '@/utils/cn';
import { formatToken } from '@/utils/format';

/**
 * Pool status panel (design.md §4.4, product.md §3.3). Status is a function of the
 * vault read and funding, never of the forecast alone (ENGINEERING.md §1.7).
 */
const TONE: Record<PoolCardStatus, ChipTone> = {
  IN_POOL: 'up',
  IDLE: 'idle',
  UNFUNDED: 'idle',
  LINK_SOON: 'soon',
  NOT_DEPLOYED: 'idle',
};

const STATUS_CLASS: Record<PoolCardStatus, string> = {
  IN_POOL: 'text-signal-up',
  IDLE: 'text-text-mid',
  UNFUNDED: 'text-text-lo',
  LINK_SOON: 'text-signal-soon',
  NOT_DEPLOYED: 'text-text-lo',
};

const STATUS_WORD: Record<PoolCardStatus, string> = {
  IN_POOL: 'IN POOL',
  IDLE: 'IDLE',
  UNFUNDED: 'UNFUNDED',
  LINK_SOON: 'SOON',
  NOT_DEPLOYED: 'NOT DEPLOYED',
};

const STATUS_TERM: Record<PoolCardStatus, 'inPool' | 'idle' | 'warmup' | undefined> = {
  IN_POOL: 'inPool',
  IDLE: 'idle',
  UNFUNDED: 'idle',
  LINK_SOON: undefined,
  NOT_DEPLOYED: undefined,
};

export function PoolCard({ pool, delay = 0 }: { pool: PoolDef; delay?: number }) {
  const { address } = useWallet();
  const statuses = usePoolStatuses(pool.chainId);
  const balances = useVaultBalances(pool.chainId, address);
  const latest = useLatestForecast();
  const deployed = Boolean(getVault(pool.chainId));

  let status: PoolCardStatus;
  if (!pool.gated) status = 'LINK_SOON';
  else if (!deployed) status = 'NOT_DEPLOYED';
  else if (address && balances.data && !balances.data.funded) status = 'UNFUNDED';
  else status = statuses.data?.[pool.id] === 1 ? 'IN_POOL' : 'IDLE';

  const exitPending = status === 'IN_POOL' && latest.data?.action === 'exit' && latest.data.txHash !== null;
  const legs = balances.data?.idle.filter((b) => pool.pair.includes(b.token.symbol)) ?? [];

  return (
    <Panel
      label={`POOL ${pool.id}`}
      meta={`${chainName(pool.chainId)} · ${pool.dex === 'uniswap-v3' ? 'v3' : 'v4'}`}
      className={cn(status === 'LINK_SOON' && 'opacity-60')}
      active={status === 'IN_POOL'}
      delay={delay}
    >
      <RevealItem className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <span className="label-lg">
            {pool.pair[0]} / {pool.pair[1]}
          </span>
          {exitPending ? <Chip tone="warn">exit pending</Chip> : <Chip tone={TONE[status]} dot flipKey={status}>{status === 'NOT_DEPLOYED' ? 'contracts not deployed' : status.replace('_', ' ').toLowerCase()}</Chip>}
        </div>
        <div className={cn('data-hero text-4xl sm:text-5xl', STATUS_CLASS[status])}>
          {(() => {
            const term = STATUS_TERM[status];
            return term ? <Term id={term}>{STATUS_WORD[status]}</Term> : STATUS_WORD[status];
          })()}
        </div>
      </RevealItem>

      {status === 'LINK_SOON' ? (
        <RevealItem>
          <p className="mt-5 leading-5 text-text-lo">LINK — model later</p>
        </RevealItem>
      ) : status === 'NOT_DEPLOYED' ? (
        <RevealItem>
          <p className="mt-5 leading-5 text-text-lo">
            No vault address for {chainName(pool.chainId)}. Set <span className="font-mono text-text-mid">{pool.chainId === 42161 ? 'NEXT_PUBLIC_VAULT_ARB' : 'NEXT_PUBLIC_VAULT_RH'}</span> and rebuild.
          </p>
        </RevealItem>
      ) : !address ? (
        <RevealItem className="mt-2 flex flex-1">
          <DisconnectedState compact title="wallet offline" cta="connect to initialize" />
        </RevealItem>
      ) : (
        <RevealItem>
          <dl className="mt-5 grid grid-cols-[4.5rem_1fr] items-baseline gap-x-4 gap-y-2 text-[0.75rem] leading-5">
            <dt className="label leading-5"><Term id="idle">idle</Term></dt>
            <dd className="text-text-mid">
              {balances.status === 'pending' ? (
                <Skeleton chars={18} />
              ) : legs.length === 0 ? (
                '—'
              ) : (
                legs.map((b) => `${formatToken(b.idle, b.token.decimals)} ${b.token.symbol}`).join(' · ')
              )}
            </dd>
            <dt className="label leading-5"><Term id="lastRebalance">last</Term></dt>
            <dd className="text-text-mid">
              {latest.data?.txHash ? (
                <HashText value={latest.data.txHash} href={txUrl(pool.chainId, latest.data.txHash)} />
              ) : (
                '— no rebalance yet'
              )}
              {latest.data && <span className="ml-2 text-text-dim">hour {latest.data.hourId}</span>}
            </dd>
          </dl>
        </RevealItem>
      )}
    </Panel>
  );
}
