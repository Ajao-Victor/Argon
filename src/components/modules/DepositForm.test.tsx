// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { parseEther, parseUnits } from 'viem';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const depositWrite = vi.fn(() => Promise.resolve());
const depositEthWrite = vi.fn(() => Promise.resolve());
const idle = { status: 'idle' as const };

vi.mock('@/hooks', () => ({
  useWallet: () => ({ address: '0x9642b6D1Db5D1A3B0A61a831099568bbCbC04D4E', isConnected: true, walletChainId: 42161 }),
  // WETH: 2 WETH in the wallet, zero allowance → the ERC-20 path must still ask for approval.
  useTokenAllowance: (_c: number, token: { symbol: string } | undefined) =>
    token ? { status: 'success', data: { balance: parseUnits('2', 18), allowance: 0n } } : { status: 'pending', data: undefined },
  // Native: exactly 1 ETH.
  useNativeBalance: (_c: number, user: string | undefined) => (user ? { status: 'success', data: parseEther('1') } : { status: 'pending', data: undefined }),
  useVaultParams: () => ({ status: 'success', data: { depositFeeBps: 10 } }),
  useDeposit: () => ({ state: idle, write: depositWrite, reset: () => undefined }),
  useDepositEth: () => ({ state: idle, write: depositEthWrite, reset: () => undefined }),
}));
vi.mock('@/stores/ui', () => ({ useUiStore: (sel: (s: { selectedChainId: number }) => unknown) => sel({ selectedChainId: 42161 }) }));
vi.mock('@/services/contracts', () => ({ getVault: () => ({ address: '0xe0eb546A1F8dcEc7B124cF8fE253de34d54A6c61', abi: [] }) }));
vi.mock('./ChainSwitcher', () => ({ ChainSwitcher: () => null }));
vi.mock('./TxStatus', () => ({ TxStatus: () => null, txBusy: () => false }));

import { DepositForm, MAX_GAS_NOTE } from './DepositForm';

beforeEach(() => {
  depositWrite.mockClear();
  depositEthWrite.mockClear();
});
afterEach(cleanup);

describe('DepositForm native ETH', () => {
  it('offers ETH beside WETH and USDC and shows the native balance when picked', () => {
    render(<DepositForm />);
    const assets = screen.getAllByRole('radio').map((b) => b.textContent);
    expect(assets).toEqual(['ETH', 'WETH', 'USDC']);
    expect(screen.getByRole('radio', { name: 'WETH' }).getAttribute('aria-checked')).toBe('true');

    fireEvent.click(screen.getByRole('radio', { name: 'ETH' }));
    expect(screen.getByRole('radio', { name: 'ETH' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('wallet 1 ETH')).toBeTruthy();
  });

  it('skips the approval step for ETH and calls depositETH with the amount as value', () => {
    render(<DepositForm />);
    // ERC-20 path still gates on allowance.
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '1' } });
    expect(screen.getByRole('button', { name: /approve WETH then deposit/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: 'ETH' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '0.5' } });
    expect(screen.queryByRole('button', { name: /approve/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'deposit ETH' }));
    expect(depositEthWrite).toHaveBeenCalledWith(parseEther('0.5'));
    expect(depositWrite).not.toHaveBeenCalled();
  });

  it('MAX on ETH leaves the 0.0005 ETH gas reserve and says so; MAX on WETH takes the full balance', () => {
    render(<DepositForm />);
    fireEvent.click(screen.getByRole('button', { name: 'max' }));
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('2');

    fireEvent.click(screen.getByRole('radio', { name: 'ETH' }));
    fireEvent.click(screen.getByRole('button', { name: 'max' }));
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('0.9995');
    expect(screen.getByText(`wallet 1 ETH · ${MAX_GAS_NOTE}`)).toBeTruthy();
    expect(MAX_GAS_NOTE).toBe('max leaves 0.0005 ETH for gas');
  });
});
