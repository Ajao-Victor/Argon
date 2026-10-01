'use client';

import { Button } from '@/components/ui';
import { useWallet } from '@/hooks';
import { truncateAddress } from '@/utils/format';

/** Injected-wallet connect / disconnect. No wallet modal library in v1. */
export function ConnectButton({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const w = useWallet();
  if (w.isConnected && w.address) {
    return (
      <Button variant="ghost" size={size} onClick={w.disconnect} title={`${w.connectorName ?? 'wallet'} · ${w.address}`}>
        {truncateAddress(w.address)} · disconnect
      </Button>
    );
  }
  return (
    <Button size={size} onClick={w.connect} pending={w.isConnecting}>
      connect wallet
    </Button>
  );
}
