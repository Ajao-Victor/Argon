# Forecast page — calculation and endpoint specification (frontend audit)

Prepared 2026-10-02 for the model/agent owner. Everything here was verified against the live Heroku service at `https://argon-bd8888db5430.herokuapp.com` on 2026-10-02 07:xx UTC (clock hour `497479`) and against the frontend source at commit `f32cbd9`. Where the frontend and the live payload disagree, Section 4 says so and names the owner.

The one-line summary for the partner: **the frontend performs almost no arithmetic on forecast data.** It renders the agent's fields verbatim, derives a single headline (`ethPct8h`), converts percent to basis points only to compare against the registry and to recompute the hash, and shows `realizedPctChange` as delivered. Every number a user sees on `/app/forecasts` is therefore the agent's number, so most of the discrepancies below are agent-side semantics that the frontend currently displays without comment.

---

## 1. Endpoints called and polling cadence

Base URL: `NEXT_PUBLIC_AGENT_URL` (`src/services/agent.ts`). All requests are `GET` except the wallet-signed `POST /gates` (§6), `Accept: application/json`, `cache: no-store`, abortable by TanStack Query. Timeouts: 15 s for the forecast feed, 30 s for `/pools`, `/vault`, `/portfolio`. If a direct browser fetch fails with a network / CORS error, the client retries once through the same-origin server proxy `/api/agent/<path>` (`src/app/api/agent/[...path]/route.ts`), which forwards the identical GET server-to-server with no transformation.

| Endpoint | Query | Hook (`src/hooks/useAgent.ts`) | Cadence | Used by |
|---|---|---|---|---|
| `GET /forecasts/latest` | none | `useLatestForecast` | every 30 s, plus one scheduled refetch at `hh:01:00` UTC (`useAgentClock`), plus on window focus; a row with a lower `hourId` than the last accepted one is ignored (monotonic guard) | hero, landing card, avatar, hash match, pool cards, ticker |
| `GET /forecasts?limit=24` | `limit` clamped to 1…168 client-side | `useForecastHistory(24)` | every 60 s | `/app/forecasts` table, telemetry ticker (first 12 rows, same cache entry) |
| `GET /forecasts/:hourId` | path integer, validated ≥ 0 | `useForecast(hourId)` | on demand; cached forever once `status === 'matured'` | reserved for a detail drawer; **not used by the table today** |
| `GET /status` | none | `useAgentStatus` | every 30 s | warmup bar, telemetry, footer, hash-match dry-run chip, gates fallback |
| `GET /health` | none | `useAgentHealth` | on boot | footer dot |
| `GET /pools` | none | `usePools` | every 15 s (agent `pollSeconds`) | pool cards: APR, pool TVL, ETH, no wallet |
| `GET /gates/:address` | path address | `useGate` | every 30 s, wallet only; 404 → null | selected pool card: preset, six bands, `inPosition`, `lastAction` |
| `POST /gates` | JSON body, wallet signature | `useSetGate` | on 'sign & save' only | selected pool card |

Normalisation (`src/types/forecast.ts`, zod 4): every payload is parsed at the boundary. Unknown extra fields are ignored. A row that fails validation is treated as an agent error and the UI falls back to the on-chain registry (never a fabricated number). After yesterday's hotfix the schema is deliberately tolerant: horizon source labels are open strings, and the fields the agent added on 2026-10-02 are optional and nullable. Two derived fields are attached by a zod transform:

```ts
ethPctChange = ethPct8h        // the 8 h headline used by the hero, avatar, ticker and table
gateBps      = gate8hBps       // the 8 h gate used by the IN/OUT chip
```

`/status` normalisation: `dryRun` arrives as the string `"true"` and is coerced to a boolean; `gateBps = gate8hBps` is derived; `lastHourId` may be null.

Ordering: `/forecasts?limit=24` is re-sorted newest-first client-side (`b.hourId - a.hourId`) regardless of wire order.

