import { FaqSection } from '@/components/modules/FaqSection';
import { QueryProvider } from '@/components/ui/QueryProvider';

import { LandingHero } from './LandingHero';

/**
 * Landing (spec §5.1 "/"), written for traders. The hero reads the live forecast through
 * a query-only provider so the page ships no wallet code (design.md §7.5).
 */
const STEPS = [
  {
    n: '1',
    title: 'Deposit once',
    body: 'Fund the vault with ETH or stablecoins. You stay in complete control and can withdraw your funds anytime.',
  },
  {
    n: '2',
    title: 'Hourly AI market check',
    body:
      "Every hour, Argon forecasts ETH's 1-hour, 2-hour, and 8-hour price movement. If ETH looks stable (within ±2%), your money works in the pool earning trading fees. If a sharp swing is predicted, Argon exits to cash to protect you from choppy losses.",
  },
  {
    n: '3',
    title: '100% transparent and verifiable',
    body: 'Every AI forecast is locked in before trades happen, so you can verify that the vault always follows the exact trading rules.',
  },
] as const;

export default function LandingPage() {
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-5xl flex-col items-center gap-14 px-4 pb-24 pt-20 sm:pt-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: 'radial-gradient(50% 40% at 50% 30%, rgba(168,85,247,0.12), transparent 70%)' }}
      />
      <header className="absolute left-4 top-4 flex items-center gap-3 sm:left-6 sm:top-6">
        <span className="font-display text-lg tracking-tight text-argon-400 glow-text">ARGON</span>
        <span className="label hidden sm:inline">automated ETH liquidity vault</span>
      </header>

      <QueryProvider>
        <LandingHero />
      </QueryProvider>

      {/* How Argon protects your trade */}
      <section className="w-full max-w-4xl">
        <h2 className="label-lg mb-4 text-center">how argon protects your trade</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="panel p-5">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-plasma-500">{s.n}</span>
                <span className="font-display text-lg text-text-hi">{s.title}</span>
              </div>
              <p className="mt-2 text-[0.8125rem] leading-5 text-text-mid">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Protocol FAQ: answers for prospective depositors and judges before they open the app */}
      <FaqSection className="max-w-4xl" />

      <footer className="absolute bottom-4 left-0 right-0 text-center label text-text-dim">
        Your funds stay in your control · Automated hourly protection · Withdraw anytime
      </footer>
    </main>
  );
}
