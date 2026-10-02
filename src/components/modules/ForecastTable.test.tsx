// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Forecast, HourId } from '@/types/forecast';

const ROW: Forecast = {
  hourId: 497479 as HourId, targetHourId: 497487 as HourId, submittedAt: '2026-10-02T07:00:30+00:00',
  ethPct1h: -0.22, ethPct2h: 0.05, ethPct8h: -0.1434, ethPct1hSource: 'lgbm', ethPct2hSource: 'lgbm', ethPct8hSource: 'lgbm',
  spotUsd: 2703.1, modelId: 'eth-1-2-8h-v1', status: 'pending', realizedPctChange: null, realizedSpotUsd: null,
  action: 'warmup', gate1hBps: 100, gate2hBps: 250, gate8hBps: 200, warmupComplete: false,
  forecastHash: null, txHash: null, txHashRh: null, rebalanceTx: null, rebalanceTxRh: null, poolStatusArb: 0, poolStatusRh: 0,
  trippedHorizons: [], ethPctChange: -0.1434, gateBps: 200,
};

vi.mock('@/hooks', () => ({
  // dataUpdatedAt = hour 497481 → the 497487 settlement reads "in 6h"
  useForecastHistory: () => ({ data: { items: [ROW] }, status: 'success', dataUpdatedAt: 497481 * 3_600_000 }),
  useAgentMode: () => 'live',
}));
vi.mock('./HashMatch', () => ({ HashMatch: () => null }));

import { ForecastTable } from './ForecastTable';

afterEach(cleanup);

describe('ForecastTable "Understandable hour"', () => {
  it('labels the settlement column Understandable hour, never Target, and formats it for a reader', () => {
    render(<ForecastTable chainId={42161} />);
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent?.trim().toLowerCase());
    expect(headers).toContain('understandable hour');
    expect(headers.some((h) => h?.includes('target'))).toBe(false);
    expect(screen.getByText('15:00 UTC (in 6h)').getAttribute('title')).toBe('hour 497487');
  });
});
