'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ConnectButton } from '@/components/modules/ConnectButton';
import { useAgentMode } from '@/hooks';
import { cn } from '@/utils/cn';

const LINKS = [
  { href: '/app', label: 'dashboard' },
  { href: '/app/deposit', label: 'deposit' },
  { href: '/app/withdraw', label: 'withdraw' },
  { href: '/app/forecasts', label: 'forecasts' },
  { href: '/app/activity', label: 'activity' },
] as const;

export function AppNav() {
  const path = usePathname();
  const mode = useAgentMode();
  return (
    <nav className="sticky top-0 z-20 border-b border-hairline bg-void/80 backdrop-blur-glass">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
        <Link href="/" className="font-display text-lg tracking-tight text-argon-400 glow-text">
          ARGON
        </Link>
        <ul className="flex flex-wrap items-center gap-1">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className={cn(
                  'rounded-chip px-2 py-1 text-label uppercase tracking-[0.12em] transition-colors',
                  path === l.href ? 'text-argon-300' : 'text-text-lo hover:text-text-hi',
                )}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-3">
          {mode === 'fixture' && <span className="label text-signal-warn">fixture agent</span>}
          <ConnectButton size="sm" />
        </div>
      </div>
    </nav>
  );
}
