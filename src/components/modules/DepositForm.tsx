'use client';

import { useState } from 'react';
import { parseUnits } from 'viem';

import { Banner, Button, Panel, TokenInput } from '@/components/ui';
import { poolForChain, useDeposit, useDepositEth, useNativeBalance, usePools, useTokenAllowance, useVaultParams, useWallet } from '@/hooks';
import { getVault } from '@/services/contracts';
import { chainName } from '@/services/explorer';
import { depositAssets, isNativeEth, type DepositAsset } from '@/services/tokens';
import { useUiStore } from '@/stores/ui';
import { cn } from '@/utils/cn';
import { formatToken } from '@/utils/format';
import { NATIVE_ETH_GAS_RESERVE_WEI, maxNativeEthDeposit } from '@/utils/nativeEth';
import { vaultBindingState } from '@/utils/vaultBinding';

import { ChainSwitcher } from './ChainSwitcher';
import { TxStatus, txBusy } from './TxStatus';

/** parseUnits is cheap; computing it per render avoids memoizing over an object rebuilt each render. */
function parseAmount(value: string, decimals: number | undefined): bigint {
  if (decimals === undefined || !value) return 0n;
  try {
    return parseUnits(value, decimals);
  } catch {
    return 0n;
  }
}

/** Full-precision string for the input (no thousands separators). */
function toInput(amount: bigint, decimals: number): string {
  return formatToken(amount, decimals, decimals).replace(/,/g, '');
}

export const MAX_GAS_NOTE = `max leaves ${formatToken(NATIVE_ETH_GAS_RESERVE_WEI, 18, 4)} ETH for gas`;

/**
 * Deposit form (design.md §4.9, product.md §3.6). Three assets per chain: native ETH, WETH
 * and the chain stable. ERC-20s run approve → deposit as one stepping button; native ETH
 * skips the allowance entirely and calls the payable `depositETH()` with the amount as
 * `value`. MAX on ETH leaves a fixed gas reserve so the transaction can always pay for itself.
 */
