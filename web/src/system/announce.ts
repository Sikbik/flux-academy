/**
 * A polite screen reader announcement, from anywhere:
 *
 *   announce('3 instances placed, 2 healthy.');
 *
 * The shell renders one visually hidden live region and feeds it from this store. Identical messages in
 * a row are re-announced by toggling a zero width suffix, so a repeat is still spoken.
 */

import { create } from 'zustand';

interface AnnounceState {
  message: string;
  seq: number;
  say: (message: string) => void;
}

export const useAnnouncer = create<AnnounceState>((set, get) => ({
  message: '',
  seq: 0,
  say: (message) => {
    const text = message.trim();
    if (!text) return;
    set({ message: text, seq: get().seq + 1 });
  },
}));

export function announce(message: string): void {
  useAnnouncer.getState().say(message);
}
