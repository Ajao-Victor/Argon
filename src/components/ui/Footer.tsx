'use client';

import { ExternalLink } from 'lucide-react';

import { useAgentHealth, useAgentMode, useAgentStatus, useUtcClock, useWallet } from '@/hooks';
import { getRegistry, getVault } from '@/services/contracts';
import { addressUrl, chainName, explorerName } from '@/services/explorer';
import { useUiStore } from '@/stores/ui';
import { cn } from '@/utils/cn';
import { truncateAddress } from '@/utils/format';

import { StatusDot, type ChipTone } from './Chip';

/**
 * Tactical footer (Phase 8 M2): --surface-0, hairline top border, mt-auto.
 * Agent health with a pulsing dot, network + explorer links for vault and
 * registry, and a live UTC clock (the model runs on :00 UTC).
 */
function Cell({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <span className="label leading-5">{label}</span>
      <span className="flex min-w-0 items-center gap-2 font-mono text-[0.75rem] leading-5 text-text-mid">{children}</span>
    </div>
  );
}

function ExplorerLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ion-400 hover:underline">
      {children}
      <ExternalLink size={11} strokeWidth={1.5} />
    </a>
  );
}

export function Footer() {
  const health = useAgentHealth();
  const status = useAgentStatus();
  const mode = useAgentMode();
  const chainId = useUiStore((s) => s.selectedChainId);
  const w = useWallet();
  const clock = useUtcClock();

  const vault = getVault(chainId);
  const registry = getRegistry(chainId);

  const agentUp = health.status === 'success' && health.data.ok && status.status !== 'error';
  const agentTone: ChipTone = mode === 'offline' ? 'idle' : health.status === 'pending' ? 'plain' : agentUp ? 'up' : 'down';
  const agentText =
    mode === 'offline'
      ? 'Agent API: Not configured'
      : health.status === 'pending'
        ? 'Agent API: connecting…'
        : mode === 'fixture'
          ? 'Agent API: fixture'
          : agentUp
            ? 'Agent API: Connected'
            : 'Agent API: Unreachable';

  const mm = clock ? String(Math.floor(clock.secondsToNextHour / 60)).padStart(2, '0') : '--';
  const ss = clock ? String(clock.secondsToNextHour % 60).padStart(2, '0') : '--';

  return (
    <footer className="mt-auto border-t border-hairline bg-surface-0">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-4 px-4 py-5 sm:px-6 md:grid-cols-4 lg:grid-cols-6">
        {/* Agent health */}
        <Cell label="agent" className="col-span-2 md:col-span-1 lg:col-span-2">
          <span className="relative inline-flex h-2 w-2">
            {agentTone === 'up' && <span aria-hidden className="absolute inline-flex h-full w-full rounded-full bg-signal-up opacity-70 animate-ping" />}
            <StatusDot tone={agentTone} className="relative h-2 w-2" />
          </span>
          <span className={cn(agentTone === 'down' && 'text-signal-down')}>{agentText}</span>
          {status.data && <span className="text-text-dim">· {status.data.modelId}</span>}
        </Cell>

        {/* Network */}
        <Cell label="network">
          <StatusDot tone={w.isConnected ? (w.walletChainId === chainId ? 'argon' : 'warn') : 'idle'} />
          <span className="text-text-hi">{chainName(chainId)}</span>
          <span className="text-text-dim">{chainId}</span>
        </Cell>

        {/* Contracts */}
        <Cell label="vault">
          {vault ? <ExplorerLink href={addressUrl(chainId, vault.address)}>{truncateAddress(vault.address)}</ExplorerLink> : <span className="text-text-dim">not deployed</span>}
        </Cell>
        <Cell label="registry">
          {registry ? <ExplorerLink href={addressUrl(chainId, registry.address)}>{truncateAddress(registry.address)}</ExplorerLink> : <span className="text-text-dim">not deployed</span>}
        </Cell>

        {/* Clock */}
        <Cell label="utc" className="col-span-2 md:col-span-4 lg:col-span-1">
          <span className="tabular-nums text-text-hi" suppressHydrationWarning>
            {clock?.hhmmss ?? '--:--:--'}
          </span>
          <span className="text-text-dim tabular-nums" suppressHydrationWarning>
            · next print {mm}:{ss}
          </span>
          {clock && <span className="hidden text-text-dim xl:inline">· hour {clock.hourId}</span>}
        </Cell>
      </div>
      <div className="border-t border-hairline">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
          <span className="label leading-5 text-text-dim">custody on-chain · judgment off-chain · the website is not the keeper</span>
          <span className="label leading-5 text-text-dim">{explorerName(chainId)}</span>
        </div>
      </div>
    </footer>
  );
}
