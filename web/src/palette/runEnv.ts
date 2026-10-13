import { appNavigate } from '@/app/navigation';
import { copyText } from '@/lib/clipboard';
import { useOverlays } from '@/system/overlays';
import { type AccentId, unlockRule, usePrefs } from '@/system/prefs';
import { sfx } from '@/system/sound';
import { toast } from '@/system/toasts';
import type { RunEnv } from './run';

/** The real environment: router navigation, preferences, toasts and the clipboard. */
export const browserRunEnv: RunEnv = {
  navigate: (to) => appNavigate(to),
  setSound: (on) => {
    usePrefs.getState().set({ sound: on });
    if (on) sfx.confirm();
  },
  setReducedMotion: (on) => {
    usePrefs.getState().set({ motion: on ? 'reduced' : 'full' });
  },
  setAutoAmbient: (on) => {
    usePrefs.getState().set({ ambient: on });
  },
  setAccent: (id: AccentId) => {
    const ok = usePrefs.getState().setAccent(id);
    if (!ok) toast.warn(unlockRule(id));
    return ok;
  },
  enterAmbient: () => useOverlays.getState().enterAmbient(),
  showShortcuts: () => useOverlays.getState().openShortcuts(),
  copyLink: () => {
    void copyText(window.location.href).then((ok) => {
      if (ok) toast.success('Link copied');
      else toast.error('Could not copy the link');
    });
  },
};
