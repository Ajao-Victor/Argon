'use client';

import { Button, Chip, DisconnectedState, HashText, Panel, RevealItem, Skeleton, Term, type ChipTone } from '@/components/ui';
import { useLatestForecast, usePools, poolForChain, usePoolStatuses, useVaultBalances, useWallet } from '@/hooks';
import { getVault } from '@/services/contracts';
import { chainName, txUrl } from '@/services/explorer';
import { useUiStore } from '@/stores/ui';
import type { PoolCardStatus, PoolDef } from '@/types/pools';
import { cn } from '@/utils/cn';
import { formatToken, formatUsd } from '@/utils/format';

/**
 * Interactive pool card (design.md §4.4, product.md §3.3) fed by two sources:
 *   - on-chain reads (poolStatus, idleBalance, shares) remain authoritative for state
 *     and money (ENGINEERING.md §1.7);
 *   - GET /pools supplies the market view: live APR (DefiLlama, or "—" when the agent
 *     reports it unavailable), Uniswap pool TVL, ETH price, fee tier and a deposit hint.
 * Clicking a gated card selects that chain for deposit / withdraw (ui store) and asks a
 * connected wallet to switch. The agent requires exactly one chain per deposit.
 */
const TONE: Record<PoolCardStatus, ChipTone> = { IN_POOL: 'up', IDLE: 'idle', UNFUNDED: 'idle', LINK_SOON: 'soon', NOT_DEPLOYED: 'idle' };
const STATUS_CLASS: Record<PoolCardStatus, string> = { IN_POOL: 'text-signal-up', IDLE: 'text-text-mid', UNFUNDED: 'text-text-lo', LINK_SOON: 'text-signal-soon', NOT_DEPLOYED: 'text-text-lo' };
const STATUS_WORD: Record<PoolCardStatus, string> = { IN_POOL: 'IN POOL', IDLE: 'IDLE', UNFUNDED: 'UNFUNDED', LINK_SOON: 'SOON', NOT_DEPLOYED: 'NOT DEPLOYED' };
const STATUS_TERM: Record<PoolCardStatus, 'inPool' | 'idle' | undefined> = { IN_POOL: 'inPool', IDLE: 'idle', UNFUNDED: 'idle', LINK_SOON: undefined, NOT_DEPLOYED: undefined };

/** The agent's free-text keeper outcome per chain, rendered as a chip (or a link when it is a tx hash). */
function RebalanceTag({ value, chainId }: { value: string | null; chainId: 42161 | 4663 }) {
  if (!value) return <Chip tone="idle">no rebalance yet</Chip>;
  if (/^0x[0-9a-fA-F]{64}$/.test(value)) return <HashText value={value} href={txUrl(chainId, value)} />;
  if (value === 'warmup-skip') return <Chip tone="idle">warmup · skipped</Chip>;
  if (value === 'hold') return <Chip tone="argon">hold</Chip>;
  if (/dry/i.test(value)) return <Chip tone="warn">{value}</Chip>;
  return <Chip tone="plain">{value}</Chip>;
}

function compactUsd(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return formatUsd(v);
}

