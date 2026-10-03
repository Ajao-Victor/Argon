// @vitest-environment jsdom
import type { KeyboardEvent } from 'react';
import { describe, expect, it } from 'vitest';

import { rovingRadioKeyDown } from './rovingRadio';

function group(checked: number): HTMLDivElement {
  const g = document.createElement('div');
  g.setAttribute('role', 'radiogroup');
  for (let i = 0; i < 3; i++) {
    const b = document.createElement('button');
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(i === checked));
    g.appendChild(b);
  }
  document.body.appendChild(g);
  return g;
}
function ev(key: string, target: HTMLElement): KeyboardEvent<HTMLElement> {
  let prevented = false;
  return { key, currentTarget: target, preventDefault: () => { prevented = true; }, get defaultPrevented() { return prevented; } } as unknown as KeyboardEvent<HTMLElement>;
}

describe('rovingRadioKeyDown', () => {
  it('moves right with wrap, left, and to the edges, focusing the new option', () => {
    const g = group(2);
    const picks: number[] = [];
    expect(rovingRadioKeyDown(ev('ArrowRight', g), (i) => picks.push(i))).toBe(true);
    expect(picks).toEqual([0]);
    expect(document.activeElement).toBe(g.children[0]);
    rovingRadioKeyDown(ev('ArrowLeft', g), (i) => picks.push(i));
    expect(picks).toEqual([0, 2]);
    rovingRadioKeyDown(ev('Home', g), (i) => picks.push(i));
    rovingRadioKeyDown(ev('End', g), (i) => picks.push(i));
    expect(picks).toEqual([0, 2, 0, 2]);
  });
  it('ignores unrelated keys', () => {
    const g = group(0);
    expect(rovingRadioKeyDown(ev('Enter', g), () => { throw new Error('should not select'); })).toBe(false);
  });
});
