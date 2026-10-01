import { cookieStorage, createConfig, createStorage, fallback, http } from 'wagmi';
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors';

import { ARB_RPC_DEFAULT, RH_RPC_DEFAULT, arbitrum, chains, robinhood } from './chains';

/**
 * wagmi config (doc/architecture.md §3.2).
 *
 * Connectors, in the order the picker lists them:
 *   1. injected   — any EIP-1193 browser wallet. With multiInjectedProviderDiscovery
 *                   (EIP-6963) MetaMask, Rabby, Phantom, Brave and friends are each
 *                   discovered as their own connector instead of fighting over
 *                   window.ethereum. shimDisconnect keeps "disconnected" sticky across
 *                   reloads for wallets that cannot truly disconnect.
 *   2. coinbase   — Coinbase Wallet / Smart Wallet. Works with no extension and on mobile
 *                   (QR or deep link), and needs no API key, so a visitor can always connect.
 *   3. walletConnect — added only when NEXT_PUBLIC_WALLETCONNECT_ID is set; QR modal for
 *                   every other mobile wallet.
 *
 * Transports try the env RPC first, then the public default. Env values are NEXT_PUBLIC_*
 * and inlined at build time; an empty value falls back.
 */
function rpcList(envValue: string | undefined, fallbackUrl: string): readonly [string, ...string[]] {
  const primary = envValue?.trim();
  if (primary && primary !== fallbackUrl) return [primary, fallbackUrl];
  return [fallbackUrl];
}

const arbRpcs = rpcList(process.env.NEXT_PUBLIC_ARB_RPC, ARB_RPC_DEFAULT);
const rhRpcs = rpcList(process.env.NEXT_PUBLIC_RH_RPC, RH_RPC_DEFAULT);
const walletConnectId = (process.env.NEXT_PUBLIC_WALLETCONNECT_ID ?? '').trim();

export const APP_NAME = 'Argon Vault';
export const APP_URL = 'https://argon.vercel.app';

export const wagmiConfig = createConfig({
  chains,
  multiInjectedProviderDiscovery: true,
  connectors: [
    injected({ shimDisconnect: true }),
    coinbaseWallet({ appName: APP_NAME, preference: { options: 'all' } }),
    ...(walletConnectId
      ? [
          walletConnect({
            projectId: walletConnectId,
            showQrModal: true,
            metadata: { name: APP_NAME, description: 'Hourly ETH forecast-gated Uniswap LP vault', url: APP_URL, icons: [] },
          }),
        ]
      : []),
  ],
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
  transports: {
    [arbitrum.id]: fallback(arbRpcs.map((url) => http(url, { batch: true }))),
    [robinhood.id]: fallback(rhRpcs.map((url) => http(url, { batch: true }))),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
