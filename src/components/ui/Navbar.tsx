'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ConnectButton } from '@/components/modules/ConnectButton';
import { useAgentMode, useWallet } from '@/hooks';
import { chains, type SupportedChainId } from '@/services/chains';
import { getVault } from '@/services/contracts';
import { chainName } from '@/services/explorer';
import { useUiStore } from '@/stores/ui';
import { cn } from '@/utils/cn';

import { Button } from './Button';
import { Chip } from './Chip';
import { SPRING } from './motion';

/**
 * Global navbar (Phase 8 M1). Sticky glass bar with a hairline bottom border.
 * Desktop: brand · links · wallet. Mobile: brand · hamburger → sliding glass panel.
 * Network is a dropdown that sets the vault chain (ui store) and prompts the wallet.
 */
const LINKS = [
  { href: '/app', label: 'dashboard' },
  { href: '/app/forecasts', label: 'forecasts' },
  { href: '/app/activity', label: 'activity' },
] as const;

function NavLink({ href, label, active, onClick, block = false }: { href: string; label: string; active: boolean; onClick?: () => void; block?: boolean }) {
  return (
    <Link
      href={href}
      {...(onClick ? { onClick } : {})}
      className={cn(
        'relative inline-flex min-h-10 items-center rounded-chip px-3 text-label uppercase tracking-[0.12em] transition-colors',
        block && 'flex min-h-12 w-full px-4 text-[0.8125rem]',
        active ? 'text-argon-300' : 'text-text-lo hover:text-text-hi',
      )}
    >
      {label}
      {active && <span aria-hidden className="absolute inset-x-3 -bottom-px h-px bg-argon-500 shadow-glow-sm" />}
    </Link>
  );
}

