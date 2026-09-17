# Argon — Web Architecture

Scope: `argon-web` only. The agent, keeper, and contracts are external systems this app reads. This document explains how the web app is built, how data moves through it, and how the visual simulation layer coexists with wallet signing without blocking either.

Source constraints: spec §2 (three planes), §3 (agent REST), §4 (contracts), §5 (stack), §6 (env), §7 (time), §9 (wagmi).

---

## 1. Full-stack topography

### 1.1 The three planes and where the web sits

```
                    ┌──────────────────────────────────────────────┐
                    │  argon-web (Next.js App Router, TypeScript)  │
                    │  wagmi v2 + viem + TanStack Query            │
                    │  READS: agent REST, vault, registry, logs    │
                    │  WRITES: approve, deposit, withdraw only     │
                    └──────────┬───────────────────┬───────────────┘
                               │                   │
                HTTPS GET JSON │                   │ JSON-RPC (reads)
                (poll 30–60s)  │                   │ wallet-signed txs (writes)
                               ▼                   ▼
              ┌────────────────────┐   ┌──────────────────────────┐
              │ Agent API (Heroku) │   │ Arbitrum One   42161     │
              │ /health /status    │   │ Robinhood      4663      │
              │ /forecasts/*       │   │ ArgonVault               │
              │ Postgres           │   │ InferenceRegistry        │
              └─────────┬──────────┘   └────────────▲─────────────┘
                        │ hourly clock              │ keeper txs
                        └──────── keeper ───────────┘  (never the web)
```

The web is a **reader plus user custody**. It holds no keys except the user's own wallet session. Custody is on-chain. Judgment is off-chain. The keeper is the only writer from agent to chain.

### 1.2 Layers inside the web app

| Layer | Technology | Responsibility |
|---|---|---|
| Routing and views | Next.js App Router, `src/app` | Pages, layouts, server components for static shells |
| Providers | wagmi `WagmiProvider`, TanStack `QueryClientProvider`, wallet modal (RainbowKit or ConnectKit) | One provider tree in `src/app/layout.tsx`, mounted only for `/app/*` routes |
| Domain modules | `src/components/modules` | ForecastHero, WarmupBar, PoolCard, HashMatch, WalletStrip, deposit and withdraw forms |
| UI primitives | `src/components/ui` | Buttons, chips, panels, tables, inputs, tokens from `design.md` |
| Simulation | `src/components/simulation` | Canvas particle field, ticker tape, telemetry readouts. Pure presentation. |
| Hooks | `src/hooks` | Every read and write is a hook. Components never call `fetch` or viem directly. |
| Services | `src/services` | Agent REST client, chain and contract config, explorer link builder, log fetcher |
| Stores | `src/stores` | One small Zustand store for ephemeral UI state only |
| Types | `src/types` | Forecast row, status, contract ABIs as `const`, chain ids |
| Utils | `src/utils` | `hourId` math, bps ↔ percent, formatting, policy helper, simulation math |

### 1.3 Backend / BFF decision

**Default: no BFF.** The browser fetches the agent API directly over HTTPS and reads chains through wagmi transports. Reasons: the spec defines the agent as CORS-restricted to the web origin, every endpoint is public and read-only, and there is nothing to hide.

**Escape hatch: a Next.js Route Handler proxy at `src/app/api/agent/[...path]/route.ts`.** Enable it only if one of these becomes true:

- The agent's CORS cannot be configured for the web origin.
- We need server-side caching to shield a free Heroku dyno from many dashboard viewers during a demo.
- We need to serve the on-chain fallback row from the server when the agent is down.

The proxy is a pass-through with `revalidate: 30`. It never adds auth, never writes, and never holds secrets that the client does not already have. The former `server/` folder is retired in favour of this; there is no separate Express or Fastify process.

### 1.4 Indexer decision

v1 has no indexer. The activity feed uses viem `getLogs` against the vault address for `Deposited`, `Withdrawn`, and `Rebalanced` over a bounded block range (default: last ~7 days of blocks, paginated in chunks the public RPC accepts). Results are cached in TanStack Query keyed by `[chainId, vault, user, fromBlock]`. If a subgraph or Ponder indexer appears later, it replaces `services/logs.ts` behind the same hook signature.

---

## 2. Data flow and lifecycle

### 2.1 Sources of truth