---

## 2. Field-by-field mapping (live JSON key → frontend)

Live keys as returned today, in payload order. "Expected name" is the name the partner's note used; several of those do not exist on the wire.

| Live JSON key | Type on the wire | Frontend variable / use | Missing or null behaviour |
|---|---|---|---|
| `hourId` | int (e.g. `497479`) | `Forecast.hourId` (branded `HourId`); table "hour"; UTC column via `hourId × 3600 s` | required; non-integer or negative → row rejected |
| `targetHourId` | int | `Forecast.targetHourId`; hero "target" cell; refined to equal `hourId + 8` | required; mismatch → row rejected |
| `submittedAt` | ISO with µs and `+00:00` | landing card time (`HH:MM UTC`) | required |
| `predEthUsd8h` | float or null (null on rows ≤ `497467`) | `Forecast.predEthUsd8h`; hero "8h predicted price" cell and landing "→ $ predicted" **only when present** | optional; absent/null → cell hidden. **Not shown in the table.** |
| `barCloseUsd` | float or null | hero "measured from" cell: the candle close the forecast was measured from | optional → cell hidden |
| `expectedEthUsd1h` | float or null | hero "next hour path" cell: where the averaged 1-hour path says price should be next | optional → cell hidden |
| `ethPct1h`, `ethPct2h`, `ethPct8h` | float **percent** (e.g. `-1.1747` = −1.17 %) | hero horizon chips (all three); `ethPct8h` is the headline everywhere else; bps for hash and registry match. Since the 2026-10-02 handoff `ethPct1h`/`ethPct2h` are the agent's average remaining move from the current price across every stored 8-hour target still covering that horizon; `ethPct8h` is only this hour's target. The frontend recomputes nothing. | required; must be finite, > −100, < 1000 |
| `ethPct1hSource`, `ethPct2hSource`, `ethPct8hSource` | string (`lgbm`, `persistence`, `catchup`, `residual`) | chip tooltip "source: …" on the hero; `residual` is labelled "updated remainder of earlier 8-hour prices" in the tooltip and under the chips | required non-empty string; any label accepted since 2026-10-02 |
| `spotUsd` | float or null | hero "spot", landing "$ now" | nullable → "—" |
| `modelId` | string `eth-1-2-8h-v1` | hero meta; `keccak256(utf8(modelId))` in the hash recomputation | required |
| `status` | `pending` \| `matured` | table "status" column; detail-row cache policy | required |
| `realizedPctChange` | float percent or null | table "real %" | nullable → "—" |
| `realizedSpotUsd` | float or null | parsed, **not displayed** | nullable |
| `action` | `warmup` \| `exit` \| `enter` \| `hold` | rendered verbatim: hero action word, landing state line, table chip, avatar energy | required; unknown → row rejected |
| `gate1hBps`, `gate2hBps`, `gate8hBps` | int bps (100 / 250 / 200) | hero gate labels (`bps / 100` %), IN/OUT chip threshold, landing "Within ±x%" | required |
| `warmupComplete` | bool | hero/landing warmup copy; refined: if false, `action` must be `warmup` | required |
| `forecastHash` | bytes32 hex or null | table "hash"; hash-match "api hash"; compared with browser recomputation and registry | nullable; must be exactly 32 bytes when present |
| `txHash`, `txHashRh` | bytes32 hex or null | table "tx" (Arbitrum `txHash` only); pool cards per chain | nullable; **`txHashRh` not shown in the table** |
| `rebalanceTx`, `rebalanceTxRh` | free text (`warmup-skip`, `hold`, or a hash) | pool card keeper chips | nullable |
| `poolStatusArb`, `poolStatusRh` | 0 \| 1 \| null | pool card fallback when the RPC read is unavailable | nullable |
| `barTime`, `barHourId` | ISO / int or null | parsed, **not displayed** | optional |
| `live` | bool | `false` → hero warn banner "showing the last stored hour N"; percent and predicted price still render; a 200 never renders "no forecast" | optional |
| `trippedHorizons` | `('1h'\|'2h'\|'8h')[]` | hero chips highlighted red; action copy names them | required (may be empty) |