export function DepositForm() {
  const chainId = useUiStore((s) => s.selectedChainId);
  const w = useWallet();
  const assets = depositAssets(chainId);
  // WETH stays the default so existing flows are unchanged; ETH is one tap away.
  const [symbol, setSymbol] = useState<string>(assets[1]?.symbol ?? 'WETH');
  const asset: DepositAsset | undefined = assets.find((a) => a.symbol === symbol) ?? assets[1] ?? assets[0];
  const native = asset !== undefined && isNativeEth(asset);
  const token = asset && !isNativeEth(asset) ? asset : undefined;
  const [value, setValue] = useState('');
  const [maxNote, setMaxNote] = useState(false);
  const allowance = useTokenAllowance(chainId, token, w.address);
  const nativeBalance = useNativeBalance(chainId, native ? w.address : undefined);
  const deposit = useDeposit(chainId);
  const depositEth = useDepositEth(chainId);
  const tx = native ? depositEth : deposit;
  const vaultBinding = getVault(chainId);
  const deployed = Boolean(vaultBinding);
  // Safety: the agent names the vault it manages per chain. A build bound to anything else never deposits.
  const agentPools = usePools();
  const agentVault = poolForChain(agentPools.data, chainId)?.vault;
  const binding = vaultBindingState(vaultBinding?.address, agentVault);
  const params = useVaultParams(chainId);
  const feeBps = params.data?.depositFeeBps;

  const amount = parseAmount(value, asset?.decimals);

  const balanceQuery = native ? nativeBalance : allowance;
  const balance = native ? (nativeBalance.data ?? 0n) : (allowance.data?.balance ?? 0n);
  const balanceReady = balanceQuery.status === 'success';
  const needsApprove = !native && (allowance.data?.allowance ?? 0n) < amount;
  const wrongChain = w.isConnected && w.walletChainId !== chainId;

  let error: string | null = null;
  if (value && amount === 0n) error = 'enter an amount';
  else if (amount > balance && w.isConnected && balanceReady) error = 'exceeds wallet balance';

  const disabledReason = !w.isConnected
    ? 'connect a wallet'
    : !deployed
      ? `vault not deployed on ${chainName(chainId)}`
      : binding === 'mismatch'
        ? 'this build is bound to a vault the agent no longer manages'
        : wrongChain
          ? `switch wallet to ${chainName(chainId)}`
          : error ?? undefined;

  const pick = (a: DepositAsset) => {
    setSymbol(a.symbol);
    setValue('');
    setMaxNote(false);
    deposit.reset();
    depositEth.reset();
  };

  const onMax = () => {
    if (!asset) return;
    if (isNativeEth(asset)) {
      setValue(toInput(maxNativeEthDeposit(balance), 18));
      setMaxNote(true);
    } else {
      setValue(toInput(balance, asset.decimals));
    }
  };

  const submit = () => {
    if (!asset) return;
    if (isNativeEth(asset)) void depositEth.write(amount);
    else void deposit.write(asset, amount);
  };

  const balanceLabel = !w.isConnected
    ? undefined
    : balanceReady
      ? `wallet ${formatToken(balance, asset?.decimals ?? 18)} ${asset?.symbol ?? ''}${native && maxNote ? ` · ${MAX_GAS_NOTE}` : ''}`
      : balanceQuery.status === 'error'
        ? 'wallet balance unavailable'
        : 'reading wallet balance…';

  return (
    <Panel label="DEPOSIT" meta={`${chainName(chainId)} · ${chainId}`}>
      <div className="flex flex-col gap-4">
        <ChainSwitcher />

        {binding === 'mismatch' && vaultBinding && agentVault && (
          <div role="alert">
            <Banner tone="down">
              deposits disabled: this build is bound to vault {vaultBinding.address} but the agent manages {agentVault} on {chainName(chainId)}. Withdrawals from the bound vault still work.
            </Banner>
          </div>
        )}

        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="deposit asset">
          <span className="label">asset</span>
          {assets.map((a) => (
            <button
              key={a.symbol}
              type="button"
              role="radio"
              aria-checked={symbol === a.symbol}
              onClick={() => pick(a)}
              title={isNativeEth(a) ? 'native ETH · no token approval needed' : undefined}
              className={cn(
                'inline-flex min-h-[44px] items-center rounded-chip border px-3 text-label uppercase tracking-[0.12em] md:min-h-8 md:px-2.5',
                symbol === a.symbol ? 'border-hairline-strong text-argon-300' : 'border-hairline text-text-lo hover:text-text-hi',
              )}
            >
              {a.symbol}
            </button>
          ))}
        </div>

        {asset && (
          <TokenInput
            value={value}
            onChange={(v) => {
              setValue(v);
              setMaxNote(false);
              if (tx.state.status === 'confirmed' || tx.state.status === 'failed') tx.reset();
            }}
            symbol={asset.symbol}
            decimals={asset.decimals}
            balanceLabel={balanceLabel}
            onMax={w.isConnected && balanceReady ? onMax : undefined}
            error={error}
            disabled={txBusy(tx.state)}
          />
        )}

        <Button
          onClick={submit}
          disabled={Boolean(disabledReason) || amount === 0n || txBusy(tx.state)}
          pending={txBusy(tx.state)}
          success={tx.state.status === 'confirmed'}
          reason={disabledReason}
        >
          {tx.state.status === 'confirmed'
            ? 'confirmed'
            : tx.state.status !== 'idle' && txBusy(tx.state)
              ? `${tx.state.step}…`
              : native
                ? 'deposit ETH'
                : needsApprove && amount > 0n
                  ? `approve ${asset?.symbol ?? ''} then deposit`
                  : 'deposit'}
        </Button>

        <TxStatus state={tx.state} chainId={chainId} />

        <Banner tone="plain">
          {native
            ? 'Native ETH goes straight into the vault through depositETH — no token approval. The vault wraps it to WETH itself.'
            : 'Funds sit idle until the first in-gate ENTER after hour 8. Deposits are allowed during warmup.'}
          {feeBps !== undefined && feeBps > 0 && <span className="text-text-dim"> · deposit fee {(feeBps / 100).toFixed(2)}% of USD value, read from the vault</span>}
        </Banner>
      </div>
    </Panel>
  );
}
