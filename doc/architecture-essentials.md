# Argon — Architecture Essentials (LLM cheat sheet)

Dense reference for coding sessions. Full detail in `product.md`, `architecture.md`, `agents.md`, `design.md`. Spec of record: `doc/Argon .txt`.

## 0. One paragraph

Argon is a dual-chain LP vault. Every hour at `:00` UTC a Python model (partner's `agent/`) forecasts ETH % change 8h ahead. Gate: `|pred| >= 2%` → keeper `EXIT`s Uniswap LP to vault (`IDLE`); else `ENTER`/`HOLD` (`IN_POOL`). Hours 0–7 warmup, no trades. Forecast hash is committed to `InferenceRegistry`. The web (`argon-web`, ours) is a Next.js reader: wallet, deposit, idle-only withdraw, live forecast, pool status, hash verification. Web never writes to the agent, never calls `rebalance`/`submit`, never holds keys. v1: ETH-only, pools 1 (WETH/USDC Arbitrum) and 4 (WETH/USDG Robinhood). Pools 2, 3 are `LINK_SOON`.

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
NEXT_PUBLIC_WALLETCONNECT_ID  NEXT_PUBLIC_ADMIN_ADDRESS
```
Missing vault/registry → `undefined` binding → "contracts not deployed" state, deposit/withdraw disabled. Missing AGENT_URL → agent mode `offline`, queries disabled, "waiting for agent telemetry". `NEXT_PUBLIC_AGENT_FIXTURE=true` (non-production only) → sample rows labelled fixture. Env is inlined at build: restart dev / rebuild after editing `.env.local`.

## 4. Agent REST

Base `NEXT_PUBLIC_AGENT_URL`. No auth. CORS = web origin. 10 s timeout. GET only.

| Path | Returns | Poll |
|---|---|---|
| /health | `{ok, modelLoaded}` | boot |
| /status | `AgentStatus` | 30s |
| /forecasts/latest | `Forecast` | 30s + `:01` UTC + focus |
| /forecasts?limit=24 | `{items: Forecast[]}` newest first | 60s |
| /forecasts/:hourId | `Forecast` | on demand; Infinity once matured |

```ts
interface Forecast {
  hourId: number; targetHourId: number; submittedAt: string; horizonHours: 8;
  ethPctChange: number; ethLogReturn: number; spotUsd: number; modelId: string;
  status: 'pending'|'matured'; realizedPctChange: number|null; realizedSpotUsd: number|null;
  action: 'warmup'|'exit'|'enter'|'hold'; gateBps: number; warmupComplete: boolean;
  txHash: `0x${string}`|null; forecastHash: `0x${string}`|null;
}
interface AgentStatus { ok: boolean; warmupComplete: boolean; hoursUntilFirstDecision: number;
  gateBps: number; lastHourId: number; modelId: string; modelLoaded: boolean; lastError?: string|null }
```
`ethPctChange = (exp(ethLogReturn) - 1) * 100`. Validate with zod. Bad row = agent error.

## 5. Contracts (spec §4.4, same ABI both chains)

```solidity
// InferenceRegistry
function latestHourId() view returns (uint64);
function getForecast(uint64 hourId) view returns (int256 ethPctBps, uint64 targetHourId, bytes32 forecastHash, uint64 submittedAt, address submitter);
event ForecastSubmitted(uint64 indexed hourId, int256 ethPctBps, bytes32 forecastHash);
// ArgonVault (user-facing)
function deposit(address token, uint256 amount);
function depositETH() payable;                  // optional; feature-detect
function withdraw(address token, uint256 amount);
function emergencyWithdraw();                   // idle only
function idleBalance(address user, address token) view returns (uint256);
function shareBalance(address user) view returns (uint256);
function poolStatus(uint8 poolId) view returns (uint8); // 0 idle, 1 in pool
function gateBps() view returns (uint16);       // 200
function warmupComplete() view returns (bool);
event Deposited(address indexed user, address token, uint256 amount);
event Withdrawn(address indexed user, address token, uint256 amount);
event Rebalanced(uint64 indexed hourId, uint8 poolId, uint8 action, bytes32 forecastHash);
```
NEVER bind: `rebalance`, `submit`, NonfungiblePositionManager, PoolManager.

## 6. Time and math

```ts
hourIdFromDate(d) = Math.floor(d.getTime()/1000/3600)
dateFromHourId(h) = new Date(h*3600*1000)          // UTC, label "UTC"
toBps(pct) = Math.trunc(pct*100)                   // -2.41 → -241
fromBps(bps) = bps/100                             // display 2 decimals
GATE = 2 (percent) ; gateBps = 200
policyAction({ethPctChange, warmupComplete, currentlyInPool}):
  !warmupComplete → 'warmup' ; |pct| >= 2 → 'exit' ; inPool ? 'hold' : 'enter'
```
Render API `action`; helper is fallback + tests. Never a second threshold.

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

- Outside gate: "Model expects |ETH| move ≥ 2% over 8h. Positions flattened."
- Inside gate: "Model expects ETH within ±2% over 8h. Liquidity in range."
- Warmup: "Collecting the first 8 hourly forecasts. No trades until hour 8."
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

## 18. Known external gaps (2026-09-17)

Partner's notebook retrains each run, prints a dict, has no REST/Postgres/hourId/hash/action. Web ships offline-honest: no sample data unless the fixture flag is set in development. Contracts have no code and no owner. Partner's README (1h, ETH+LINK, 4 pools live) is superseded by code + web spec (8h, ETH-only).
