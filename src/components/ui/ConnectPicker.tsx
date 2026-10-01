'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Globe, Monitor, QrCode, Wallet, X } from 'lucide-react';
import { useEffect } from 'react';

import { connectorLabel, injectedDetected, metaMaskDeepLink, useWallet } from '@/hooks/useWallet';
import { useUiStore } from '@/stores/ui';
import { cn } from '@/utils/cn';

import { SPRING } from './motion';

/**
 * Glass connector picker. Opens from the ui store (`modal: 'connect'`), lists every
 * registered connector, and tells the truth about the browser: when no EIP-1193
 * provider is injected the "Browser wallet" row is marked not detected and the
 * MetaMask mobile deep link is offered, while Coinbase Wallet / WalletConnect remain
 * fully usable. Escape and backdrop close it.
 */
function iconFor(type: string) {
  if (type === 'coinbaseWallet') return <Wallet size={16} strokeWidth={1.5} />;
  if (type === 'walletConnect') return <QrCode size={16} strokeWidth={1.5} />;
  if (type === 'injected') return <Monitor size={16} strokeWidth={1.5} />;
  return <Globe size={16} strokeWidth={1.5} />;
}

export function ConnectPicker() {
  const open = useUiStore((s) => s.modal === 'connect');
  const setModal = useUiStore((s) => s.setModal);
  const w = useWallet();
  const reduced = useReducedMotion();
  const injectedPresent = open ? injectedDetected(w.connectors) : false;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModal('none');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setModal]);

  // Discovered EIP-6963 wallets first (they have a real name), then the generic injected, then the rest.
  const ordered = [...w.connectors].sort((a, b) => rank(a.type, a.id) - rank(b.type, b.id));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="connect-backdrop"
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.14 } }}
          onClick={() => setModal('none')}
          role="presentation"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="connect-title"
            onClick={(e) => e.stopPropagation()}
            className="panel panel-active w-full max-w-md overflow-hidden"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.14 } }}
            transition={SPRING.heavy}
          >
            <header className="flex h-11 items-center justify-between border-b border-hairline px-5">
              <span id="connect-title" className="label leading-5">
                connect wallet
              </span>
              <button type="button" onClick={() => setModal('none')} aria-label="close" className="-mr-2 inline-flex h-9 w-9 items-center justify-center text-text-lo hover:text-text-hi">
                <X size={16} strokeWidth={1.5} />
              </button>
            </header>

            <ul className="divide-y divide-hairline">
              {ordered.map((c) => {
                const injectedRow = c.type === 'injected';
                const missing = injectedRow && !injectedPresent;
                return (
                  <li key={c.uid}>
                    <button
                      type="button"
                      onClick={() => w.connectWith(c)}
                      className={cn(
                        'flex min-h-[56px] w-full items-center gap-4 px-5 text-left transition-colors hover:bg-surface-2',
                        missing && 'opacity-70',
                      )}
                    >
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-chip border border-hairline text-argon-300">
                        {c.icon ? (
                          // EIP-6963 wallet icons are data: URIs; next/image cannot optimise them.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.icon} alt="" width={20} height={20} className="h-5 w-5" />
                        ) : (
                          iconFor(c.type)
                        )}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-mono text-[0.8125rem] leading-5 text-text-hi">{c.type === 'injected' && c.id !== 'injected' ? c.name : connectorLabel(c)}</span>
                        <span className="text-[0.6875rem] leading-4 text-text-lo">
                          {c.type === 'coinbaseWallet'
                            ? 'Extension, mobile app, or Smart Wallet · no extension required'
                            : c.type === 'walletConnect'
                              ? 'Scan a QR with any mobile wallet'
                              : missing
                                ? 'not detected in this browser'
                                : 'EIP-1193 extension detected'}
                        </span>
                      </span>
                      {missing && <span className="label text-signal-warn">missing</span>}
                    </button>
                  </li>
                );
              })}
            </ul>

            {process.env.NODE_ENV !== 'production' && !w.connectors.some((c) => c.type === 'walletConnect') && (
              <footer className="border-t border-hairline px-5 py-2 text-[0.6875rem] leading-5 text-text-dim">WalletConnect is not configured on this deployment</footer>
            )}
            {!injectedPresent && (
              <footer className="border-t border-hairline px-5 py-3 text-[0.6875rem] leading-5 text-text-lo">
                No browser wallet here. On mobile, open this page inside your wallet&apos;s browser:{' '}
                <a href={metaMaskDeepLink()} className="text-ion-400 hover:underline" target="_blank" rel="noreferrer">
                  open in MetaMask ↗
                </a>
              </footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function rank(type: string, id: string): number {
  if (type === 'injected' && id !== 'injected') return 0; // EIP-6963 discovered wallet (MetaMask, Rabby, …)
  if (type === 'injected') return 1;
  if (type === 'coinbaseWallet') return 2;
  if (type === 'walletConnect') return 3;
  return 4;
}
