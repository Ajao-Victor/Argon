<div align="center">

# Argon | Web3 Liquidity Vault Interface

**Hourly inference decides when Uniswap liquidity should be in the pool and when it should sit in cash.**

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-20232a?logo=react&logoColor=61dafb)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9_strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![wagmi](https://img.shields.io/badge/wagmi-3-1c1b1f)](https://wagmi.sh)
[![viem](https://img.shields.io/badge/viem-2-1c1b1f)](https://viem.sh)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-13-0055ff?logo=framer&logoColor=white)](https://www.framer.com/motion/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06b6d4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Tests](https://img.shields.io/badge/tests-136_passing-34d399)](#quality-gates)
[![Lint](https://img.shields.io/badge/lint-0_warnings-a855f7)](#quality-gates)

</div>

---

Concentrated Uniswap liquidity earns fees only while price stays in range. A sharp move pushes the position out of range, realizes impermanent loss, and leaves the LP holding the asset that just fell. Argon deposits once, forecasts the ETH move **eight hours ahead every hour on the :00 UTC**, at three horizons (1 h, 2 h, 8 h), and applies one public rule from `DualHorizonGate.sol`: if the model expects |ETH| to move **≥ 1 % in 1 h or ≥ 2.5 % in 2 h**, the keeper flattens liquidity into the vault (`EXIT`); it only enters the range when all three horizons are inside their gates (8 h ±2 %), and holds while in pool (`ENTER` / `HOLD`). Every forecast is hashed to an on-chain registry before any trade, so the number on screen can be checked against the number the vault acted on. This repository is the user's window onto that loop: wallet, deposit, share-based withdraw, the live forecast, pool status, and the hash match. **The website never signs a rebalance and never holds a keeper key.**

---

## Table of contents

1. [Architecture and stack](#architecture-and-stack)
2. [Tier-1 simulation engine](#tier-1-simulation-engine)
3. [Application surface](#application-surface)
4. [Local setup and development](#local-setup-and-development)
5. [Hackathon judge verification and live deployment](#hackathon-judge-verification-and-live-deployment)
6. [Integration status](#integration-status)
7. [Quality gates](#quality-gates)
8. [Project layout](#project-layout)
9. [Documentation](#documentation)
10. [Authorship and credits](#authorship-and-credits)

---

## Architecture and stack

Argon is split into **custody (on-chain)** and **judgment (off-chain)**. The frontend sits on all three planes as a reader plus user custody.

```
                 ┌──────────────────────────────────────────────┐
                 │  argon-web · Next.js 16 App Router            │
                 │  wagmi 3 + viem 2 + TanStack Query 5          │
                 │  READS  agent REST · vault · registry · logs  │
                 │  WRITES approve · deposit · withdraw only     │
                 └──────────┬───────────────────┬────────────────┘
                            │ HTTPS GET, polled │ JSON-RPC reads
                            │ every 30–60 s     │ wallet-signed txs
                            ▼                   ▼
           ┌────────────────────┐   ┌────────────────────────────┐
           │ Agent API (Heroku) │   │ Arbitrum One        42161  │
           │ Python · LightGBM  │   │ Robinhood Chain      4663  │
           │ /status /forecasts │   │ ArgonVault                 │
           │ Postgres           │   │ InferenceRegistry          │
           └─────────┬──────────┘   └─────────────▲──────────────┘
                     │ hourly clock               │ keeper txs
                     └──────── keeper ────────────┘  (never the website)
```

| Plane | Runs on | Owns | The frontend's relationship |
|---|---|---|---|
| **Frontend** (this repo) | Next.js 16, React 19 | Wallet UI, deposit and withdraw, rendering forecasts, verifying hashes | The product surface |
| **Agent** | Heroku, Python | Model, hourly inference, forecast store, ±2 % policy, keeper | Read-only REST, zod-validated at the boundary |
| **Contracts** | Arbitrum One, Robinhood Chain | User funds, Uniswap positions, public forecast hash | `useReadContract` for everything; the user signs deposit and withdraw only |

### Frontend technologies

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16** (App Router, Turbopack) with **React 19** | Static routes, nested layouts, providers mounted only under `/app` so the landing page ships no wallet code |
| Language | **TypeScript 5.9** in strict mode with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` | Addresses are `` `0x${string}` ``, amounts are `bigint`, no `any` anywhere |
| Web3 | **wagmi 3** + **viem 2** | Typed `as const` ABIs, multicall reads, `simulate → sign → receipt` write pipeline, fallback RPC transports |
| Server state | **TanStack Query 5** | The only cache for network and chain data; 30 s polling, a single scheduled refetch at `:01` UTC |
| Validation | **zod 4** | Every agent payload is validated; malformed rows never reach the UI |
| UI state | **Zustand 5** | Three persisted preferences and nothing else |
| Motion | **Framer Motion 13** | Spring physics, staggered entrances, colour interpolation; transform and opacity only |
| Styling | **Tailwind CSS 3.4** over CSS custom properties | The Ultraviolet Argon token system lives in `src/styles/tokens.css`; components carry no raw hex |
| Tooling | ESLint 9 (flat config, React Compiler rules), Vitest 5 | Zero-warning lint, 47 unit tests on the correctness core |

---

## Tier-1 simulation engine

The dashboard is anchored by the **Keeper Avatar**, a visual instrument for the off-chain model, and a **fluid particle field** behind the glass panels. Both are presentation only: they read the same hooks as the data widgets and introduce no state, no thresholds, and no user actions.

**The avatar** is inline SVG driven by Framer Motion. A hexagonal reactor core, cursor-tracking eyes on weighted springs (stiffness 100, damping 30), three orbital rings, and energy arcs. Its posture derives from a pure energy model, `k = |ethPctChange| / 2`, so the ±2 % gate is exactly `k = 1`:

| State | Trigger | Look |
|---|---|---|
| `dormant` | Agent not configured or unreachable | Rings stopped, eyes a hairline, six-second breathing |
| `warmup` | First eight hours after launch | Rings at quarter speed |
| `calm` | `ENTER` / `HOLD`, `k < 0.6` | Cool `--argon-500`, core breathing `argon-600 → argon-300 → plasma-400` |
| `charged` | `0.6 ≤ k < 1` | Plasma highlights, core jitter, one arc |
| `aggressive` | `EXIT`, `k ≥ 1` | Blazing `--plasma-500` with `--signal-down` eyes, counter-rotating rings, three arcs |

It also reacts to the software itself. While a TanStack query is in flight it sweeps a scan line and pulses a data ring. While a wallet prompt is open it holds still and turns amber. While a transaction is mining it **overclocks**: rings six times faster, the core vibrating at about 16 Hz, an ion palette, until the receipt lands.

**How it stays off the main thread's critical path.** One `requestAnimationFrame` scheduler owns the whole page (`src/utils/sim/scheduler.ts`). Subscribers get a **4 ms budget** per frame; a frame over budget drops exactly the next frame, and a rolling average lets the particle field shed particles down to a floor of 80. The canvas pauses when the tab is hidden, when it leaves the viewport, and **while any wallet signature is pending**, so the signing prompt always gets a quiet thread. Pointer tracking writes to Framer motion values, never React state. Every continuous animation is translate, rotate, scale, or opacity; the layered neon auras are static per state and only transition on a state change. The scheduler's frame-drop behaviour is covered by unit tests with a fake `requestAnimationFrame`.

---

## Application surface

| Route | What it shows |
|---|---|
| `/` | Landing: "Yield on autopilot. Safety built in." with the Keeper Avatar reading the live forecast through a query-only provider (no wallet code), a three-step explainer and the protocol FAQ |
| `/app` | Bento dashboard: forecast hero, keeper, on-chain hash match, warmup bar, four pool cards (with the wallet's signer gate), wallet strip, activity feed, protocol FAQ (`#faq`, linked from the navbar and footer) |
| `/app/deposit` | Chain switcher, asset picker (native ETH, WETH, USDC or USDG), `approve → deposit` as one stepping button for ERC-20s, `depositETH` with no approval for native ETH, gas-safe MAX that leaves 0.0005 ETH behind |
| `/app/withdraw` | Share-based withdraw with the in-pool banner, wallet readout (native ETH, WETH, stable), plus emergency withdraw |
| `/app/forecasts` | Last 24 hourly rows with the **Understandable hour** (the UTC hour each 8-hour prediction settles, e.g. `15:00 UTC (in 6h)`), predicted versus realized after maturity, row click opens the hash match |
| `/app/activity` | `Deposited` / `Withdrawn` / `Rebalanced` events from bounded `getLogs`, no indexer |

**Forecast terminology.** The hour at which an 8-hour forecast settles (`hourId + 8`) is shown as the *Understandable hour* everywhere, never as a "target": the exact UTC hour plus a plain countdown, with a tooltip explaining that it is the prediction's resolution window.

**Protocol FAQ.** `FaqSection` answers eight questions from the protocol specification (what Argon solves, the hourly 8-hour forecast and remaining-move calculation, ENTER / HOLD / EXIT, the 9-hour warmup and 2-hour cooldown, chains and pools, signer gates, custody and keeper limits, hash verification) as a filterable, keyboard-accessible accordion mounted on `/` and `/app`.

**Native ETH deposits.** Besides WETH and the chain stablecoin, the vault takes native ETH through its payable `depositETH()`; the deposit form skips the ERC-20 approval for it and sends the amount as the transaction `value`. MAX on ETH subtracts a 0.0005 ETH gas reserve so the transaction can always pay for itself. The native balance is read per vault chain and refreshed with the ERC-20 balances after every receipt.

**Honesty rules baked into the UI.** With no agent URL the app says "waiting for agent telemetry"; it never shows a sample number. With no contract addresses, pool cards read "contracts not deployed" and deposit and withdraw stay disabled. If the agent is down but the registry is live, the hero falls back to the on-chain number under a banner. Optimistic UI is allowed for presentation only, never for balances, pool status, or the hash match.

**Transaction feedback.** Every write drives a local discriminated union, `idle → simulating → awaitingSignature → pending → confirmed | failed`, mirrored by a toast that updates in place: amber while the wallet prompt is up, an argon pending bar while mining, green with the block number on confirmation, red with the decoded reason on failure. User rejection is detected by walking viem's typed error; receipts time out after five minutes so a dropped transaction never leaves the UI mining forever.

---

## Local setup and development

**Prerequisites:** Node 22 or newer, npm 10, and a browser wallet such as MetaMask for the transaction flows.

```bash
git clone https://github.com/Ajao-Victor/Argon.git
cd Argon
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The dashboard lives at `/app`.

### Environment

All configuration is public and inlined at build time. **After editing `.env.local`, restart `next dev` or rebuild.** No code changes are needed: every hook is gated on these values and activates the moment they are present.

| Variable | Purpose | When empty |
|---|---|---|
| `NEXT_PUBLIC_AGENT_URL` | Base URL of the agent REST API (`https://argon-bd8888db5430.herokuapp.com`) | UI shows "waiting for agent telemetry" |
| `NEXT_PUBLIC_AGENT_FIXTURE` | `true` serves local sample rows (development builds only) | Ignored in production |
| `NEXT_PUBLIC_ARB_RPC` / `NEXT_PUBLIC_RH_RPC` | RPC endpoints, tried before the public defaults | Public RPCs |
| `NEXT_PUBLIC_VAULT_ARB` / `NEXT_PUBLIC_VAULT_RH` | `ArgonVault` (`0xe0eb546A1F8dcEc7B124cF8fE253de34d54A6c61` on Arbitrum One, `0x89403CA4AdB3A89A0173B7494903B4247881966f` on Robinhood Chain) | "Contracts not deployed", deposit and withdraw disabled |
| `NEXT_PUBLIC_REGISTRY_ARB` / `NEXT_PUBLIC_REGISTRY_RH` | `InferenceRegistry` (`0x8F288a7a6E28a5d44980De19502522C376965afe` on Arbitrum One, `0x256A61b459BFdb48B4C04DE5Ba13E0dFBC326508` on Robinhood Chain) | Hash match reads "registry not deployed" |
| `NEXT_PUBLIC_WALLETCONNECT_ID` | WalletConnect project id; adds the QR option to the connect picker | Browser wallets (EIP-6963) and Coinbase Wallet still work |
| `NEXT_PUBLIC_APP_URL` | Public origin used in wallet metadata | The page's own origin at runtime |
| `NEXT_PUBLIC_ADMIN_ADDRESS` | Address that sees the read-only keeper panel | Panel hidden |

Never place a keeper key, a Tiingo key, or any private value in this repository. Only `NEXT_PUBLIC_*` values are read.

### Scripts

| Command | Does |
|---|---|
| `npm run dev` | Development server with Turbopack |
| `npm run build` | Production build; all six routes prerender as static |
| `npm run start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` under the strict config |
| `npm run lint` | ESLint 9, zero warnings allowed |
| `npm run test` | Vitest: `hourId`, `bps`, dual-horizon policy, reconciliation, live payload validation, hash recomputation, scheduler |

To exercise every avatar state and the full dashboard locally without the agent service, set `NEXT_PUBLIC_AGENT_FIXTURE=true` in `.env.local`. The fixture generates 24 clock-advancing rows (warmup, in-gate, out-of-gate, matured) that satisfy the same strict schema as live data and is labelled "fixture" everywhere it appears.

---

## Hackathon judge verification and live deployment

Everything below can be checked without trusting this repository.

### Live contracts

Redeployed on 2026-10-02 with the scheduled-news pause; the deployer nonces differ, so addresses differ per chain. Owner and keeper on every contract: `0x9642b6D1Db5D1A3B0A61a831099568bbCbC04D4E`. Deposit fee read from the vault: 10 bps on Arbitrum, 60 bps on Robinhood. The agent publishes the vault it manages in `GET /pools`, and the web refuses deposits when its bound vault differs. Retired with zero shares: `ArgonVault` / `InferenceRegistry` at `0x9F844b4D1b28Be7413067f9d4fC08Bc276fd1C60` / `0xbAf00c0aCa440337d43495c7de661A0AC2E01e8f` on both chains.

| Contract | Arbitrum One (42161) | Robinhood Chain (4663) |
|---|---|---|
| `ArgonVault` | [`0xe0eb546A1F8dcEc7B124cF8fE253de34d54A6c61`](https://arbiscan.io/address/0xe0eb546A1F8dcEc7B124cF8fE253de34d54A6c61) · deploy block 511142126 | [`0x89403CA4AdB3A89A0173B7494903B4247881966f`](https://robinhoodchain.blockscout.com/address/0x89403CA4AdB3A89A0173B7494903B4247881966f) · deploy block 78649595 |
| `InferenceRegistry` | [`0x8F288a7a6E28a5d44980De19502522C376965afe`](https://arbiscan.io/address/0x8F288a7a6E28a5d44980De19502522C376965afe) | [`0x256A61b459BFdb48B4C04DE5Ba13E0dFBC326508`](https://robinhoodchain.blockscout.com/address/0x256A61b459BFdb48B4C04DE5Ba13E0dFBC326508) |
| `ChainlinkEthOracle` | [`0x89403CA4AdB3A89A0173B7494903B4247881966f`](https://arbiscan.io/address/0x89403CA4AdB3A89A0173B7494903B4247881966f) | [`0x8F288a7a6E28a5d44980De19502522C376965afe`](https://robinhoodchain.blockscout.com/address/0x8F288a7a6E28a5d44980De19502522C376965afe) |
| `UniswapV3Adapter` | [`0x05734481536644bc20e671Db28f5b4c05B7D64D4`](https://arbiscan.io/address/0x05734481536644bc20e671Db28f5b4c05B7D64D4) · pool 1 · WETH/USDC 0.05 % | [`0xEDa50F3F5530E9BFFD427c1DB0E0a8f3D05cCC9D`](https://robinhoodchain.blockscout.com/address/0xEDa50F3F5530E9BFFD427c1DB0E0a8f3D05cCC9D) · pool 4 · WETH/USDG 0.05 % |

Escrowed tokens (EIP-55): Arbitrum WETH `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1`, USDC `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`; Robinhood WETH `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`, USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`.

### Live agent API

Base `https://argon-bd8888db5430.herokuapp.com` (FastAPI on Heroku, Postgres, LightGBM 8 h model with 1 h and 2 h persistence baselines, model id `eth-1-2-8h-v1`).

| Endpoint | Frontend poll | Hook | What the page does with it |
|---|---|---|---|
| `GET /health` | on boot | `useAgentHealth` | Footer agent dot |
| `GET /status` | 30 s | `useAgentStatus` | Warmup bar, gates, DRY_RUN in the admin panel |
| `GET /forecasts/latest` | 30 s + a scheduled refetch at `:01` UTC | `useLatestForecast` | Hero number, horizon chips, Keeper Avatar, hash match |
| `GET /forecasts?limit=24` | 60 s | `useForecastHistory` | Forecasts table, ticker |
| `GET /pools` | 60 s | `usePools` | APR / TVL pool cards, chain selection |
| `GET /vault` | 30 s (the endpoint answers in 9.6–12.7 s) | `useVaultTelemetry` | Global TVL before any wallet connects |
| `GET /portfolio/{address}` | 30 s, only with a wallet, refetched on every receipt | `usePortfolio` | Live equity in USD |

Every payload is validated with zod against schemas built from verbatim captures of the live responses (`src/types/forecast.test.ts`, `src/types/agentApi.test.ts`). The browser never writes to the agent.

### Verifying an inference hash yourself

Each hourly row publishes three numbers and one hash. The hash is:

```
bps_h        = round_half_even(ethPct_h × 100)                       # the agent uses Python round()
modelId      = keccak256(utf8("eth-1-2-8h-v1"))
forecastHash = keccak256(abi.encode(uint64 hourId, int256 bps1h, int256 bps2h, int256 bps8h, bytes32 modelId))
```

Three independent checks, all shown on the dashboard's **ON-CHAIN MATCH** panel:

1. **Browser recomputation.** `src/utils/forecastHash.ts` recomputes the hash from the API's own numbers. The unit test reproduces the live hash `0x1db0b9d6064bfcba03285dfb5430e357f10f61097ae726986e00319a6f04451e` for hour `497434` from `(-1, -13, -39)` bps and fails on a tampered number.
2. **The registry's own function.** Call `InferenceRegistry.computeHash(hourId, bps1h, bps2h, bps8h)` on either chain's registry and you get the API's bytes (re-verified on 2026-10-03 against both redeployed registries for hour `497508`).
3. **Stored row.** Once the keeper submits, `getForecast(hourId)` returns the bps triple and hash the vault acted on; the panel compares both against the API row and turns green only when all four values agree.

Run it locally in a few seconds:

```bash
curl -s https://argon-bd8888db5430.herokuapp.com/forecasts/latest | jq '{hourId, ethPct1h, ethPct2h, ethPct8h, forecastHash}'
# bps = round-half-even(pct × 100); hour 497508 on 2026-10-03 was (-21, -26, -36) → 0x82c6e22c…5ac5 on both chains
cast call 0x8F288a7a6E28a5d44980De19502522C376965afe "computeHash(uint64,int256,int256,int256)(bytes32)" 497508 -- -21 -26 -36 --rpc-url https://arb1.arbitrum.io/rpc
cast call 0x256A61b459BFdb48B4C04DE5Ba13E0dFBC326508 "computeHash(uint64,int256,int256,int256)(bytes32)" 497508 -- -21 -26 -36 --rpc-url https://rpc.mainnet.chain.robinhood.com
```

### What a judge will see today

The keeper runs with `DRY_RUN=true`, so the registry's `forecastCount` is `0` and `latestHourId` is `0` on both chains, every API row is in `warmup`, and the hash-match panel reads **pending · keeper dry-run** with the submit count. The telemetry strip, footer and hero also say so, and they flag the print as **stale** whenever the agent's last hour lags the current UTC hour by more than one (the live capture lagged 29 h). That is the honest state: the API publishes and the browser verifies its hashes, but nothing has been written on-chain yet. When the operator flips `DRY_RUN`, the panel turns green with no frontend change.

---

## Integration status

| Deliverable | Status |
|---|---|
| **Agent REST service** | Live. All eight endpoints integrated and validated against live captures. |
| **Smart contracts** | Deployed on both chains. ABIs transcribed from the deployed Solidity and verified by decoding live calls. |
| **Keeper** | Deployed, `DRY_RUN=true`; no on-chain submits yet. |

The web app never calls `rebalance`, `submit`, any owner setter, the Uniswap `NonfungiblePositionManager`, or the v4 `PoolManager`. Those ABIs do not exist in this codebase by design.

---

## Quality gates

Every commit on `main` passes all four.

| Gate | Result |
|---|---|
| `npm run typecheck` | Clean under strict, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns` |
| `npm run lint` | 0 errors, 0 warnings, including React Compiler rules (`refs`, `immutability`, `set-state-in-effect`) |
| `npm run test` | 72 tests across 8 files, including live-payload captures and the hash recomputation |
| `npm run build` | 6 static routes; the landing bundle contains no wagmi code (verified against the built HTML) |
| `npm audit` | 0 vulnerabilities |

Security audit highlights: 32-byte hash validation, bounded numeric fields, cross-field consistency refinements, abortable requests, re-entrancy guard on writes, typed user-rejection handling, receipt timeouts, and no secrets in the bundle.

---

## Project layout

```
argon-web/
├── ENGINEERING.md            operating guardrails: absolute rules, anti-overengineering, lint patterns
├── doc/                      product, architecture, essentials cheat sheet, agent protocol, design system
├── src/
│   ├── app/                  routes: /, /app, /app/{deposit,withdraw,forecasts,activity}; template transition
│   ├── components/
│   │   ├── ui/               Panel, Button, Chip, DataTable, TokenInput, Navbar, Footer, Toasts, Skeleton, Tooltip…
│   │   ├── modules/          ForecastHero, HashMatch, PoolCard, WalletStrip, forms, tables, telemetry
│   │   └── simulation/       KeeperAvatar, ParticleField, AmbientGlow, TickerTape, Telemetry
│   ├── hooks/                useAgent, useVault, useRegistry, useWallet, useActivity, useSimulationLoop…
│   ├── services/             agent client, chains, wagmi config, contracts, tokens, explorer, logs, fixtures
│   ├── stores/               the one Zustand store (selectedChainId, motion, field)
│   ├── styles/               tokens.css (brand), globals.css, keyframes.css
│   ├── types/                Forecast + zod schemas, pools, as-const ABIs
│   └── utils/                hourId, bps, policy, format, reconcile, sim/scheduler + keeper energy model
├── eslint.config.mjs · tailwind.config.ts · tsconfig.json · vitest.config.ts
└── .env.example
```

---

## Documentation

| File | Read it for |
|---|---|
| [`ENGINEERING.md`](ENGINEERING.md) | The rules every change must respect |
| [`doc/architecture-essentials.md`](doc/architecture-essentials.md) | The dense cheat sheet: chains, tokens, endpoints, ABIs, state model, copy |
| [`doc/product.md`](doc/product.md) | Vision, personas, feature matrix, non-functional requirements |
| [`doc/architecture.md`](doc/architecture.md) | Topography, data flow, contract interfaces, simulation architecture |
| [`doc/agents.md`](doc/agents.md) | The exact web ↔ agent protocol and failure recovery |
| [`doc/design.md`](doc/design.md) | The Ultraviolet Argon design system and the Tier-1 interactivity spec |

---

## Authorship and credits

The frontend architecture, design system, and implementation of Argon Web were **solely engineered by Victor Oluwatimileyin Ajao**.

The off-chain forecasting agent and the smart contracts are separate workstreams outside this repository.

<div align="center">

*custody on-chain · judgment off-chain · the website is not the keeper*

</div>
