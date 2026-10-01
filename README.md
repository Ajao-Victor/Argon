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
[![Tests](https://img.shields.io/badge/tests-72_passing-34d399)](#quality-gates)
[![Lint](https://img.shields.io/badge/lint-0_warnings-a855f7)](#quality-gates)

</div>

---

Concentrated Uniswap liquidity earns fees only while price stays in range. A sharp move pushes the position out of range, realizes impermanent loss, and leaves the LP holding the asset that just fell. Argon deposits once, forecasts the ETH move **eight hours ahead every hour on the :00 UTC**, and applies one public rule: if the model expects a move of **2 % or more**, the keeper flattens liquidity into the vault (`EXIT`); inside ±2 % it enters or holds the range (`ENTER` / `HOLD`). Every forecast is hashed to an on-chain registry before any trade, so the number on screen can be checked against the number the vault acted on. This repository is the user's window onto that loop: wallet, deposit, idle-only withdraw, the live forecast, pool status, and the hash match. **The website never signs a rebalance and never holds a keeper key.**

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
| `/` | Landing with the Keeper Avatar as hero, reading the live forecast through a query-only provider (no wallet code) |
| `/app` | Bento dashboard: forecast hero, keeper, on-chain hash match, warmup bar, four pool cards, wallet strip, activity feed |
| `/app/deposit` | Chain switcher, token picker, `approve → deposit` as one stepping button |
| `/app/withdraw` | Idle-only withdraw with the in-pool banner, plus emergency idle withdraw |
| `/app/forecasts` | Last 24 hourly rows, predicted versus realized after maturity, row click opens the hash match |
| `/app/activity` | `Deposited` / `Withdrawn` / `Rebalanced` events from bounded `getLogs`, no indexer |

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
| `NEXT_PUBLIC_VAULT_ARB` / `NEXT_PUBLIC_VAULT_RH` | `ArgonVault` (`0x9F844b4D1b28Be7413067f9d4fC08Bc276fd1C60` on both chains) | "Contracts not deployed", deposit and withdraw disabled |
| `NEXT_PUBLIC_REGISTRY_ARB` / `NEXT_PUBLIC_REGISTRY_RH` | `InferenceRegistry` (`0xbAf00c0aCa440337d43495c7de661A0AC2E01e8f` on both chains) | Hash match reads "registry not deployed" |
| `NEXT_PUBLIC_WALLETCONNECT_ID` | WalletConnect project id | Injected wallets still work |
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

The same deployer nonce was used on both chains, so the addresses match. Owner and keeper: `0x9642b6D1Db5D1A3B0A61a831099568bbCbC04D4E`.

| Contract | Address | Arbitrum One (42161) | Robinhood Chain (4663) |
|---|---|---|---|
| `ArgonVault` | `0x9F844b4D1b28Be7413067f9d4fC08Bc276fd1C60` | [Arbiscan](https://arbiscan.io/address/0x9F844b4D1b28Be7413067f9d4fC08Bc276fd1C60) | [Blockscout](https://robinhoodchain.blockscout.com/address/0x9F844b4D1b28Be7413067f9d4fC08Bc276fd1C60) |
| `InferenceRegistry` | `0xbAf00c0aCa440337d43495c7de661A0AC2E01e8f` | [Arbiscan](https://arbiscan.io/address/0xbAf00c0aCa440337d43495c7de661A0AC2E01e8f) | [Blockscout](https://robinhoodchain.blockscout.com/address/0xbAf00c0aCa440337d43495c7de661A0AC2E01e8f) |
| `ChainlinkEthOracle` | `0xfC22F2C49Ce6Fa46c5081f900fD691b127Bd1bc5` | [Arbiscan](https://arbiscan.io/address/0xfC22F2C49Ce6Fa46c5081f900fD691b127Bd1bc5) | [Blockscout](https://robinhoodchain.blockscout.com/address/0xfC22F2C49Ce6Fa46c5081f900fD691b127Bd1bc5) |
| `UniswapV3Adapter` | `0xECCc4B8946D0DB206f977d3021544D0cD5Dc69D4` | pool 1 · WETH/USDC 0.05 % | pool 4 · WETH/USDG 0.05 % |

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
| `GET /vault` | 10 s | `useVaultTelemetry` | Global TVL before any wallet connects |
| `GET /portfolio/{address}` | 10 s, only with a wallet | `usePortfolio` | Live equity in USD |

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
2. **The registry's own function.** Call `InferenceRegistry.computeHash(497434, -1, -13, -39)` on either chain and you get the same bytes (verified during integration).
3. **Stored row.** Once the keeper submits, `getForecast(hourId)` returns the bps triple and hash the vault acted on; the panel compares both against the API row and turns green only when all four values agree.

Run it locally in a few seconds:

```bash
curl -s https://argon-bd8888db5430.herokuapp.com/forecasts/latest | jq '{hourId, ethPct1h, ethPct2h, ethPct8h, forecastHash}'
cast call 0xbAf00c0aCa440337d43495c7de661A0AC2E01e8f "computeHash(uint64,int256,int256,int256)(bytes32)" 497434 -- -1 -13 -39 --rpc-url https://arb1.arbitrum.io/rpc
```

### What a judge will see today

The keeper runs with `DRY_RUN=true`, so the registry's `forecastCount` is `0` on both chains, every API row is in `warmup`, and the hash-match panel reads **pending on chain**. That is the honest state: the API publishes and the browser verifies its hashes, but nothing has been written on-chain yet. When the operator flips `DRY_RUN`, the panel turns green with no frontend change.

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

The frontend architecture, design system, and implementation of Argon Web were **solely engineered by Victor Oluwatimilryin Ajao**.

The off-chain forecasting agent and the smart contracts are separate workstreams outside this repository.

<div align="center">

*custody on-chain · judgment off-chain · the website is not the keeper*

</div>
