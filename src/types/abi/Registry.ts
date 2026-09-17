/**
 * InferenceRegistry — read surface only (spec §4.4). `submit` is keeper-only and
 * is intentionally absent (CLAUDE.md §0.3).
 */
export const registryAbi = [
  {
    type: 'function',
    name: 'latestHourId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint64' }],
  },
  {
    type: 'function',
    name: 'getForecast',
    stateMutability: 'view',
    inputs: [{ name: 'hourId', type: 'uint64' }],
    outputs: [
      { name: 'ethPctBps', type: 'int256' },
      { name: 'targetHourId', type: 'uint64' },
      { name: 'forecastHash', type: 'bytes32' },
      { name: 'submittedAt', type: 'uint64' },
      { name: 'submitter', type: 'address' },
    ],
  },
  {
    type: 'event',
    name: 'ForecastSubmitted',
    inputs: [
      { name: 'hourId', type: 'uint64', indexed: true },
      { name: 'ethPctBps', type: 'int256', indexed: false },
      { name: 'forecastHash', type: 'bytes32', indexed: false },
    ],
  },
] as const;