function NetworkMenu({ block = false, onPick }: { block?: boolean; onPick?: () => void }) {
  const selected = useUiStore((s) => s.selectedChainId);
  const setSelected = useUiStore((s) => s.setSelectedChainId);
  const w = useWallet();
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const wrong = w.isConnected && w.walletChainId !== selected;

  const pick = (id: SupportedChainId) => {
    setSelected(id);
    if (w.isConnected) w.switchChain(id);
    setOpen(false);
    onPick?.();
  };

  const list = chains.map((c) => (
    <button
      key={c.id}
      type="button"
      onClick={() => pick(c.id as SupportedChainId)}
      className={cn(
        'flex min-h-[44px] w-full items-center justify-between gap-4 px-4 text-left text-label uppercase tracking-[0.12em] transition-colors hover:bg-surface-2',
        selected === c.id ? 'text-argon-300' : 'text-text-lo',
      )}
    >
      <span>{chainName(c.id as SupportedChainId)}</span>
      <span className="font-mono text-text-dim">{c.id}</span>
    </button>
  ));

  if (block) {
    return (
      <div className="flex flex-col">
        <div className="label px-4 py-2 leading-5">network</div>
        {list}
        {wrong && (
          <div className="px-4 py-2">
            <Chip tone="warn" dot>
              wallet on {w.walletChainId ?? '?'}
            </Chip>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" onPointerLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          'flex min-h-10 items-center gap-1.5 rounded-chip px-3 text-label uppercase tracking-[0.12em] transition-colors',
          open ? 'text-text-hi' : 'text-text-lo hover:text-text-hi',
        )}
      >
        <span className="hidden lg:inline">network ·&nbsp;</span>
        <span className="text-argon-300">{chainName(selected)}</span>
        {wrong && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-signal-warn" />}
        <ChevronDown size={12} strokeWidth={1.5} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={SPRING.snappy}
            className="absolute left-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-panel border border-hairline-strong bg-surface-1/95 py-1 shadow-glow-sm backdrop-blur-glass"
          >
            {list}
            {wrong && (
              <div className="border-t border-hairline px-4 py-2">
                <Chip tone="warn" dot>
                  wallet on {w.walletChainId ?? '?'}
                </Chip>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function WalletControls({ block = false, onNavigate }: { block?: boolean; onNavigate?: () => void }) {
  const selected = useUiStore((s) => s.selectedChainId);
  const deployed = Boolean(getVault(selected));
  return (
    <div className={cn('flex items-center gap-3', block && 'flex-col items-stretch gap-3 px-4 py-4')}>
      <div className={cn('gap-2', block ? 'flex w-full [&>*]:flex-1' : 'hidden lg:flex')}>
        {deployed ? (
          <>
            <Link href="/app/deposit" className="contents" {...(onNavigate ? { onClick: onNavigate } : {})}>
              <Button size="sm">deposit</Button>
            </Link>
            <Link href="/app/withdraw" className="contents" {...(onNavigate ? { onClick: onNavigate } : {})}>
              <Button size="sm" variant="ghost">
                withdraw
              </Button>
            </Link>
          </>
        ) : (
          <>
            <Button size="sm" disabled magnetic={false} title="vault not deployed">
              deposit
            </Button>
            <Button size="sm" variant="ghost" disabled magnetic={false} title="vault not deployed">
              withdraw
            </Button>
          </>
        )}
      </div>
      <ConnectButton size="sm" />
    </div>
  );
}

export function Navbar() {
  const path = usePathname();
  const mode = useAgentMode();
  const reduced = useReducedMotion();
  // The sheet remembers the path it was opened on, so a route change closes it without an effect.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === path;
  const setOpen = (next: boolean | ((prev: boolean) => boolean)) => {
    const value = typeof next === 'function' ? next(open) : next;
    setOpenAt(value ? path : null);
  };

  // Lock body scroll while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
    {/* Full-screen dimmer behind the sheet, above the dashboard. A sibling of the header on
        purpose: the header's backdrop-filter makes it the containing block for fixed children. */}
    <AnimatePresence>
      {open && (
        <motion.button
          key="backdrop"
          type="button"
          aria-label="close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 cursor-default bg-black/60 backdrop-blur-sm md:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.14 } }}
          transition={{ duration: 0.18 }}
        />
      )}
    </AnimatePresence>
    <header className="sticky top-0 z-50 w-full overflow-visible border-b border-hairline bg-glass backdrop-blur-glass">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 md:justify-start md:gap-6">
        {/* Brand */}
        <Link href="/" className="flex min-h-[44px] shrink-0 items-center gap-3">
          <span aria-hidden className="relative inline-flex h-5 w-3 items-center justify-center rounded-full border border-argon-500 shadow-glow-sm">
            <span className="absolute inset-x-0 top-1 h-px bg-argon-400/70" />
            <span className="absolute inset-x-0 top-2.5 h-px bg-argon-400/70" />
            <span className="absolute inset-x-0 top-4 h-px bg-argon-400/70" />
          </span>
          <span className="font-display text-lg tracking-tight text-argon-400 glow-text">ARGON</span>
        </Link>

        {/* Center links (desktop) */}
        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex" aria-label="primary">
          {LINKS.map((l) => (
            <NavLink key={l.href} href={l.href} label={l.label} active={path === l.href} />
          ))}
          <NetworkMenu />
        </nav>

        {/* Right: wallet (desktop) */}
        <div className="ml-auto hidden shrink-0 items-center gap-3 md:flex">
          {mode === 'fixture' && <span className="label hidden text-signal-warn xl:inline">fixture agent</span>}
          <WalletControls />
        </div>

        {/* Hamburger (mobile) */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'close menu' : 'open menu'}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-chip border border-hairline text-text-mid hover:border-hairline-strong hover:text-text-hi md:hidden"
        >
          {open ? <X size={16} strokeWidth={1.5} /> : <Menu size={16} strokeWidth={1.5} />}
        </button>
      </div>

      {/* Mobile sheet */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-nav"
            key="sheet"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8, transition: { duration: 0.14 } }}
            transition={SPRING.heavy}
            className="absolute inset-x-0 top-full z-50 max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-b border-hairline-strong bg-glass shadow-2xl shadow-black/80 backdrop-blur-glass md:hidden"
          >
            <nav className="flex flex-col divide-y divide-hairline bg-surface-1/70" aria-label="mobile">
              <div className="py-1">
                {LINKS.map((l) => (
                  <NavLink key={l.href} href={l.href} label={l.label} active={path === l.href} block onClick={() => setOpen(false)} />
                ))}
              </div>
              <NetworkMenu block onPick={() => setOpen(false)} />
              <WalletControls block onNavigate={() => setOpen(false)} />
              {mode === 'fixture' && <div className="label px-4 py-3 text-signal-warn">fixture agent · sample data</div>}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
    </>
  );
}