| Data | Source | Hook | Cache key | Stale time |
|---|---|---|---|---|
| Latest forecast | `GET /forecasts/latest` | `useLatestForecast` | `['agent','latest']` | 30s, refetch at `:01` UTC and on focus |
| Forecast history | `GET /forecasts?limit=24` | `useForecastHistory` | `['agent','history',24]` | 60s |
| Forecast detail | `GET /forecasts/:hourId` | `useForecast(hourId)` | `['agent','forecast',hourId]` | Infinity once `status === 'matured'` |
| Agent status | `GET /status` | `useAgentStatus` | `['agent','status']` | 30s |
| Registry row | `getForecast(hourId)`, `latestHourId()` | `useRegistryForecast` | wagmi read key | 30s |
| Pool status | `poolStatus(poolId)` | `usePoolStatus` | wagmi read key | 15s |
| Vault balances | `idleBalance`, `shareBalance` | `useVaultBalances` | wagmi read key | 15s, invalidate on receipt |
| Vault params | `gateBps()`, `warmupComplete()` | `useVaultParams` | wagmi read key | 5 min |
| Wallet | `useAccount`, `useChainId`, `useBalance` | wagmi | wagmi | wagmi defaults |
| Activity | `getLogs` | `useActivity` | `['logs',chainId,vault,user]` | 60s, invalidate on receipt |

There is exactly one cache: TanStack Query (wagmi uses it internally). Zustand never mirrors server or chain data.

### 2.2 One hour, as the web sees it

```
:00 UTC   agent infers → Postgres; keeper submit() → registry; maybe rebalance() → vault
:00:30    poll → /forecasts/latest returns new hourId → hero re-renders, action flips
:01:00    scheduled refetch (catches slow clocks)
:01–:03   useRegistryForecast(newHourId) → hash + bps → HashMatch green or red
:03–:08   keeper rebalance lands → next poll of poolStatus flips IN_POOL ↔ IDLE
rest      nothing changes; polls continue at 30–60s
```

The `:01` refetch is implemented once in `useAgentClock`: it computes ms until the next `hh:01:00Z` and schedules a single `queryClient.invalidateQueries({queryKey:['agent']})`. On fire it reschedules. No `setInterval` at 1s.

### 2.3 Derived state

Derived values are computed in selectors inside hooks, not stored.

- `gateChip = |ethPctChange| >= 2 ? 'OUT' : 'IN'`
- `displayAction = forecast.action ?? policyAction({...})` (API wins, helper is fallback)
- `poolCardStatus = !funded ? 'UNFUNDED' : poolId in {2,3} ? 'LINK_SOON' : poolStatus === 1 ? 'IN_POOL' : 'IDLE'`
- `hashMatch = registry.forecastHash === api.forecastHash && registry.ethPctBps === toBps(api.ethPctChange)`
- `warmupProgress = min(status.lastHourId - firstHourId + 1, 8)` or from `hoursUntilFirstDecision`

### 2.4 Agent-down fallback

```
useLatestForecast fails (network, 5xx, timeout 10s)
   → useRegistryForecast(latestHourId()) becomes the hero's source
   → hero renders ethPctBps / 100 with two decimals
   → banner: "live agent unreachable — showing last on-chain forecast"
   → action derived by policyAction() from vault warmupComplete + poolStatus
   → ticker, particle field keep running on the fallback row
```

If the registry is also unavailable, the hero shows an explicit "no forecast available" empty state. It never shows a fabricated number.

### 2.5 Write lifecycle

```
form input → validate (decimals, max) →
useSimulateContract (catches reverts before signing) →
useWriteContract (wallet prompt) →
useWaitForTransactionReceipt →
on success: invalidate ['vault', chainId] and ['logs', chainId, ...] →
toast + activity row
```

State per write is a small discriminated union in the hook: `idle | simulating | awaitingSignature | pending(hash) | confirmed(receipt) | failed(error)`. Components render from that union. There is no global tx store.

---

## 3. Contract and RPC interfaces

### 3.1 Chains

`src/services/chains.ts` exports both chains. Arbitrum comes from `viem/chains`. Robinhood is defined by hand:

| Field | Value |
|---|---|
| `id` | `4663` |
| `name` | Robinhood Chain |
| `nativeCurrency` | ETH, 18 |
| `rpcUrls.default` | `NEXT_PUBLIC_RH_RPC` or `https://rpc.mainnet.chain.robinhood.com` |
| `blockExplorers.default` | `https://robinhoodchain.blockscout.com` |

Arbitrum explorer is `https://arbiscan.io`. Explorer URLs are built in `services/explorer.ts` from chain id, never taken from API payloads.

### 3.2 Transports and fallback nodes

