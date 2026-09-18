'use client';

import { Chip, DataTable, DisconnectedState, HashText, Panel, SkeletonLines, type ChipTone, type Column } from '@/components/ui';
import { useActivity, useWallet } from '@/hooks';
import type { SupportedChainId } from '@/services/chains';
import { getVault } from '@/services/contracts';
import { chainName, txUrl } from '@/services/explorer';
import { tokenByAddress } from '@/services/tokens';
import type { ActivityEvent } from '@/services/logs';
import { formatToken } from '@/utils/format';

/** Deposited / Withdrawn / Rebalanced events (spec §5.1 /app/activity). Source: bounded getLogs. */
const KIND_TONE: Record<ActivityEvent['kind'], ChipTone> = { Deposited: 'up', Withdrawn: 'warn', Rebalanced: 'argon' };
const ACTION_NAME: Record<number, string> = { 0: 'exit', 1: 'enter', 2: 'hold' };

export function ActivityFeed({ chainId, delay = 0 }: { chainId: SupportedChainId; delay?: number }) {
  const { address } = useWallet();
  const activity = useActivity(chainId, address);
  const deployed = Boolean(getVault(chainId));
  const rows = activity.data ?? [];

  const columns: readonly Column<ActivityEvent>[] = [
    { key: 'kind', header: 'event', render: (e) => <Chip tone={KIND_TONE[e.kind]}>{e.kind}</Chip> },
    { key: 'block', header: 'block', render: (e) => <span className="text-text-lo">{e.blockNumber.toString()}</span> },
    {
      key: 'detail',
      header: 'detail',
      render: (e) => {
        if (e.kind === 'Rebalanced') {
          return (
            <span className="text-text-mid">
              pool {e.poolId} · {ACTION_NAME[e.action ?? -1] ?? e.action} · hour {e.hourId?.toString()}
            </span>
          );
        }
        const t = e.token ? tokenByAddress(chainId, e.token) : undefined;
        return (
          <span className="text-text-mid">
            {e.amount !== undefined && t ? `${formatToken(e.amount, t.decimals)} ${t.symbol}` : e.amount?.toString()}
          </span>
        );
      },
    },
    { key: 'hash', header: 'hash', render: (e) => <HashText value={e.forecastHash ?? null} /> },
    { key: 'tx', header: 'tx', render: (e) => <HashText value={e.txHash} href={txUrl(chainId, e.txHash)} /> },
  ];

  return (
    <Panel label="ACTIVITY" meta={`${chainName(chainId)} · ${deployed ? `${rows.length} events` : 'vault not deployed'}`} padded={!address || (deployed && activity.status === 'pending')} delay={delay}>
      {!address ? (
        <DisconnectedState copy="Connect a wallet to see your deposits and withdrawals. Keeper rebalances are public and will appear once you connect." />
      ) : deployed && activity.status === 'pending' ? (
        <div className="flex flex-col gap-3">
          <span className="label leading-5">scanning logs</span>
          <SkeletonLines lines={4} chars={40} />
        </div>
      ) : (
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(e) => `${e.txHash}-${e.logIndex}`}
        refreshKey={activity.dataUpdatedAt}
        empty={
          !deployed
            ? `vault not deployed on ${chainName(chainId)}`
            : activity.status === 'pending'
              ? 'scanning logs…'
              : activity.status === 'error'
                ? 'log scan failed'
                : address
                  ? 'no events for this wallet yet'
                  : 'connect a wallet to see deposits and withdrawals; rebalances show for everyone'
        }
      />
      )}
    </Panel>
  );
}