Names from the partner's note that **do not exist on the wire** and are therefore never read: `spotEthUsd` (the key is `spotUsd`), `predEthUsd1h` / `predEthUsd2h` (only `expectedEthUsd1h` and `predEthUsd8h` exist), `actualEthUsd` (it is `realizedSpotUsd`), `realizedPct` (it is `realizedPctChange`), `errorPct` (does not exist; nothing computes it).

`/status` keys: `ok`, `warmupComplete`, `hoursUntilFirstDecision`, `gate*Bps`, `lastHourId`, `currentHourId`, `liveForecast`, `modelId`, `modelLoaded`, `dryRun`, `database`, `onchainForecastCount`, `dbForecastCount`. The frontend uses `hoursUntilFirstDecision` for the warmup bar (filled = 9 − value; "first decision in" = value), `onchainForecastCount` as the "on-chain submits" row (never the bar's source), `dbForecastCount` as "stored inferences", `lastHourId` / `currentHourId` for staleness, `dryRun` for the dry-run banners, and `gate*Bps` as the gate fallback. `txHash: null` and `onchainForecastCount: 0` mean dry-run only; the numbers are still valid.

---

## 3. Every frontend formula and calculation

### 3.1 Predicted price vs spot

The frontend **does not compute** a predicted price. It displays `predEthUsd8h` verbatim when present (hero "8h target", landing "→ $ predicted") and `spotUsd` verbatim beside it.

Observed on the live history: `predEthUsd8h` is anchored to the **prior hourly bar close**, not to `spotUsd`:

```
predEthUsd8h == barCloseUsd × (1 + ethPct8h / 100)        (all 10 rows that carry it, to 4 dp)
predEthUsd8h != spotUsd     × (1 + ethPct8h / 100)        (every row; difference up to ~$8)
```

Example `hourId 497470`: `spotUsd 2700.43`, `barCloseUsd 2692.52`, `ethPct8h −0.4381 %` → `predEthUsd8h 2680.72`. A trader reading "−0.44 % → $2,680.72 predicted · $2,700.43 now" will compute −0.73 % from the two prices. See Section 4, item 1.

### 3.2 Percent → basis points, and the gate

```ts
// src/utils/forecastHash.ts / src/utils/bps.ts
roundHalfEven(x)       // Python round(): ties go to the even integer
toBps(pct)  = BigInt(roundHalfEven(pct * 100))      // -2.41 → -241n ; -2.419 → -242n ; 0.005 → 0n
fromBps(b)  = Number(b) / 100
```

Gate comparison is on **percent**, mirroring `DualHorizonGate.sol` (`src/utils/policy.ts`):

```ts
GATES_PCT = { '1h': 1.0, '2h': 2.5, '8h': 2.0 }       // == gate1hBps/2hBps/8hBps / 100
dualHorizonAction({ethPct1h, ethPct2h, ethPct8h, warmupComplete, currentlyInPool}):
  !warmupComplete                                   → 'warmup'
  |1h| >= 1.0 || |2h| >= 2.5                        → 'exit'
  currentlyInPool                                   → 'hold'
  |1h| < 1.0 && |2h| < 2.5 && |8h| < 2.0            → 'enter'
  otherwise                                         → 'exit'      // idle, only the 8 h horizon outside: stay flat
trippedHorizons(...)  → ['1h'?, '2h'?, '8h'?] by the same thresholds
```

**The UI renders the agent's `action` and `trippedHorizons` verbatim**; `dualHorizonAction` is used only on the registry-fallback path and in tests. The single-horizon chip is display-only:

```ts
gateChip(pct8h) = |pct8h| >= 2.0 ? 'OUT' : 'IN'     // 8 h only; this is NOT the trading rule
```

So the hero can legitimately show `gate IN` (8 h inside) while the action is `exit` because 1 h or 2 h tripped; the three horizon chips and the action word carry the real rule.

### 3.3 Browser-side hash recomputation

```ts
// src/utils/forecastHash.ts — mirrors InferenceRegistry.computeHash and agent hashing.py
bps_h        = roundHalfEven(ethPct_h × 100)                       // int256
modelId      = keccak256(utf8("eth-1-2-8h-v1"))                     // bytes32
forecastHash = keccak256(abi.encode(uint64 hourId, int256 bps1h, int256 bps2h, int256 bps8h, bytes32 modelId))
```

Note the exact ABI types: `uint64` for `hourId` and `bytes32` (the keccak of the model id text) for `modelId`. Encoding `hourId` as `uint256` or passing the model id as a `string` produces a different hash. Verified on 2026-10-02: **16 of 16** live history rows recompute to their published `forecastHash`; the registry's own `computeHash(497434, -1, -13, -39)` returned the same bytes on both chains on 2026-10-01. The hash-match panel shows this as "keccak of the published numbers = published hash" (`apiHashVerified`), independent of the chain.

Registry comparison (`src/utils/reconcile.ts`): `match` requires `forecastHash` equality **and** all three `toBps(ethPct_h) === registry.pct_hBps`. With `forecastCount = 0` (dry-run) the result is `pending-chain`, labelled "pending · keeper dry-run".

### 3.4 Realized move, forecast error, direction hit-rate

| Quantity | Frontend computation | Source |
|---|---|---|
| Realized move | **none** | `realizedPctChange` displayed verbatim in the "real %" column |
| Realized price | **none, not displayed** | `realizedSpotUsd` parsed only |
| Forecast error (pred − real) | **not computed, not displayed** | — |
| Direction hit-rate | **not computed, not displayed** | — |
| Maturity | **not computed** | `status` taken from the API; the frontend never evaluates `hourId + 8 <= now` for live rows (the development fixture does) |

The agent's realized values are internally consistent where the target row exists: `realizedSpotUsd` equals the `spotUsd` of the row at `targetHourId`, and `realizedPctChange = (realizedSpotUsd / spotUsd − 1) × 100` to 4 dp on all eight matured rows. See Section 4, item 2 for the two rows where the target row does not exist.

### 3.5 Time and warmup

```ts
hourIdFromDate(d) = floor(d.getTime() / 1000 / 3600)
dateFromHourId(h) = new Date(h × 3600 × 1000)            // table "utc" column, formatted "YYYY-MM-DD HH:MM UTC"
msUntilNextMinuteOne()                                     // the :01 UTC scheduled refetch
```

The table's "utc" column is the **inference hour** (`hourId`), not `submittedAt` (which is ~28 s later) and not `barTime` (which is the previous hour's bar).

