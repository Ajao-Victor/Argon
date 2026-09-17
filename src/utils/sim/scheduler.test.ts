import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FRAME_BUDGET_MS, _resetSchedulerForTests, schedulerStats, subscribeFrame } from './scheduler';

/**
 * Drives the scheduler with a fake requestAnimationFrame and a fake clock so we
 * can prove: (1) it only advances through rAF, (2) a frame over the 4 ms budget
 * drops exactly the next frame, (3) unsubscribe cancels the loop.
 */
let queue: Array<(t: number) => void> = [];
let now = 0;
let cancelled = 0;

function flushFrame(advanceMs = 16) {
  now += advanceMs;
  const q = queue;
  queue = [];
  for (const cb of q) cb(now);
}

beforeEach(() => {
  queue = [];
  now = 0;
  cancelled = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
    queue.push(cb);
    return queue.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    cancelled++;
  });
  vi.stubGlobal('document', { hidden: false });
  let perf = 0;
  vi.stubGlobal('performance', {
    now: () => perf,
    _advance: (ms: number) => {
      perf += ms;
    },
  });
  _resetSchedulerForTests(); // cancels any stale frame from the previous test …
  cancelled = 0; // … so the counter starts clean for this one
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('scheduler', () => {
  it('runs subscribers only through requestAnimationFrame', () => {
    const calls: number[] = [];
    subscribeFrame((dt) => calls.push(dt));
    expect(calls).toHaveLength(0);
    flushFrame();
    flushFrame();
    expect(calls).toHaveLength(2);
    expect(calls[1]).toBeCloseTo(16, 0);
  });

  it('drops the next frame when a frame exceeds the budget', () => {
    let runs = 0;
    const perf = performance as unknown as { _advance: (ms: number) => void };
    subscribeFrame(() => {
      runs++;
      if (runs === 1) perf._advance(FRAME_BUDGET_MS + 1); // expensive first frame
    });
    flushFrame(); // frame 1: expensive
    flushFrame(); // frame 2: dropped
    flushFrame(); // frame 3: runs
    expect(runs).toBe(2);
    expect(schedulerStats().dropped).toBe(1);
  });

  it('cancels the loop when the last subscriber leaves', () => {
    const unsub = subscribeFrame(() => {});
    flushFrame();
    unsub();
    expect(cancelled).toBe(1);
    expect(schedulerStats().subscribers).toBe(0);
  });

  it('does not run subscribers while hidden', () => {
    let runs = 0;
    subscribeFrame(() => runs++);
    (document as unknown as { hidden: boolean }).hidden = true;
    flushFrame();
    flushFrame();
    expect(runs).toBe(0);
    (document as unknown as { hidden: boolean }).hidden = false;
    flushFrame();
    expect(runs).toBe(1);
  });
});
