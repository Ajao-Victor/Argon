/**
 * The single requestAnimationFrame scheduler (doc/design.md §7.4 rules 2–4).
 * Nobody else calls requestAnimationFrame. Subscribers get (dt, now) in ms.
 *
 * Budget: 4 ms per frame for all subscribers combined. A frame that exceeds the
 * budget causes the next frame to be dropped (no queueing, no catch-up). A rolling
 * average is exposed so subscribers can degrade (the particle field cuts count).
 * Pauses on document.hidden and on external pause tokens (wallet signing).
 */
export type FrameCallback = (dtMs: number, nowMs: number) => void;

export const FRAME_BUDGET_MS = 4;
const MAX_DT_MS = 100;
const EMA_ALPHA = 0.1;

const subscribers = new Set<FrameCallback>();
const pauseTokens = new Set<string>();
let rafId: number | null = null;
let last = 0;
let lastCost = 0;
let avgCost = 0;
let dropped = 0;
let frames = 0;
let skipNext = false;

function tick(now: number) {
  rafId = null;
  if (subscribers.size === 0) return;

  const hidden = typeof document !== 'undefined' && document.hidden;
  if (hidden || pauseTokens.size > 0) {
    last = 0;
    rafId = requestAnimationFrame(tick);
    return;
  }

  if (skipNext) {
    skipNext = false;
    dropped++;
    last = now;
    rafId = requestAnimationFrame(tick);
    return;
  }

  const dt = last === 0 ? 16.67 : Math.min(now - last, MAX_DT_MS);
  last = now;

  const start = performance.now();
  for (const cb of subscribers) {
    try {
      cb(dt, now);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.error('[sim] subscriber threw', err);
    }
  }
  lastCost = performance.now() - start;
  avgCost = avgCost === 0 ? lastCost : avgCost + (lastCost - avgCost) * EMA_ALPHA;
  frames++;
  if (lastCost > FRAME_BUDGET_MS) skipNext = true;

  rafId = requestAnimationFrame(tick);
}

function ensureRunning() {
  if (rafId === null && subscribers.size > 0 && typeof requestAnimationFrame === 'function') {
    last = 0;
    rafId = requestAnimationFrame(tick);
  }
}

export function subscribeFrame(cb: FrameCallback): () => void {
  subscribers.add(cb);
  ensureRunning();
  return () => {
    subscribers.delete(cb);
    if (subscribers.size === 0 && rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
      last = 0;
    }
  };
}

/** Pause with a token (e.g. 'signing'); resume by releasing the same token. */
export function pauseSimulation(token: string): void {
  pauseTokens.add(token);
}

export function resumeSimulation(token: string): void {
  pauseTokens.delete(token);
}

export function isSimulationPaused(): boolean {
  return pauseTokens.size > 0;
}

export function lastFrameCostMs(): number {
  return lastCost;
}

/** Exponential moving average of subscriber cost per frame. */
export function averageFrameCostMs(): number {
  return avgCost;
}

export function isOverBudget(): boolean {
  return avgCost > FRAME_BUDGET_MS;
}

export function schedulerStats(): { frames: number; dropped: number; avgMs: number; lastMs: number; subscribers: number } {
  return { frames, dropped, avgMs: avgCost, lastMs: lastCost, subscribers: subscribers.size };
}

/** Test hook: reset counters. Not used by the app. */
export function _resetSchedulerForTests(): void {
  subscribers.clear();
  pauseTokens.clear();
  if (rafId !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId);
  rafId = null;
  last = 0;
  lastCost = 0;
  avgCost = 0;
  dropped = 0;
  frames = 0;
  skipNext = false;
}
