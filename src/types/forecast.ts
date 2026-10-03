import { z } from 'zod';

/**
 * Web ↔ agent contract, aligned 1:1 with the live Heroku service
 * (https://argon-bd8888db5430.herokuapp.com, FastAPI, model `eth-1-2-8h-v1`).
 *
 * The model is three-horizon: it publishes the predicted ETH % change over 1 h, 2 h and
 * 8 h, and the vault's DualHorizonGate trips on any horizon crossing its own gate
 * (100 / 250 / 200 bps). `action` is computed server-side from that rule and the UI
 * renders it verbatim (ENGINEERING.md §0.5).
 *
 * Derived view: `ethPctChange` and `gateBps` are the 8 h headline horizon, produced by a
 * zod transform so the dashboard's hero, avatar, and reconciliation keep one number to
 * anchor on. The three-horizon fields are canonical; the derived pair is convenience.
 *
 * Every payload is validated here at the boundary. Extra fields are ignored; a missing
 * or mistyped field fails validation and the UI falls back to the registry (never a
 * fabricated number, ENGINEERING.md §0.6).
 */

/** floor(unixUtcSeconds / 3600). Branded so it is never confused with a plain number. */
export type HourId = number & { readonly __brand: 'HourId' };

export type Hex = `0x${string}`;

export type PolicyAction = 'warmup' | 'exit' | 'enter' | 'hold';
export type ForecastStatus = 'pending' | 'matured';
export type Horizon = '1h' | '2h' | '8h';
/**
 * Where a horizon's number came from. Known values today: 'lgbm' (the model),
 * 'persistence' (carry-forward baseline), 'catchup' (clock catching up after a stall).
 * Typed as string on purpose: a new source label must never invalidate a live row.
 */
export type HorizonSource = string;
/** On-chain pool status as the agent last read it: 0 idle, 1 in pool, null unknown. */
export type ApiPoolStatus = 0 | 1 | null;

export interface Forecast {
  hourId: HourId;
  targetHourId: HourId;
  submittedAt: string;
  ethPct1h: number;
  ethPct2h: number;
  ethPct8h: number;
  ethPct1hSource: HorizonSource;
  ethPct2hSource: HorizonSource;
  ethPct8hSource: HorizonSource;
  spotUsd: number | null;
  modelId: string;
  status: ForecastStatus;
  realizedPctChange: number | null;
  realizedSpotUsd: number | null;
  action: PolicyAction;
  gate1hBps: number;
  gate2hBps: number;
  gate8hBps: number;
  warmupComplete: boolean;
  forecastHash: Hex | null;
  /** Keeper `submit` / `rebalance` tx on Arbitrum One. */
  txHash: Hex | null;
  /** Keeper tx on Robinhood Chain. */
  txHashRh: Hex | null;
  /** Free-text keeper outcome per chain, e.g. "warmup-skip" or a tx hash. */
  rebalanceTx: string | null;
  rebalanceTxRh: string | null;
  poolStatusArb: ApiPoolStatus;
  poolStatusRh: ApiPoolStatus;
  trippedHorizons: Horizon[];
  /** Predicted ETH/USD at the 8 h target hour (added by the agent 2026-10-02). */
  predEthUsd8h?: number | null | undefined;
  /** Predicted ETH/USD one hour ahead. */
  expectedEthUsd1h?: number | null | undefined;
  /** Close of the hourly bar the model consumed. */
  barCloseUsd?: number | null | undefined;
  barTime?: string | null | undefined;
  barHourId?: HourId | null | undefined;
  /** True when the row was produced by the live clock (not a backfill). */
  live?: boolean | undefined;
  /** Derived: the 8 h headline horizon (= ethPct8h). */
  ethPctChange: number;
  /** Derived: the 8 h gate in bps (= gate8hBps). */
  gateBps: number;
}

