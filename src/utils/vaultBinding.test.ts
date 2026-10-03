import { describe, expect, it } from 'vitest';

import { vaultBindingState } from './vaultBinding';

const NEW = '0xe0eb546A1F8dcEc7B124cF8fE253de34d54A6c61' as const;
const RETIRED = '0x9F844b4D1b28Be7413067f9d4fC08Bc276fd1C60' as const;

describe('vaultBindingState', () => {
  it('matches case-insensitively', () => {
    expect(vaultBindingState(NEW, NEW)).toBe('match');
    expect(vaultBindingState(NEW, NEW.toLowerCase() as typeof NEW)).toBe('match');
  });
  it('flags a build still bound to the retired vault', () => {
    expect(vaultBindingState(RETIRED, NEW)).toBe('mismatch');
  });
  it('is unknown until both sides are known', () => {
    expect(vaultBindingState(undefined, NEW)).toBe('unknown');
    expect(vaultBindingState(NEW, undefined)).toBe('unknown');
    expect(vaultBindingState(NEW, null)).toBe('unknown');
  });
});
