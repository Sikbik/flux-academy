/**
 * Start-up wiring for everything that is not a page: the theme mirror (accent, motion, glass), the
 * sound delegates, the Beat, the global hotkeys, the Konami code, the scene bridge and route prefetch.
 * Each piece is refcounted and idempotent, so React StrictMode's double effects are harmless.
 */

import { Component, type ErrorInfo, type ReactNode, useEffect } from 'react';
import { startAmbientController } from '@/ambient/controller';
import { attachHotkeys } from '@/system/hotkeys';
import { useKonami } from '@/system/konami';
import { sfx } from '@/system/sound';
import { startSound } from '@/system/soundWiring';
import { startThemeSync, useOverclock } from '@/system/theme';
import { toast } from '@/system/toasts';
import { startBeat } from './beat';
import { FatalError } from './ErrorViews';
import { registerGlobalHotkeys } from './globalHotkeys';
import { startRoutePrefetch } from './routes';
import { useSceneBridge } from './sceneBridge';
import { trackActivations } from './transitions';

class FatalBoundary extends Component<{ children: ReactNode }, { error: unknown; failed: boolean }> {
  override state = { error: null as unknown, failed: false };

  static getDerivedStateFromError(error: unknown) {
    return { error, failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('[fatal]', error, info.componentStack);
  }

  override render() {
    return this.state.failed ? <FatalError error={this.state.error} /> : this.props.children;
  }
}

/** Everything that runs once for the life of the page. Renders nothing. */
function SystemStart() {
  useSceneBridge();
  useKonami(() => {
    useOverclock.getState().start();
    sfx.rankUp();
    toast('Overclock engaged. The bench runs hot for 20 seconds.');
  });

  useEffect(() => {
    const offs = [
      startThemeSync(),
      startBeat(),
      startSound(),
      attachHotkeys(),
      registerGlobalHotkeys(),
      trackActivations(),
      startRoutePrefetch(),
      startAmbientController(),
    ];
    return () => {
      for (const off of offs) off();
    };
  }, []);

  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <FatalBoundary>
      <SystemStart />
      {children}
    </FatalBoundary>
  );
}
