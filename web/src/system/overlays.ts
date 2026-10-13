/**
 * Which system overlays are open. The shell owns the flags and the global hotkeys; the overlay modules
 * (command deck, shortcuts, ambient) only react to them.
 *
 *   const open = useOverlays((s) => s.deck);
 *   useOverlays.getState().openDeck('> block');
 *
 * Rules: the deck and the shortcuts overlay are exclusive (opening one closes the other). Turning
 * ambient on closes them all, and opening a modal overlay while ambient runs wakes the page.
 *
 * Adapted from fluxcommunity/web/src/lib/overlays.ts (same owner, MIT).
 */

import { create } from 'zustand';

export type OverlayName = 'deck' | 'shortcuts' | 'ambient';

const MODALS: readonly OverlayName[] = ['deck', 'shortcuts'];

interface OverlayFlags {
  deck: boolean;
  shortcuts: boolean;
  ambient: boolean;
}

interface OverlayActions {
  open: (name: OverlayName) => void;
  close: (name: OverlayName) => void;
  toggle: (name: OverlayName) => void;
  closeAll: () => void;
  /** Open the command deck, optionally with a query already typed (`> block`). */
  openDeck: (seed?: string) => void;
  closeDeck: () => void;
  toggleDeck: () => void;
  openShortcuts: () => void;
  closeShortcuts: () => void;
  toggleShortcuts: () => void;
  enterAmbient: () => void;
  exitAmbient: () => void;
  toggleAmbient: () => void;
}

export type OverlaysState = OverlayFlags & OverlayActions & { deckSeed: string };

const NONE_OPEN: OverlayFlags = { deck: false, shortcuts: false, ambient: false };

export const useOverlays = create<OverlaysState>((set, get) => {
  const open = (name: OverlayName) =>
    set((s) => {
      if (s[name]) return s;
      if (name === 'ambient') return { ...NONE_OPEN, ambient: true };
      const next: Partial<OverlayFlags> = { [name]: true };
      for (const other of MODALS) if (other !== name) next[other] = false;
      // Opening a modal overlay while ambient is running wakes the page.
      next.ambient = false;
      return next;
    });
  const close = (name: OverlayName) => set((s) => (s[name] ? { [name]: false } : s));
  return {
    ...NONE_OPEN,
    deckSeed: '',
    open,
    close,
    toggle: (name) => (get()[name] ? close(name) : open(name)),
    closeAll: () => set({ ...NONE_OPEN }),
    openDeck: (seed = '') => {
      set({ deckSeed: seed });
      open('deck');
    },
    closeDeck: () => close('deck'),
    toggleDeck: () => {
      if (get().deck) {
        close('deck');
        return;
      }
      set({ deckSeed: '' });
      open('deck');
    },
    openShortcuts: () => open('shortcuts'),
    closeShortcuts: () => close('shortcuts'),
    toggleShortcuts: () => (get().shortcuts ? close('shortcuts') : open('shortcuts')),
    enterAmbient: () => open('ambient'),
    exitAmbient: () => close('ambient'),
    toggleAmbient: () => (get().ambient ? close('ambient') : open('ambient')),
  };
});

/** True while any modal-style overlay (deck, shortcuts) is open. */
export function anyModalOverlayOpen(state: OverlayFlags): boolean {
  return state.deck || state.shortcuts;
}
