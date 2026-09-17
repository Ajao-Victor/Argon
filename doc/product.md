# Argon — Product Specification (web track)

Status: v1 locked. ETH-only, 8-hour horizon, ±2% gate, pools 1 and 4.
Source of truth: `doc/Argon .txt` (web spec), `doc/argon-web-architecture.pdf` (canvas), partner's `agent/README.md` and `agent/eth_model.ipynb` (agent code).
Owner of this document: web track (argon-web). The agent track is read-only for us.

---

## 1. Vision and core thesis

### 1.1 What Argon is

Argon is a dual-chain liquidity vault that decides, every hour, whether concentrated Uniswap liquidity should be **in the pool** or **sitting in cash**. A user deposits once. An off-chain model forecasts the ETH price move eight hours ahead. A keeper turns that forecast into one of three on-chain actions per pool: `ENTER`, `HOLD`, or `EXIT`. The user never mints, burns, or rebalances an LP position themselves.

The website is the user's window onto that loop: wallet, deposit, withdraw, the live forecast, pool status, and the on-chain hash that proves the vault acted on the same number the model produced.

### 1.2 The problem

Concentrated Uniswap liquidity only earns fees while price stays inside the range. A sharp move pushes the position out of range, realizes impermanent loss, and leaves the LP holding the asset that just fell. Human LPs cannot watch the book every hour. Existing automators move the range; they do not **leave** the pool before a red hour and **re-enter** after it.

### 1.3 The thesis

Timing entry and exit on a short-horizon forecast beats passively sitting in range. Argon makes that timing:

- **Auditable.** Every hourly forecast is hashed and submitted to an `InferenceRegistry` contract. The dashboard shows the API number and the on-chain hash side by side.
- **Custodially safe.** Funds live in a per-chain vault. The keeper can only call `rebalance()` with slippage and range bounds fixed in the contract. It can never send tokens to an arbitrary address. Users can always withdraw idle balances.
- **Legible.** The gate is a single public rule: predicted |ETH move| ≥ 2% over 8h means flatten, otherwise stay in range. The UI shows that rule, never a second one.

### 1.4 The ecosystem

| Layer | Detail |
|---|---|
| Chains | Arbitrum One (`42161`), Robinhood Chain (`4663`) |
| DEX | Uniswap v3 (pools 1, 2, 4), Uniswap v4 (pool 3) |
| Oracles | Chainlink ETH/USD, LINK/USD, L2 sequencer-uptime feed (contract side) |
| Model data | Tiingo hourly OHLCV (training), DIA spot (current price). Never called from the browser. |
| Hosting | Agent and keeper on Heroku. Web on any Next.js host. |

The README frames pool 4 as the "Robinhood prize-lane pool" and speaks of judges auditing the hash. This is a demo-facing product first: the hourly loop must be visible, verifiable, and impressive on a projector.

### 1.5 v1 scope lock

| In v1 | Out of v1 |
|---|---|
| ETH 8h forecast, ±2% gate | LINK forecasts and LINK-driven enter/exit |
| Pools 1 (WETH/USDC, Arbitrum) and 4 (WETH/USDG, Robinhood) | Pools 2 and 3 automation (listed as `LINK_SOON`) |
| Deposit, idle-only withdraw, emergency idle withdraw | `withdrawAll` that forces LP exit |
| Two separate vaults, user deposits per chain | Bridging between Arbitrum and Robinhood |
| Read agent REST, read contracts, sign deposit/withdraw | Any write to the agent, any keeper action, any Uniswap call |
| Hash-match verification against the registry | Training UI, model upload, custom gate slider |

The partner's README describes a broader 1h ETH+LINK design with a per-pool policy matrix. The partner's actual code and the web spec both implement 8h ETH-only. The README design is v2.

---

## 2. User personas and journeys

### 2.1 Personas

| Persona | Who | What they want from the web app |
|---|---|---|
| **Depositor** | A crypto-native user holding WETH, USDC, or USDG on Arbitrum or Robinhood | Deposit once, see that the model is working for them, withdraw idle funds when they want out |
| **Verifier** | A judge, auditor, or skeptical user | Confirm that the number on screen equals the hash on Arbiscan, and that the vault acted on it |
| **Demo operator** | The team presenting the hourly loop live | Walk the demo script without touching a terminal; watch status chips flip on a projector |
| **Keeper operator** (hidden) | The partner running the Heroku clock | See keeper tx hashes and registry state. Never executes anything from the web. Gated by `NEXT_PUBLIC_ADMIN_ADDRESS`. |

### 2.2 Journey A: first deposit (Depositor, Arbitrum)

