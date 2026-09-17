import { cookieStorage, createConfig, createStorage, fallback, http, injected } from 'wagmi';

import { ARB_RPC_DEFAULT, RH_RPC_DEFAULT, arbitrum, chains, robinhood } from './chains';

/**
 * wagmi config (doc/architecture.md §3.2).
 * Transports try the env RPC first, then the public default. Env values are
 * NEXT_PUBLIC_* and are inlined at build time; an empty value falls back.
 * WalletConnect is added in a later step once NEXT_PUBLIC_WALLETCONNECT_ID is wired.
 */
function rpcList(envValue: string | undefined, fallbackUrl: string): readonly [string, ...string[]] {
  const primary = envValue?.trim();
  if (primary && primary !== fallbackUrl) return [primary, fallbackUrl];
  return [fallbackUrl];
}

const arbRpcs = rpcList(process.env.NEXT_PUBLIC_ARB_RPC, ARB_RPC_DEFAULT);
const rhRpcs = rpcList(process.env.NEXT_PUBLIC_RH_RPC, RH_RPC_DEFAULT);

export const wagmiConfig = createConfig({
  chains,
  connectors: [injected()],
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
