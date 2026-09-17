'use client';

import { useMemo, useState } from 'react';
import { parseUnits } from 'viem';

import { Banner, Button, Panel, TokenInput } from '@/components/ui';
import { useDeposit, useTokenAllowance, useWallet } from '@/hooks';
import { getVault } from '@/services/contracts';
import { chainName } from '@/services/explorer';
import { depositTokens, type TokenDef } from '@/services/tokens';
import { useUiStore } from '@/stores/ui';
import { cn } from '@/utils/cn';
import { formatToken } from '@/utils/format';

import { ChainSwitcher } from './ChainSwitcher';
import { TxStatus, txBusy } from './TxStatus';

/** approve → deposit as one stepping button (design.md §4.9, product.md §3.6). */
export function DepositForm() {
  const chainId = useUiStore((s) => s.selectedChainId);
  const w = useWallet();
  const tokens = depositTokens(chainId);
  const [symbol, setSymbol] = useState(tokens[0]?.symbol ?? 'WETH');
  const token: TokenDef | undefined = tokens.find((t) => t.symbol === symbol) ?? tokens[0];
  const [value, setValue] = useState('');
  const allowance = useTokenAllowance(chainId, token, w.address);
  const deposit = useDeposit(chainId);
  const deployed = Boolean(getVault(chainId));

  const amount = useMemo(() => {
    if (!token || !value) return 0n;
    try {
      return parseUnits(value, token.decimals);
    } catch {
      return 0n;
    }
  }, [token, value]);

  const balance = allowance.data?.balance ?? 0n;
  const needsApprove = (allowance.data?.allowance ?? 0n) < amount;
  const wrongChain = w.isConnected && w.walletChainId !== chainId;

  let error: string | null = null;
  if (value && amount === 0n) error = 'enter an amount';
  else if (amount > balance && w.isConnected && allowance.status === 'success') error = 'exceeds wallet balance';

  const disabledReason = !w.isConnected
    ? 'connect a wallet'
    : !deployed
      ? `vault not deployed on ${chainName(chainId)}`
      : wrongChain
        ? `switch wallet to ${chainName(chainId)}`
        : error ?? undefined;

  return (
    <Panel label="DEPOSIT" meta={`${chainName(chainId)} · ${chainId}`}>
      <div className="flex flex-col gap-4">
        <ChainSwitcher />

        <div className="flex flex-wrap gap-2">
          <span className="label">token</span>
          {tokens.map((t) => (
            <button
              key={t.symbol}
              type="button"
              onClick={() => {
                setSymbol(t.symbol);
                setValue('');
                deposit.reset();
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
              if (deposit.state.status === 'confirmed' || deposit.state.status === 'failed') deposit.reset();
            }}
            symbol={token.symbol}
            decimals={token.decimals}
            balanceLabel={w.isConnected ? `wallet ${formatToken(balance, token.decimals)} ${token.symbol}` : undefined}
            onMax={w.isConnected ? () => setValue(formatToken(balance, token.decimals, token.decimals).replace(/,/g, '')) : undefined}
            error={error}
            disabled={txBusy(deposit.state)}
          />
        )}

        <Button
          onClick={() => token && void deposit.write(token, amount)}
          disabled={Boolean(disabledReason) || amount === 0n || txBusy(deposit.state)}
          pending={txBusy(deposit.state)}
          reason={disabledReason}
        >
          {deposit.state.status === 'confirmed'
            ? 'confirmed'
            : deposit.state.status !== 'idle' && txBusy(deposit.state)
              ? `${deposit.state.step}…`
              : needsApprove && amount > 0n
                ? `approve ${token?.symbol ?? ''} then deposit`
                : 'deposit'}
        </Button>

        <TxStatus state={deposit.state} chainId={chainId} />

        <Banner tone="plain">Funds sit idle until the first in-gate ENTER after hour 8. Deposits are allowed during warmup.</Banner>
      </div>
    </Panel>
  );
}
