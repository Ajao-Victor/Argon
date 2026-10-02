# Argon — Architecture Essentials (LLM cheat sheet)

Dense reference for coding sessions. Full detail in `product.md`, `architecture.md`, `agents.md`, `design.md`. Spec of record: `doc/Argon .txt`.

## 0. One paragraph

Argon is a dual-chain LP vault. Every hour at `:00` UTC a Python model (partner's `agent/`, `eth-1-2-8h-v1`) forecasts ETH % change 1 h, 2 h and 8 h ahead. Gate (DualHorizonGate): EXIT if |1h| ≥ 1.00 % or |2h| ≥ 2.50 %; HOLD if in pool; ENTER only when idle and all three are inside (8h ±2.00 %). The first 9 submits are warmup, no trades. Forecast hash is committed to `InferenceRegistry`; the keeper is in dry-run today (0 submits on chain). The web (`argon-web`, ours) is a Next.js reader: wallet, deposit, share-based withdraw, live forecast, pool status, hash verification. Web never writes to the agent, never calls `rebalance`/`submit`, never holds keys. v1: ETH-only, pools 1 (WETH/USDC Arbitrum) and 4 (WETH/USDG Robinhood). Pools 2, 3 are `LINK_SOON`.

## 1. Planes

```
Browser(Next.js) ──GET poll 30–60s──► Agent REST (Heroku, Postgres)
Browser(wagmi/viem) ──read──► ArgonVault + InferenceRegistry on 42161 / 4663
Browser(wallet) ──sign──► approve / deposit / depositETH / withdraw / emergencyWithdraw
Agent clock ──keeper──► Registry.submit + Vault.rebalance      (NOT the web)
```

## 2. Chains, tokens, explorers

| Chain | id | RPC default | Explorer |
|---|---|---|---|
| Arbitrum One | 42161 | https://arb1.arbitrum.io/rpc | https://arbiscan.io |
| Robinhood | 4663 | https://rpc.mainnet.chain.robinhood.com | https://robinhoodchain.blockscout.com |

| Chain | Token | Address | Dec |
|---|---|---|---|
| 42161 | WETH | 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1 | 18 |
| 42161 | USDC | 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 | 6 |
| 42161 | LINK | 0xf97f4df75117a78c1A5a0DBb814Af92458539FB4 | 18 |
| 4663 | WETH | 0x0bd7d308f8e1639fab988df18a8011f41eacad73 | 18 |
| 4663 | USDG | 0x5fc5360d0400a0fd4f2af552add042d716f1d168 | 6 |

Pools: 1 WETH/USDC Arb v3 (gated) · 2 LINK/WETH Arb v3 (soon) · 3 LINK/USDC Arb v4 (soon) · 4 WETH/USDG RH v3 (gated).

## 3. Env (all public)

```
NEXT_PUBLIC_AGENT_URL  NEXT_PUBLIC_ARB_RPC  NEXT_PUBLIC_RH_RPC
NEXT_PUBLIC_VAULT_ARB  NEXT_PUBLIC_REGISTRY_ARB  NEXT_PUBLIC_VAULT_RH  NEXT_PUBLIC_REGISTRY_RH
NEXT_PUBLIC_WALLETCONNECT_ID  NEXT_PUBLIC_ADMIN_ADDRESS  NEXT_PUBLIC_APP_URL
```
Wallet: `injected` (EIP-6963 discovery) + `coinbaseWallet` (no key, mobile) + `walletConnect` only when `NEXT_PUBLIC_WALLETCONNECT_ID` is set; `NEXT_PUBLIC_APP_URL` is the origin in wallet metadata (defaults to the page origin). Polling floor 30 s applies to every feed, including /vault and /portfolio.
Live values (2026-10-01): `AGENT_URL=https://argon-bd8888db5430.herokuapp.com` · `VAULT_ARB=VAULT_RH=0x9F844b4D1b28Be7413067f9d4fC08Bc276fd1C60` · `REGISTRY_ARB=REGISTRY_RH=0xbAf00c0aCa440337d43495c7de661A0AC2E01e8f` · `ADMIN=0x9642b6D1Db5D1A3B0A61a831099568bbCbC04D4E` (owner + keeper). Same deployer nonce on both chains, so addresses match.
Missing vault/registry → `undefined` binding → "contracts not deployed" state, deposit/withdraw disabled. Missing AGENT_URL → agent mode `offline`, queries disabled, "waiting for agent telemetry". `NEXT_PUBLIC_AGENT_FIXTURE=true` (non-production only) → sample rows labelled fixture. Env is inlined at build: restart dev / rebuild after editing `.env.local`.

## 4. Agent REST (live FastAPI on Heroku, model `eth-1-2-8h-v1`)

Base `NEXT_PUBLIC_AGENT_URL`. No auth. CORS = web origin (`FRONTEND_ORIGIN` on Heroku; `*.vercel.app` previews allowed). GET only. Timeouts: 15 s feed, 30 s chain-reading endpoints (measured 9–13 s). Errors: FastAPI `{ detail }`.

| Path | Returns | Poll | Hook |
|---|---|---|---|
| /health | `{ok, modelLoaded, database}` | boot | useAgentHealth |
| /status | `AgentStatus` | 30s | useAgentStatus |
| /forecasts/latest | `Forecast` | 30s + `:01` UTC + focus | useLatestForecast |
| /forecasts?limit=24 | `{items: Forecast[]}` newest first (max 168) | 60s | useForecastHistory |
| /forecasts/:hourId | `Forecast` (404 unknown) | on demand; Infinity once matured | useForecast |
| /pools | `PoolsResponse` (APR, TVL, ETH; aprSource open string; TVL/ETH nullable) | 15s (agent pollSeconds; documented exception) | usePools |
| /vault | `VaultSnapshot` (global TVL, no wallet) | 30s (endpoint takes 9.6–12.7 s) | useVaultTelemetry |
| /portfolio/:address | `Portfolio` (totalUsd, per-chain, forecast) | 30s, wallet only; invalidated on every receipt | usePortfolio |

```ts
interface Forecast {   // three horizons; ethPctChange/gateBps are the derived 8 h headline
  hourId; targetHourId (= hourId+8); submittedAt; ethPct1h; ethPct2h; ethPct8h; ethPct{1h,2h,8h}Source: 'lgbm'|'persistence';
  spotUsd|null; modelId; status: 'pending'|'matured'; realizedPctChange|null; realizedSpotUsd|null;
  action: 'warmup'|'exit'|'enter'|'hold'; gate1hBps 100; gate2hBps 250; gate8hBps 200; warmupComplete;
  forecastHash (bytes32)|null; txHash (arb)|null; txHashRh|null; rebalanceTx|null; rebalanceTxRh|null;
  poolStatusArb: 0|1|null; poolStatusRh: 0|1|null; trippedHorizons: ('1h'|'2h'|'8h')[];
}
interface AgentStatus { ok; warmupComplete; hoursUntilFirstDecision (≤9); gate{1h,2h,8h}Bps; lastHourId|null; currentHourId; modelId; modelLoaded; dryRun: boolean (string on wire); database? }
interface LpPool { id: 'arbitrum'|'robinhood'; chainId; poolId; pair; feePercent; uniswapFee; vault; pool; weth; stable; stableSymbol; inPool; poolTvlUsd; ethUsd; selectable; depositHint; aprPct|null; aprBasePct|null; aprSource: 'defillama'|'unavailable'; llamaTvlUsd|null; volumeUsd1d|null }
interface ChainPortfolio { name; chainId; vault; poolId; pair; inPool; ethUsd; totalShares (uint string); tvlUsd; shares (uint string); shareUsd; idleWeth; idleStable; idle*Formatted; wallet*; stableSymbol; stableDecimals }
VaultSnapshot = { address: null; updatedAt; pollSeconds; totalUsd; chains: { arbitrum?; robinhood? } }
Portfolio     = VaultSnapshot & { address; forecast: Forecast|null }
```
Validate with zod (`src/types/forecast.ts`, `src/types/agentApi.ts`); addresses → EIP-55 at the boundary. Bad row = agent error.

## 5. Contracts (deployed; same address on 42161 and 4663)

Vault `0x9F844b4D1b28Be7413067f9d4fC08Bc276fd1C60` · Registry `0xbAf00c0aCa440337d43495c7de661A0AC2E01e8f` · Oracle `0xfC22F2C49Ce6Fa46c5081f900fD691b127Bd1bc5` · Adapter `0xECCc4B8946D0DB206f977d3021544D0cD5Dc69D4`. Gated pools: Arb **1** (WETH/USDC 0.05 %), RH **4** (WETH/USDG 0.05 %).

```solidity
// InferenceRegistry (reads we bind)
function latestHourId() view returns (uint64);  function forecastCount() view returns (uint64);  function warmupComplete() view returns (bool); // forecastCount >= 9
function modelId() view returns (bytes32);      // keccak256("eth-1-2-8h-v1")
function getForecast(uint64 hourId) view returns (Forecast{int256 pct1hBps; int256 pct2hBps; int256 pct8hBps; bytes32 forecastHash; uint64 submittedAt; address submitter}); // reverts UnknownHour
function computeHash(uint64,int256,int256,int256) view returns (bytes32); // keccak256(abi.encode(hourId, bps1h, bps2h, bps8h, modelId))
event ForecastSubmitted(uint64 indexed hourId, int256 pct1hBps, int256 pct2hBps, int256 pct8hBps, bytes32 forecastHash);
// ArgonVault (user-facing)
function deposit(address token, uint256 amount);   function depositETH() payable;
function withdraw(uint256 shares);                 // flattens LP first, pays pro-rata WETH + stable
function emergencyWithdraw();                      // burns ALL caller shares; allowed while paused
function idleBalance(address user, address token) view returns (uint256); // pro-rata claim on vault token balance
function shareBalance(address) view returns (uint256);  function totalShares() view returns (uint256);
function poolStatus(uint8 poolId) view returns (uint8); // adapter.inPosition() ? 1 : 0
function warmupComplete() view returns (bool);  function weth()/stable()/oracle()/keeper() view returns (address);
event Deposited(address indexed user, address indexed token, uint256 amount, uint256 shares);
event Withdrawn(address indexed user, address indexed token, uint256 amount, uint256 shares);
event Rebalanced(uint64 indexed hourId, uint8 indexed poolId, uint8 action, bytes32 forecastHash); // HOLD 0, ENTER 1, EXIT 2
```
No `gateBps()` on chain: gates come from the API (100/250/200). NEVER bind: `rebalance`, `submit`, setters, NonfungiblePositionManager, PoolManager.

Gate (DualHorizonGate): EXIT if |1h| ≥ 1.00 % or |2h| ≥ 2.50 %; HOLD if in pool; ENTER only if idle and all three inside (8h gate 2.00 %); idle + 8h outside = EXIT (stay flat). bps = round-half-even(pct × 100).

## 6. Time and math

```ts
hourIdFromDate(d) = Math.floor(d.getTime()/1000/3600)
dateFromHourId(h) = new Date(h*3600*1000)          // UTC, label "UTC"
toBps(pct) = roundHalfEven(pct*100)                // -2.41 → -241 ; -2.419 → -242 (Python round(), matches agent + registry)
fromBps(bps) = bps/100                             // display 2 decimals
GATES_PCT = { 1h: 1.0, 2h: 2.5, 8h: 2.0 } ; WARMUP_HOURS = 9
dualHorizonAction({ethPct1h, ethPct2h, ethPct8h, warmupComplete, currentlyInPool}):
  !warmupComplete → 'warmup' ; |1h| ≥ 1.0 || |2h| ≥ 2.5 → 'exit' ; inPool → 'hold' ; all three inside → 'enter' ; else 'exit'
forecastHash = keccak256(abi.encode(uint64 hourId, int256 bps1h, int256 bps2h, int256 bps8h, keccak256("eth-1-2-8h-v1")))  // utils/forecastHash.ts
isForecastStale(status) = currentHourId - (lastHourId ?? currentHourId) > 1       // utils/agentStaleness.ts
```
Render API `action`; gate figures come from the payload (`gate*Bps`) with these constants as fallback. Never a second threshold.

## 7. State model

```
WARMUP (warmupComplete=false, no IN_POOL anywhere)
  └─hour 8─► IDLE (poolStatus=0) ◄──exit (|pred|≥2) + rebalance receipt──┐
                 │ enter (|pred|<2) + rebalance receipt                   │
                 ▼                                                        │
              IN_POOL (poolStatus=1) ── hold while |pred|<2 ──────────────┘
Card overlays: UNFUNDED (zero vault balance) · LINK_SOON (pools 2,3)
Gate chip: IN (|pct|<2) argon · OUT (|pct|>=2) warn. Sign color: up green / down red.
HashMatch: green if registry.forecastHash==api.forecastHash && registry.ethPctBps==toBps(api.ethPctChange)
           amber "pending on chain" if api.hourId > registry.latestHourId ; red on mismatch ; dim if not deployed
Write status: idle | simulating | awaitingSignature | pending(hash) | confirmed | failed
```

## 8. Reconciliation rules

- Monotonic: accept API row only if `hourId >= lastRendered`.
- API behind registry → "agent stale", prefer registry number.
- API ahead of registry → amber pending, not red.
- `action=exit` but `poolStatus=1` → still IN_POOL with "exit pending" tag. Never flip on forecast alone.
- Agent down → hero from `getForecast(latestHourId())`, banner "live agent unreachable — showing last on-chain forecast". Registry down too → "no forecast available". Never fake a %.
- Optimistic UI: presentation only. Never balances, never poolStatus, never hash match.

## 9. Stack and caching

Next.js App Router · TypeScript strict · wagmi v2 · viem · TanStack Query · RainbowKit/ConnectKit · Tailwind · Framer Motion · zod · Zustand (UI only) · Lucide.

One cache: TanStack Query (wagmi uses it). Zustand holds only `{selectedChainId, modal, motion, field, sound}`. Providers mount under `/app` only. Transports: `fallback([http(env), http(public)])`, multicall on. Writes: `useSimulateContract → useWriteContract → useWaitForTransactionReceipt → invalidate ['vault',chainId], ['logs',...]`. Activity: viem `getLogs` bounded range, no indexer. Optional proxy `app/api/agent/[...path]` pass-through `revalidate:30`. No BFF, no Express, `server/` retired.

## 10. Directory map

```
src/
  app/            /, /app, /app/deposit, /app/withdraw, /app/forecasts, /app/activity, api/agent (optional)
  components/ui/          Button Chip Panel DataTable TokenInput Glow
  components/simulation/  ParticleField TickerTape Telemetry HourPulse
  components/modules/     ForecastHero WarmupBar PoolCard HashMatch WalletStrip DepositForm WithdrawForm ActivityFeed ChainSwitcher ConnectButton
  hooks/          useLatestForecast useForecastHistory useAgentStatus useAgentClock useRegistryForecast usePoolStatus useVaultBalances useVaultParams useDeposit useWithdraw useActivity useSimulationLoop
  services/       agent.ts chains.ts wagmi.ts contracts.ts tokens.ts explorer.ts logs.ts env.ts fixtures/
  stores/         ui.ts
  types/          forecast.ts status.ts pools.ts abi/
  styles/         globals.css tokens.css keyframes.css
  utils/          hourId.ts bps.ts format.ts policy.ts sim/
```

## 11. Simulation rules

One rAF loop (`useSimulationLoop`). Register `(dt, now) => void`, unregister on unmount. Pause on `document.hidden`, `prefers-reduced-motion`, and `awaitingSignature`. DPR ≤ 2. ≤ 4 ms/frame. ≤ 400 particles desktop, 150 mobile. Props via ref. No Three.js in v1. Framer: transform/opacity only, ≤ 20 nodes/route. Ticker = CSS transform. Glitch only on error states.

## 12. Design tokens (hex)

```
void #000000  surface-0 #07060B  surface-1 #0E0C16  glass rgba(14,12,22,.55) blur 14px
hairline rgba(192,132,252,.14)  hairline-strong rgba(192,132,252,.32)
argon-300 #D8B4FE  argon-400 #C084FC  argon-500 #A855F7  argon-600 #7E22CE  argon-glow rgba(168,85,247,.45)
plasma-400 #F0ABFC  plasma-500 #E879F9  ion-400 #22D3EE
signal-up #34D399  signal-down #FB7185  signal-warn #FBBF24  signal-idle #8B86A0  signal-soon #5B5670
text-hi #EDEAF6  text-mid #B8B3C9  text-lo #8B86A0  text-dim #5B5670
mono JetBrains Mono (tabular-nums) · display Space Grotesk · radii 6/4 px · spacing 4 8 12 16 24 32 48
```

## 13. Copy

- Outside gate: "Model expects ETH to move past its gate on <tripped horizons> (1h ≥ 1%, 2h ≥ 2.5%, 8h ≥ 2%). Positions flattened."
- Inside gate: "Model expects ETH inside every gate (1h ±1%, 2h ±2.5%, 8h ±2%). Liquidity in range."
- Warmup: "Collecting the first 9 hourly submits. No trades until the registry opens at submit 9."
- Stale: "last print was N h ago — the agent clock is behind; this forecast is stale"  ·  Dry-run: "keeper in dry-run: forecasts are published and hashed off-chain, on-chain submission and rebalancing are paused"
- In-pool withdraw: "Your LP is in range. Withdraw becomes available when the model next exits (±2% gate), or use Emergency idle withdraw for any unallocated tokens."
- Agent down: "live agent unreachable — showing last on-chain forecast"

## 14. Required error/empty states

wallet not connected · wrong chain · agent 5xx/timeout · registry not deployed · vault not deployed · warmup · no deposit · approve needed · tx rejected · sequencer/stale oracle revert reason · hash mismatch

## 15. Build order

1 scaffold+wallet · 2 types+agent client+fixture · 3 dashboard modules+particle field · 4 registry+HashMatch · 5 deposit/withdraw Arb · 6 Robinhood+pool 4 · 7 forecast history · 8 activity feed

## 16. Acceptance (spec §12)

Deposit USDC on Arb, idle updates · hero shows 8h % same sign 2 decimals · |pred|≥2 → EXIT/IDLE · |pred|<2 → ENTER/HOLD/IN_POOL · warmup hides trade status · hash matches Arbiscan · idle withdraw works, in-pool funds never exposed · RH switch keeps Arb reads.

## 17. Hard bans

No POST to agent · no `rebalance`/`submit` · no Uniswap manager calls · no keeper key, Tiingo key, DIA call in browser · no second gate threshold · no polling < 30s · no second cache · no touching `agent/`.

## 18. Live state (2026-10-01)

Agent live on Heroku (FastAPI, Postgres, LightGBM 8 h pickle; 1 h and 2 h via persistence), `DRY_RUN=true` so the keeper is not sending txs yet: registry `forecastCount = 0`, `latestHourId = 0` on both chains, every API row shows `action: warmup`, hash match reads "pending on chain". Contracts deployed and verified by decoding with our ABIs; `registry.computeHash(live row) == API forecastHash == browser recomputation`. Web ships offline-honest: no sample data unless the fixture flag is set in development.
