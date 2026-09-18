import { z } from 'zod';

/**
 * Web ↔ agent contract (doc/agents.md §4). This is the only place the shape is defined.
 * The partner's service must emit exactly these fields. Extra fields are ignored.
 * Missing or mistyped fields fail validation and trigger the fallback path.
 */

/** floor(unixUtcSeconds / 3600). Branded so it is never confused with a plain number. */
export type HourId = number & { readonly __brand: 'HourId' };

export type Hex = `0x${string}`;

export type PolicyAction = 'warmup' | 'exit' | 'enter' | 'hold';
export type ForecastStatus = 'pending' | 'matured';

export interface Forecast {
  hourId: HourId;
  targetHourId: HourId;
  submittedAt: string;
  horizonHours: 8;
  ethPctChange: number;
  ethLogReturn: number;
  spotUsd: number;
  modelId: string;
  status: ForecastStatus;
  realizedPctChange: number | null;
  realizedSpotUsd: number | null;
  action: PolicyAction;
  gateBps: number;
  warmupComplete: boolean;
  txHash: Hex | null;
  forecastHash: Hex | null;
}

export interface AgentStatus {
  ok: boolean;
  warmupComplete: boolean;
  hoursUntilFirstDecision: number;
  gateBps: number;
  lastHourId: HourId;
  modelId: string;
  modelLoaded: boolean;
  lastError?: string | null | undefined;
}

export interface Health {
  ok: boolean;
  modelLoaded: boolean;
  version?: string | undefined;
}

export interface ForecastList {
  items: Forecast[];
}

export type AgentErrorCode = 'MODEL_NOT_LOADED' | 'NOT_FOUND' | 'INTERNAL' | 'NETWORK' | 'TIMEOUT' | 'INVALID' | 'OFFLINE';

export interface AgentErrorBody {
  ok: false;
  error: string;
  code: 'MODEL_NOT_LOADED' | 'NOT_FOUND' | 'INTERNAL';
}

// ---------------------------------------------------------------------------
// zod schemas (runtime validation at the boundary, ENGINEERING.md §3.1)
// ---------------------------------------------------------------------------

const hourIdSchema = z
  .number()
  .int()
  .nonnegative()
  .transform((n) => n as HourId);

/** Exactly 32 bytes: tx hashes and bytes32 forecast hashes. Nothing shorter or longer passes. */
const hash32Schema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, '32-byte hex hash')
  .transform((s) => s as Hex);

export const policyActionSchema = z.enum(['warmup', 'exit', 'enter', 'hold']);
export const forecastStatusSchema = z.enum(['pending', 'matured']);

// A percent change below -100 is impossible; above +1000 in 8 h is corruption, not a forecast.
const pctSchema = z.number().finite().gt(-100).lt(1000);

export const forecastSchema = z
  .object({
    hourId: hourIdSchema,
    targetHourId: hourIdSchema,
    submittedAt: z.string().datetime({ offset: true }),
    horizonHours: z.literal(8),
    ethPctChange: pctSchema,
    ethLogReturn: z.number().finite().gt(-10).lt(10),
    spotUsd: z.number().finite().positive(),
    modelId: z.string().min(1).max(64),
    status: forecastStatusSchema,
    realizedPctChange: pctSchema.nullable(),
    realizedSpotUsd: z.number().finite().positive().nullable(),
    action: policyActionSchema,
    gateBps: z.number().int().nonnegative().max(10_000),
    warmupComplete: z.boolean(),
    txHash: hash32Schema.nullable(),
    forecastHash: hash32Schema.nullable(),
  })
  .refine((f) => f.targetHourId === f.hourId + f.horizonHours, { message: 'targetHourId must equal hourId + horizonHours', path: ['targetHourId'] })
  .refine((f) => f.warmupComplete || f.action === 'warmup', { message: 'action must be warmup while warmupComplete is false', path: ['action'] });

export const agentStatusSchema = z.object({
  ok: z.boolean(),
  warmupComplete: z.boolean(),
  hoursUntilFirstDecision: z.number().int().nonnegative().max(8),
  gateBps: z.number().int().nonnegative().max(10_000),
  lastHourId: hourIdSchema,
  modelId: z.string().min(1).max(64),
  modelLoaded: z.boolean(),
  lastError: z.string().max(500).nullable().optional(),
});

export const healthSchema = z.object({
  ok: z.boolean(),
  modelLoaded: z.boolean(),
  version: z.string().max(64).optional(),
});

export const forecastListSchema = z.object({
  items: z.array(forecastSchema).max(500),
});

export const agentErrorBodySchema = z.object({
  ok: z.literal(false),
  error: z.string(),
  code: z.enum(['MODEL_NOT_LOADED', 'NOT_FOUND', 'INTERNAL']),
});

// Compile-time guarantee that the schemas and the interfaces agree.
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const _forecastMatches: Equals<z.infer<typeof forecastSchema>, Forecast> = true;
const _statusMatches: Equals<z.infer<typeof agentStatusSchema>, AgentStatus> = true;
const _healthMatches: Equals<z.infer<typeof healthSchema>, Health> = true;
const _listMatches: Equals<z.infer<typeof forecastListSchema>, ForecastList> = true;
void _forecastMatches;
void _statusMatches;
void _healthMatches;
void _listMatches;
