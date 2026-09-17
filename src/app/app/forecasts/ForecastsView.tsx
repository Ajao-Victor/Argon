'use client';

import { ForecastTable } from '@/components/modules/ForecastTable';
import { useUiStore } from '@/stores/ui';

export function ForecastsView() {
  const chainId = useUiStore((s) => s.selectedChainId);
  return <ForecastTable chainId={chainId} />;
}