1. Lands on `/`. Reads the one-liner, the ±2% gate, the 8h model. Clicks **Launch app**.
2. `/app` loads with wallet disconnected. Forecast hero, warmup bar, and pool cards render from the agent API. Wallet strip shows a connect prompt.
3. Connects wallet. App detects chain. If not on Arbitrum, chain switcher prompts.
4. Goes to `/app/deposit`. Picks USDC, enters an amount. App shows the two-step flow: **Approve** then **Deposit**.
5. Signs approve. Waits for receipt. Button flips to Deposit. Signs deposit. Waits for receipt.
6. Wallet strip and idle balance update. Activity feed shows a `Deposited` event linked to Arbiscan.
7. If warmup is still running, the dashboard says "Collecting the first 8 hourly forecasts. No trades until hour 8." Funds sit idle until the first in-gate `ENTER`.

### 2.3 Journey B: watching an hour tick (Depositor or Demo operator)

1. User is on `/app`. The forecast hero shows the last `ethPctChange`, the gate chip, and the next action.
2. Clock hits `:00` UTC. Agent infers and writes Postgres. Keeper submits the hash and, if the gate flipped, rebalances.
3. Next poll (30–60s, plus a forced refetch at `:01`). Hero updates. Action flips.
4. Hash-match widget reads `InferenceRegistry.getForecast(hourId)` and confirms the hash. Turns green.
5. One or two polls later, `poolStatus` flips `IN_POOL` ↔ `IDLE` after the rebalance receipt. Pool card links to the tx.
6. User did nothing. Balances stayed in the vault. Only status chips changed.

### 2.4 Journey C: withdraw while in pool (Depositor)

1. Goes to `/app/withdraw`. Sees idle balances per token.
2. If pool status is `IN_POOL`, a banner reads: "Your LP is in range. Withdraw becomes available when the model next exits (±2% gate), or use Emergency idle withdraw for any unallocated tokens."
3. Withdraws the idle portion. Signs one tx. Receipt. Balances refresh.
4. Funds in range unlock on the next `EXIT`. The page never pretends otherwise.

### 2.5 Journey D: verify the forecast (Verifier)

1. Opens `/app/forecasts`. Sees the last 24 hourly rows: `hourId`, UTC time, predicted %, realized % (once matured), status, action.
2. Clicks a row. Sees the API `forecastHash` beside the registry `forecastHash`, and the `ethPctBps` from chain formatted as a percent. Match or mismatch is explicit.
3. Clicks the tx link. Lands on Arbiscan or Blockscout.

### 2.6 Journey E: Robinhood pool 4 (Depositor)

1. On `/app/deposit`, switches the chain selector to Robinhood Chain (`4663`).
2. wagmi `useSwitchChain` prompts the wallet to add or switch the network.
3. Token list changes to WETH / USDG. Vault address changes to `NEXT_PUBLIC_VAULT_RH`.
4. Same approve + deposit flow. Explorer links point at Blockscout.
5. Arbitrum reads continue to work in the background because each vault is read on its own chain id.

---

## 3. Core feature matrix

Every item below is derived from spec §4 and §5. Visual treatment is defined in `design.md`. Nothing here is invented product mechanics.

### 3.1 Routes

| Route | Purpose | Requires wallet |
|---|---|---|
| `/` | Landing: one-liner, ±2% gate explainer, 8h model explainer, Launch app | No |
| `/app` | Dashboard: forecast hero, warmup, four pool cards, hash match, wallet strip | No (read-only without wallet) |
| `/app/deposit` | Chain switcher, token amount, approve + deposit | Yes |
| `/app/withdraw` | Idle balances, withdraw, in-pool banner | Yes |
| `/app/forecasts` | Last 24 hours, predicted vs realized after `hourId + 8` | No |
| `/app/activity` | `Deposited` / `Withdrawn` / `Rebalanced` events for this wallet | Yes for user events, no for `Rebalanced` |

### 3.2 Dashboard widgets (required)

| Widget | Reads | Renders | State triggers |
|---|---|---|---|
| **Forecast hero** | `/forecasts/latest` | Large signed `ethPctChange`, "8h ahead", gate chip `IN` or `OUT`, next action | Re-renders on each poll; pulses on `hourId` change |
| **Warmup bar** | `/status` | `n / 8` hours until first decision; countdown to next `:00` UTC | Hidden once `warmupComplete === true` |
| **Pool cards ×4** | vault `poolStatus(poolId)`, latest forecast `txHash` | Pair, chain, DEX, status chip, last rebalance tx link | `IN_POOL` / `IDLE` / `UNFUNDED` / `LINK_SOON` |
| **Hash match** | API `forecastHash` vs registry `getForecast(hourId)` | Green "matches chain" or red "API ≠ registry"; both hashes truncated with copy | Re-evaluates when either source changes |
| **Wallet strip** | `useAccount`, vault `idleBalance` per token | Address, chain, idle WETH / USDC (or USDG) in the vault | Updates after every receipt |

