import type { Address, PublicClient } from 'viem';

import { VAULT_ACTION_NAME, vaultAbi } from '@/types/abi/Vault';

import type { SupportedChainId } from './chains';

/**
 * Activity feed source (doc/architecture.md §1.4): viem getLogs over a bounded block
 * range, chunked to what public RPCs accept. No indexer in v1. Event shapes follow the
 * deployed ArgonVault: Deposited / Withdrawn carry (user, token, amount, shares) with
 * user and token indexed; Rebalanced carries (hourId, poolId, action, forecastHash).
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

// ~7 days of Arbitrum blocks at ~0.25 s; Robinhood is tuned the same way for v1.
export const DEFAULT_LOOKBACK_BLOCKS = 2_400_000n;
export const LOG_CHUNK_BLOCKS = 10_000n;

export async function fetchVaultActivity(opts: {
  client: PublicClient;
  chainId: SupportedChainId;
  vault: Address;
  user: Address | undefined;
  lookbackBlocks?: bigint;
}): Promise<ActivityEvent[]> {
  const { client, chainId, vault, user } = opts;
  const latest = await client.getBlockNumber();
  const lookback = opts.lookbackBlocks ?? DEFAULT_LOOKBACK_BLOCKS;
  const fromBlock = latest > lookback ? latest - lookback : 0n;

  const events: ActivityEvent[] = [];
  const depositedEvent = vaultAbi.find((x) => x.type === 'event' && x.name === 'Deposited');
  const withdrawnEvent = vaultAbi.find((x) => x.type === 'event' && x.name === 'Withdrawn');
  const rebalancedEvent = vaultAbi.find((x) => x.type === 'event' && x.name === 'Rebalanced');
  if (!depositedEvent || !withdrawnEvent || !rebalancedEvent) return events;

  for (let start = fromBlock; start <= latest; start += LOG_CHUNK_BLOCKS + 1n) {
    const end = start + LOG_CHUNK_BLOCKS > latest ? latest : start + LOG_CHUNK_BLOCKS;

    const [deposits, withdrawals, rebalances] = await Promise.all([
      user ? client.getLogs({ address: vault, event: depositedEvent, args: { user }, fromBlock: start, toBlock: end }) : Promise.resolve([]),
      user ? client.getLogs({ address: vault, event: withdrawnEvent, args: { user }, fromBlock: start, toBlock: end }) : Promise.resolve([]),
      client.getLogs({ address: vault, event: rebalancedEvent, fromBlock: start, toBlock: end }),
    ]);

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
  }

  events.sort((a, b) => (a.blockNumber === b.blockNumber ? b.logIndex - a.logIndex : a.blockNumber > b.blockNumber ? -1 : 1));
  return events;
}
