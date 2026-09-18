'use client';

import { useCallback } from 'react';
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from 'wagmi';

import { DEFAULT_CHAIN_ID, isSupportedChainId, type SupportedChainId } from '@/services/chains';
import { isAdmin } from '@/services/contracts';

/** Thin wallet facade so components never import wagmi hooks directly (ENGINEERING.md §3.3). */
export function useWallet() {
  const { address, isConnected, isConnecting, connector } = useAccount();
  const walletChainId = useChainId();
  const { connect, connectors, isPending: isConnectPending, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching, error: switchError } = useSwitchChain();

  const connectInjected = useCallback(() => {
    const injected = connectors.find((c) => c.id === 'injected') ?? connectors[0];
    if (injected) connect({ connector: injected });
  }, [connect, connectors]);

  const ensureChain = useCallback(
    (target: SupportedChainId) => {
      if (walletChainId !== target) switchChain({ chainId: target });
    },
    [switchChain, walletChainId],
  );

  const chainId: SupportedChainId = isSupportedChainId(walletChainId) ? walletChainId : DEFAULT_CHAIN_ID;

  return {
    address,
    isConnected,
    isConnecting: isConnecting || isConnectPending,
    connectorName: connector?.name,
    walletChainId,
    chainId,
    onSupportedChain: isSupportedChainId(walletChainId),
    isAdmin: isAdmin(address),
    connect: connectInjected,
    disconnect: () => disconnect(),
    switchChain: ensureChain,
    isSwitching,
    error: connectError ?? switchError ?? null,
  } as const;
}
