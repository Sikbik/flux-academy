/**
 * The hotkeys that work on every page. Registered once at start-up (not per component), so they are
 * always in the shortcuts overlay's list. Pages and labs add their own with `useHotkey` and
 * `useHotkeyScope`.
 *
 * Go-to chords use `g` then a letter. `g o` is deliberately NOT here: the lesson player owns it ("open
 * the outline", docs/DESIGN.md section 5.4), so the global nav picks other letters.
 */

import { registerHotkey } from '@/system/hotkeys';
import { useOverlays } from '@/system/overlays';
import { appNavigate } from './navigation';

/** A modal (a dialog or drawer from the design system) that is not one of ours is open. */
function foreignModalOpen(): boolean {
  if (document.documentElement.dataset.scrollLocked !== 'true') return false;
  const o = useOverlays.getState();
  return !o.deck && !o.shortcuts;
}

const GO: ReadonlyArray<{ keys: string; to: string; label: string }> = [
  { keys: 'g h', to: '/', label: 'Go to the home page' },
  { keys: 'g c', to: '/learn', label: 'Go to the course map' },
  { keys: 'g l', to: '/labs', label: 'Go to the labs' },
  { keys: 'g r', to: '/reference', label: 'Go to the reference' },
  { keys: 'g g', to: '/glossary', label: 'Go to the glossary' },
  { keys: 'g t', to: '/troubleshoot', label: 'Go to troubleshooting' },
  { keys: 'g p', to: '/profile', label: 'Go to your profile' },
];

/** Registers the global hotkeys. Returns the unregister function. */
export function registerGlobalHotkeys(): () => void {
  const offs: Array<() => void> = [];

  offs.push(
    registerHotkey({
      id: 'deck.toggle',
      keys: 'mod+k',
      label: 'Open the command deck',
      group: 'General',
      run: () => {
        if (foreignModalOpen()) return false;
        useOverlays.getState().toggleDeck();
        return undefined;
      },
    }),
    registerHotkey({
      id: 'deck.slash',
      keys: '/',
      label: 'Search the Academy',
      group: 'General',
      run: () => {
        if (foreignModalOpen()) return false;
        useOverlays.getState().openDeck();
        return undefined;
      },
    }),
    registerHotkey({
      id: 'shortcuts.toggle',
      keys: '?',
      label: 'Show keyboard shortcuts',
      group: 'General',
      run: () => {
        if (foreignModalOpen()) return false;
        useOverlays.getState().toggleShortcuts();
        return undefined;
      },
    }),
    registerHotkey({
      id: 'ambient.toggle',
      keys: 'a',
      label: 'Start ambient mode',
      group: 'General',
      run: () => {
        if (foreignModalOpen()) return false;
        useOverlays.getState().toggleAmbient();
        return undefined;
      },
    }),
  );

  for (const g of GO) {
    offs.push(
      registerHotkey({
        id: `go.${g.to === '/' ? 'home' : g.to.slice(1)}`,
        keys: g.keys,
        label: g.label,
        group: 'Go to',
        run: () => {
          if (foreignModalOpen()) return false;
          appNavigate(g.to);
          return undefined;
        },
      }),
    );
  }

  return () => {
    for (const off of offs) off();
  };
}
