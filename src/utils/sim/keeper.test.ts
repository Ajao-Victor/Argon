import { describe, expect, it } from 'vitest';

import { keeperEnergy } from './keeper';

describe('keeperEnergy', () => {
  it('dormant when unreachable or no number', () => {
    expect(keeperEnergy({ ethPctChange: 5, warmupComplete: true, reachable: false }).state).toBe('dormant');
    expect(keeperEnergy({ ethPctChange: null, warmupComplete: true, reachable: true }).state).toBe('dormant');
  });
  it('warmup overrides energy', () => {
    expect(keeperEnergy({ ethPctChange: -2.41, warmupComplete: false, reachable: true }).state).toBe('warmup');
  });
  it('calm, charged, aggressive by k', () => {
    expect(keeperEnergy({ ethPctChange: 0.5, warmupComplete: true, reachable: true }).state).toBe('calm');
    expect(keeperEnergy({ ethPctChange: 1.4, warmupComplete: true, reachable: true }).state).toBe('charged');
    expect(keeperEnergy({ ethPctChange: -2.0, warmupComplete: true, reachable: true }).state).toBe('aggressive');
    expect(keeperEnergy({ ethPctChange: -2.9, warmupComplete: true, reachable: true }).arcs).toBe(3);
  });
  it('k clamps at 1.5', () => {
    expect(keeperEnergy({ ethPctChange: 40, warmupComplete: true, reachable: true }).k).toBe(1.5);
  });
});