Warmup (`WarmupBar`, telemetry): `WARMUP_HOURS = 9` (registry `WARMUP_SUBMITS`), `done = 9 − status.hoursUntilFirstDecision`, segments = `done / 9`, countdown = `hoursUntilFirstDecision`, on-chain submits = `onchainForecastCount`, stored inferences = `dbForecastCount`. The bar is never derived from the on-chain count (handoff 2026-10-02). The vault's own `warmupComplete()` is `registry.forecastCount() >= 9`. Staleness: `lag = currentHourId − (lastHourId ?? currentHourId)`, flagged when `lag > 1`.

---

## 4. Live payload vs frontend: discrepancies found

Ordered by user impact. "Owner" says where the fix belongs.

1. **Resolved by the 2026-10-02 handoff: the hero now labels `barCloseUsd` "measured from" and `expectedEthUsd1h` "next hour path" beside the predicted price.** Original finding: **Predicted price is anchored to the bar close, spot is shown beside it (owner: agent semantics; frontend presentation).** `predEthUsd8h = barCloseUsd × (1 + ethPct8h/100)` while the UI prints `spotUsd` next to it. The two prices imply a different percent than the one displayed (up to ~0.3 pp on the live rows). Options: the agent exposes the basis explicitly (e.g. `basisUsd = barCloseUsd` and/or `predEthUsd8h` recomputed from spot), or the frontend labels the reference price "price at forecast" and shows `barCloseUsd` instead of spot next to the prediction. No frontend arithmetic is wrong; the pairing is misleading.

