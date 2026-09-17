import { QueryProvider } from '@/components/ui/QueryProvider';

import { LandingHero } from './LandingHero';

/**
 * Landing (spec §5.1 "/"). The Keeper Avatar is the hero. Query-only provider so
 * the landing reads the forecast but ships no wallet code (design.md §7.5).
 */
export default function LandingPage() {
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-5xl flex-col items-center justify-center px-4 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: 'radial-gradient(50% 40% at 50% 45%, rgba(168,85,247,0.12), transparent 70%)' }}
      />
      <header className="absolute left-4 top-4 flex items-center gap-3 sm:left-6 sm:top-6">
        <span className="font-display text-lg tracking-tight text-argon-400 glow-text">ARGON</span>
        <span className="label hidden sm:inline">eth 8h gate · v1</span>
      </header>

      <QueryProvider>
        <LandingHero />
      </QueryProvider>

      <footer className="absolute bottom-4 label text-text-dim">custody on-chain · judgment off-chain · the website is not the keeper</footer>
    </main>
  );
}
