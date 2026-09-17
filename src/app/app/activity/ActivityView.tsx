'use client';

import { ActivityFeed } from '@/components/modules/ActivityFeed';
import { ChainSwitcher } from '@/components/modules/ChainSwitcher';
import { useUiStore } from '@/stores/ui';

export function ActivityView() {
  const chainId = useUiStore((s) => s.selectedChainId);
  return (
    <div className="flex flex-col gap-4">
      <ChainSwitcher />
      <ActivityFeed chainId={chainId} />
    </div>
  );
}