2. **Realized values for rows whose target hour has no row are taken from a much later hour (owner: agent).** Rows `497433` and `497434` (targets `497441`, `497442`) are `matured` with `realizedSpotUsd = 2685.345…`, which is the `spotUsd` of row **`497464`**, 22–23 hours after their target hour (the clock was down between `497435` and `497463`). Their `realizedPctChange` (−0.09 %, −0.11 %) is therefore not an 8 h realized move. The maturity job should look up the price at `targetHourId` (bar or oracle) rather than the next available row, or leave the row `pending` with a reason.

3. **Consecutive rows carry identical forecasts (owner: agent / data freshness).** Three pairs are byte-identical across all three horizons: `(497467, 497466)`, `(497465, 497464)`, `(497434, 497433)`. All are `live: false` rows with `persistence`/`catchup` sources, i.e. catch-up prints re-using the previous bar. The frontend does not flag `live` or the source labels in the table, so these look like fresh forecasts. Suggested: the frontend adds a source/live badge per row (cheap), and the agent avoids emitting a new `hourId` with an unchanged input bar.

4. **Resolved by the 2026-10-02 handoff: the bar uses `hoursUntilFirstDecision`, the on-chain count is a separate row.** Original finding: **Warmup counter contradicts `warmupComplete` (owner: agent; frontend shows it faithfully).** `/status` today: `hoursUntilFirstDecision: 0` (derived from `dbForecastCount: 16 ≥ 9`) while `warmupComplete: false` (derived from `onchainForecastCount: 0`, because dry-run never submits). The UI therefore shows "9 / 9" segments full and still says warming up. Both numbers are honest, but they count different things. Suggested: `hoursUntilFirstDecision` should derive from the on-chain count while dry-run is on, or the frontend should switch to `max(0, 9 − onchainForecastCount)`.

5. **"LAST 24H" is really "last 24 rows" (owner: frontend).** `limit=24` returned 16 rows spanning 46 hours with two gaps (`497468–497469` missing; `497435–497463` missing). The panel label and the absence of gap markers imply a continuous window. Fix: label by row count or hour span, and render a gap row when consecutive `hourId`s differ by more than one.

6. **The table shows only the 8 h horizon and omits fields the partner needs to debug (owner: frontend).** Columns are `hour · utc · pred % (8h) · real % · status · action · hash · tx`. Not shown: `ethPct1h`, `ethPct2h`, `predEthUsd8h`, `spotUsd`, `realizedSpotUsd`, `barCloseUsd`, the three source labels, `live`, `txHashRh`. A reader comparing the table against the model's own logs cannot tell which horizon a number is or what price it was relative to.

7. **Field names in the partner's note do not match the wire.** `spotEthUsd`, `predEthUsd1h`, `predEthUsd2h`, `actualEthUsd`, `realizedPct`, `errorPct` are not emitted; the live keys are `spotUsd`, `expectedEthUsd1h`, `predEthUsd8h`, `realizedSpotUsd`, `realizedPctChange`, and there is no error field. If the agent intends to add `predEthUsd1h/2h` or an error metric, the frontend schema will accept them as unknown keys but will not display them until mapped.

8. **Hash ABI types (documentation correction).** The hash is `abi.encode(uint64, int256, int256, int256, bytes32)` with `bytes32 = keccak256(modelId text)`, not `(uint256, …, string)`. Verified against all 16 live rows and the registry's `computeHash`.

