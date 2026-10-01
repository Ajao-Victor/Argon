import { describe, expect, it } from 'vitest';

import { fromBps, toBps } from './bps';

describe('bps', () => {
  it('rounds half-to-even like the agent', () => {
    expect(toBps(-2.41)).toBe(-241n);
    expect(toBps(0.5)).toBe(50n);
    expect(toBps(-2.419)).toBe(-242n);
    expect(toBps(1.999)).toBe(200n);
    expect(toBps(0.005)).toBe(0n); // 0.5 → even
    expect(toBps(0.015)).toBe(2n); // 1.5 → even
  });
  it('round-trips two decimals', () => {
    expect(fromBps(-241n)).toBe(-2.41);
  });
});
