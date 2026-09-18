'use client';

import { Button, Chip } from '@/components/ui';
import { useWallet } from '@/hooks';
import { chains, type SupportedChainId } from '@/services/chains';
import { chainName } from '@/services/explorer';
import { useUiStore } from '@/stores/ui';
import { cn } from '@/utils/cn';

/**
 * Selects the vault chain for deposit/withdraw (ui store) and prompts the wallet
 * to switch when it is elsewhere. Reads elsewhere keep working on their own chain id.
 */
export function ChainSwitcher() {
  const selected = useUiStore((s) => s.selectedChainId);
  const setSelected = useUiStore((s) => s.setSelectedChainId);
  const w = useWallet();
  const wrong = w.isConnected && w.walletChainId !== selected;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="label">chain</span>
      {chains.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => setSelected(c.id as SupportedChainId)}
          className={cn(
            'inline-flex min-h-[44px] items-center rounded-chip border px-3 text-label uppercase tracking-[0.12em] md:min-h-0 md:px-2 md:py-0.5 transition-colors',
            selected === c.id ? 'border-hairline-strong text-argon-300 shadow-glow-sm' : 'border-hairline text-text-lo hover:text-text-hi',
          )}
        >
          {chainName(c.id as SupportedChainId)} · {c.id}
        </button>
      ))}
      {wrong && (
        <>
          <Chip tone="warn" dot>
            wallet on {w.walletChainId}
          </Chip>
          <Button size="sm" variant="ghost" onClick={() => w.switchChain(selected)} pending={w.isSwitching}>
            switch to {chainName(selected)}
          </Button>
        </>
      )}
    </div>
  );
}
