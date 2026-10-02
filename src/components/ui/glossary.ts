import { GATES_PCT, WARMUP_HOURS } from '@/utils/policy';

/**
 * Micro-copy for Web3 terms (Phase 7 M3). One short sentence each, written for a
 * first-time user. Rendered through <Term id="…"> as a hover / focus tooltip.
 */
export const GLOSSARY = {
  apiHash: 'keccak256 of (hourId, 1h bps, 2h bps, 8h bps, model id). The browser recomputes it from the published numbers, so a hash of different numbers cannot pass.',
  registryHash: 'The same hash, read from the InferenceRegistry contract on-chain. Green means the API and the chain agree.',
  bps: 'Basis points for each horizon, as the registry stores them: percent × 100, rounded half-to-even. −241 is −2.41%.',
  hourId: 'Hours since 1970 UTC. Every forecast, hash, and rebalance is keyed on this number.',
  targetHour: 'The understandable hour: the UTC hour, eight ahead of the forecast, when the 8-hour prediction settles and is compared against the real ETH price. Until then the forecast is pending.',
  gate: `The one rule, per horizon: liquidity leaves the pool if the model expects |ETH| to move ≥ ${GATES_PCT['1h']}% in 1h or ≥ ${GATES_PCT['2h']}% in 2h; it only enters when 1h, 2h and 8h (±${GATES_PCT['8h']}%) are all inside.`,
  spot: 'The ETH price the model saw when it ran, from the DIA oracle.',
  model: 'The version of the forecasting model. It changes only when the training policy changes.',
  action: 'What the keeper does this hour: ENTER puts liquidity in range, HOLD leaves it, EXIT pulls it to the vault.',
  warmup: `The first ${WARMUP_HOURS} hourly submits after launch are observation only; the registry opens trading at submit ${WARMUP_HOURS}.`,
  idle: 'Your pro-rata claim on the tokens the vault holds outside Uniswap right now. Withdrawing pays pro-rata WETH + stable.',
  inPool: 'Your share of the vault is deployed as concentrated Uniswap liquidity right now.',
  shares: 'USD-denominated vault shares minted on deposit (oracle-priced). Withdraw burns shares; the vault pays pro-rata WETH + stable.',
  lastRebalance: 'The keeper transaction that last moved this pool in or out of range.',
  keeper: 'The off-chain bot that reads the forecast and calls the vault. It can only rebalance, never move funds elsewhere.',
  emergency: 'Burns your entire share balance in one transaction, flattening any LP position first. Works even while the keeper is paused.',
  fixture: 'The agent service is not connected. Numbers come from a local sample so the interface can be exercised.',
  apr: 'Fee APR of the underlying Uniswap pool from DefiLlama, refreshed every minute. Robinhood pools may not be listed there yet, shown as —%.',
  sequencer: 'The vault refuses to trade if the L2 sequencer is down or the price feed is stale.',
} as const;

export type TermId = keyof typeof GLOSSARY;
