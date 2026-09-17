'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { DEFAULT_CHAIN_ID, type SupportedChainId } from '@/services/chains';

/**
 * The one UI store (CLAUDE.md §1.1–1.2). Five ephemeral fields. Nothing here has a
 * query key. Balances, forecasts, and pool status live in TanStack Query only.
 */
export type MotionSetting = 'full' | 'reduced';
export type ModalKind = 'none' | 'connect' | 'settings';

interface UiState {
  selectedChainId: SupportedChainId;
  modal: ModalKind;
  motion: MotionSetting;
  field: boolean;
  sound: boolean;
  setSelectedChainId: (id: SupportedChainId) => void;
  setModal: (m: ModalKind) => void;
  setMotion: (m: MotionSetting) => void;
  setField: (on: boolean) => void;
  setSound: (on: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      selectedChainId: DEFAULT_CHAIN_ID,
      modal: 'none',
      motion: 'full',
      field: true,
      sound: false,
      setSelectedChainId: (selectedChainId) => set({ selectedChainId }),
      setModal: (modal) => set({ modal }),
      setMotion: (motion) => set({ motion }),
      setField: (field) => set({ field }),
      setSound: (sound) => set({ sound }),
    }),
    {
      name: 'argon-ui',
      // Hydrate after mount so the server and first client render agree (CLAUDE.md §2 hydration).
      skipHydration: true,
      partialize: (s) => ({ selectedChainId: s.selectedChainId, motion: s.motion, field: s.field, sound: s.sound }),
    },
  ),
);
