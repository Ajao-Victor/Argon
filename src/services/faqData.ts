import type { FaqCategory, FaqEntry } from '@/types/faq';

/**
 * The eight protocol questions, trader-friendly, grounded 100 % in the Argon README
 * specification (hourly 8 h forecast, DualHorizonGate, 9-hour warmup, 2-hour cooldown,
 * two chains, signer gates, on-chain custody, InferenceRegistry hashes).
 */
export const FAQ_ENTRIES: readonly FaqEntry[] = [
  {
    id: 'what-is-argon',
    category: 'how-it-works',
    question: 'What is Argon and what problem does it solve?',
    answer: [
      'Concentrated Uniswap liquidity only earns fees while the price stays inside your range. A sudden 1-hour dump pushes the position out of range and locks in impermanent loss before you can react.',
      'Existing automators only shift the range after the move. Argon leaves the pool into cash before a predicted red hour and re-enters when the market looks calm, so your capital earns fees in quiet markets and sits safely idle in volatile ones.',
    ],
  },
  {
    id: 'hourly-forecast',
    category: 'how-it-works',
    question: 'How does the hourly 8-hour forecast and remaining-move calculation work?',
    answer: [
      'Every hour at `:00 UTC`, a hosted LightGBM model predicts the ETH price 8 hours ahead (`predEthUsd8h`). Older 8-hour target prices stay fixed once published.',
      'Each hour Argon recalculates the percentage move still left from the current ETH price to those stored targets, so the gate always reacts to what remains, not to the move at birth.',
      'Worked example: a `$2,754` target from a `$2,700` close is `+2.0%` at birth. If the price is `$2,748` seven hours later, the 1-hour gate sees `+0.22%`, not `+2.0%`.',
    ],
  },
  {
    id: 'enter-hold-exit',
    category: 'trading-rules',
    question: 'When does Argon ENTER, HOLD, or EXIT a pool?',
    answer: ['Argon slices the remaining move into 1-hour, 2-hour and 8-hour views, `(target / current)^(H / R) − 1`, and applies one rule per hour:'],
    bullets: [
      'EXIT if `|1h| ≥ 1.0%` or `|2h| ≥ 2.5%`. Liquidity is removed and the tokens are held safely idle in the vault.',
      'ENTER if idle and `|1h| < 1.0%` and `|2h| < 2.5%` and `|8h| < 2.0%`. A concentrated Uniswap v3 range is minted around the current tick.',
      'HOLD if already in the pool and EXIT is not triggered.',
    ],
  },
  {
    id: 'warmup-cooldown',
    category: 'trading-rules',
    question: 'What is the 9-hour Warmup and 2-hour Cooldown?',
    answer: [
      'The first 9 hourly submits (`hours 0–8`) are warmup: the model is observed and its forecasts are recorded on-chain, but no trades happen.',
      'After an EXIT, a 2-hour cooldown prevents whipsaw re-entry. The vault stays in cash for those two hours unless another EXIT signal fires, which simply keeps it out.',
    ],
  },
  {
    id: 'chains-pools',
    category: 'chains-pools',
    question: 'Which chains and pools are supported?',
    answer: ['Two chains run today, each with its own independent vault:'],
    bullets: [
      'Arbitrum One (`42161`): `WETH / USDC` on Uniswap v3, live now. `LINK / WETH` on v3 and `LINK / USDC` on v4 are on the roadmap.',
      'Robinhood Chain (`4663`): `WETH / USDG` on Uniswap v3, live now.',
      'Both vaults use the same contract addresses and never bridge. There is no cross-chain risk: an outage on one chain never freezes funds on the other.',
    ],
  },
  {
    id: 'signer-gates',
    category: 'trading-rules',
    question: 'What are Signer Gates (Safe, Balanced, Aggressive, Custom)?',
    answer: [
      'The shared vault executes on the Balanced on-chain band: `1h ±1.0%`, `2h ±2.5%`, `8h ±2.0%`. The model still publishes one 8-hour ETH price for everyone.',
      'Any wallet can sign a message (`argon-gate:…`) to track its own band: Safe (`±0.6% / ±1.2% / ±1.0%`), Balanced, Aggressive (`±2.0% / ±4.0% / ±3.5%`), or a Custom 1-hour band. Your gate decides whether your capital is allowed into the Uniswap position that hour, and the pool card shows your wallet’s own last decision.',
    ],
  },
  {
    id: 'funds-safety',
    category: 'security-custody',
    question: 'Are my funds safe? Can the AI or Keeper steal my crypto?',
    answer: [
      'Custody is 100 % on-chain; only the judgment is off-chain. The agent never holds user keys and the web app never sends a transaction on your behalf.',
      'The keeper hot wallet can only call `rebalance()` within contract-enforced slippage and tick bounds. It can never send tokens to an arbitrary address.',
      'You can withdraw your pro-rata WETH and stablecoin shares at any time, in pool or idle. A Chainlink oracle check and an L2 sequencer-uptime guard block rebalances during stale price feeds or L2 downtime.',
    ],
  },
  {
    id: 'verify-forecast',
    category: 'security-custody',
    question: "How can I verify the AI didn't fake a trade?",
    answer: [
      'Every hourly forecast is hashed with `keccak256` and committed to the on-chain `InferenceRegistry` through `submit(forecastHash, hourId)` before any trade for that hour.',
      'The dashboard recomputes the hash from the published numbers in your browser and compares it against the contract, so you can see the forecast was locked in before the vault acted on it.',
    ],
  },
];

/** The entries for one category chip, or all of them. Pure, so it is tested without a DOM. */
export function filterFaq(category: FaqCategory | 'all', entries: readonly FaqEntry[] = FAQ_ENTRIES): readonly FaqEntry[] {
  return category === 'all' ? entries : entries.filter((e) => e.category === category);
}