export interface AgentStatus {
  ok: boolean;
  warmupComplete: boolean;
  hoursUntilFirstDecision: number;
  gate1hBps: number;
  gate2hBps: number;
  gate8hBps: number;
  lastHourId: HourId | null;
  currentHourId: HourId;
  modelId: string;
  modelLoaded: boolean;
  /** Heroku DRY_RUN flag as the agent reports it (string or boolean). True = keeper is not sending txs. */
  dryRun: boolean;
  database?: string | undefined;
  liveForecast?: boolean | undefined;
  /** Rows the registry holds vs rows Postgres holds; the gap is what dry-run withholds from chain. */
  onchainForecastCount?: number | undefined;
  dbForecastCount?: number | undefined;
  /** Keeper's scheduled pause around high-impact US releases (added 2026-10-03): rebalance accepts EXIT only while active. */
  newsPause?: NewsPause | undefined;
  /** Derived: the 8 h gate in bps (= gate8hBps). */
  gateBps: number;
}

export interface Health {
  ok: boolean;
  modelLoaded: boolean;
  database?: string | undefined;
  version?: string | undefined;
}

export interface ForecastList {
  items: Forecast[];
}

export type AgentErrorCode = 'MODEL_NOT_LOADED' | 'NOT_FOUND' | 'BAD_REQUEST' | 'CONFLICT' | 'INTERNAL' | 'NETWORK' | 'TIMEOUT' | 'INVALID' | 'OFFLINE';

/** FastAPI error envelope: `{ "detail": "unknown hourId" }` (422 validation errors arrive as an array and are joined). */
export interface AgentErrorBody {
  detail: string;
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

// A percent change below -100 is impossible; above +1000 in 8 h is corruption, not a forecast.
const pctSchema = z.number().finite().gt(-100).lt(1000);
const bpsGateSchema = z.number().int().nonnegative().max(10_000);

export const policyActionSchema = z.enum(['warmup', 'exit', 'enter', 'hold']);
export const forecastStatusSchema = z.enum(['pending', 'matured']);
export const horizonSchema = z.enum(['1h', '2h', '8h']);
export const horizonSourceSchema = z.string().min(1).max(32);
const apiPoolStatusSchema = z.union([z.literal(0), z.literal(1)]).nullable();

export const forecastSchema = z
  .object({
    hourId: hourIdSchema,
    targetHourId: hourIdSchema,
    submittedAt: z.string().datetime({ offset: true }),
    ethPct1h: pctSchema,
    ethPct2h: pctSchema,
    ethPct8h: pctSchema,
    ethPct1hSource: horizonSourceSchema,
    ethPct2hSource: horizonSourceSchema,
    ethPct8hSource: horizonSourceSchema,
    spotUsd: z.number().finite().positive().nullable(),
    modelId: z.string().min(1).max(64),
    status: forecastStatusSchema,
    realizedPctChange: pctSchema.nullable(),
    realizedSpotUsd: z.number().finite().positive().nullable(),
    action: policyActionSchema,
    gate1hBps: bpsGateSchema,
    gate2hBps: bpsGateSchema,
    gate8hBps: bpsGateSchema,
    warmupComplete: z.boolean(),
    forecastHash: hash32Schema.nullable(),
    txHash: hash32Schema.nullable(),
    txHashRh: hash32Schema.nullable(),
    rebalanceTx: z.string().max(128).nullable(),
    rebalanceTxRh: z.string().max(128).nullable(),
    poolStatusArb: apiPoolStatusSchema,
    poolStatusRh: apiPoolStatusSchema,
    trippedHorizons: z.array(horizonSchema).max(3),
    predEthUsd8h: z.number().finite().positive().nullable().optional(),
    expectedEthUsd1h: z.number().finite().positive().nullable().optional(),
    barCloseUsd: z.number().finite().positive().nullable().optional(),
    barTime: z.string().datetime({ offset: true }).nullable().optional(),
    barHourId: hourIdSchema.nullable().optional(),
    live: z.boolean().optional(),
  })
  .refine((f) => f.targetHourId === f.hourId + 8, { message: 'targetHourId must equal hourId + 8', path: ['targetHourId'] })
  .refine((f) => f.warmupComplete || f.action === 'warmup', { message: 'action must be warmup while warmupComplete is false', path: ['action'] })
  .transform((f) => ({ ...f, ethPctChange: f.ethPct8h, gateBps: f.gate8hBps }));

/** Heroku reports DRY_RUN as the string "true" / "false"; accept a boolean too. */
const dryRunSchema = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => (typeof v === 'boolean' ? v : v === undefined ? true : v.trim().toLowerCase() === 'true'));

