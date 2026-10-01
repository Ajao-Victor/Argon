import { describe, expect, it } from 'vitest';

import type { HourId } from '@/types/forecast';

import { forecastLagHours, isForecastStale } from './agentStaleness';

const h = (n: number) => n as HourId;

describe('forecast staleness', () => {
  it('lag is current minus last', () => {
    expect(forecastLagHours({ currentHourId: h(497463), lastHourId: h(497434) })).toBe(29);
  });
  it('no last print counts as no lag (nothing to be stale about yet)', () => {
    expect(forecastLagHours({ currentHourId: h(10), lastHourId: null })).toBe(0);
    expect(isForecastStale({ currentHourId: h(10), lastHourId: null })).toBe(false);
  });
  it('0 and 1 hour are fresh; 2 hours is stale', () => {
    expect(isForecastStale({ currentHourId: h(100), lastHourId: h(100) })).toBe(false);
    expect(isForecastStale({ currentHourId: h(100), lastHourId: h(99) })).toBe(false);
    expect(isForecastStale({ currentHourId: h(100), lastHourId: h(98) })).toBe(true);
  });
  it('the live capture (last 497434, current 497463) is stale', () => {
    expect(isForecastStale({ currentHourId: h(497463), lastHourId: h(497434) })).toBe(true);
  });
});