export function PoolCard({ pool, delay = 0 }: { pool: PoolDef; delay?: number }) {
  const w = useWallet();
  const { address } = w;
  const statuses = usePoolStatuses(pool.chainId);
  const balances = useVaultBalances(pool.chainId, address);
  const latest = useLatestForecast();
  const pools = usePools();
  const live = pool.gated ? poolForChain(pools.data, pool.chainId) : undefined;
  const deployed = Boolean(getVault(pool.chainId));

  const selected = useUiStore((s) => s.selectedChainId);
  const setSelected = useUiStore((s) => s.setSelectedChainId);
  const isSelected = pool.gated && selected === pool.chainId;

  let status: PoolCardStatus;
  if (!pool.gated) status = 'LINK_SOON';
  else if (!deployed) status = 'NOT_DEPLOYED';
  else if (address && balances.data && !balances.data.funded) status = 'UNFUNDED';
  else {
    const onChain = statuses.data?.[pool.id];
    // On-chain read is authoritative; the agent's inPool is a fallback while the RPC read is unavailable.
    const inPool = onChain !== undefined ? onChain === 1 : (live?.inPool ?? false);
    status = inPool ? 'IN_POOL' : 'IDLE';
  }

  const keeperTx = pool.chainId === 42161 ? latest.data?.txHash : latest.data?.txHashRh;
  const exitPending = status === 'IN_POOL' && latest.data?.action === 'exit' && Boolean(keeperTx);
  const legs = balances.data?.idle.filter((b) => pool.pair.includes(b.token.symbol)) ?? [];

  const select = () => {
    if (!pool.gated) return;
    setSelected(pool.chainId);
    if (w.isConnected && w.walletChainId !== pool.chainId) w.switchChain(pool.chainId);
  };

  return (
    <Panel
      label={`POOL ${pool.id}`}
      meta={`${chainName(pool.chainId)} · ${pool.dex === 'uniswap-v3' ? 'v3' : 'v4'}${live ? ` · ${live.feePercent}%` : ''}`}
      className={cn(status === 'LINK_SOON' && 'opacity-60', isSelected && 'ring-1 ring-argon-500/60')}
      active={status === 'IN_POOL' || isSelected}
      delay={delay}
    >
      <RevealItem className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <span className="label-lg">
            {pool.pair[0]} / {pool.pair[1]}
          </span>
          <div className="flex items-center gap-2">
            {isSelected && <Chip tone="argon">selected</Chip>}
            {exitPending ? <Chip tone="warn">exit pending</Chip> : <Chip tone={TONE[status]} dot flipKey={status}>{status === 'NOT_DEPLOYED' ? 'contracts not deployed' : status.replace('_', ' ').toLowerCase()}</Chip>}
          </div>
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
      ) : (
        <>
          {/* Market view from GET /pools: public, needs no wallet */}
          <RevealItem>
            <dl className="mt-5 grid grid-cols-[4.5rem_1fr] items-baseline gap-x-4 gap-y-2 text-[0.75rem] leading-5">
              <dt className="label leading-5"><Term id="apr">apr</Term></dt>
              <dd className="font-mono text-text-hi">
                {pools.status === 'pending' ? <Skeleton chars={8} scan={false} /> : live?.aprPct !== null && live?.aprPct !== undefined ? `${live.aprPct.toFixed(2)}%` : '—%'}
                {live && <span className="ml-2 text-text-dim">{live.aprSource === 'defillama' ? 'defillama' : 'APR unavailable on DefiLlama'}</span>}
              </dd>
              <dt className="label leading-5">pool tvl</dt>
              <dd className="font-mono text-text-mid">
                {pools.status === 'pending' ? <Skeleton chars={10} scan={false} /> : live ? compactUsd(live.poolTvlUsd) : '—'}
                {live?.volumeUsd1d !== null && live?.volumeUsd1d !== undefined && <span className="ml-2 text-text-dim">· {compactUsd(live.volumeUsd1d)} 24h vol</span>}
              </dd>
              <dt className="label leading-5">eth</dt>
              <dd className="font-mono text-text-mid">{live ? formatUsd(live.ethUsd) : '—'}</dd>
            </dl>
          </RevealItem>

          {/* Position view: on-chain, wallet required */}
          {!address ? (
            <RevealItem className="mt-3 flex flex-1">
              <DisconnectedState compact title="wallet offline" cta="connect to initialize" />
            </RevealItem>
          ) : (
            <RevealItem>
              <dl className="mt-4 grid grid-cols-[4.5rem_1fr] items-baseline gap-x-4 gap-y-2 border-t border-hairline pt-4 text-[0.75rem] leading-5">
                <dt className="label leading-5"><Term id="idle">idle</Term></dt>
                <dd className="text-text-mid">
                  {balances.status === 'pending' ? <Skeleton chars={18} /> : legs.length === 0 ? '—' : legs.map((b) => `${formatToken(b.idle, b.token.decimals)} ${b.token.symbol}`).join(' · ')}
                </dd>
                <dt className="label leading-5"><Term id="lastRebalance">keeper</Term></dt>
                <dd className="text-text-mid">
                  {keeperTx ? <HashText value={keeperTx} href={txUrl(pool.chainId, keeperTx)} /> : latest.data ? <RebalanceTag value={pool.chainId === 42161 ? latest.data.rebalanceTx : latest.data.rebalanceTxRh} chainId={pool.chainId} /> : '—'}
                  {latest.data && <span className="ml-2 text-text-dim">hour {latest.data.hourId}</span>}
                </dd>
              </dl>
            </RevealItem>
          )}

          <RevealItem className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
            <span className="text-[0.6875rem] leading-5 text-text-dim">{isSelected ? 'selected for deposit / withdraw' : (live?.depositHint ?? `Select to deposit on ${chainName(pool.chainId)}`)}</span>
            <Button size="sm" variant={isSelected ? 'ghost' : 'primary'} onClick={select} aria-pressed={isSelected} disabled={isSelected} magnetic={!isSelected}>
              {isSelected ? 'selected' : 'select vault'}
            </Button>
          </RevealItem>
        </>
      )}
    </Panel>
  );
}
