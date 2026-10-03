/**
 * @file ForecastsView — the /app/forecasts route body.
 *
 * Reads the selected chain from the UI store and renders the hourly forecast table for it.
 * Kept as its own client component so the route file stays a server component.
 */
'use client';

import { ForecastTable } from '@/components/modules/ForecastTable';
import { useUiStore } from '@/stores/ui';

export function ForecastsView() {
  const chainId = useUiStore((s) => s.selectedChainId);
  return <ForecastTable chainId={chainId} />;
}
