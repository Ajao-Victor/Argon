import { describe, expect, it } from 'vitest';

import { gateChip, policyAction } from './policy';

describe('policyAction', () => {
  it('warmup wins', () => {
    expect(policyAction({ ethPctChange: 5, warmupComplete: false, currentlyInPool: false })).toBe('warmup');
  });
  it('exit at |pred| >= 2 in either direction', () => {
    expect(policyAction({ ethPctChange: -2.41, warmupComplete: true, currentlyInPool: true })).toBe('exit');
    expect(policyAction({ ethPctChange: 2, warmupComplete: true, currentlyInPool: false })).toBe('exit');
  });
  it('enter when idle, hold when in pool, inside the gate', () => {
    expect(policyAction({ ethPctChange: 0.5, warmupComplete: true, currentlyInPool: false })).toBe('enter');
    expect(policyAction({ ethPctChange: -1.99, warmupComplete: true, currentlyInPool: true })).toBe('hold');
  });
  it('gate chip', () => {
    expect(gateChip(1.99)).toBe('IN');
    expect(gateChip(-2)).toBe('OUT');
  });
});
