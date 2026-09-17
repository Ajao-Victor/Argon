import { describe, expect, it } from 'vitest';

import { fromBps, toBps } from './bps';

describe('bps', () => {
  it('truncates toward zero', () => {
    expect(toBps(-2.41)).toBe(-241n);
    expect(toBps(0.5)).toBe(50n);
    expect(toBps(-2.419)).toBe(-241n);
    expect(toBps(1.999)).toBe(199n);
  });
  it('round-trips two decimals', () => {
    expect(fromBps(-241n)).toBe(-2.41);
  });
});
