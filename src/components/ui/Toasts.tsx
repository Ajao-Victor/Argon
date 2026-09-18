'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import type { SupportedChainId } from '@/services/chains';
import { txUrl } from '@/services/explorer';
import { cn } from '@/utils/cn';
import { truncateHex } from '@/utils/format';

import { StatusDot, type ChipTone } from './Chip';
import { SPRING } from './motion';

/**
 * Transaction toasts (Phase 8 M3). A tiny external store (no Zustand: the ui store
 * keeps its five fields, ENGINEERING.md §1.2) read through useSyncExternalStore.
 * One toast per write, updated in place as the TxState advances:
 *   signing → amber  ·  mining → pending bar  ·  confirmed → up  ·  failed → down
 */
export type ToastKind = 'info' | 'signing' | 'mining' | 'success' | 'error';

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  detail?: string | undefined;
  hash?: `0x${string}` | undefined;
  chainId?: SupportedChainId | undefined;
  /** ms until auto-dismiss; undefined = sticky */
  ttl?: number | undefined;
}

let toasts: readonly Toast[] = [];
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  for (const l of listeners) l();
}

function armTtl(t: Toast) {
  const existing = timers.get(t.id);
  if (existing) clearTimeout(existing);
  if (t.ttl !== undefined) timers.set(t.id, setTimeout(() => dismiss(t.id), t.ttl));
}

export function push(t: Toast): string {
  toasts = [...toasts.filter((x) => x.id !== t.id), t];
  armTtl(t);
  emit();
  return t.id;
}

export function update(id: string, patch: Partial<Omit<Toast, 'id'>>): void {
  const cur = toasts.find((x) => x.id === id);
  if (!cur) {
    push({ id, kind: 'info', title: patch.title ?? '', ...patch });
    return;
  }
  const next: Toast = { ...cur, ...patch };
  toasts = toasts.map((x) => (x.id === id ? next : x));
  armTtl(next);
  emit();
}

export function dismiss(id: string): void {
  const t = timers.get(id);
  if (t) clearTimeout(t);
  timers.delete(id);
  toasts = toasts.filter((x) => x.id !== id);
  emit();
}

export const toast = { push, update, dismiss } as const;

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
const getSnapshot = () => toasts;
// React requires getServerSnapshot to return the SAME reference on every call; a fresh []
// each time makes React think the store changed and loops during server rendering.
const emptySnapshot: readonly Toast[] = Object.freeze([]);
const getServerSnapshot = (): readonly Toast[] => emptySnapshot;

/** What the wallet is doing right now, derived from live toasts. Drives the Keeper's overclock. */
export type TxActivity = 'idle' | 'signing' | 'mining';
export function useTxActivity(): TxActivity {
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (list.some((t) => t.kind === 'mining')) return 'mining';
  if (list.some((t) => t.kind === 'signing')) return 'signing';
  return 'idle';
}

const TONE: Record<ToastKind, ChipTone> = { info: 'plain', signing: 'warn', mining: 'argon', success: 'up', error: 'down' };
const BORDER: Record<ToastKind, string> = {
  info: 'border-hairline',
  signing: 'border-signal-warn/50 shadow-[0_0_24px_-8px_var(--signal-warn)]',
  mining: 'border-hairline-strong shadow-glow-sm',
  success: 'border-signal-up/50 shadow-[0_0_24px_-8px_var(--signal-up)]',
  error: 'border-signal-down/50 shadow-[0_0_24px_-8px_var(--signal-down)]',
};
const LABEL: Record<ToastKind, string> = { info: 'notice', signing: 'signature requested', mining: 'transaction mining', success: 'confirmed', error: 'failed' };

export function ToastViewport() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const reduced = useReducedMotion();
  return (
    <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-3 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96">
      <AnimatePresence initial={false}>
        {list.map((t) => (
          <motion.div
            key={t.id}
            layout={false}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.14 } }}
            transition={SPRING.snappy}
            role="status"
            className={cn('pointer-events-auto relative w-full overflow-hidden rounded-panel border bg-surface-1/95 backdrop-blur-glass', BORDER[t.kind], t.kind === 'error' && 'animate-glitch')}
          >
            <div className="flex items-start gap-3 px-4 py-3">
              <span className="relative mt-1.5 inline-flex h-2 w-2 shrink-0">
                {(t.kind === 'signing' || t.kind === 'mining') && !reduced && (
                  <span aria-hidden className={cn('absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping', t.kind === 'signing' ? 'bg-signal-warn' : 'bg-argon-500')} />
                )}
                <StatusDot tone={TONE[t.kind]} className="relative h-2 w-2" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="label leading-5">{LABEL[t.kind]}</span>
                <span className="font-mono text-[0.8125rem] leading-5 text-text-hi">{t.title}</span>
                {t.detail && <span className="text-[0.75rem] leading-5 text-text-mid">{t.detail}</span>}
                {t.hash && t.chainId && (
                  <a href={txUrl(t.chainId, t.hash)} target="_blank" rel="noreferrer" className="font-mono text-[0.75rem] leading-5 text-ion-400 hover:underline">
                    {truncateHex(t.hash, 10, 6)} ↗
                  </a>
                )}
              </div>
              <button type="button" onClick={() => dismiss(t.id)} aria-label="dismiss" className="shrink-0 text-text-lo hover:text-text-hi">
                <X size={14} strokeWidth={1.5} />
              </button>
            </div>
            {t.kind === 'mining' && (
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-px overflow-hidden bg-surface-2">
                <span className="absolute inset-y-0 w-1/4 bg-argon-500 animate-pending-bar" />
              </span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
