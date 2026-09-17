import Link from 'next/link';

import { arbitrum, robinhood } from '@/services/chains';

/**
 * Landing (spec §5.1 "/"): one-liner, ±2% gate, 8h model, Launch app.
 * Static. Ships no wallet code and no canvas (architecture.md §4.7).
 */
const STEPS = [
  { n: '01', title: 'deposit once', body: 'WETH, USDC, or USDG into a per-chain vault. You never mint Uniswap LP yourself.' },
  { n: '02', title: 'hourly forecast', body: 'At :00 UTC a hosted model infers the ETH % change eight hours ahead and commits its hash on-chain.' },
  { n: '03', title: 'one gate', body: '|pred| ≥ 2% flattens liquidity into the vault. Inside ±2% the keeper enters or holds the range.' },
  { n: '04', title: 'verify', body: 'The dashboard shows the API number beside the InferenceRegistry hash. Green means the vault acted on it.' },
] as const;

const POOLS = [
  { id: 1, pair: 'WETH / USDC', chain: `Arbitrum · ${arbitrum.id}`, dex: 'Uniswap v3', live: true },
  { id: 2, pair: 'LINK / WETH', chain: `Arbitrum · ${arbitrum.id}`, dex: 'Uniswap v3', live: false },
  { id: 3, pair: 'LINK / USDC', chain: `Arbitrum · ${arbitrum.id}`, dex: 'Uniswap v4', live: false },
  { id: 4, pair: 'WETH / USDG', chain: `Robinhood · ${robinhood.id}`, dex: 'Uniswap v3', live: true },
] as const;

export default function LandingPage() {
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-5xl flex-col gap-10 px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[60vh]"
        style={{ background: 'radial-gradient(55% 45% at 50% 20%, rgba(168,85,247,0.16), transparent 70%)' }}
      />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-display text-lg tracking-tight text-argon-400 glow-text">ARGON</span>
        <span className="label">eth 8h gate · v1 · arbitrum + robinhood</span>
      </header>

      <section className="panel panel-active relative overflow-hidden p-6 sm:p-8">
        <div className="label mb-4">argon · hourly inference · uniswap lp vault</div>
        <h1 className="font-display text-4xl font-medium leading-tight tracking-tight text-text-hi sm:text-6xl">
          In the pool when the next eight hours look calm.
          <br />
          <span className="text-argon-400 glow-text">In cash when they don&apos;t.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-text-mid">
          Concentrated liquidity earns fees only while price stays in range. Argon deposits once, forecasts ETH every
          hour, and moves Uniswap positions in and out of range on a single public rule. The website is the window.
          The keeper does the timing.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/app"
            className="inline-flex items-center rounded-chip border border-argon-500 bg-argon-600/30 px-5 py-2.5 text-label uppercase tracking-[0.12em] text-argon-300 transition-[box-shadow,background-color] hover:bg-argon-600/50 hover:shadow-glow-sm"
          >
            launch app →
          </Link>
          <span className="rounded-chip border border-hairline-strong px-2 py-1 text-label uppercase tracking-[0.12em] text-argon-300">
            |pred| &lt; 2% → in range
          </span>
          <span className="rounded-chip border border-hairline px-2 py-1 text-label uppercase tracking-[0.12em] text-signal-warn">
            |pred| ≥ 2% → flattened
          </span>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {STEPS.map((s) => (
          <div key={s.n} className="panel p-4">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-plasma-500">{s.n}</span>
              <span className="font-display text-lg text-text-hi">{s.title}</span>
            </div>
            <p className="mt-2 text-text-mid">{s.body}</p>
          </div>
        ))}
      </section>

      <section className="panel p-0">
        <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
          <span className="label">pools</span>
          <span className="label text-text-dim">v1 gate: 1 and 4</span>
        </div>
        <ul className="divide-y divide-hairline">
          {POOLS.map((p) => (
            <li key={p.id} className="grid grid-cols-[3ch_1fr_auto] items-center gap-3 px-3 py-2 text-[0.75rem] sm:grid-cols-[3ch_1fr_1fr_1fr_auto]">
              <span className="text-text-lo">{p.id}</span>
              <span className="text-text-hi">{p.pair}</span>
              <span className="hidden text-text-lo sm:block">{p.chain}</span>
              <span className="hidden text-text-lo sm:block">{p.dex}</span>
              <span className={p.live ? 'label text-argon-300' : 'label text-signal-soon'}>{p.live ? 'eth gate' : 'link soon'}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ['custody', 'Funds stay in a per-chain vault. Idle balances are always withdrawable. The keeper can only call rebalance with bounds fixed in the contract.'],
          ['judgment', 'The model runs off-chain on an hourly clock. Its output is hashed to an on-chain registry before any trade.'],
          ['no keys in the browser', 'The website reads the agent and the chain. It signs deposit and withdraw. It never holds the keeper key.'],
        ].map(([t, b]) => (
          <div key={t} className="panel p-4">
            <div className="label">{t}</div>
            <p className="mt-2 text-text-mid">{b}</p>
          </div>
        ))}
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-4 label text-text-dim">
        <span>custody on-chain · judgment off-chain · the website is not the keeper</span>
        <Link href="/app" className="text-ion-400 hover:underline">
          open dashboard
        </Link>
      </footer>
    </main>
  );
}