/** One scheduled window: exit at `exitAt` (one hour before the release), no entries until `resumesAt`. */
export interface NewsPauseWindow {
  fromHourId: HourId;
  untilHourId: HourId;
  exitAt: string;
  resumesAt: string;
  events: { title: string; at: string; source?: string | undefined }[];
}
export interface NewsPause {
  active: boolean;
  current: NewsPauseWindow | null;
  next: NewsPauseWindow | null;
  rule: string;
}

const newsPauseWindowSchema = z.object({
  fromHourId: hourIdSchema,
  untilHourId: hourIdSchema,
  exitAt: z.string().min(1),
  resumesAt: z.string().min(1),
  events: z.array(z.object({ title: z.string().min(1).max(120), at: z.string().min(1), source: z.string().max(64).optional() })),
});
export const newsPauseSchema = z.object({
  active: z.boolean(),
  current: newsPauseWindowSchema.nullable(),
  next: newsPauseWindowSchema.nullable(),
  rule: z.string().max(200),
});

export const agentStatusSchema = z
  .object({
    ok: z.boolean(),
    warmupComplete: z.boolean(),
    hoursUntilFirstDecision: z.number().int().nonnegative().max(9),
    gate1hBps: bpsGateSchema,
    gate2hBps: bpsGateSchema,
    gate8hBps: bpsGateSchema,
    lastHourId: hourIdSchema.nullable(),
    currentHourId: hourIdSchema,
    modelId: z.string().min(1).max(64),
    modelLoaded: z.boolean(),
    dryRun: dryRunSchema,
    database: z.string().max(64).optional(),
    liveForecast: z.boolean().optional(),
    onchainForecastCount: z.number().int().nonnegative().optional(),
    dbForecastCount: z.number().int().nonnegative().optional(),
    // A malformed pause object must never invalidate /status: fall back to "not reported".
    newsPause: newsPauseSchema.optional().catch(undefined),
  })
  .transform((s) => ({ ...s, gateBps: s.gate8hBps }));

export const healthSchema = z.object({
  ok: z.boolean(),
  modelLoaded: z.boolean(),
  database: z.string().max(64).optional(),
  version: z.string().max(64).optional(),
});

export const forecastListSchema = z.object({
  items: z.array(forecastSchema).max(500),
});

export const agentErrorBodySchema = z.object({
  detail: z.union([z.string().max(500), z.array(z.object({ msg: z.string(), loc: z.array(z.union([z.string(), z.number()])).optional() })).transform((a) => a.map((i) => `${(i.loc ?? []).join('.')}: ${i.msg}`).join('; '))]),
});

// Compile-time guarantee that the schemas and the interfaces agree.
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const _forecastMatches: Equals<z.infer<typeof forecastSchema>, Forecast> = true;
const _statusMatches: Equals<z.infer<typeof agentStatusSchema>, AgentStatus> = true;
const _healthMatches: Equals<z.infer<typeof healthSchema>, Health> = true;
const _listMatches: Equals<z.infer<typeof forecastListSchema>, ForecastList> = true;
const _errorMatches: Equals<z.infer<typeof agentErrorBodySchema>, AgentErrorBody> = true;
void _forecastMatches;
void _statusMatches;
void _healthMatches;
void _listMatches;
void _errorMatches;
