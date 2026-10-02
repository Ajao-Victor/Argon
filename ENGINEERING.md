# ENGINEERING.md — argon-web operating guardrails

Read `doc/architecture-essentials.md` first in every session. It is the compressed truth. Go to `doc/product.md`, `doc/architecture.md`, `doc/agents.md`, `doc/design.md` only when the essentials do not answer the question. `doc/Argon .txt` is the original spec of record.

## 0. Absolute rules

1. **Never touch `../agent/`.** Not read-modify, not format, not move, not `git add`, not commit. It belongs to another engineer. Reading it for context is fine. Writing is forbidden.
2. **The web never writes to the agent.** No `POST`, `PUT`, `DELETE`, no WebSocket sends. `GET` only.
3. **The web never calls `rebalance`, `submit`, Uniswap `NonfungiblePositionManager`, or v4 `PoolManager`.** Do not add those ABIs to the codebase.
4. **No secrets in this repo.** Only `NEXT_PUBLIC_*` env. No keeper key, no Tiingo key, no DIA calls from the browser. If a value would be dangerous in a browser bundle, it does not belong here.
5. **One gate.** The deployed rule is `DualHorizonGate.sol`: EXIT if |1h| ≥ 1.00 % or |2h| ≥ 2.50 %; HOLD if in pool; ENTER only when idle and all three horizons are inside (8h gate 2.00 %). Render the API `action`. `dualHorizonAction()` mirrors the contract for the fallback path and tests; `policyAction()` is the legacy 8 h helper. Never introduce another threshold, slider, or "sensitivity". Gates come from the API (`gate1hBps/2hBps/8hBps`); the vault has no gate getter.
6. **Never fake a number.** Agent not configured → "waiting for agent telemetry". Agent down → show the registry row with a banner. Registry down → empty state. No placeholder percent, no default gate, no sample hash, ever. The fixture exists only behind `NEXT_PUBLIC_AGENT_FIXTURE=true` in non-production builds.
7. **Never poll under 30 s**, with one documented exception: `GET /pools` polls every 15 s (the agent's advertised `pollSeconds`, requested for the live APR cards; TanStack de-duplicates in-flight ticks). No `setInterval(…, 1000)`. The `:01` UTC refetch is one scheduled timeout in `useAgentClock`.

## 1. Anti-overengineering manifesto

Web3 frontends rot in predictable ways. These are the ones we refuse.

### 1.1 Duplicate caching

**Symptom:** wagmi/TanStack Query holds `idleBalance`, and a Zustand store also holds `idleBalance`, and they disagree after a tx.
**Rule:** TanStack Query is the only cache for anything that came from the network or the chain. Zustand holds four fields of ephemeral UI state (`modal`, `selectedChainId`, `motion`, `field`) and nothing that has a query key. A field is added only when something reads it. If you find yourself writing `setBalance(...)` in a store, stop and invalidate a query instead.

### 1.2 Micro-store sprawl

**Symptom:** `useTxStore`, `useForecastStore`, `useWalletStore`, `usePoolStore`, each with its own subscription and its own staleness bugs.
**Rule:** one store file, `src/stores/ui.ts`. Transaction state is a local discriminated union inside `useDeposit` / `useWithdraw`. Forecast state is a query. Wallet state is wagmi. There is no third thing.

### 1.3 ABI over-abstraction

**Symptom:** a `ContractService` class with a generic `call<T>(method, args)` wrapper, a `useContractMethod` factory, and typed nothing.
**Rule:** ABIs are `as const` arrays in `src/types/abi/`. Hooks call `useReadContract` / `useWriteContract` directly with the ABI and `functionName`. viem infers the types. A hook per domain read (`usePoolStatus`, `useVaultBalances`), not a hook per contract method, and no generic wrapper.

### 1.4 Premature indexer

**Symptom:** a subgraph, Ponder, or Postgres event mirror before there is a single deployed contract.
**Rule:** `getLogs` over a bounded block range, cached by query key. Replace `services/logs.ts` behind the same hook signature when volume justifies it.

### 1.5 BFF for its own sake

**Symptom:** an Express server in `server/` that forwards JSON and adds a place for secrets to leak.
**Rule:** the browser fetches the agent directly. The only server code allowed is the optional Next.js route handler `app/api/agent/[...path]` as a pass-through for CORS or caching. It transforms nothing.

### 1.6 Simulation engine creep

**Symptom:** Three.js, a physics library, and a postprocessing chain for a background that shows one number.
**Rule:** Canvas 2D, one `requestAnimationFrame` owned by `useSimulationLoop`, ≤ 4 ms per frame. WebGL is a feature-flagged swap of the same background. No Three.js in v1.

### 1.7 Optimistic lies

**Symptom:** `idleBalance += amount` before the receipt; `IN_POOL` flipped on the forecast alone.
**Rule:** balances, `poolStatus`, and hash match change only on chain reads after a receipt or poll. Optimism is allowed for pending chips and animations only.

## 2. What breaks under load, and how we avoid it

| Failure | Cause | Pattern |
|---|---|---|
| Frame drops while signing | canvas loop competing with the wallet prompt | `useSimulationLoop` pauses when any write hook is in `awaitingSignature`; DPR capped at 2; frame skipped if the previous exceeded 12 ms |
| Memory growth over hours on `/app` | rAF loops, `ResizeObserver`s, timers, `EventSource`s never cleaned | every `useEffect` that starts something returns a cleanup; canvas context released on unmount; `AnimatePresence` around anything that unmounts |
| RPC 429 / rate limits | one `useReadContract` per pool card per poll on a public node | `useReadContracts` with multicall; `staleTime` 15–30 s; `fallback([http(env), http(public)])`; never poll reads faster than agent polls |
| Agent dyno cold-start timeouts | free Heroku sleeps | 10 s abort; retry 2 with backoff cap 8 s; then registry fallback; `/health` on boot |
| Stale socket connections | long-lived SSE/WebSocket held open across sleeps | no sockets in v1; if SSE arrives, it only invalidates queries and polling remains the source |
| Ticker jank | JS-driven marquee with `setInterval` | CSS `transform` animation, duplicated content, `animation-play-state: paused` on hover |
| Wrong chain reads returning zeros | a hook reads vault on the wallet's chain instead of the pool's chain | every read passes `chainId` explicitly from `pools.ts`; never rely on the connected chain for reads |
| Number flicker | layout shift from proportional digits | `font-variant-numeric: tabular-nums` on all numeric text |
| Hydration mismatch | wallet state or `Date.now()` rendered on the server | providers under `/app` layout only; time-dependent widgets are client components with a stable first render |

## 3. Coding standards

### 3.1 TypeScript

- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- No `any`. `unknown` at boundaries, narrowed with zod.
- Addresses are `` `0x${string}` `` from viem, never `string`.
- Amounts are `bigint` from `parseUnits` until the moment they are formatted. Never `Number(balance)` for arithmetic.
- `hourId` is a `number` branded via `HourId` type from `types/forecast.ts`.

### 3.2 Folder colocation

- A component lives with its styles and its test: `PoolCard.tsx`, `PoolCard.test.tsx`. No `__tests__` dumping ground.
- Route-specific components live next to the route in `app/…/`. Shared ones live in `components/`.
- Hooks in `hooks/` are domain hooks. If a hook is only used by one component, colocate it as `useX.ts` beside that component.
- Barrel `index.ts` files exist only at the folder roots listed in the scaffold. No nested barrels.

### 3.3 Hooks encapsulation

- Components never call `fetch`, viem clients, or `useReadContract` directly. They call a domain hook.
- Every domain hook returns `{ data, status, error, refetch }` shaped by TanStack Query. No custom loading booleans.
- Two components that need the same data share one query key. Slice in the component; never request the same rows under a second key.
- Write hooks return a discriminated union `status` plus `write()` and `reset()`. Nothing else.
- Simulation components receive plain values as props and push them into a ref. They never subscribe to queries.

### 3.4 Error boundaries

- One `error.tsx` under `app/app/` catching render errors for the dashboard tree. It shows the registry fallback panel, not a blank page.
- Each panel that depends on a query renders its own inline error state from `status === 'error'`. Never let one failed panel unmount the dashboard.
- Wallet write errors are decoded with viem `BaseError.shortMessage` and shown inline under the button.

### 3.5 Styling

- Tailwind with tokens from `styles/tokens.css`. No raw hex in components.
- `className` composition via `clsx`. No CSS-in-JS.
- Framer Motion animates `transform` and `opacity` only.

### 3.6 Lint (ESLint 9 flat config, `npm run lint`, zero warnings allowed)

- `next lint` no longer exists in Next 16; `eslint.config.mjs` runs `eslint-config-next` (core-web-vitals + typescript) and `typescript-eslint` with `no-explicit-any`, `no-unused-vars`, `consistent-type-imports`, and the React Compiler rules (`react-hooks/refs`, `immutability`, `set-state-in-effect`, `preserve-manual-memoization`) as errors.
- Refs are written in effects, never during render. The "latest callback" pattern is `useEffect(() => { ref.current = cb; })`, not an assignment in the function body.
- Media queries and other external values are read through `useSyncExternalStore`, never by returning `ref.current` from a hook.
- Derive UI state from props (`openAt === path`) instead of `setState` inside an effect keyed on the prop.
- Do not `useMemo` over an object rebuilt every render; either memoize the object or drop the memo.
- The only `'use no memo'` in the codebase is the particle field, an imperative canvas system. Do not add another without a comment explaining why the compiler cannot model it.
- TypeScript is pinned to 5.x: `typescript-eslint` does not support the 7.x line yet.

### 3.7 Testing

- `policy.ts`, `hourId.ts`, `bps.ts`, `format.ts` have unit tests. They are the correctness core.
- Every hook that reconciles API and chain (`useRegistryForecast` match logic, monotonic guard) has a test with fixture rows.
- Vitest + Testing Library. No snapshot tests of animated components.

## 4. Git protocol

- Work on `main` until a second contributor appears; then feature branches `feat/<area>` merged by PR.
- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`. Scope optional, e.g. `feat(dashboard): hash match panel`.
- Commit after each working unit: a hook plus its test, a module plus its story or page. Not after every file, not once a day.
- Never commit `.env*` except `.env.example`. Never commit `.DS_Store`.
- Never `git add` anything outside `argon-web/`. The `agent/` folder is a separate repository owned by someone else; it is not ours to stage, commit, or push.
- `git push` only when asked.

## 5. Session start checklist

1. Read `doc/architecture-essentials.md`.
2. `git status` to see where the last session stopped.
3. Confirm which build-order step (`essentials` §15) is in progress.
4. If the task touches the agent contract, re-read `doc/agents.md` §4 before writing a type.
5. If the task touches visuals, re-read `doc/design.md` §2 tokens and §3 budgets.

## 6. Hackathon judge verification and live deployment

What a reviewer can check without trusting this repository, and what every change must keep true.

| Item | Value |
|---|---|
| Agent | `https://argon-bd8888db5430.herokuapp.com` (FastAPI, Heroku), model `eth-1-2-8h-v1` |
| ArgonVault | `0x9F844b4D1b28Be7413067f9d4fC08Bc276fd1C60` on Arbitrum One 42161 and Robinhood Chain 4663 |
| InferenceRegistry | `0xbAf00c0aCa440337d43495c7de661A0AC2E01e8f` on both chains |
| Owner / keeper | `0x9642b6D1Db5D1A3B0A61a831099568bbCbC04D4E` (= `NEXT_PUBLIC_ADMIN_ADDRESS`, unlocks a read-only panel only) |
| Hash | `keccak256(abi.encode(uint64 hourId, int256 bps1h, int256 bps2h, int256 bps8h, keccak256("eth-1-2-8h-v1")))`, bps = round-half-even(pct × 100) |

Polling: `/forecasts/latest` and `/status` 30 s; `/forecasts` 60 s; `/pools` 15 s (documented exception); `/vault` 30 s; `/portfolio/{address}` 30 s with a wallet only, invalidated on every receipt. The 30 s floor in §0.7 has no exceptions: `/vault` and `/portfolio` answer in 9.6–12.7 s, so anything faster only stacks requests. Timeouts 15 s feed / 30 s chain-reading endpoints. bps = round-half-even(pct × 100). Staleness: a print older than one hour is flagged on every route. Wallet: `NEXT_PUBLIC_APP_URL` is the origin in wallet metadata; `NEXT_PUBLIC_WALLETCONNECT_ID` enables the QR connector.

Invariants a change must not break:

- `src/types/forecast.test.ts` recomputes the live published hash from the live numbers. If that test fails, either the agent changed its encoding or someone touched `forecastHash.ts` or `bps.ts`; find out which before merging.
- ABIs in `src/types/abi/` are transcriptions of the deployed Solidity in the partner repo (`contracts/src/ArgonVault.sol`, `InferenceRegistry.sol`). Verify any ABI edit by decoding a live call on both chains before committing.
- `withdraw(shares)` flattens LP first and pays pro-rata WETH + stable. The UI copy says so. Do not reintroduce the spec's idle-only withdraw language.
- Addresses enter the app only through `getAddress()` (env, tokens) or the zod address schema (agent payloads). No raw string address reaches a contract call.
