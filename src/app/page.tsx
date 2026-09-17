import { arbitrum, robinhood } from '@/services/chains';

/**
 * Temporary "System Boot" placeholder to verify tokens, fonts, and the build.
 * Replaced by the landing page in Phase 4. No wallet, no agent calls, no fake numbers.
 */
type BootState = 'ok' | 'wait' | 'off';

const envSet = (v: string | undefined): boolean => Boolean(v && v.trim().length > 0);

const rows: ReadonlyArray<{ state: BootState; label: string; detail: string }> = [
  { state: 'ok', label: 'runtime', detail: 'next 16 · react 19 · typescript strict' },
  { state: 'ok', label: 'design system', detail: 'ultraviolet argon · tokens.css · tailwind 3' },
  { state: 'ok', label: 'wagmi', detail: `chains ${arbitrum.id} ${robinhood.id} · injected connector · ssr` },
  { state: 'ok', label: 'query', detail: 'tanstack · staleTime 30s · retry 2 · no polling < 30s' },
  {
    state: envSet(process.env.NEXT_PUBLIC_AGENT_URL) ? 'wait' : 'off',
    label: 'agent api',
    detail: envSet(process.env.NEXT_PUBLIC_AGENT_URL)
      ? 'NEXT_PUBLIC_AGENT_URL set · client not wired (phase 4)'
      : 'NEXT_PUBLIC_AGENT_URL unset · fixture mode',
  },
  {
    state: envSet(process.env.NEXT_PUBLIC_VAULT_ARB) ? 'wait' : 'off',
    label: 'vault · arb',
    detail: envSet(process.env.NEXT_PUBLIC_VAULT_ARB) ? 'address set · abi not bound' : 'not deployed',
  },
  {
    state: envSet(process.env.NEXT_PUBLIC_REGISTRY_ARB) ? 'wait' : 'off',
    label: 'registry · arb',
    detail: envSet(process.env.NEXT_PUBLIC_REGISTRY_ARB) ? 'address set · abi not bound' : 'not deployed',
  },
  {
    state: envSet(process.env.NEXT_PUBLIC_VAULT_RH) ? 'wait' : 'off',
    label: 'vault · rh',
    detail: envSet(process.env.NEXT_PUBLIC_VAULT_RH) ? 'address set · abi not bound' : 'not deployed',
  },
];

const stateGlyph: Record<BootState, { text: string; className: string }> = {
  ok: { text: 'ok', className: 'text-signal-up' },
  wait: { text: '..', className: 'text-signal-warn' },
  off: { text: '--', className: 'text-signal-idle' },
};

function Dot({ className }: { className: string }) {
  return <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${className}`} />;
}

export default function BootPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-4 px-4 py-12">
      {/* Telemetry strip (design.md §4.6) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 label">
        <span className="flex items-center gap-1.5">
          <Dot className="bg-signal-up" /> sys <span className="text-text-mid">boot</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Dot className="bg-argon-500" /> arb <span className="text-text-mid">{arbitrum.id}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Dot className="bg-argon-500" /> rh <span className="text-text-mid">{robinhood.id}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Dot className="bg-signal-idle" /> agent <span className="text-text-mid">idle</span>
        </span>
        <span className="ml-auto text-text-dim">v0.1.0 · phase 3</span>
      </div>

      {/* Wordmark + pulse */}
      <section className="panel panel-active relative overflow-hidden p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-plasma-500 animate-hour-pulse"
        />
        <div className="label mb-3">argon · eth 8h gate · v1</div>
        <h1 className="font-display text-5xl font-medium tracking-tight text-argon-400 glow-text sm:text-7xl">
          ARGON
        </h1>
        <p className="mt-3 max-w-xl text-text-mid">
          Hourly inference decides when Uniswap LP should be in the pool and when it should sit in
          cash. Deposit once. The model times the range.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-label uppercase tracking-[0.12em]">
          <span className="rounded-chip border border-hairline-strong px-2 py-1 text-argon-300">
            |pred| &lt; 2% → in range
          </span>
          <span className="rounded-chip border border-hairline px-2 py-1 text-signal-warn">
            |pred| ≥ 2% → flattened
          </span>
          <span className="rounded-chip border border-hairline px-2 py-1 text-text-lo">
            warmup 0–7h · no trades
          </span>
        </div>
      </section>

      {/* Boot log (design.md §4.7 density) */}
      <section className="panel p-0">
        <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
          <span className="label">system boot</span>
          <span className="label text-text-dim">utc</span>
        </div>
        <ol className="divide-y divide-hairline">
          {rows.map((r) => {
            const g = stateGlyph[r.state];
            return (
              <li key={r.label} className="grid grid-cols-[3ch_12ch_1fr] items-baseline gap-3 px-3 py-1.5 sm:grid-cols-[3ch_16ch_1fr]">
                <span className={`${g.className}`}>[{g.text}]</span>
                <span className="text-text-hi">{r.label}</span>
                <span className="truncate text-text-lo">{r.detail}</span>
              </li>
            );
          })}
        </ol>
        <div className="border-t border-hairline px-3 py-2">
          <div className="relative h-px w-full overflow-hidden bg-surface-2">
            <div className="absolute inset-y-0 w-1/4 bg-argon-500 animate-pending-bar" />
          </div>
          <p className="mt-2 text-text-dim">
            awaiting phase 4 · ui modules · agent client · fixture forecasts
          </p>
        </div>
      </section>

      <p className="text-center label text-text-dim animate-breathe">
        custody on-chain · judgment off-chain · the website is not the keeper
      </p>
    </main>
  );
}