```ts
transports: {
  [arbitrum.id]: fallback([http(env.ARB_RPC), http('https://arb1.arbitrum.io/rpc')]),
  [robinhood.id]: fallback([http(env.RH_RPC), http('https://rpc.mainnet.chain.robinhood.com')]),
}
```

- `fallback` tries the env RPC first, then the public default. Add a third paid endpoint later by env without code changes.
- `batch: { multicall: true }` on transports so pool cards and balances collapse into one call per chain.
- Reads use `useReadContracts` (plural) where a widget needs several values from the same contract.

### 3.3 Wallet connectors

RainbowKit (or ConnectKit) over wagmi v2. Configured chains: Arbitrum first, Robinhood second. `NEXT_PUBLIC_WALLETCONNECT_ID` enables WalletConnect. Injected wallets work without it. Providers mount only under `/app` via a nested `layout.tsx` so the landing page ships no wallet code.

### 3.4 Contract bindings

`src/services/contracts.ts`:

- ABIs live in `src/types/abi/*.ts` as `as const` arrays typed by viem. Only the functions and events the web uses (spec §4.4). No full generated ABI dumps until contracts exist.
- Addresses come from env per chain: `NEXT_PUBLIC_VAULT_ARB`, `NEXT_PUBLIC_REGISTRY_ARB`, `NEXT_PUBLIC_VAULT_RH`, `NEXT_PUBLIC_REGISTRY_RH`.
- `getVault(chainId)` and `getRegistry(chainId)` return `{ address, abi } | undefined`. `undefined` drives the "not deployed" states. No throwing at import time.

Functions bound:

| Contract | Reads | Writes | Events |
|---|---|---|---|
| `ArgonVault` | `idleBalance`, `shareBalance`, `poolStatus`, `gateBps`, `warmupComplete` | `deposit`, `depositETH` (optional), `withdraw`, `emergencyWithdraw` | `Deposited`, `Withdrawn`, `Rebalanced` |
| `InferenceRegistry` | `latestHourId`, `getForecast` | none | `ForecastSubmitted` (read-only, for activity) |
| ERC-20 | `allowance`, `balanceOf`, `decimals` | `approve` | none |

Never bound: `rebalance`, `submit`, Uniswap `NonfungiblePositionManager`, v4 `PoolManager`.

### 3.5 Transaction simulation pipeline

Every write calls `useSimulateContract` with the exact args first. If simulation reverts, the button shows the decoded reason and stays disabled. This catches sequencer-down and stale-oracle guards before the user pays for a failed tx. Gas is left to the wallet. No custom gas UI in v1.

### 3.6 Token registry

`src/services/tokens.ts` holds the checksummed addresses and decimals from spec §4.2 keyed by chain id. Amount parsing uses `parseUnits(value, decimals)` from viem. Display uses `formatUnits` and a formatter that never shows more than 6 significant decimals.

---

## 4. Performance and simulation architecture

### 4.1 The rule

Wallet signing, RPC reads, and agent polling live on the main thread and must never wait on a frame. The simulation layer must therefore be **frame-budgeted, cancellable, and disposable**. If a canvas loop ever makes the approve button feel late, the canvas loses.

### 4.2 Rendering tiers

| Tier | Technology | Used for | Budget |
|---|---|---|---|
| DOM + CSS | Tailwind, CSS variables, keyframes | Layout, chips, glow, glass panels, ticker tape scroll | Free |
| Framer Motion | `motion` components, `AnimatePresence`, `layout` | Number roll-ups, chip flips, panel enter/exit, route transitions | ≤ 20 animated nodes per view |
| Canvas 2D | Single `<canvas>` behind the dashboard | Particle field, hourly pulse, gate boundary visual | ≤ 4 ms per frame at 60 Hz on a mid laptop |
| WebGL / shaders | Optional, feature-flagged | Background shader instead of Canvas 2D on capable devices | Same 4 ms budget; falls back to Canvas 2D |

Three.js is not a dependency in v1. A single background scene does not justify it. If a 3D artifact is added later, it goes in `components/simulation/three/` behind `next/dynamic` with `ssr: false`.

### 4.3 The single scheduler

One `requestAnimationFrame` loop per page, owned by `useSimulationLoop` in `src/hooks`. Every simulation component registers a callback `(dt, now) => void` and unregisters on unmount. Nobody else calls `requestAnimationFrame`.

The scheduler:

