import { create } from 'zustand';

/**
 * Whether the hero scene could not be loaded or crashed. The stage host sets it, the hero reads it to
 * swap in the calm 2D bench. Nothing is persisted: a reload tries again.
 */
export const useStageStatus = create<{ failed: boolean; fail: () => void }>((set) => ({
  failed: false,
  fail: () => set({ failed: true }),
}));
