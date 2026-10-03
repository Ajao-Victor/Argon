import { formatUnits } from 'viem';

/** Signed percent with two decimals: "+0.50%", "−2.41%". Uses a true minus sign. */
export function formatPct(pct: number, opts: { sign?: boolean } = {}): string {
  const sign = opts.sign ?? true;
  const abs = Math.abs(pct).toFixed(2);
  if (pct < 0) return `−${abs}%`;
  if (pct > 0 && sign) return `+${abs}%`;
  return `${abs}%`;
}

export function formatUsd(v: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(v);
}

/** Token amount from bigint with at most `maxDecimals` shown, trailing zeros trimmed. */
export function formatToken(amount: bigint, decimals: number, maxDecimals = 6): string {
  const raw = formatUnits(amount, decimals);
  const [whole = '0', frac = ''] = raw.split('.');
  const trimmed = frac.slice(0, maxDecimals).replace(/0+$/, '');
  const wholeFmt = Number(whole).toLocaleString('en-US');
  return trimmed ? `${wholeFmt}.${trimmed}` : wholeFmt;
}

/** 0xdef0…91c2 */
export function truncateHex(hex: string, head = 6, tail = 4): string {
  if (hex.length <= head + tail + 2) return hex;
  return `${hex.slice(0, head)}…${hex.slice(-tail)}`;
}

export function truncateAddress(addr: string): string {
  return truncateHex(addr, 6, 4);
}

/** Gate percentages read with one decimal everywhere: 1 → "1.0%", 2.5 → "2.5%". */
export function formatGatePct(pct: number): string {
  return `${pct.toFixed(1)}%`;
}

