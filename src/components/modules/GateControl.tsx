'use client';

import { useState } from 'react';
import type { Address } from 'viem';

import { Button, Chip, Skeleton, type ChipTone } from '@/components/ui';
import { useGate, useSetGate } from '@/hooks';
import { CUSTOM_BPS_LIMIT, PRESET_BANDS, resolveGate, type GatePreset, type GatePresetNamed, type GateRow } from '@/types/gates';
import { cn } from '@/utils/cn';
import { rovingRadioKeyDown } from '@/utils/rovingRadio';

/**
 * Per-user gate on the selected pool card (handoff 2026-10-02).
 *
 * The model still publishes one 8-hour ETH price. The user's gate decides whether their
 * capital is allowed into the Uniswap position that hour. Presets fix all six bands;
 * Custom sets the 1 h top (+) and bottom (−) in basis points, each within 20 %, and keeps
 * 2 h / 8 h at Balanced. Saving asks the wallet to personal_sign the exact gate string;
 * the agent recovers the signer and stores the gate. `lastAction` here is this wallet's
 * own decision; the hero's `action` remains the shared vault action.
 */
export const GATE_COPY = 'The model still publishes one 8-hour ETH price. Your gate decides whether your capital is allowed into the Uniswap position that hour.';

const PRESETS: readonly GatePreset[] = ['safe', 'balanced', 'aggressive', 'custom'];
const ACTION_TONE: Record<NonNullable<GateRow['lastAction']>, ChipTone> = { warmup: 'idle', enter: 'up', hold: 'argon', exit: 'down' };

function bandsLine(top1h: number, top2h: number, top8h: number): string {
  return `1h ±${top1h} bps · 2h ±${top2h} bps · 8h ±${top8h} bps`;
}

export function GateControl({ address }: { address: Address }) {
  const gate = useGate(address);
  const { setGate, isPending } = useSetGate();
  const stored = gate.data ?? null;

  const [preset, setPreset] = useState<GatePreset | null>(null);
  const [topText, setTopText] = useState('');
  const [bottomText, setBottomText] = useState('');

  // The selected preset defaults to the stored one; custom inputs default to the stored 1 h band.
  const activePreset: GatePreset = preset ?? stored?.preset ?? 'balanced';
  const topBps = topText === '' ? (stored?.preset === 'custom' ? stored.top1hBps : PRESET_BANDS.balanced.top1h) : Number(topText);
  const bottomBps = bottomText === '' ? (stored?.preset === 'custom' ? stored.bottom1hBps : -PRESET_BANDS.balanced.top1h) : Number(bottomText);

  let customError: string | null = null;
  if (activePreset === 'custom') {
    try {
      resolveGate('custom', topBps, bottomBps);
    } catch (err) {
      customError = err instanceof Error ? err.message : 'invalid band';
    }
  }

  const preview = customError ? null : resolveGate(activePreset, topBps, bottomBps);
  const unchanged =
    stored !== null && preview !== null && stored.preset === preview.preset && stored.top1hBps === preview.top1hBps && stored.bottom1hBps === preview.bottom1hBps;

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-hairline pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label leading-5">your gate</span>
        {gate.status === 'pending' ? (
          <Skeleton chars={10} scan={false} />
        ) : gate.status === 'error' ? (
          <Chip tone="warn">gate feed unavailable</Chip>
        ) : stored ? (
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="argon" flipKey={stored.preset}>{stored.preset}</Chip>
            {stored.lastAction ? (
              <Chip tone={ACTION_TONE[stored.lastAction]} dot flipKey={stored.lastAction} title="this wallet's decision last hour; the hero action is the shared vault action">
                last action · {stored.lastAction}
                {stored.lastHourId !== null && <span className="text-text-dim"> · hour {stored.lastHourId}</span>}
              </Chip>
            ) : (
              <Chip tone="idle">no decision yet</Chip>
            )}
            {stored.inPosition && <Chip tone="up">in position</Chip>}
          </div>
        ) : (
          <Chip tone="idle">no gate chosen · default policy</Chip>
        )}
      </div>
      {stored && <p className="font-mono text-[0.6875rem] leading-4 text-text-dim">{bandsLine(stored.top1hBps, stored.top2hBps, stored.top8hBps)}</p>}
      <p className="text-[0.6875rem] leading-4 text-text-dim">{GATE_COPY}</p>

      <div
        className="flex flex-wrap gap-1.5"
        role="radiogroup"
        aria-label="gate preset"
        onKeyDown={(e) =>
          rovingRadioKeyDown(e, (i) => {
            const next = PRESETS[i];
            if (next) setPreset(next);
          })
        }
      >
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={activePreset === p}
            tabIndex={activePreset === p ? 0 : -1}
            onClick={() => setPreset(p)}
            className={cn(
              'rounded-chip border px-2.5 py-1 text-[0.6875rem] uppercase tracking-wider transition-colors',
              activePreset === p ? 'border-argon-500/70 bg-argon-500/10 text-argon-300' : 'border-hairline text-text-mid hover:border-text-dim hover:text-text-hi',
            )}
          >
            {p}
            {p !== 'custom' && <span className="ml-1.5 normal-case tracking-normal text-text-dim">±{PRESET_BANDS[p as GatePresetNamed].top1h / 100}%</span>}
          </button>
        ))}
      </div>

      {activePreset === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[0.6875rem] text-text-dim">
            1h top (+ bps, ≤ {CUSTOM_BPS_LIMIT})
            <input
              inputMode="numeric"
              value={topText}
              placeholder={String(topBps)}
              onChange={(e) => setTopText(e.target.value.trim())}
              className="h-9 rounded-chip border border-hairline bg-surface-0/60 px-2 font-mono text-sm text-text-hi outline-none focus:border-argon-500/70"
            />
          </label>
          <label className="flex flex-col gap-1 text-[0.6875rem] text-text-dim">
            1h bottom (− bps, ≥ −{CUSTOM_BPS_LIMIT})
            <input
              inputMode="numeric"
              value={bottomText}
              placeholder={String(bottomBps)}
              onChange={(e) => setBottomText(e.target.value.trim())}
              className="h-9 rounded-chip border border-hairline bg-surface-0/60 px-2 font-mono text-sm text-text-hi outline-none focus:border-argon-500/70"
            />
          </label>
          <p className={cn('col-span-2 text-[0.6875rem] leading-4', customError ? 'text-signal-down' : 'text-text-dim')}>
            {customError ?? '2h and 8h stay at Balanced (±250 / ±200 bps).'}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[0.6875rem] leading-4 text-text-dim">{preview ? bandsLine(preview.top1hBps, preview.top2hBps, preview.top8hBps) : '—'}</span>
        <Button
          size="sm"
          variant="primary"
          disabled={isPending || customError !== null || unchanged || gate.status === 'pending'}
          onClick={() => void setGate({ address, preset: activePreset, topBps, bottomBps })}
          title="signs argon-gate:{address}:{preset}:{topBps}:{bottomBps}:{issuedAt} with your wallet; no transaction, no gas"
        >
          {isPending ? 'awaiting signature…' : unchanged ? 'gate saved' : 'sign & save gate'}
        </Button>
      </div>
    </div>
  );
}
