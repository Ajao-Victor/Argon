/**
 * InferenceRegistry — read surface only, transcribed from the deployed
 * contracts/src/InferenceRegistry.sol (0xbAf00c0aCa440337d43495c7de661A0AC2E01e8f on
 * Arbitrum One 42161 and Robinhood Chain 4663).
 *
 * `submit` is keeper-only and is intentionally absent (ENGINEERING.md §0.3).
 * `getForecast` reverts with UnknownHour for an unsubmitted hour; callers read it with
 * allowFailure and treat a failure as "pending on chain".
 * `computeHash` lets the browser ask the chain for the hash of any three numbers.
 */
export const registryAbi = [
  { type: 'function', name: 'latestHourId', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint64' }] },
  { type: 'function', name: 'forecastCount', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint64' }] },
  { type: 'function', name: 'warmupComplete', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'modelId', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bytes32' }] },
  { type: 'function', name: 'keeper', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  {
    type: 'function',
    name: 'getForecast',
    stateMutability: 'view',
    inputs: [{ name: 'hourId', type: 'uint64' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'pct1hBps', type: 'int256' },
          { name: 'pct2hBps', type: 'int256' },
          { name: 'pct8hBps', type: 'int256' },
          { name: 'forecastHash', type: 'bytes32' },
          { name: 'submittedAt', type: 'uint64' },
          { name: 'submitter', type: 'address' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'computeHash',
    stateMutability: 'view',
    inputs: [
      { name: 'hourId', type: 'uint64' },
      { name: 'pct1hBps', type: 'int256' },
      { name: 'pct2hBps', type: 'int256' },
      { name: 'pct8hBps', type: 'int256' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'event',
    name: 'ForecastSubmitted',
    inputs: [
      { name: 'hourId', type: 'uint64', indexed: true },
      { name: 'pct1hBps', type: 'int256', indexed: false },
      { name: 'pct2hBps', type: 'int256', indexed: false },
      { name: 'pct8hBps', type: 'int256', indexed: false },
      { name: 'forecastHash', type: 'bytes32', indexed: false },
    ],
  },
] as const;
