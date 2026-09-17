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

export type AgentErrorCode = 'MODEL_NOT_LOADED' | 'NOT_FOUND' | 'INTERNAL' | 'NETWORK' | 'TIMEOUT' | 'INVALID';

export interface AgentErrorBody {
  ok: false;
  error: string;
  code: 'MODEL_NOT_LOADED' | 'NOT_FOUND' | 'INTERNAL';
}

// ---------------------------------------------------------------------------
// zod schemas (runtime validation at the boundary, CLAUDE.md §3.1)
// ---------------------------------------------------------------------------

const hourIdSchema = z
  .number()
  .int()
  .nonnegative()
  .transform((n) => n as HourId);

const hexSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]*$/, 'hex string')
  .transform((s) => s as Hex);

export const policyActionSchema = z.enum(['warmup', 'exit', 'enter', 'hold']);
export const forecastStatusSchema = z.enum(['pending', 'matured']);

export const forecastSchema = z.object({
  hourId: hourIdSchema,
  targetHourId: hourIdSchema,
  submittedAt: z.string().datetime({ offset: true }),
  horizonHours: z.literal(8),
  ethPctChange: z.number().finite(),
  ethLogReturn: z.number().finite(),
  spotUsd: z.number().finite().nonnegative(),
  modelId: z.string().min(1),
  status: forecastStatusSchema,
  realizedPctChange: z.number().finite().nullable(),
  realizedSpotUsd: z.number().finite().nullable(),
  action: policyActionSchema,
  gateBps: z.number().int().nonnegative(),
  warmupComplete: z.boolean(),
  txHash: hexSchema.nullable(),
  forecastHash: hexSchema.nullable(),
});

export const agentStatusSchema = z.object({
  ok: z.boolean(),
  warmupComplete: z.boolean(),
  hoursUntilFirstDecision: z.number().int().nonnegative(),
  gateBps: z.number().int().nonnegative(),
  lastHourId: hourIdSchema,
  modelId: z.string().min(1),
  modelLoaded: z.boolean(),
  lastError: z.string().nullable().optional(),
});

export const healthSchema = z.object({
  ok: z.boolean(),
  modelLoaded: z.boolean(),
  version: z.string().optional(),
});

export const forecastListSchema = z.object({
  items: z.array(forecastSchema),
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
