import { getAddress, isAddress, type Address } from 'viem';
import { z } from 'zod';

import type { HourId, PolicyAction } from './forecast';

/**
 * Per-user gate (handoff 2026-10-02, agent `POST /gates`, `GET /gates/{address}`).
 *
 * The model still publishes one 8-hour ETH price. A signer's gate decides whether that
 * wallet's capital is allowed into the Uniswap position each hour. Presets fix all six
 * bands; Custom sets the 1 h top (+) and bottom (−) in basis points and keeps 2 h / 8 h at
 * Balanced. Shapes and rules mirror the agent's `policy.resolve_gate` and `_gate_public`.
 */
export type GatePreset = 'safe' | 'balanced' | 'aggressive' | 'custom';
export type GatePresetNamed = Exclude<GatePreset, 'custom'>;

/** Top bands per preset, in bps; the bottom band is the negative of the top. */
export const PRESET_BANDS: Record<GatePresetNamed, { top1h: number; top2h: number; top8h: number }> = {
  safe: { top1h: 60, top2h: 120, top8h: 100 },
  balanced: { top1h: 100, top2h: 250, top8h: 200 },
  aggressive: { top1h: 200, top2h: 400, top8h: 350 },
};

/** Custom 1 h bands must sit within ±20 %, top positive, bottom negative. */
export const CUSTOM_BPS_LIMIT = 2000;

export interface GateBands {
  top1hBps: number;
  bottom1hBps: number;
  top2hBps: number;
  bottom2hBps: number;
  top8hBps: number;
  bottom8hBps: number;
}

export interface GateRow extends GateBands {
  address: Address;
  preset: GatePreset;
  inPosition: boolean;
  /** That wallet's own decision last hour; the forecast `action` stays the shared vault action. */
  lastAction: PolicyAction | null;
  lastHourId: HourId | null;
  issuedAt: number;
}

export interface GateRequest {
  address: Address;
  preset: GatePreset;
  topBps: number;
  bottomBps: number;
  issuedAt: number;
  signature: `0x${string}`;
}

// ---------------------------------------------------------------------------
// Pure policy mirrors (tested)
// ---------------------------------------------------------------------------

/** Resolve the six bands for a preset, or validate a custom 1 h band. Throws like the agent does. */
export function resolveGate(preset: string, topBps: number, bottomBps: number): { preset: GatePreset } & GateBands {
  const name = preset.trim().toLowerCase();
  if (name === 'safe' || name === 'balanced' || name === 'aggressive') {
    const b = PRESET_BANDS[name];
    return { preset: name, top1hBps: b.top1h, bottom1hBps: -b.top1h, top2hBps: b.top2h, bottom2hBps: -b.top2h, top8hBps: b.top8h, bottom8hBps: -b.top8h };
  }
  if (name !== 'custom') throw new Error('unknown preset');
  if (!Number.isInteger(topBps) || !Number.isInteger(bottomBps) || topBps <= 0 || topBps > CUSTOM_BPS_LIMIT || bottomBps >= 0 || bottomBps < -CUSTOM_BPS_LIMIT) {
    throw new Error('custom gate must be within ±20% and bottom must be negative');
  }
  const base = PRESET_BANDS.balanced;
  return { preset: 'custom', top1hBps: topBps, bottom1hBps: bottomBps, top2hBps: base.top2h, bottom2hBps: -base.top2h, top8hBps: base.top8h, bottom8hBps: -base.top8h };
}

/** The exact string the wallet signs (EIP-191 personal_sign). Address lowercased, preset lowercased. */
export function gateMessage(address: string, preset: string, topBps: number, bottomBps: number, issuedAt: number): string {
  return `argon-gate:${address.toLowerCase()}:${preset.trim().toLowerCase()}:${Math.trunc(topBps)}:${Math.trunc(bottomBps)}:${Math.trunc(issuedAt)}`;
}

/** The agent accepts issuedAt within two hours of its clock and strictly newer than the stored gate. */
export const GATE_ISSUED_AT_WINDOW_S = 2 * 3600;

// ---------------------------------------------------------------------------
// zod
// ---------------------------------------------------------------------------

const addressSchema = z
  .string()
  .refine((s) => isAddress(s), 'EVM address')
  .transform((s) => getAddress(s));
const bps = z.number().int().min(-CUSTOM_BPS_LIMIT).max(CUSTOM_BPS_LIMIT);
const hourIdSchema = z
  .number()
  .int()
  .nonnegative()
  .transform((n) => n as HourId);

export const gatePresetSchema = z.enum(['safe', 'balanced', 'aggressive', 'custom']);

export const gateRowSchema = z.object({
  address: addressSchema,
  preset: gatePresetSchema,
  top1hBps: bps,
  bottom1hBps: bps,
  top2hBps: bps,
  bottom2hBps: bps,
  top8hBps: bps,
  bottom8hBps: bps,
  inPosition: z.boolean(),
  lastAction: z.enum(['warmup', 'exit', 'enter', 'hold']).nullable(),
  lastHourId: hourIdSchema.nullable(),
  issuedAt: z.number().int().nonnegative(),
});

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const _row: Equals<z.infer<typeof gateRowSchema>, GateRow> = true;
void _row;
