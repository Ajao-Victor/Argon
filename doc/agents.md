# Argon — Web ↔ Agent Protocol Contract

This is the exact boundary between `argon-web` (ours) and `agent/` (partner's). Everything the web knows about the agent is on this page. Everything the partner must expose for the web is on this page.

Sources: spec §3 (Web ↔ agent), §7 (time), §8 (sequence); partner's `agent/README.md` and `agent/eth_model.ipynb`.

---

## 1. Boundary statement

| | argon-web | agent |
|---|---|---|
| Owns | Wallet UI, deposit/withdraw, rendering forecasts, verifying hashes | Model, hourly inference, forecast store, ±2% policy, keeper |
| May call | `GET` on the agent REST API. Read contracts. Sign deposit/withdraw. | Tiingo, DIA, Postgres, `Registry.submit`, `Vault.rebalance` |
| May never call | Any `POST`/`PUT` to the agent. `rebalance`. `submit`. Uniswap managers. | Nothing on the web. The agent never pushes to the browser in v1. |
| Holds secrets | None beyond the user's wallet session | Tiingo key, keeper private keys, Postgres URL |
| Source of the number | Reads `ethPctChange` | Produces `ethPctChange` |
| Source of the action | Renders `action` from the API | Computes `action` from the ±2% gate |

**Direction of data is one way: agent → web, by polling.** There are no execution triggers, kill switches, or parameter-tuning messages from the web to the agent. The spec forbids them and the design does not need them. The only "execution triggers" a user can fire are on-chain `deposit` and `withdraw` against the vault, which the agent observes from chain, not from the web.

---

## 2. Communication topology

### 2.1 v1: REST over HTTPS, polled

```
Browser ──GET──► https://<NEXT_PUBLIC_AGENT_URL>/forecasts/latest   every 30–60s, plus :01 UTC
Browser ──GET──► /status                                             every 30s
Browser ──GET──► /forecasts?limit=24                                 every 60s on /app/forecasts
Browser ──GET──► /forecasts/:hourId                                  on demand, cached forever once matured
Browser ──GET──► /health                                             on app boot, and when the agent looks down
```

- Transport: HTTPS, JSON, `Content-Type: application/json`.
- Auth: none. All endpoints are public reads.
- CORS: the agent allows the web origin only (`Access-Control-Allow-Origin: https://<web-host>`). Local dev origin is added by the partner or the optional Next.js proxy handles it.
- Timeouts: the web aborts any agent request after 10 s.
- Caching: `Cache-Control: public, max-age=15` on `/forecasts/latest` and `/status` is welcome but not required. The web caches in TanStack Query regardless.

### 2.2 Not in v1: WebSocket, SSE, IPC

The agent runs on an hourly clock. Nothing changes between `:00` and the next `:00` except maturity of rows eight hours old. Polling at 30–60 s with a forced refetch at `:01` UTC catches every change within about a minute. A socket would add a stateful connection to a free Heroku dyno for no product gain.

If the partner later offers `GET /events` as Server-Sent Events, the web adopts it as an **optimization only**: the SSE handler simply calls `queryClient.invalidateQueries(['agent'])` on any message. Polling remains as the fallback. No UI state ever depends on the socket being open.

### 2.3 Optional Next.js proxy

`src/app/api/agent/[...path]/route.ts` may forward `GET` requests to `NEXT_PUBLIC_AGENT_URL` with `revalidate: 30`. Same paths, same JSON, no transformation. Use it only for CORS or dyno-shielding reasons. See `architecture.md` §1.3.

---

## 3. Endpoints

Base: `NEXT_PUBLIC_AGENT_URL` = `https://argon-bd8888db5430.herokuapp.com` (live since 2026-10-01; see §9 for the as-deployed contract).

| Method | Path | Returns | Poll | Web use |
|---|---|---|---|---|
| `GET` | `/health` | `Health` | boot | Agent up, model loaded, database |
| `GET` | `/status` | `AgentStatus` | 30 s | Warmup progress, clock, gates, DRY_RUN |
| `GET` | `/forecasts/latest` | `Forecast` | 30 s | Dashboard hero, avatar, hash match |
| `GET` | `/forecasts?limit=24` | `{ items: Forecast[] }` newest first | 60 s | History table and ticker |
| `GET` | `/forecasts/:hourId` | `Forecast` | on demand | Detail, predicted vs realized |
| `GET` | `/pools` | `PoolsResponse` | 60 s | APR / TVL cards, chain selection |
| `GET` | `/vault` | `VaultSnapshot` | 30 s | Global TVL before any wallet connects |
| `GET` | `/portfolio/:address` | `Portfolio` | 30 s (wallet only) | Live user equity in USD |

Error shape for any non-2xx:

```json
{ "ok": false, "error": "string", "code": "MODEL_NOT_LOADED | NOT_FOUND | INTERNAL" }
```

HTTP codes: `404` for an unknown `hourId`, `503` while the model is loading or the last inference failed, `500` otherwise.

---

## 4. Schemas (TypeScript, the contract)

These types live in `src/types/forecast.ts` and are the only place the shape is defined. The partner's service must emit exactly these fields with these types. Extra fields are ignored by the web. Missing required fields fail validation and trigger the fallback.

```ts
/** floor(unixUtcSeconds / 3600) */
export type HourId = number;

export type PolicyAction = 'warmup' | 'exit' | 'enter' | 'hold';
export type ForecastStatus = 'pending' | 'matured';

export interface Forecast {
  hourId: HourId;                 // hour the inference ran
  targetHourId: HourId;           // hourId + horizonHours
  submittedAt: string;            // ISO 8601 UTC, e.g. "2026-09-16T16:00:00.000Z"
  horizonHours: 8;                // literal 8 in v1
  ethPctChange: number;           // THE number. (exp(logReturn) - 1) * 100. Two-decimal display.
  ethLogReturn: number;           // raw model output
  spotUsd: number;                // DIA spot at inference time
  modelId: string;                // "eth-8h-v1"
  status: ForecastStatus;         // 'pending' until nowHour >= targetHourId
  realizedPctChange: number | null; // filled at targetHourId
  realizedSpotUsd: number | null;   // filled at targetHourId
  action: PolicyAction;           // server-computed from the gate
  gateBps: number;                // 200
  warmupComplete: boolean;        // false until 8 forecasts exist
  txHash: `0x${string}` | null;   // keeper submit and/or rebalance tx for this hour
  forecastHash: `0x${string}` | null; // bytes32 committed to InferenceRegistry
}

export interface AgentStatus {
  ok: boolean;
  warmupComplete: boolean;
  hoursUntilFirstDecision: number; // 0 once warmup is complete
  gateBps: number;                 // 200
  lastHourId: HourId;
  modelId: string;
  modelLoaded: boolean;
  lastError?: string | null;       // optional, human readable
}

export interface Health {
  ok: boolean;
  modelLoaded: boolean;
  version?: string;
}

export interface ForecastList {
  items: Forecast[];               // newest first
}
```

Runtime validation: the web validates every payload with a schema (zod) built from these types. A row that fails validation is treated as an agent error, not rendered.

### 4.1 Reference payload

```json
{
  "hourId": 488888,
  "targetHourId": 488896,
  "submittedAt": "2026-09-16T16:00:00.000Z",
  "horizonHours": 8,
  "ethPctChange": -2.41,
  "ethLogReturn": -0.0244,
  "spotUsd": 2410.12,
  "modelId": "eth-8h-v1",
  "status": "pending",
  "realizedPctChange": null,
  "realizedSpotUsd": null,
  "action": "exit",
  "gateBps": 200,
  "warmupComplete": true,
  "txHash": "0xabc...",
  "forecastHash": "0xdef..."
}
```

### 4.2 Field derivations the partner must implement

| Field | Derivation | Where it exists in the partner's code today |
|---|---|---|
| `ethLogReturn` | model output for the 8h horizon | `generate_hourly_predictions()` → `predictions['8h']['log_return']` |
| `ethPctChange` | `(exp(ethLogReturn) - 1) * 100` | same function → `percentage_change`; identical formula |
| `spotUsd` | DIA current price | `DataIngestion.fetch_current_price_from_dia()` |
| `submittedAt` | ISO UTC timestamp of the inference | `prediction_result['timestamp']` (DIA time; should be the `:00` clock time instead) |
| `modelId` | constant `"eth-8h-v1"`; bump on retrain policy change | not present |
| `hourId` | `floor(unixUtc / 3600)` at inference | not present |
| `targetHourId` | `hourId + 8` | not present |
| `status`, `realizedPctChange`, `realizedSpotUsd` | maturity job at `targetHourId` reads spot and fills | not present; needs Postgres |
| `action` | `warmup` if `!warmupComplete`; `exit` if `abs(ethPctChange) >= gateBps/100`; else `enter` if pool idle, `hold` if in pool | not present; policy engine |
| `gateBps` | constant `200`, should match the vault | not present |
| `warmupComplete` | `count(forecasts) >= 8` | not present |
| `forecastHash` | `keccak256(abi.encode(hourId, ethPctBps, targetHourId, modelId))` or whatever the registry defines; must be the same bytes the keeper submits | not present; keeper |
| `txHash` | receipt hash of `submit` (or `rebalance` if both, prefer `rebalance`) | not present; keeper |

The partner's notebook currently retrains on every run and prints a dict. The hourly service must load a persisted model, infer once, and persist the row. That is the partner's work. The web does not block on it.

### 4.3 On-chain mirror

The web cross-checks the API row against `InferenceRegistry.getForecast(hourId)`:

| Chain field | Equals |
|---|---|
| `ethPctBps` (int256) | `trunc(ethPctChange * 100)`, e.g. `-2.41` → `-241` |
| `targetHourId` (uint64) | `targetHourId` |
| `forecastHash` (bytes32) | `forecastHash` |
| `submittedAt` (uint64) | unix seconds ≈ `Date.parse(submittedAt) / 1000` |

Both `forecastHash` and `ethPctBps` must match for the HashMatch widget to show green.

---

## 5. Polling and clock

```ts
// useAgentClock: one scheduled invalidation at hh:01:00Z, rescheduled after firing
const msUntilNextMinuteOne = () => {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours() + 1, 1, 0, 0));
  return next.getTime() - now.getTime();
};
```

- `refetchInterval`: 30 000 ms for `latest` and `status`, 60 000 ms for history.
- `refetchOnWindowFocus: true`.
- `retry: 2` with exponential backoff capped at 8 s. After that, the fallback path engages.
- Never below 30 s. Never a 1 s loop.

---

## 6. Failure recovery

### 6.1 Agent unreachable

| Condition | Detection | Web behaviour |
|---|---|---|
| Network error, timeout > 10 s, 5xx | fetch rejects or `!res.ok` | Keep last good row rendered (TanStack keeps cache). Show amber "agent stale since hh:mm UTC". |
| Still failing after retries | query `status === 'error'` | Switch hero source to `useRegistryForecast(latestHourId())`. Red banner: "live agent unreachable — showing last on-chain forecast." |
| Registry also unavailable | read reverts or address undefined | "No forecast available" empty state. No number. |
| Agent back | next successful poll | Banner clears; hero returns to API row; hash match re-evaluates |

### 6.2 Reconnection loop

There is no persistent connection to reconnect. Recovery is the poll itself. If SSE is ever added, its reconnection is browser-native `EventSource` with a 5 s cap on retry, and a dropped SSE connection changes nothing because polling continues.

### 6.3 State reconciliation

The web treats these three sources as independent and reconciles them in one selector:

1. **API row** (fast, may be stale or wrong).
2. **Registry row** (authoritative for the number the keeper committed).
3. **Vault `poolStatus`** (authoritative for what actually happened to liquidity).

Rules:

- If the API `hourId` is **behind** the registry `latestHourId`, the API is stale. Prefer the registry for the number. Show "agent stale".
- If the API `hourId` is **ahead** of the registry, the keeper has not submitted yet. Show the API number, hash match shows "pending on chain" (amber), not red.
- If both agree on `hourId` but hashes differ, that is a real mismatch. Red. Never hide it.
- If `action` says `exit` but `poolStatus` still reads `1`, the rebalance has not landed. Pool card shows `IN_POOL` with a small "exit pending" tag once `txHash` is known. Never flip the chip on the forecast alone.

### 6.4 Out-of-order and replay defenses

- **Monotonic guard:** the hero only accepts a new API row if `row.hourId >= lastRenderedHourId`. A lower `hourId` from a lagging replica is ignored and logged.
- **Idempotent rendering:** all render state is a pure function of the latest accepted row plus chain reads. Re-delivering the same row is a no-op.
- **Maturity is one-way:** once a `/forecasts/:hourId` row has `status: 'matured'`, it is cached with `staleTime: Infinity` and never refetched.
- **Clock skew:** `hourId` is computed from the row, never from the browser clock, except for the warmup countdown display which uses the browser's UTC time and labels it as an estimate.

### 6.5 Mid-transaction agent drop

The agent has no role in user transactions. A user `deposit` or `withdraw` is browser → wallet → chain. If the agent dies mid-way, the tx is unaffected. The only visible effect is a stale hero, handled by §6.1.

---

## 7. Development fixture

`src/services/fixtures/forecasts.ts` generates 24 rows shaped exactly like §4, covering: warmup rows (`action: 'warmup'`), an in-gate row (`+0.50`, matching the partner's committed notebook output), an out-of-gate row (`-2.41`), and matured rows with `realizedPctChange`, advancing `hourId` with the real clock so the `:01` refetch path is exercised.

The fixture is **opt-in and development-only**: `services/agent.ts` serves it only when `NEXT_PUBLIC_AGENT_FIXTURE=true` and the build is not production. With `NEXT_PUBLIC_AGENT_URL` unset and no fixture flag the client is `offline`: every agent query is disabled and the UI renders "waiting for agent telemetry". A production build never shows a sample number (ENGINEERING.md §0.6).

---

## 8. What the web asks of the partner

Concise list to hand over:

1. Expose the five `GET` endpoints in §3 with the exact JSON in §4.
2. Persist one row per hour in Postgres; fill `realized*` at `targetHourId`.
3. Compute `action`, `warmupComplete`, `gateBps` server-side. Gate is `200` bps.
4. Commit `forecastHash` to the registry every hour and store both hashes in the row.
5. Set CORS to the web origin. Return `503` while the model is loading.
6. Move the Tiingo key out of the notebook and into an env var; rotate the one currently committed.
7. Use the clock `:00` UTC timestamp for `submittedAt`, not the DIA price timestamp.

---

## 9. As deployed (2026-10-01): the live contract

Everything above §9 is the original plan; this section records what the partner actually shipped and what the web binds to. Where they differ, **this section wins** and `src/types/forecast.ts` / `src/types/agentApi.ts` are the executable truth.

### 9.1 Three horizons, one action

The live model is `eth-1-2-8h-v1`. Each row carries `ethPct1h`, `ethPct2h`, `ethPct8h` (with a `…Source` of `lgbm` or `persistence`), three gates (`gate1hBps 100`, `gate2hBps 250`, `gate8hBps 200`), `trippedHorizons`, and the server-computed `action`. The gate is `DualHorizonGate.sol`: EXIT if |1h| ≥ 1.00 % or |2h| ≥ 2.50 %; HOLD if in pool; ENTER only when idle and all three are inside; idle with only the 8 h horizon outside stays flat. The web derives `ethPctChange = ethPct8h` and `gateBps = gate8hBps` as the headline view and renders the three horizons as chips.

Per chain fields: `txHash` / `rebalanceTx` (Arbitrum), `txHashRh` / `rebalanceTxRh` (Robinhood), `poolStatusArb`, `poolStatusRh`. `spotUsd` may be null. Added 2026-10-02 (all optional): `predEthUsd8h`, `expectedEthUsd1h`, `barCloseUsd`, `barTime`, `barHourId`, `live`; `/status` adds `liveForecast`, `onchainForecastCount`, `dbForecastCount`. Horizon sources are open strings (`lgbm`, `persistence`, `catchup` seen); the web never rejects a row for an unknown label. `txHash: null` with an empty registry is the normal dry-run state and the hero renders the agent row regardless (utils/heroSource.ts); a browser CORS failure retries once through the same-origin `/api/agent/*` proxy. `submittedAt` carries microseconds and a `+00:00` offset. Errors are FastAPI `{ "detail": string }` (400 invalid address, 404 unknown hourId).

### 9.2 Hash scheme (verifiable in the browser)

```
bps        = round_half_even(pct × 100)                      # Python round(); -2.41 % → -241
modelId    = keccak256(utf8("eth-1-2-8h-v1"))
forecastHash = keccak256(abi.encode(uint64 hourId, int256 bps1h, int256 bps2h, int256 bps8h, bytes32 modelId))
```

`src/utils/forecastHash.ts` recomputes this client-side; `src/types/forecast.test.ts` proves it reproduces the live published hash `0x1db0b9d6…` from the live numbers, and `InferenceRegistry.computeHash(497434, -1, -13, -39)` on both chains returns the same bytes. The HashMatch panel therefore shows two independent proofs: "keccak of the published numbers = published hash" (no chain needed) and "registry stores the same triple + hash".

### 9.3 Polling, as implemented

| Hook | Endpoint | Interval | Notes |
|---|---|---|---|
| `useLatestForecast` | `/forecasts/latest` | 30 s + `:01` UTC | monotonic hourId guard |
| `useAgentStatus` | `/status` | 30 s | |
| `useForecastHistory` | `/forecasts?limit=24` | 60 s | re-sorted newest-first client-side |
| `usePools` | `/pools` | 15 s | agent `pollSeconds`; `cache: no-store`; aprSource is an open string (`defillama`, `uniswap`, `unavailable` seen); `poolTvlUsd` / `ethUsd` nullable; selection lives in the UI store |
| `useVaultTelemetry` | `/vault` | 30 s | no wallet required; the endpoint answers in 9.6–12.7 s |
| `usePortfolio` | `/portfolio/:address` | 30 s | enabled only with a wallet; invalidated on every deposit / withdraw receipt (the handover's 10 s never settled against a 9.6–12.7 s response) |

Timeouts: 15 s for the feed, 30 s for `/pools`, `/vault`, `/portfolio` (measured 9–13 s: they read two chains and DefiLlama). TanStack de-duplicates in-flight requests, so a 10 s cadence over a 12 s response never stacks. After any deposit or withdraw receipt the web invalidates its chain reads and the agent's portfolio and vault snapshots.

### 9.4 CORS

The agent answers `Access-Control-Allow-Origin: *` to tooling, and allowlists browsers through Heroku's `FRONTEND_ORIGIN` (exact scheme + host of the Vercel production URL; `https://*.vercel.app` previews already match). A bare browser `TypeError: Failed to fetch` is reported by the web as a CORS / origin hint.

### 9.5 Deployed contracts

| Contract | Address (both chains) | Arbitrum One 42161 | Robinhood Chain 4663 |
|---|---|---|---|
| ArgonVault | `0x9F844b4D1b28Be7413067f9d4fC08Bc276fd1C60` | [Arbiscan](https://arbiscan.io/address/0x9F844b4D1b28Be7413067f9d4fC08Bc276fd1C60) | [Blockscout](https://robinhoodchain.blockscout.com/address/0x9F844b4D1b28Be7413067f9d4fC08Bc276fd1C60) |
| InferenceRegistry | `0xbAf00c0aCa440337d43495c7de661A0AC2E01e8f` | [Arbiscan](https://arbiscan.io/address/0xbAf00c0aCa440337d43495c7de661A0AC2E01e8f) | [Blockscout](https://robinhoodchain.blockscout.com/address/0xbAf00c0aCa440337d43495c7de661A0AC2E01e8f) |
| ChainlinkEthOracle | `0xfC22F2C49Ce6Fa46c5081f900fD691b127Bd1bc5` | read by the vault | read by the vault |
| UniswapV3Adapter | `0xECCc4B8946D0DB206f977d3021544D0cD5Dc69D4` | pool 1 WETH/USDC 0.05 % | pool 4 WETH/USDG 0.05 % |

Owner and keeper: `0x9642b6D1Db5D1A3B0A61a831099568bbCbC04D4E`. Deployed-contract semantics the web honours: `withdraw(shares)` flattens every LP position first and pays pro-rata WETH + stable (there is no per-token idle withdraw); `emergencyWithdraw()` burns all shares; `warmupComplete()` is `registry.forecastCount() >= 9`; there is no `gateBps()` getter (gates come from the API).
