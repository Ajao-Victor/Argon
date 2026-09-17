/**
 * Micro-copy for Web3 terms (Phase 7 M3). One short sentence each, written for a
 * first-time user. Rendered through <Term id="…"> as a hover / focus tooltip.
 */
export const GLOSSARY = {
  apiHash: 'The forecast is hashed so anyone can check the vault acted on exactly this number, without publishing the model.',
  registryHash: 'The same hash, read from the InferenceRegistry contract on-chain. Green means the API and the chain agree.',
  bps: 'Basis points: the forecast in hundredths of a percent, as the contract stores it. −241 bps is −2.41%.',
  hourId: 'Hours since 1970 UTC. Every forecast, hash, and rebalance is keyed on this number.',
  targetHour: 'The hour eight ahead, when this forecast can be compared against the real price.',
  gate: 'The one rule: if the model expects ETH to move 2% or more in eight hours, liquidity leaves the pool.',
  spot: 'The ETH price the model saw when it ran, from the DIA oracle.',
  model: 'The version of the forecasting model. It changes only when the training policy changes.',
  action: 'What the keeper does this hour: ENTER puts liquidity in range, HOLD leaves it, EXIT pulls it to the vault.',
  warmup: 'The first eight hours after launch collect forecasts without trading.',
  idle: 'Tokens sitting in the vault, not in a Uniswap position. Always withdrawable.',
  inPool: 'Your share of the vault is deployed as concentrated Uniswap liquidity right now.',
  shares: 'Your fraction of the vault. Grows with fees, falls only if you withdraw.',
  lastRebalance: 'The keeper transaction that last moved this pool in or out of range.',
  keeper: 'The off-chain bot that reads the forecast and calls the vault. It can only rebalance, never move funds elsewhere.',
  emergency: 'Withdraws every idle token you have in this vault in one transaction. Never touches funds in a pool.',
  fixture: 'The agent service is not connected. Numbers come from a local sample so the interface can be exercised.',
  sequencer: 'The vault refuses to trade if the L2 sequencer is down or the price feed is stale.',
} as const;

export type TermId = keyof typeof GLOSSARY;
