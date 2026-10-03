import { parseEther } from 'viem';

/**
 * Native ETH deposits (`ArgonVault.depositETH()`, payable). The whole wallet balance can
 * never be sent: the same balance has to pay the gas for the deposit itself, so MAX leaves a
 * fixed reserve behind. 0.0005 ETH covers a vault deposit on Arbitrum One and Robinhood Chain
 * with a wide margin at current L2 fees.
 */
export const NATIVE_ETH_GAS_RESERVE_WEI: bigint = parseEther('0.0005');

/** The largest native deposit that still leaves `gasReserveWei` behind; 0n when the balance cannot cover the reserve. */
export function maxNativeEthDeposit(balanceWei: bigint, gasReserveWei: bigint = NATIVE_ETH_GAS_RESERVE_WEI): bigint {
  return balanceWei <= gasReserveWei ? 0n : balanceWei - gasReserveWei;
}
