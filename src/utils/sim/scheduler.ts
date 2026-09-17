/**
 * The single requestAnimationFrame scheduler (doc/architecture.md §4.3).
 * Nobody else calls requestAnimationFrame. Subscribers get (dt, now) in ms.
 * Pauses on document.hidden, on external pause tokens (wallet signing), and
 * drops a frame if the previous one overran 12 ms rather than queueing.
 */
export type FrameCallback = (dtMs: number, nowMs: number) => void;

const subscribers = new Set<FrameCallback>();
const pauseTokens = new Set<string>();
let rafId: number | null = null;
let last = 0;
let lastFrameCost = 0;
let skipNext = false;

const FRAME_OVERRUN_MS = 12;

function tick(now: number) {
  rafId = null;
  if (subscribers.size === 0) return;
  if (typeof document !== 'undefined' && document.hidden) {
    last = 0;
    rafId = requestAnimationFrame(tick);
    return;
  }
  if (pauseTokens.size > 0) {
    last = 0;
    rafId = requestAnimationFrame(tick);
    return;
  }
  if (skipNext) {
    skipNext = false;
    last = now;
    rafId = requestAnimationFrame(tick);
    return;
  }

  const dt = last === 0 ? 16.67 : Math.min(now - last, 100);
  last = now;
  const start = performance.now();
  for (const cb of subscribers) {
    try {
      cb(dt, now);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.error('[sim] subscriber threw', err);
    }
  }
  lastFrameCost = performance.now() - start;
  if (lastFrameCost > FRAME_OVERRUN_MS) skipNext = true;
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
  return lastFrameCost;
}