9. **Units are consistent (no bug).** Both sides use percent (`−1.1747` means −1.17 %). The frontend never divides or multiplies the percent for display; it only converts to bps for hashing and registry comparison, using the same half-to-even rounding as `policy.pct_to_bps`.

10. **Source labels (fixed 2026-10-02).** The `catchup` label rejected every live row under the old `lgbm | persistence` enum and blanked the hero. Source labels are now open strings.

11. **`txHashRh` is invisible on the forecasts page (owner: frontend).** The "tx" column reads `txHash` (Arbitrum) only; once dry-run ends, Robinhood submits will not appear in the table.

12. **Detail endpoint unused (no bug).** `GET /forecasts/:hourId` is implemented and cached forever once matured, but the table opens the hash-match panel from the already-loaded row instead. Fine, but the partner should not expect per-row requests in the server logs.

---

## 5. Done on 2026-10-02 from the agent owner's handoff (`doc/Argon_handoff.pdf`)

| Requirement | Where |
|---|---|
| `cache: no-store`, `/forecasts/latest` + `/status` 30 s, `/pools` 15 s | `src/services/agent.ts`, `src/hooks/useAgent.ts`, `src/hooks/usePools.ts` (unchanged, verified) |
| A 200 never renders "no forecast"; `live:false` → stale banner, numbers intact | `src/components/modules/ForecastHero.tsx`, `src/utils/heroSource.ts` |
| `predEthUsd8h` as 8-hour predicted price, `ethPct8h` as percent, `barCloseUsd` "measured from", `expectedEthUsd1h` "next hour path" | `ForecastHero.tsx` |
| `ethPct1h`/`ethPct2h` = averaged remaining move; `residual` label | `ForecastHero.tsx` (chip tooltip and caption) |
| Warmup bar: filled = 9 − `hoursUntilFirstDecision`, countdown, on-chain submits, stored inferences | `src/components/modules/WarmupBar.tsx` |
| Pool cards by `id`, APR / TVL / ETH without a wallet; null APR → empty APR line | `src/utils/poolMarket.ts`, `PoolCard.tsx` |
| Per-user gate: presets, custom 1 h band, `personal_sign` of the exact string, `POST /gates`, `GET /gates/{address}`, `lastAction` on the card | `src/types/gates.ts`, `src/services/agent.ts`, `src/hooks/useGate.ts`, `src/components/modules/GateControl.tsx`, `src/app/api/agent/[...path]/route.ts` |

Still open from §4 and owned by the agent: items 2 (realized values from a later hour), 3 (duplicate catch-up rows). Frontend-only follow-ups not in the handoff: items 5, 6, 11 (table columns and gap rows).

## 6. The one write: `POST /gates`

```
message   = "argon-gate:" + address.lower() + ":" + preset + ":" + topBps + ":" + bottomBps + ":" + issuedAt
signature = personal_sign(message)                       // EIP-191; the agent verifies with encode_defunct + recover
body      = { address, preset, topBps, bottomBps, issuedAt, signature }
```

`issuedAt` is unix seconds, must be within 2 hours of the agent clock and newer than the stored gate (409 otherwise). Preset bands (top bps; bottom = −top): Safe 60 / 120 / 100, Balanced 100 / 250 / 200, Aggressive 200 / 400 / 350; Custom takes the user's 1 h top (`0 < top ≤ 2000`) and bottom (`−2000 ≤ bottom < 0`) and keeps 2 h / 8 h at Balanced. The frontend resolves the bands with the same rules before signing (`resolveGate`, tested against the agent's `policy.resolve_gate`) so a preset mismatch cannot reach the agent. `GET /gates/{address}` returns the six bands, `inPosition`, `lastAction` (that wallet's decision; the forecast `action` stays the shared vault action) and `lastHourId`; 404 means no gate chosen.
