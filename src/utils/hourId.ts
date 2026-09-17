import type { HourId } from '@/types/forecast';

/** hourId = floor(unixUtcSeconds / 3600). Do this once, reuse everywhere (spec §7). */
export function hourIdFromDate(d: Date = new Date()): HourId {
  return Math.floor(d.getTime() / 1000 / 3600) as HourId;
}

export function dateFromHourId(hourId: HourId | number): Date {
  return new Date(hourId * 3600 * 1000); // UTC
}

export function asHourId(n: number): HourId {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`invalid hourId ${n}`);
  return n as HourId;
}

/** "16:00 UTC" */
export function formatHourUtc(hourId: HourId | number): string {
  const d = dateFromHourId(hourId);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm} UTC`;
}

/** "2026-09-16 16:00 UTC" */
export function formatDateHourUtc(hourId: HourId | number): string {
  const d = dateFromHourId(hourId);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${da} ${formatHourUtc(hourId)}`;
}

/** Milliseconds until the next hh:01:00Z (the agent clock refetch, spec §3.3). */
export function msUntilNextMinuteOne(now: Date = new Date()): number {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours(),
    1,
    0,
    0,
  );
  const delta = next - now.getTime();
  return delta > 0 ? delta : delta + 3_600_000;
}

/** Milliseconds until the next :00 UTC boundary, for countdown displays. */
export function msUntilNextHour(now: Date = new Date()): number {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours() + 1,
    0,
    0,
    0,
  );
  return next - now.getTime();
}
