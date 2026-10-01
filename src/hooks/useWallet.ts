'use client';

import { useCallback } from 'react';
import { ProviderNotFoundError, useAccount, useConnect, useConnectors, useDisconnect, useSwitchChain, type Connector } from 'wagmi';

import { toast } from '@/components/ui/Toasts';
import { DEFAULT_CHAIN_ID, isSupportedChainId, type SupportedChainId } from '@/services/chains';
import { isAdmin } from '@/services/contracts';
import { useUiStore } from '@/stores/ui';

/**
 * Thin wallet facade so components never import wagmi hooks directly (ENGINEERING.md §3.3).
 *
 * Connecting is a two-step decision:
 *   - `connect()` opens the connector picker (ui store modal) whenever more than one
 *     connector is registered or no EIP-1193 provider is injected, so a visitor without a
 *     browser extension is offered Coinbase Wallet / WalletConnect instead of a thrown
 *     ProviderNotFoundError. It connects directly only when the single option is an
 *     injected wallet that is actually present.
 *   - `connectWith(connector)` is what the picker calls. A ProviderNotFoundError (user
 *     chose "Browser Wallet" without an extension) becomes a toast with a MetaMask mobile
 *     deep link rather than a raw @wagmi/core message.
 */
export function hasInjectedProvider(): boolean {
  return typeof window !== 'undefined' && window.ethereum !== undefined && window.ethereum !== null;
}

/**
 * A browser wallet counts as detected when EIP-6963 discovery registered one (a connector
 * of type 'injected' whose id is not the generic 'injected'), or when window.ethereum is
 * present. Discovery runs before window.ethereum is assigned in some wallets, so both
 * signals are needed.
 */
export function injectedDetected(connectors: readonly Connector[]): boolean {
  return connectors.some((c) => c.type === 'injected' && c.id !== 'injected') || hasInjectedProvider();
}

export function metaMaskDeepLink(): string {
  if (typeof window === 'undefined') return 'https://metamask.io/download/';
  const { host, pathname } = window.location;
  return `https://metamask.app.link/dapp/${host}${pathname}`;
}

/** Human label for a connector in the picker. */
export function connectorLabel(c: Connector): string {
  if (c.type === 'injected' && c.id === 'injected') return 'Browser wallet';
  if (c.type === 'coinbaseWallet') return 'Coinbase Wallet';
  if (c.type === 'walletConnect') return 'WalletConnect';
  return c.name;
}

export function useWallet() {
  // The account's chain, not the config's: undefined when disconnected, and an unsupported
  // id (e.g. 1 for mainnet) when the wallet is somewhere we have no vault.
  const { address, isConnected, isConnecting, connector, chainId: walletChainId } = useAccount();
  const connectors = useConnectors();
  const { connect, isPending: isConnectPending, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching, error: switchError } = useSwitchChain();
  const setModal = useUiStore((s) => s.setModal);

  const connectWith = useCallback(
    (c: Connector) => {
      connect(
        { connector: c },
        {
          // Close the picker only once the wallet actually connected; on error it stays open.
          onSuccess: () => setModal('none'),
          onError: (err) => {
            const notFound = err instanceof ProviderNotFoundError || /provider not found/i.test(err.message);
            if (notFound) {
              toast.push({
                id: 'wallet-not-found',
                kind: 'error',
                title: 'no browser wallet detected',
                detail: 'Use Coinbase Wallet or WalletConnect from the picker, or open this page inside the MetaMask mobile browser.',
                link: { href: metaMaskDeepLink(), label: 'open in MetaMask mobile' },
                ttl: 12_000,
              });
              return;
            }
            if (!/rejected|denied|cancel/i.test(err.message)) {
              toast.push({ id: 'wallet-connect-error', kind: 'error', title: 'wallet connection failed', detail: err.message.split('\n')[0] ?? 'unknown error', ttl: 8_000 });
            }
          },
        },
      );
    },
    [connect, setModal],
  );

  const openConnect = useCallback(() => {
    const injectedOnly = connectors.length === 1 && connectors[0]?.type === 'injected';
    if (injectedOnly && injectedDetected(connectors) && connectors[0]) {
      connectWith(connectors[0]);
      return;
    }
    setModal('connect');
  }, [connectors, connectWith, setModal]);

  /** Ask the wallet to move to `target` (including from an unsupported or unknown chain); failures surface as toasts. */
  const ensureChain = useCallback(
    (target: SupportedChainId) => {
      if (walletChainId === target) return;
      switchChain(
        { chainId: target },
        {
          onError: (err) => {
            const first = err.message.split('\n')[0] ?? 'unknown error';
            if (/rejected|denied|cancel/i.test(err.message)) {
              toast.push({ id: 'chain-switch', kind: 'info', title: 'network switch cancelled', ttl: 5_000 });
            } else {
              toast.push({ id: 'chain-switch', kind: 'error', title: 'could not switch network', detail: first, ttl: 10_000 });
            }
          },
        },
      );
    },
    [switchChain, walletChainId],
  );

  const onSupportedChain = walletChainId !== undefined && isSupportedChainId(walletChainId);
  const chainId: SupportedChainId = walletChainId !== undefined && isSupportedChainId(walletChainId) ? walletChainId : DEFAULT_CHAIN_ID;

  return {
    address,
    isConnected,
    isConnecting: isConnecting || isConnectPending,
    connectorName: connector?.name,
    connectors,
    walletChainId,
    chainId,
    onSupportedChain,
    isAdmin: isAdmin(address),
    connect: openConnect,
    connectWith,
    disconnect: () => disconnect(),
    switchChain: ensureChain,
    isSwitching,
    error: connectError ?? switchError ?? null,
  } as const;
}
