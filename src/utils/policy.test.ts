import { describe, expect, it } from 'vitest';

import { dualHorizonAction, gateChip, policyAction, trippedHorizons } from './policy';

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

describe('dualHorizonAction (mirror of DualHorizonGate.sol)', () => {
  const base = { ethPct1h: 0.2, ethPct2h: 0.5, ethPct8h: 0.9, warmupComplete: true, currentlyInPool: false };
  it('warmup wins', () => {
    expect(dualHorizonAction({ ...base, warmupComplete: false })).toBe('warmup');
  });
  it('1h or 2h outside forces EXIT even when in pool', () => {
    expect(dualHorizonAction({ ...base, ethPct1h: -1.0, currentlyInPool: true })).toBe('exit');
    expect(dualHorizonAction({ ...base, ethPct2h: 2.5, currentlyInPool: true })).toBe('exit');
  });
  it('in pool and inside the short gates holds, even if 8h is outside', () => {
    expect(dualHorizonAction({ ...base, ethPct8h: 3, currentlyInPool: true })).toBe('hold');
  });
  it('idle enters only when all three are inside; 8h outside alone stays flat', () => {
    expect(dualHorizonAction(base)).toBe('enter');
    expect(dualHorizonAction({ ...base, ethPct8h: 2.0 })).toBe('exit');
  });
  it('tripped horizons in agent order', () => {
    expect(trippedHorizons({ ethPct1h: 1.0, ethPct2h: 0, ethPct8h: -2.5 })).toEqual(['1h', '8h']);
    expect(trippedHorizons({ ethPct1h: 0, ethPct2h: 0, ethPct8h: 0 })).toEqual([]);
  });
});
