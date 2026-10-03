import { parseEther } from 'viem';
import { describe, expect, it } from 'vitest';

import { depositAssets, isNativeEth } from '@/services/tokens';

import { NATIVE_ETH_GAS_RESERVE_WEI, maxNativeEthDeposit } from './nativeEth';

describe('maxNativeEthDeposit', () => {
  it('leaves exactly 0.0005 ETH behind for gas', () => {
    expect(NATIVE_ETH_GAS_RESERVE_WEI).toBe(parseEther('0.0005'));
    expect(maxNativeEthDeposit(parseEther('1'))).toBe(parseEther('0.9995'));
    expect(maxNativeEthDeposit(parseEther('0.0006'))).toBe(parseEther('0.0001'));
  });
  it('returns 0n when the balance cannot cover the reserve', () => {
    expect(maxNativeEthDeposit(parseEther('0.0005'))).toBe(0n);
    expect(maxNativeEthDeposit(parseEther('0.0001'))).toBe(0n);
    expect(maxNativeEthDeposit(0n)).toBe(0n);
  });
  it('honours a custom reserve', () => {
    expect(maxNativeEthDeposit(parseEther('1'), parseEther('0.01'))).toBe(parseEther('0.99'));
  });
});

describe('depositAssets', () => {
  it('lists native ETH first, then the chain legs', () => {
    expect(depositAssets(42161).map((a) => a.symbol)).toEqual(['ETH', 'WETH', 'USDC']);
    expect(depositAssets(4663).map((a) => a.symbol)).toEqual(['ETH', 'WETH', 'USDG']);
    const [eth, weth] = depositAssets(42161);
    expect(eth && isNativeEth(eth)).toBe(true);
    expect(weth && isNativeEth(weth)).toBe(false);
  });
});