### 3.3 State machine the UI displays

Pool status is a pure function of what the vault and agent report. The UI never computes it from the forecast alone.

```
                 warmupComplete=false
   ┌────────────────────────────────────────────┐
   │              WARMUP (no trades)             │
   └──────────────────┬─────────────────────────┘
                      │ hour 8, warmupComplete=true
                      ▼
        ┌────────── IDLE ◄──────────────┐
        │  poolStatus=0                  │
        │                                │ action=exit (|pred| ≥ 2)
        │ action=enter (|pred| < 2)      │ keeper rebalance receipt
        ▼                                │
   ┌──────────────── IN_POOL ────────────┘
   │  poolStatus=1
   │  action=hold while |pred| < 2
   └──────────────────────────────────────
```

Per-card overlays:

- `UNFUNDED`: vault has zero balance for that pool's tokens. Shown regardless of gate.
- `LINK_SOON`: pools 2 and 3 in v1. Card is read-only, no status polling.

### 3.4 Gate rule (display only)

```
warmup  if !warmupComplete
exit    if |ethPctChange| >= 2
enter   if idle
hold    if in pool
```

Prefer the API `action` field. The local helper exists for the fallback banner and for unit tests. There is no second threshold anywhere in the UI. `gateBps` is read from the vault (`200`) and shown, never edited.

### 3.5 Copy for the gate

| State | Copy |
|---|---|
| Outside gate | "Model expects \|ETH\| move ≥ 2% over 8h. Positions flattened." |
| Inside gate | "Model expects ETH within ±2% over 8h. Liquidity in range." |
| Warmup | "Collecting the first 8 hourly forecasts. No trades until hour 8." |

### 3.6 Transaction features

| Feature | Contract call | Preconditions | Post-conditions |
|---|---|---|---|
| Approve | ERC-20 `approve(vault, amount)` | Wallet on vault chain, amount > 0, allowance < amount | Allowance read invalidated |
| Deposit ERC-20 | `deposit(token, amount)` | Allowance ≥ amount | `idleBalance`, `shareBalance` invalidated; activity refetch |
| Deposit ETH | `depositETH()` with `value` | Vault exposes it (feature-detect from ABI) | Same as above |
| Withdraw idle | `withdraw(token, amount)` | amount ≤ `idleBalance` | Same as above |
| Emergency idle withdraw | `emergencyWithdraw()` | Always available | Same as above |

Every write goes through simulate → sign → wait for receipt → invalidate. No optimistic balance mutation before the receipt.

### 3.7 Verification features

- `useRegistryForecast(hourId)` reads `latestHourId()` and `getForecast(hourId)`.
- Compare `forecastHash` (bytes32) and `ethPctBps` (int256, percent × 100 truncated) against the API row.
- Link every hash and tx to the right explorer for the chain.
- If the agent is down, show the last on-chain registry row and the banner "live agent unreachable — showing last on-chain forecast." Never fabricate a percent.

### 3.8 Visual layers with no product mechanics

The design direction in `design.md` adds a simulation-grade visual layer: a particle field, a ticker tape, telemetry readouts, and animated state transitions. These are presentation. They read from the same data as the widgets above and never introduce new state, new thresholds, or new user actions. The product has no points, badges, levels, or rewards. The "simulation loop" the UI animates is the real hourly loop.

### 3.9 Admin surface (hidden by default)

When the connected address equals `NEXT_PUBLIC_ADMIN_ADDRESS`, show a read-only keeper panel: last `submit` tx, last `rebalance` tx, agent `/status` raw JSON, registry `latestHourId`. No buttons that write. Default users never see this.

---

## 4. Non-functional requirements

### 4.1 Latency and freshness budgets

| Metric | Budget | Mechanism |
|---|---|---|
| Landing first contentful paint | < 1.5s on 4G | Static route, no wallet provider on `/` |
| Dashboard interactive | < 2.5s | Agent fetch and chain reads in parallel; skeletons, not spinners |
| Forecast staleness | ≤ 60s normally, ≤ 90s after the `:00` boundary | Poll every 30–60s; extra refetch scheduled at `:01` UTC; refetch on window focus |
| Pool status after keeper tx | ≤ 2 polls after receipt | Same poll cadence; no faster loop |
| Chain read staleness | ≤ 30s | TanStack Query `staleTime` 15–30s on contract reads; invalidate on receipt |
| Tx feedback | Immediate pending state on signature; confirmed state on receipt | `useWaitForTransactionReceipt` |

