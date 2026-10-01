'use client';

import Link from 'next/link';

import { Button, Chip, Panel, RevealItem, Skeleton, StaggerText, Term } from '@/components/ui';
import { usePortfolio, useVaultBalances, useWallet } from '@/hooks';
import { getVault } from '@/services/contracts';
import { chainName } from '@/services/explorer';
import { useUiStore } from '@/stores/ui';
import { formatToken, formatUsd, truncateAddress } from '@/utils/format';

import { ConnectButton } from './ConnectButton';

/**
 * Wallet strip (design.md §5.2 widget 5). Two sources, kept distinct on screen:
 *   - GET /portfolio/{address} every 10 s → live USD equity (totalUsd) and per-chain
 *     shareUsd, the agent's oracle-priced valuation;
 *   - on-chain reads → idle token claims, which remain authoritative for money.
 * The admin chip is gated on NEXT_PUBLIC_ADMIN_ADDRESS and unlocks the read-only keeper
 * panel; it never unlocks a write.
 */
export function WalletStrip({ delay = 0 }: { delay?: number }) {
  const w = useWallet();
  const chainId = useUiStore((s) => s.selectedChainId);
  const balances = useVaultBalances(chainId, w.address);
  const portfolio = usePortfolio(w.address);
  const deployed = Boolean(getVault(chainId));
  const p = portfolio.data;

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
            {w.isAdmin && <Chip tone="ion">admin · keeper</Chip>}
          </>
        ) : (
          <span className="text-text-lo">connect to see vault balances</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <ConnectButton size="sm" />
        </div>
      </RevealItem>

      {/* Live equity from the agent (10 s) */}
      {w.isConnected && (
        <RevealItem className="mt-5">
          <div className="label-lg mb-2">
            <Term id="shares">vault equity</Term> · live 10 s
          </div>
          {portfolio.status === 'pending' ? (
            <Skeleton chars={10} slow className="data-hero text-4xl sm:text-5xl" />
          ) : portfolio.status === 'error' ? (
            <span className="font-mono text-sm text-signal-warn">{portfolio.error.message}</span>
          ) : p ? (
            <>
              <StaggerText text={formatUsd(p.totalUsd)} className="data-hero text-4xl text-text-hi glow-text sm:text-5xl" />
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[0.75rem] leading-5">
                {(['arbitrum', 'robinhood'] as const).map((k) => {
                  const c = p.chains[k];
                  return (
                    <span key={k} className="font-mono">
                      <span className="label mr-1">{k}</span>
                      <span className="text-text-mid">{c ? formatUsd(c.shareUsd) : '—'}</span>
                      {c?.inPool && <span className="ml-1 text-signal-up">· in pool</span>}
                      {c?.error && <span className="ml-1 text-signal-warn">· {c.error}</span>}
                    </span>
                  );
                })}
                <span className="text-text-dim">updated {new Date(p.updatedAt).toISOString().slice(11, 19)} UTC</span>
              </div>
            </>
          ) : null}
        </RevealItem>
      )}

      {/* On-chain claims: authoritative */}
      <RevealItem className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-2 text-[0.75rem] leading-5">
        <span className="label leading-5"><Term id="idle">idle claim · on-chain</Term></span>
        {!deployed ? (
          <span className="text-text-dim">vault not deployed on {chainName(chainId)}</span>
        ) : !w.isConnected ? (
          <span className="text-text-dim">—</span>
        ) : balances.status === 'pending' ? (
          <Skeleton chars={22} />
        ) : balances.status === 'error' ? (
          <span className="text-signal-warn">read failed</span>
        ) : (
          <>
            {balances.data?.idle.map((b) => (
              <span key={b.token.symbol} className="text-text-mid">
                {formatToken(b.idle, b.token.decimals)} <span className="text-text-lo">{b.token.symbol}</span>
              </span>
            ))}
            <span className="text-text-dim">· {formatToken(balances.data?.shares ?? 0n, 18, 4)} shares</span>
          </>
        )}
      </RevealItem>

      <RevealItem className="mt-5 flex flex-wrap gap-3">
        {deployed ? (
          <>
            <Link href="/app/deposit" className="contents">
              <Button size="sm">deposit</Button>
            </Link>
            <Link href="/app/withdraw" className="contents">
              <Button size="sm" variant="ghost">
                withdraw
              </Button>
            </Link>
          </>
        ) : (
          <>
            <Button size="sm" disabled magnetic={false} reason={`vault not deployed on ${chainName(chainId)}`}>
              deposit
            </Button>
            <Button size="sm" variant="ghost" disabled magnetic={false}>
              withdraw
            </Button>
          </>
        )}
      </RevealItem>
    </Panel>
  );
}
