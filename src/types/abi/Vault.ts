/**
 * ArgonVault — user-facing surface only (spec §4.4).
 * Deliberately excludes `rebalance` and any adapter/Uniswap functions (CLAUDE.md §0.3).
 */
export const vaultAbi = [
  // writes (user wallet)
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'depositETH',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'emergencyWithdraw',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  // reads
  {
    type: 'function',
    name: 'idleBalance',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'token', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'shareBalance',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'poolStatus',
    stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'uint8' }],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'gateBps',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint16' }],
  },
  {
    type: 'function',
    name: 'warmupComplete',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
  // events (activity feed)
  {
    type: 'event',
    name: 'Deposited',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Withdrawn',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Rebalanced',
    inputs: [
      { name: 'hourId', type: 'uint64', indexed: true },
      { name: 'poolId', type: 'uint8', indexed: false },
      { name: 'action', type: 'uint8', indexed: false },
      { name: 'forecastHash', type: 'bytes32', indexed: false },
    ],
  },
] as const;
