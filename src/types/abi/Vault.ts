/**
 * ArgonVault — user-facing surface, transcribed from the deployed
 * contracts/src/ArgonVault.sol (0x9F844b4D1b28Be7413067f9d4fC08Bc276fd1C60 on
 * Arbitrum One 42161 and Robinhood Chain 4663).
 *
 * Accounting model: deposits mint USD-denominated shares (oracle-priced); `withdraw(shares)`
 * flattens every LP position first, then pays the burner pro-rata WETH + stable;
 * `emergencyWithdraw()` burns the caller's whole balance. `idleBalance(user, token)` is the
 * user's pro-rata claim on the vault's current token balance. `poolStatus(poolId)` asks the
 * adapter whether a position is open (1) or not (0). `warmupComplete()` is
 * `registry.forecastCount() >= 9`.
 *
 * `rebalance` and every owner/keeper setter are intentionally absent (ENGINEERING.md §0.3).
 * The `Action` enum in `Rebalanced` encodes HOLD = 0, ENTER = 1, EXIT = 2 (DualHorizonGate).
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
  { type: 'function', name: 'depositETH', stateMutability: 'payable', inputs: [], outputs: [] },
  { type: 'function', name: 'withdraw', stateMutability: 'nonpayable', inputs: [{ name: 'shares', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'emergencyWithdraw', stateMutability: 'nonpayable', inputs: [], outputs: [] },
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
  { type: 'function', name: 'shareBalance', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'totalShares', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'poolStatus', stateMutability: 'view', inputs: [{ name: 'poolId', type: 'uint8' }], outputs: [{ name: '', type: 'uint8' }] },
  { type: 'function', name: 'warmupComplete', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'weth', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { type: 'function', name: 'stable', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { type: 'function', name: 'stableDecimals', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
  { type: 'function', name: 'oracle', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { type: 'function', name: 'keeper', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  // events (activity feed)
  {
    type: 'event',
    name: 'Deposited',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'shares', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Withdrawn',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'shares', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Rebalanced',
    inputs: [
      { name: 'hourId', type: 'uint64', indexed: true },
      { name: 'poolId', type: 'uint8', indexed: true },
      { name: 'action', type: 'uint8', indexed: false },
      { name: 'forecastHash', type: 'bytes32', indexed: false },
    ],
  },
] as const;

/** DualHorizonGate action codes as emitted in `Rebalanced.action`. */
export const VAULT_ACTION_NAME: Record<number, 'hold' | 'enter' | 'exit'> = { 0: 'hold', 1: 'enter', 2: 'exit' };
