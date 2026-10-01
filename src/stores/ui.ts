'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { SupportedChainId } from '@/services/chains';

/** Arbitrum One. Literal so this module has no runtime import of the chain definitions (landing bundle stays free of them). */
const DEFAULT_CHAIN_ID: SupportedChainId = 42161;

/**
 * The one UI store (ENGINEERING.md §1.1–1.2). Three persisted preferences plus one
 * transient modal flag. Nothing here has a query key. Balances, forecasts, and pool
 * status live in TanStack Query only. Add a field here only when something reads it.
 */
export type MotionSetting = 'full' | 'reduced';
export type ModalKind = 'none' | 'connect';

interface UiState {
  /** Transient. 'connect' opens the connector picker; not persisted. */
  modal: ModalKind;
  setModal: (m: ModalKind) => void;
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
      modal: 'none',
      setModal: (modal) => set({ modal }),
      selectedChainId: DEFAULT_CHAIN_ID,
      motion: 'full',
      field: true,
      setSelectedChainId: (selectedChainId) => set({ selectedChainId }),
      setMotion: (motion) => set({ motion }),
      setField: (field) => set({ field }),
    }),
    {
      name: 'argon-ui',
      // Hydrate after mount so the server and first client render agree (ENGINEERING.md §2 hydration).
      skipHydration: true,
      partialize: (s) => ({ selectedChainId: s.selectedChainId, motion: s.motion, field: s.field }),
    },
  ),
);
