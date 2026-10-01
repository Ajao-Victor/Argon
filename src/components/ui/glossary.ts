/**
 * Micro-copy for Web3 terms (Phase 7 M3). One short sentence each, written for a
 * first-time user. Rendered through <Term id="…"> as a hover / focus tooltip.
 */
export const GLOSSARY = {
  apiHash: 'keccak256 of (hourId, 1h bps, 2h bps, 8h bps, model id). The browser recomputes it from the published numbers, so a hash of different numbers cannot pass.',
  registryHash: 'The same hash, read from the InferenceRegistry contract on-chain. Green means the API and the chain agree.',
  bps: 'Basis points for each horizon, as the registry stores them: percent × 100, rounded half-to-even. −241 is −2.41%.',
  hourId: 'Hours since 1970 UTC. Every forecast, hash, and rebalance is keyed on this number.',
  targetHour: 'The hour eight ahead, when this forecast can be compared against the real price.',
  gate: 'The one rule: if the model expects ETH to move 2% or more in eight hours, liquidity leaves the pool.',
  spot: 'The ETH price the model saw when it ran, from the DIA oracle.',
  model: 'The version of the forecasting model. It changes only when the training policy changes.',
  action: 'What the keeper does this hour: ENTER puts liquidity in range, HOLD leaves it, EXIT pulls it to the vault.',
  warmup: 'The first eight hours after launch collect forecasts without trading.',
  idle: 'Your pro-rata claim on the tokens the vault holds outside Uniswap right now. Withdrawing pays pro-rata WETH + stable.',
  inPool: 'Your share of the vault is deployed as concentrated Uniswap liquidity right now.',
  shares: 'USD-denominated vault shares minted on deposit (oracle-priced). Withdraw burns shares; the vault pays pro-rata WETH + stable.',
  lastRebalance: 'The keeper transaction that last moved this pool in or out of range.',
  keeper: 'The off-chain bot that reads the forecast and calls the vault. It can only rebalance, never move funds elsewhere.',
  emergency: 'Burns your entire share balance in one transaction, flattening any LP position first. Works even while the keeper is paused.',
  fixture: 'The agent service is not connected. Numbers come from a local sample so the interface can be exercised.',
  sequencer: 'The vault refuses to trade if the L2 sequencer is down or the price feed is stale.',
} as const;

export type TermId = keyof typeof GLOSSARY;
