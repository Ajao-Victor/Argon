import { encodeAbiParameters, keccak256, stringToBytes, type Hex } from 'viem';

/**
 * Client-side recomputation of the on-chain forecast hash.
 *
 * Mirrors `InferenceRegistry.computeHash` and the agent's `hashing.forecast_hash`:
 *
 *   forecastHash = keccak256(abi.encode(uint64 hourId, int256 pct1hBps, int256 pct2hBps, int256 pct8hBps, bytes32 modelId))
 *   modelId      = keccak256(utf8(modelIdText))          e.g. "eth-1-2-8h-v1"
 *   pctBps       = roundHalfEven(pct * 100)              the agent uses Python round(), which is banker's rounding
 *
 * A judge can therefore verify, in the browser, that the hash the API publishes is
 * exactly the hash of the three numbers it publishes, and that the registry stores
 * the same bytes. No trust in the server is required for that check.
 */
export function modelIdBytes32(modelIdText: string): Hex {
  return keccak256(stringToBytes(modelIdText));
}

/** Python's round(): ties go to the nearest even integer. Math.round would send -0.5 to -0. */
export function roundHalfEven(x: number): number {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

/** Percent → signed bps exactly as the agent encodes it. -2.41 → -241. */
export function pctToBpsAgent(pct: number): bigint {
  return BigInt(roundHalfEven(pct * 100));
}

export interface HashInputs {
  hourId: number;
  ethPct1h: number;
  ethPct2h: number;
  ethPct8h: number;
  modelId: string;
}

export function computeForecastHash(input: HashInputs): Hex {
  const encoded = encodeAbiParameters(
    [{ type: 'uint64' }, { type: 'int256' }, { type: 'int256' }, { type: 'int256' }, { type: 'bytes32' }],
    [BigInt(input.hourId), pctToBpsAgent(input.ethPct1h), pctToBpsAgent(input.ethPct2h), pctToBpsAgent(input.ethPct8h), modelIdBytes32(input.modelId)],
  );
  return keccak256(encoded);
}

/** True when the published hash equals the hash of the published numbers. */
export function verifyForecastHash(row: HashInputs & { forecastHash: string | null }): boolean {
  if (!row.forecastHash) return false;
  return computeForecastHash(row).toLowerCase() === row.forecastHash.toLowerCase();
}
