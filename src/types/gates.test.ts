import { describe, expect, it } from 'vitest';

import { CUSTOM_BPS_LIMIT, PRESET_BANDS, gateMessage, gateRowSchema, resolveGate } from './gates';

describe('resolveGate (mirror of agent policy.resolve_gate)', () => {
  it('presets fix all six bands, bottom = -top', () => {
    expect(resolveGate('safe', 0, 0)).toEqual({ preset: 'safe', top1hBps: 60, bottom1hBps: -60, top2hBps: 120, bottom2hBps: -120, top8hBps: 100, bottom8hBps: -100 });
    expect(resolveGate('Balanced', 1, 1).top2hBps).toBe(250);
    expect(resolveGate('aggressive', 0, 0)).toMatchObject({ top1hBps: 200, top2hBps: 400, top8hBps: 350 });
  });
  it('custom keeps 2h / 8h at Balanced and validates the 1h band', () => {
    expect(resolveGate('custom', 150, -75)).toEqual({ preset: 'custom', top1hBps: 150, bottom1hBps: -75, top2hBps: 250, bottom2hBps: -250, top8hBps: 200, bottom8hBps: -200 });
    expect(() => resolveGate('custom', 0, -50)).toThrow();
    expect(() => resolveGate('custom', 50, 10)).toThrow();
    expect(() => resolveGate('custom', CUSTOM_BPS_LIMIT + 1, -50)).toThrow();
    expect(() => resolveGate('custom', 50, -(CUSTOM_BPS_LIMIT + 1))).toThrow();
    expect(() => resolveGate('custom', 12.5, -50)).toThrow();
  });
  it('rejects unknown presets', () => {
    expect(() => resolveGate('yolo', 1, -1)).toThrow('unknown preset');
  });
  it('preset table matches the handoff', () => {
    expect(PRESET_BANDS.safe).toEqual({ top1h: 60, top2h: 120, top8h: 100 });
    expect(PRESET_BANDS.balanced).toEqual({ top1h: 100, top2h: 250, top8h: 200 });
    expect(PRESET_BANDS.aggressive).toEqual({ top1h: 200, top2h: 400, top8h: 350 });
  });
});

describe('gateMessage', () => {
  it('builds the exact signed string from the handoff with a lowercased address', () => {
    expect(gateMessage('0x9642b6D1Db5D1A3B0A61a831099568bbCbC04D4E', 'safe', 60, -60, 1710000000)).toBe('argon-gate:0x9642b6d1db5d1a3b0a61a831099568bbcbc04d4e:safe:60:-60:1710000000');
    expect(gateMessage('0xAbC', ' Custom ', 150.9, -75.2, 1710000000.7)).toBe('argon-gate:0xabc:custom:150:-75:1710000000');
  });
});

describe('gateRowSchema (GET /gates/{address})', () => {
  const row = { address: '0x9642b6d1db5d1a3b0a61a831099568bbcbc04d4e', preset: 'balanced', top1hBps: 100, bottom1hBps: -100, top2hBps: 250, bottom2hBps: -250, top8hBps: 200, bottom8hBps: -200, inPosition: false, lastAction: null, lastHourId: null, issuedAt: 1759400000 };
  it('accepts the agent row and checksums the address', () => {
    const r = gateRowSchema.safeParse(row);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.address).toBe('0x9642b6D1Db5D1A3B0A61a831099568bbCbC04D4E');
  });
  it('accepts a decided row and rejects an unknown action', () => {
    expect(gateRowSchema.safeParse({ ...row, lastAction: 'exit', lastHourId: 497482, inPosition: true }).success).toBe(true);
    expect(gateRowSchema.safeParse({ ...row, lastAction: 'yolo' }).success).toBe(false);
  });
});
