'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { DEFAULT_CHAIN_ID, type SupportedChainId } from '@/services/chains';

/**
 * The one UI store (CLAUDE.md §1.1–1.2). Three ephemeral, persisted preferences.
 * Nothing here has a query key. Balances, forecasts, and pool status live in
 * TanStack Query only. Add a field here only when something reads it.
 */
export type MotionSetting = 'full' | 'reduced';

interface UiState {
  /** Vault chain for deposit / withdraw and chain-scoped panels. */
  selectedChainId: SupportedChainId;
  /** User override for motion; prefers-reduced-motion still wins. */
  motion: MotionSetting;
  /** Particle field on / off. */
  field: boolean;
  setSelectedChainId: (id: SupportedChainId) => void;
  setMotion: (m: MotionSetting) => void;
  setField: (on: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      selectedChainId: DEFAULT_CHAIN_ID,
      motion: 'full',
      field: true,
      setSelectedChainId: (selectedChainId) => set({ selectedChainId }),
      setMotion: (motion) => set({ motion }),
      setField: (field) => set({ field }),
    }),
    {
      name: 'argon-ui',
      // Hydrate after mount so the server and first client render agree (CLAUDE.md §2 hydration).
      skipHydration: true,
      partialize: (s) => ({ selectedChainId: s.selectedChainId, motion: s.motion, field: s.field }),
    },
  ),
);
