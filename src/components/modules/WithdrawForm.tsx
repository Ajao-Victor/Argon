'use client';

import { useMemo, useState } from 'react';
import { parseUnits } from 'viem';

import { Banner, Button, Panel, Term, TokenInput } from '@/components/ui';
import { useEmergencyWithdraw, usePoolStatuses, useVaultBalances, useWallet, useWithdraw } from '@/hooks';
import { getVault } from '@/services/contracts';
import { chainName } from '@/services/explorer';
import { depositTokens, type TokenDef } from '@/services/tokens';
import { useUiStore } from '@/stores/ui';
import { cn } from '@/utils/cn';
import { formatToken } from '@/utils/format';

import { ChainSwitcher } from './ChainSwitcher';
import { TxStatus, txBusy } from './TxStatus';

/** Idle-only withdraw with the in-pool banner (product.md §2.4, §3.6). Fails closed. */
export function WithdrawForm() {
  const chainId = useUiStore((s) => s.selectedChainId);
  const w = useWallet();
  const tokens = depositTokens(chainId);
  const [symbol, setSymbol] = useState(tokens[0]?.symbol ?? 'WETH');
  const token: TokenDef | undefined = tokens.find((t) => t.symbol === symbol) ?? tokens[0];
  const [value, setValue] = useState('');
  const balances = useVaultBalances(chainId, w.address);
  const pools = usePoolStatuses(chainId);
  const withdraw = useWithdraw(chainId);
  const emergency = useEmergencyWithdraw(chainId);
  const deployed = Boolean(getVault(chainId));

  const idle = balances.data?.idle.find((b) => b.token.symbol === symbol)?.idle ?? 0n;
  const inPool = Object.values(pools.data ?? {}).some((s) => s === 1);

  const amount = useMemo(() => {
    if (!token || !value) return 0n;
    try {
      return parseUnits(value, token.decimals);
    } catch {
      return 0n;
    }
  }, [token, value]);

  let error: string | null = null;
  if (value && amount === 0n) error = 'enter an amount';
  else if (amount > idle && balances.status === 'success') error = 'exceeds idle balance';

  const wrongChain = w.isConnected && w.walletChainId !== chainId;
  const disabledReason = !w.isConnected
    ? 'connect a wallet'
    : !deployed
      ? `vault not deployed on ${chainName(chainId)}`
      : wrongChain
        ? `switch wallet to ${chainName(chainId)}`
        : error ?? undefined;

  const busy = txBusy(withdraw.state) || txBusy(emergency.state);

  return (
    <Panel label="WITHDRAW · IDLE ONLY" meta={`${chainName(chainId)} · ${chainId}`}>
      <div className="flex flex-col gap-4">
        <ChainSwitcher />

        {inPool && (
          <Banner tone="warn">
            Your LP is in range. Withdraw becomes available when the model next exits (±2% gate), or use Emergency idle
            withdraw for any unallocated tokens.
          </Banner>
        )}

        <div className="flex flex-wrap gap-2">
          <span className="label">token</span>
          {tokens.map((t) => (
            <button
              key={t.symbol}
              type="button"
              onClick={() => {
                setSymbol(t.symbol);
                setValue('');
                withdraw.reset();
              }}
              className={cn(
                'rounded-chip border px-2 py-0.5 text-label uppercase tracking-[0.12em]',
                symbol === t.symbol ? 'border-hairline-strong text-argon-300' : 'border-hairline text-text-lo hover:text-text-hi',
              )}
            >
              {t.symbol}
            </button>
          ))}
        </div>

        {token && (
          <TokenInput
            value={value}
            onChange={(v) => {
              setValue(v);
              if (withdraw.state.status === 'confirmed' || withdraw.state.status === 'failed') withdraw.reset();
            }}
            symbol={token.symbol}
            decimals={token.decimals}
            balanceLabel={w.isConnected ? `idle ${formatToken(idle, token.decimals)} ${token.symbol}` : undefined}
            onMax={w.isConnected ? () => setValue(formatToken(idle, token.decimals, token.decimals).replace(/,/g, '')) : undefined}
            error={error}
            disabled={busy}
          />
        )}

        <Button
          onClick={() => token && void withdraw.write(token, amount)}
          disabled={Boolean(disabledReason) || amount === 0n || busy}
          pending={txBusy(withdraw.state)}
          success={withdraw.state.status === 'confirmed'}
          reason={disabledReason}
        >
          {withdraw.state.status === 'confirmed' ? 'confirmed' : txBusy(withdraw.state) ? 'withdraw…' : 'withdraw idle now'}
        </Button>
        <TxStatus state={withdraw.state} chainId={chainId} />

        <div className="border-t border-hairline pt-3">
          <Button
            variant="danger"
            size="sm"
            onClick={() => void emergency.write()}
            disabled={!w.isConnected || !deployed || wrongChain || busy}
            pending={txBusy(emergency.state)}
          >
            <Term id="emergency">emergency idle withdraw</Term> · all tokens
          </Button>
          <div className="mt-2">
            <TxStatus state={emergency.state} chainId={chainId} />
          </div>
        </div>
      </div>
    </Panel>
  );
}
