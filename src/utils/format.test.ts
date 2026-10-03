import { describe, expect, it } from 'vitest';

import { formatGatePct } from './format';

describe('formatGatePct', () => {
  it('prints one decimal for every gate', () => {
    expect(formatGatePct(1)).toBe('1.0%');
    expect(formatGatePct(2.5)).toBe('2.5%');
    expect(formatGatePct(2)).toBe('2.0%');
  });
});
