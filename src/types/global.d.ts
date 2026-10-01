/**
 * EIP-1193 provider injected by browser wallets. Typed as `unknown` on purpose: the app
 * only ever checks for its presence; all calls go through wagmi connectors.
 */
interface Window {
  ethereum?: unknown;
}
