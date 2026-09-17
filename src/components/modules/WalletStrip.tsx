'use client';

import Link from 'next/link';

import { Button, Chip, Panel, RevealItem } from '@/components/ui';
import { useVaultBalances, useWallet } from '@/hooks';
import { getVault } from '@/services/contracts';
import { chainName } from '@/services/explorer';
import { useUiStore } from '@/stores/ui';
import { formatToken, truncateAddress } from '@/utils/format';

import { ConnectButton } from './ConnectButton';

/** Address, chain, idle balances in the vault, deposit/withdraw entry points (design.md §5.2 widget 5). */
export function WalletStrip({ delay = 0 }: { delay?: number }) {
  const w = useWallet();
  const chainId = useUiStore((s) => s.selectedChainId);
  const balances = useVaultBalances(chainId, w.address);
  const deployed = Boolean(getVault(chainId));

  return (
    <Panel label="WALLET" meta={w.isConnected ? `${chainName(chainId)} · ${chainId}` : 'disconnected'} delay={delay}>
      <RevealItem className="flex flex-wrap items-center gap-3">
        {w.isConnected && w.address ? (
          <>
            <span className="text-text-hi" title={w.address}>
              {truncateAddress(w.address)}
            </span>
            {!w.onSupportedChain && (
              <Chip tone="warn" dot>
                wrong chain
              </Chip>
            )}
            {w.isAdmin && <Chip tone="ion">admin</Chip>}
          </>
        ) : (
          <span className="text-text-lo">connect to see vault balances</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <ConnectButton size="sm" />
        </div>
      </RevealItem>

      <RevealItem className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.75rem]">
        <span className="label">idle in vault</span>
        {!deployed ? (
          <span className="text-text-dim">vault not deployed on {chainName(chainId)}</span>
        ) : !w.isConnected ? (
          <span className="text-text-dim">—</span>
        ) : balances.status === 'pending' ? (
          <span className="text-text-dim">reading…</span>
        ) : balances.status === 'error' ? (
          <span className="text-signal-warn">read failed</span>
        ) : (
          balances.data?.idle.map((b) => (
            <span key={b.token.symbol} className="text-text-mid">
              {formatToken(b.idle, b.token.decimals)} <span className="text-text-lo">{b.token.symbol}</span>
            </span>
          ))
        )}
      </RevealItem>

      <RevealItem className="mt-3 flex gap-2">
        <Link href="/app/deposit" className="contents">
          <Button size="sm">deposit</Button>
        </Link>
        <Link href="/app/withdraw" className="contents">
          <Button size="sm" variant="ghost">
            withdraw
          </Button>
        </Link>
      </RevealItem>
    </Panel>
  );
}
