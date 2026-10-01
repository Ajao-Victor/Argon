import type { Address, PublicClient } from 'viem';

import { VAULT_ACTION_NAME, vaultAbi } from '@/types/abi/Vault';

import type { SupportedChainId } from './chains';
import { VAULT_DEPLOY_BLOCK } from './contracts';

/**
 * Activity feed source (doc/architecture.md §1.4): viem getLogs from the vault's
 * deployment block to head. No indexer in v1.
 *
 * Public RPCs on both chains accept ranges up to ~10 M blocks for an address-filtered
 * eth_getLogs, so the scan is one request per event type for the first ~110 days of
 * the vault's life. Beyond that the range is split into 9.5 M-block windows and the
 * windows run in parallel. Event shapes follow the deployed ArgonVault: Deposited /
 * Withdrawn carry (user, token, amount, shares) with user and token indexed; Rebalanced
 * carries (hourId, poolId, action, forecastHash).
 */
export type ActivityKind = 'Deposited' | 'Withdrawn' | 'Rebalanced';

export interface ActivityEvent {
  kind: ActivityKind;
  chainId: SupportedChainId;
  blockNumber: bigint;
  txHash: `0x${string}`;
  logIndex: number;
  user?: Address | undefined;
  token?: Address | undefined;
  amount?: bigint | undefined;
  shares?: bigint | undefined;
  hourId?: bigint | undefined;
  poolId?: number | undefined;
  action?: 'hold' | 'enter' | 'exit' | undefined;
  forecastHash?: `0x${string}` | undefined;
}

/** Largest block span a single address-filtered eth_getLogs may cover on the public RPCs. */
export const MAX_LOG_WINDOW_BLOCKS = 9_500_000n;

/** Split [from, to] into consecutive windows of at most MAX_LOG_WINDOW_BLOCKS. Exported for tests. */
export function logWindows(fromBlock: bigint, toBlock: bigint, max: bigint = MAX_LOG_WINDOW_BLOCKS): Array<{ fromBlock: bigint; toBlock: bigint }> {
  if (toBlock < fromBlock) return [];
  const span = toBlock - fromBlock;
  if (span <= max) return [{ fromBlock, toBlock }];
  const count = Number((span + max - 1n) / max);
  const out: Array<{ fromBlock: bigint; toBlock: bigint }> = [];
  for (let i = 0; i < count; i++) {
    const start = fromBlock + BigInt(i) * max;
    const end = i === count - 1 ? toBlock : start + max - 1n;
    out.push({ fromBlock: start, toBlock: end });
  }
  return out;
}

/** Newest block first; within a block, highest log index first. */
export function sortNewestFirst(events: ActivityEvent[]): ActivityEvent[] {
  return [...events].sort((a, b) => (a.blockNumber === b.blockNumber ? b.logIndex - a.logIndex : a.blockNumber > b.blockNumber ? -1 : 1));
}

export async function fetchVaultActivity(opts: {
  client: PublicClient;
  chainId: SupportedChainId;
  vault: Address;
  user: Address | undefined;
}): Promise<ActivityEvent[]> {
  const { client, chainId, vault, user } = opts;
  const latest = await client.getBlockNumber();
  const fromBlock = VAULT_DEPLOY_BLOCK[chainId];

  const depositedEvent = vaultAbi.find((x) => x.type === 'event' && x.name === 'Deposited');
  const withdrawnEvent = vaultAbi.find((x) => x.type === 'event' && x.name === 'Withdrawn');
  const rebalancedEvent = vaultAbi.find((x) => x.type === 'event' && x.name === 'Rebalanced');
  if (!depositedEvent || !withdrawnEvent || !rebalancedEvent) return [];

  const windows = logWindows(fromBlock, latest);
  const perWindow = await Promise.all(
    windows.map(async ({ fromBlock: start, toBlock: end }) => {
      const [deposits, withdrawals, rebalances] = await Promise.all([
        user ? client.getLogs({ address: vault, event: depositedEvent, args: { user }, fromBlock: start, toBlock: end }) : Promise.resolve([]),
        user ? client.getLogs({ address: vault, event: withdrawnEvent, args: { user }, fromBlock: start, toBlock: end }) : Promise.resolve([]),
        client.getLogs({ address: vault, event: rebalancedEvent, fromBlock: start, toBlock: end }),
      ]);
      const events: ActivityEvent[] = [];
      for (const l of deposits) {
        events.push({ kind: 'Deposited', chainId, blockNumber: l.blockNumber, txHash: l.transactionHash, logIndex: l.logIndex, user: l.args.user, token: l.args.token, amount: l.args.amount, shares: l.args.shares });
      }
      for (const l of withdrawals) {
        events.push({ kind: 'Withdrawn', chainId, blockNumber: l.blockNumber, txHash: l.transactionHash, logIndex: l.logIndex, user: l.args.user, token: l.args.token, amount: l.args.amount, shares: l.args.shares });
      }
      for (const l of rebalances) {
        events.push({
          kind: 'Rebalanced', chainId, blockNumber: l.blockNumber, txHash: l.transactionHash, logIndex: l.logIndex,
          hourId: l.args.hourId, poolId: l.args.poolId, action: l.args.action === undefined ? undefined : VAULT_ACTION_NAME[l.args.action], forecastHash: l.args.forecastHash,
        });
      }
      return events;
    }),
  );

  return sortNewestFirst(perWindow.flat());
}