Never poll faster than 30s. Never run a 1s loop. Never hammer public RPCs.

### 4.2 Wallet UX expectations

- Connect modal via RainbowKit or ConnectKit. Both chains registered. Default to Arbitrum.
- Wrong chain: block writes, show a single switch button, keep reads working.
- Every write has four visible states: idle, awaiting signature, pending on chain, confirmed or failed.
- Rejected signature is a quiet inline message, not a modal.
- Reverts surface the reason string when the vault provides one (sequencer down, stale oracle, insufficient idle).
- Amount inputs use token decimals from `tokens.ts`. Max button reads the wallet balance for deposit and `idleBalance` for withdraw.

### 4.3 Error and empty states (build all of them)

| State | Trigger | Treatment |
|---|---|---|
| Wallet not connected | No account | Dashboard reads still render; deposit/withdraw show connect CTA |
| Wrong chain | `chainId` ≠ vault chain | Switch banner; writes disabled |
| Agent 5xx / timeout | fetch fails or > 10s | Fallback to last registry row; red "agent unreachable" banner |
| Registry not deployed | `NEXT_PUBLIC_REGISTRY_*` empty or read reverts | "Not deployed" empty state on hash-match; forecast still shown from API |
| Vault not deployed | `NEXT_PUBLIC_VAULT_*` empty | Pool cards show `UNFUNDED`; deposit page shows "not deployed" |
| Warmup | `warmupComplete === false` | Warmup copy; no `IN_POOL` chip anywhere |
| No deposit | `idleBalance` and `shareBalance` both zero | Deposit CTA on dashboard |
| Approve needed | allowance < amount | Two-step button |
| Tx rejected | user cancels | Inline notice; form state preserved |
| Sequencer / stale oracle | vault view reverts with reason | Surface the reason verbatim |
| Hash mismatch | API hash ≠ registry hash | Red state, both hashes shown; never auto-hide |

### 4.4 Optimistic UI policy

Optimism is allowed for **presentation**, never for **balances or status**.

- Allowed: showing a "pending" chip on a pool card once a keeper tx hash is known from the API; animating the forecast hero as soon as a new `hourId` arrives.
- Not allowed: incrementing `idleBalance` before the deposit receipt; flipping `IN_POOL` before `poolStatus` reads `1`; showing a green hash-match before the registry read returns.

### 4.5 Correctness invariants

- The percent shown always has the same sign and two decimals as the API `ethPctChange`.
- `ethPctBps` from chain formatted as percent must equal the API value to two decimals when both are live.
- No `IN_POOL` during warmup.
- Withdraw can never touch funds that are in pool. A broken withdraw button must fail closed.
- Times are UTC with an explicit `UTC` label. `hourId` math is in one module and reused everywhere.

### 4.6 Security requirements for the web

- No keeper private key, no Tiingo key, no DIA calls in the browser bundle. Only `NEXT_PUBLIC_*` values.
- Never call `rebalance`, `submit`, `NonfungiblePositionManager`, or `PoolManager`.
- Agent API is read-only. CORS on the agent must allow the web origin only.
- Explorer links are constructed from a chain-id map, never from API-provided URLs.

### 4.7 Accessibility and motion

- Every animated surface respects `prefers-reduced-motion`. The particle field and glitch effects are off under that setting.
- All status is conveyed by text and icon, not color alone.
- Monospace data tables are real tables with headers.
- Keyboard reachable: connect, chain switch, amount input, approve, deposit, withdraw.

### 4.8 Acceptance checks (from spec §12)

1. Connect on Arbitrum; deposit USDC; idle balance updates.
2. Dashboard shows an 8h % from the agent with the same sign and two decimals.
3. `|pred| ≥ 2` shows EXIT / IDLE after the keeper (or mocked status).
4. `|pred| < 2` shows ENTER / HOLD / IN_POOL.
5. Warmup hides trade status until 8 hours.
6. `forecastHash` matches Arbiscan when both API and registry are live.
7. Withdraw of idle works; in-pool funds are never exposed by a broken withdraw button.
8. Robinhood network switch does not break Arbitrum reads.

---

## 5. Open decisions carried into planning

| Decision | Recommendation | Owner |
|---|---|---|
| Contracts have no code and no owner | Web codes against spec §4.4 ABIs with a "not deployed" state. Someone must own the Foundry project. | Team |
| Agent REST service does not exist yet | Web ships against a static fixture. Partner builds the service to the §3.1 row. | Partner |
| `depositETH()` optional | Feature-detect from ABI. If absent, deposit flow wraps to WETH first. | Web |
| Activity feed indexing | v1 uses `getLogs` from public RPC over a bounded block range. No indexer. | Web |
