import { describe, expect, it } from 'vitest';

import { dateFromHourId, formatHourUtc, formatSettlementHour, hourIdFromDate, msUntilNextMinuteOne } from './hourId';

describe('hourId', () => {
  it('matches the spec example', () => {
    // 2026-09-16T16:00:00Z → 497104 (the spec §3.1 hourId 488888 is illustrative)
    expect(hourIdFromDate(new Date('2026-09-16T16:00:00.000Z'))).toBe(497104);
    expect(dateFromHourId(497104).toISOString()).toBe('2026-09-16T16:00:00.000Z');
  });
  it('floors within the hour', () => {
    expect(hourIdFromDate(new Date('2026-09-16T16:59:59.999Z'))).toBe(497104);
  });
  it('formats UTC', () => {
    expect(formatHourUtc(497104)).toBe('16:00 UTC');
  });
  it('schedules :01 in the next hour once past :01', () => {
    expect(msUntilNextMinuteOne(new Date('2026-09-16T16:00:30Z'))).toBe(30_000);
    expect(msUntilNextMinuteOne(new Date('2026-09-16T16:01:00Z'))).toBe(3_600_000);
    expect(msUntilNextMinuteOne(new Date('2026-09-16T16:30:00Z'))).toBe(31 * 60_000);
  });
});

describe('formatSettlementHour (the "Understandable hour")', () => {
  it('reads as the UTC hour plus a plain countdown', () => {
    // 497487 = 2026-10-02 15:00 UTC
    expect(formatSettlementHour(497487, 497481)).toBe('15:00 UTC (in 6h)');
    expect(formatSettlementHour(497487, 497487)).toBe('15:00 UTC (this hour)');
    expect(formatSettlementHour(497487, 497490)).toBe('15:00 UTC (settled 3h ago)');
  });
  it('defaults "now" to the current clock hour', () => {
    expect(formatSettlementHour(hourIdFromDate() + 8)).toBe(`${formatHourUtc(hourIdFromDate() + 8)} (in 8h)`);
  });
});