- Pauses when `document.hidden` is true and on `prefers-reduced-motion`.
- Pauses while a wallet write is in `awaitingSignature` state (read from the write hook's status) so the signing prompt gets a quiet main thread.
- Caps device pixel ratio at 2 and resizes the canvas with a debounced `ResizeObserver`.
- Runs at most one callback set per frame; if the previous frame overran 12 ms, it drops the next frame rather than queueing.

### 4.4 Data into the simulation

Simulation components never fetch. They receive plain values as props from the same hooks the widgets use: `ethPctChange`, `gateChip`, `action`, `warmupProgress`, `poolStatuses`. Props are pushed into a `useRef` so the render loop reads the latest values without re-subscribing per frame. React re-renders do not restart the loop.

### 4.5 Heavy computation

There is no heavy client computation in v1. `hourId` math and formatting are trivial. If a future feature needs real work (backtest replay, large log decoding), it goes in a Web Worker under `src/utils/workers/` with `OffscreenCanvas` where supported. Never `for` loop over thousands of logs on the main thread.

### 4.6 Memory and cleanup rules

- Every `useEffect` that starts a loop, observer, timer, or subscription returns a cleanup.
- Canvas contexts are released and the element is un-sized on unmount to free GPU memory.
- Framer Motion `AnimatePresence` wraps anything that can leave the tree so exit animations do not keep unmounted nodes alive.
- Ticker tape is a CSS transform loop, not a JavaScript interval.

### 4.7 Bundle policy

- `/` ships no wagmi, no canvas.
- `/app/*` lazy-loads simulation components with `next/dynamic` and renders the data widgets first.
- Fonts are self-hosted or from Google Fonts with `display: swap`.
- No moment.js, no lodash. `date-fns` only if UTC formatting needs it; native `Intl` preferred.

---

## 5. Directory map

```
argon-web/
  CLAUDE.md                    operating guardrails for coding sessions
  doc/                         this folder: product, architecture, agents, design, essentials
  src/
    app/                       routes: /, /app, /app/deposit, /app/withdraw, /app/forecasts, /app/activity, api/agent (optional proxy)
    components/
      ui/                      primitives: Button, Chip, Panel, DataTable, TokenInput, Glow
      simulation/              ParticleField, TickerTape, Telemetry, HourPulse
      modules/                 ForecastHero, WarmupBar, PoolCard, HashMatch, WalletStrip, DepositForm, WithdrawForm, ActivityFeed, ChainSwitcher, ConnectButton
    hooks/                     useLatestForecast, useForecastHistory, useAgentStatus, useAgentClock, useRegistryForecast, usePoolStatus, useVaultBalances, useVaultParams, useDeposit, useWithdraw, useActivity, useSimulationLoop
    services/                  agent.ts, chains.ts, wagmi.ts, contracts.ts, tokens.ts, explorer.ts, logs.ts
    stores/                    ui.ts (Zustand: selected chain, modal, motion setting)
    types/                     forecast.ts, status.ts, pools.ts, abi/
    styles/                    globals.css, tokens.css, keyframes.css
    utils/                     hourId.ts, bps.ts, format.ts, policy.ts, sim/
```

---

## 6. Environment

From spec §6. All public. Anything else does not belong in this app.

```
NEXT_PUBLIC_AGENT_URL
NEXT_PUBLIC_ARB_RPC
NEXT_PUBLIC_RH_RPC
NEXT_PUBLIC_VAULT_ARB
NEXT_PUBLIC_REGISTRY_ARB
NEXT_PUBLIC_VAULT_RH
NEXT_PUBLIC_REGISTRY_RH
NEXT_PUBLIC_WALLETCONNECT_ID
NEXT_PUBLIC_ADMIN_ADDRESS
```

Env is validated once in `src/services/env.ts`. Missing contract addresses are allowed and yield `undefined` bindings. A missing `NEXT_PUBLIC_AGENT_URL` in development switches the agent client to the static fixture in `src/services/fixtures/`.

---

## 7. Build order

From spec §11, mapped onto this architecture:

1. Scaffold Next.js, Tailwind, wagmi, both chains, connect wallet. Providers under `/app` only.
2. `types/forecast.ts` + `services/agent.ts` + `useLatestForecast` against a fixture.
3. Dashboard modules with mocked pool status. Simulation layer starts here with a Canvas 2D particle field only.
4. `useRegistryForecast` + HashMatch once a registry address exists.
5. `useDeposit` / `useWithdraw` against the Arbitrum vault, simulate → sign → receipt → invalidate.
6. Robinhood chain switch + vault 4.
7. Forecast history table with matured realized %.
8. Activity feed via `getLogs`.
