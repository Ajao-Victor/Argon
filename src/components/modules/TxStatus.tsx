'use client';

import { Banner, HashText } from '@/components/ui';
import type { TxState } from '@/hooks/useVault';
import type { SupportedChainId } from '@/services/chains';
import { txUrl } from '@/services/explorer';

/** Renders a write hook's discriminated union inline under its button (design.md §3.5). */
export function TxStatus({ state, chainId }: { state: TxState; chainId: SupportedChainId }) {
  switch (state.status) {
    case 'idle':
      return null;
    case 'simulating':
      return <Banner tone="plain">simulating {state.step}…</Banner>;
    case 'awaitingSignature':
      return <Banner tone="argon">confirm {state.step} in your wallet</Banner>;
    case 'pending':
      return (
        <Banner tone="warn">
          {state.step} pending · <HashText value={state.hash} href={txUrl(chainId, state.hash)} />
        </Banner>
      );
    case 'confirmed':
      return (
        <Banner tone="up">
          {state.step} confirmed · <HashText value={state.hash} href={txUrl(chainId, state.hash)} />
        </Banner>
      );
    case 'failed':
      return (
        <Banner tone="down" glitch>
          {state.step} failed · {state.error}
          {state.hash && (
            <>
              {' '}
              · <HashText value={state.hash} href={txUrl(chainId, state.hash)} />
            </>
          )}
        </Banner>
      );
  }
}

export function txBusy(state: TxState): boolean {
  return state.status === 'simulating' || state.status === 'awaitingSignature' || state.status === 'pending';
}
