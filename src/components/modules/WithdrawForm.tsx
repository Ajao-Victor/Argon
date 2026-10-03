'use client';

import { useState } from 'react';

import { Banner, Button, Panel, Term } from '@/components/ui';
import { useEmergencyWithdraw, useNativeBalance, usePoolStatuses, useVaultBalances, useWallet, useWalletTokenBalances, useWithdraw } from '@/hooks';
import { getVault } from '@/services/contracts';
import { chainName } from '@/services/explorer';
import { useUiStore } from '@/stores/ui';
import { cn } from '@/utils/cn';
import { formatToken } from '@/utils/format';

import { ChainSwitcher } from './ChainSwitcher';
import { TxStatus, txBusy } from './TxStatus';

/**
 * Share-based withdraw against the deployed ArgonVault. The user picks a fraction of
 * their shares; the vault burns them, flattens any LP position first, and pays pro-rata
 * WETH + stable. There is no per-token idle withdraw on this contract, so the copy says
 * exactly what will happen. Emergency withdraw burns everything.
 */
const FRACTIONS = [25, 50, 75, 100] as const;

export function WithdrawForm() {
  const chainId = useUiStore((s) => s.selectedChainId);
  const w = useWallet();
  const balances = useVaultBalances(chainId, w.address);
  const pools = usePoolStatuses(chainId);
  const nativeBalance = useNativeBalance(chainId, w.address);
  const walletTokens = useWalletTokenBalances(chainId, w.address);
  const withdraw = useWithdraw(chainId);
  const emergency = useEmergencyWithdraw(chainId);
  const deployed = Boolean(getVault(chainId));
  const [pct, setPct] = useState<number>(100);
  const [acceptLoss, setAcceptLoss] = useState(false);

  const shares = balances.data?.shares ?? 0n;
  const totalShares = balances.data?.totalShares ?? 0n;
  const inPool = Object.values(pools.data ?? {}).some((s) => s === 1);
  const burn = (shares * BigInt(Math.max(0, Math.min(100, Math.trunc(pct))))) / 100n;
  const ownership = totalShares > 0n ? Number((shares * 10_000n) / totalShares) / 100 : 0;

  const wrongChain = w.isConnected && w.walletChainId !== chainId;
  const disabledReason = !w.isConnected
    ? 'connect a wallet'
    : !deployed
      ? `vault not deployed on ${chainName(chainId)}`
      : wrongChain
        ? `switch wallet to ${chainName(chainId)}`
        : balances.status === 'success' && shares === 0n
          ? 'no shares in this vault'
          : undefined;

  const busy = txBusy(withdraw.state) || txBusy(emergency.state);

  return (
    <Panel label="WITHDRAW · BY SHARES" meta={`${chainName(chainId)} · ${chainId}`}>
      <div className="flex flex-col gap-4">
        <ChainSwitcher />

        <Banner tone={inPool ? 'warn' : 'plain'}>
          {inPool
            ? 'Liquidity is in range. Withdrawing flattens the LP position for everyone first, then pays your pro-rata WETH + stable.'
            : 'Burns the selected share of your position and pays pro-rata WETH + stable from the vault.'}
        </Banner>

        <dl className="grid grid-cols-[6rem_1fr] items-baseline gap-x-4 gap-y-2 text-[0.75rem] leading-5">
          <dt className="label leading-5"><Term id="shares">your shares</Term></dt>
          <dd className="font-mono text-text-hi">
            {!w.isConnected ? '—' : balances.status === 'success' ? `${formatToken(shares, 18, 6)} · ${ownership.toFixed(2)}% of vault` : balances.status === 'error' ? 'read failed' : 'reading…'}
          </dd>
          <dt className="label leading-5"><Term id="idle">idle claim</Term></dt>
          <dd className="font-mono text-text-mid">
            {balances.data ? balances.data.idle.map((b) => `${formatToken(b.idle, b.token.decimals)} ${b.token.symbol}`).join(' · ') : '—'}
          </dd>
          {/* What the wallet itself holds on this chain: native ETH beside the two legs the vault pays out in. */}
          <dt className="label leading-5">wallet</dt>
          <dd className="font-mono text-text-mid">
            {!w.isConnected
              ? '—'
              : [
                  nativeBalance.status === 'success' ? `${formatToken(nativeBalance.data, 18)} ETH` : 'ETH …',
                  ...(walletTokens.data ?? []).map((b) => `${formatToken(b.balance, b.token.decimals)} ${b.token.symbol}`),
                ].join(' · ')}
          </dd>
        </dl>

        <div className="flex flex-wrap items-center gap-2">
          <span className="label">burn</span>
          {FRACTIONS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setPct(f);
                if (withdraw.state.status === 'confirmed' || withdraw.state.status === 'failed') withdraw.reset();
              }}
              className={cn(
                'inline-flex min-h-[44px] items-center rounded-chip border px-3 text-label uppercase tracking-[0.12em] md:min-h-8 md:px-2.5',
                pct === f ? 'border-hairline-strong text-argon-300' : 'border-hairline text-text-lo hover:text-text-hi',
              )}
              disabled={busy}
            >
              {f}%
            </button>
          ))}
          <span className="ml-auto font-mono text-[0.75rem] text-text-mid">{formatToken(burn, 18, 6)} shares</span>
        </div>

        <Button
          onClick={() => void withdraw.write(burn)}
          disabled={Boolean(disabledReason) || burn === 0n || busy}
          pending={txBusy(withdraw.state)}
          success={withdraw.state.status === 'confirmed'}
          reason={disabledReason}
        >
          {withdraw.state.status === 'confirmed' ? 'confirmed' : txBusy(withdraw.state) ? 'withdraw…' : `withdraw ${pct}%`}
        </Button>
        <TxStatus state={withdraw.state} chainId={chainId} />

        <div className="border-t border-hairline pt-3">
          <label className="mb-3 flex items-start gap-2 text-label tracking-normal text-text-mid">
            <input type="checkbox" checked={acceptLoss} onChange={(e) => setAcceptLoss(e.target.checked)} disabled={busy} className="mt-0.5 accent-argon-500" />
            <span>accept loss: if the LP exit fails, take my idle share only and forfeit the rest. Unchecked, a failed exit reverts and nothing is burned.</span>
          </label>
          <Button
            variant="danger"
            size="sm"
            onClick={() => void emergency.write(acceptLoss)}
            disabled={!w.isConnected || !deployed || wrongChain || busy || shares === 0n}
            pending={txBusy(emergency.state)}
          >
            <Term id="emergency">emergency withdraw</Term> · all shares
          </Button>
          <div className="mt-2">
            <TxStatus state={emergency.state} chainId={chainId} />
          </div>
        </div>
      </div>
    </Panel>
  );
}
