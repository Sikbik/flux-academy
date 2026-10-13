/**
 * Ambient mode's face (docs/DESIGN.md section 6): the bench full screen, a quiet HUD (clock, block height,
 * next block) and a caption layer cycling facts every nine seconds.
 *
 * `controller.ts` owns the triggers and the wake rules. This renders only while the `ambient` flag is on:
 * it takes focus (the page behind is made inert), restores it on the way out, and never takes the
 * pointer. The picture is the scenes agent's ambient scene when it exists (`scenes/ambient.tsx`, found by
 * glob so its absence is not an error), else a calm 2D field.
 */

import {
  Component,
  type ComponentType,
  type CSSProperties,
  type ErrorInfo,
  lazy,
  type ReactNode,
  Suspense,
  useId,
  useRef,
} from 'react';
import { Portal } from '@/app/Portal';
import { useHotkeyScope } from '@/system/hotkeys';
import { useOverlays } from '@/system/overlays';
import { useFocusTrap, usePresence, useReducedMotion } from '@/ui';
import styles from './Ambient.module.css';
import { AmbientField } from './AmbientField';
import { Chain } from './Chain';
import { Clock } from './Clock';
import { driftOffset } from './schedule';
import { Tour } from './Tour';
import { useMinute } from './useMinute';

const EXIT_MS = 420;

const sceneLoaders = import.meta.glob<{ default: ComponentType }>('../scenes/ambient.tsx');
const firstLoader = Object.values(sceneLoaders)[0];
const SceneAmbient: ComponentType | null = firstLoader ? lazy(firstLoader) : null;

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('[ambient scene]', error, info.componentStack);
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Backdrop() {
  const field = <AmbientField />;
  if (!SceneAmbient) return field;
  return (
    <SceneBoundary fallback={field}>
      <Suspense fallback={field}>
        <SceneAmbient />
      </Suspense>
    </SceneBoundary>
  );
}

function Hud({ state, calm }: { state: string; calm: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const hintId = useId();
  const minute = useMinute();
  const drift = calm ? { x: 0, y: 0 } : driftOffset(minute);
  const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  const open = state === 'enter' || state === 'open';

  useFocusTrap(root, {
    active: open,
    initialFocus: 'container',
    onEscape: () => useOverlays.getState().exitAmbient(),
  });
  // While it runs only its own scope answers, so a stray `g` then `h` cannot navigate behind it.
  useHotkeyScope('ambient', { active: open, exclusive: true });

  return (
    <div
      ref={root}
      className={styles.root}
      data-state={state}
      data-calm={calm ? 'true' : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={hintId}
      tabIndex={-1}
    >
      <span id={titleId} className="sr-only">
        Ambient mode: facts about Flux and the live network
      </span>
      <div className={styles.backdrop} aria-hidden="true">
        <Backdrop />
      </div>
      <div className={styles.scrim} aria-hidden="true" />
      <div className={styles.hud} style={{ '--dx': `${drift.x}px`, '--dy': `${drift.y}px` } as CSSProperties}>
        <div className={`${styles.corner} ${styles.topLeft}`} aria-hidden="true">
          <img src="/brand/round/flux-round-blue-white.svg" alt="" width={30} height={30} />
          <span className={styles.word}>
            <b>Flux</b> <span>Academy</span>
          </span>
        </div>
        <div className={`${styles.corner} ${styles.topRight}`}>
          <p className={styles.hint} id={hintId}>
            {touch ? 'Tap to wake' : 'Press any key or move the mouse to wake'}
          </p>
        </div>
        <div className={`${styles.corner} ${styles.bottomLeft}`}>
          <Clock />
          <Chain />
        </div>
        <Tour />
      </div>
    </div>
  );
}

/** Mounted by the shell; renders nothing until ambient mode is on. */
export default function AmbientOverlay() {
  const ambient = useOverlays((s) => s.ambient);
  const calm = useReducedMotion();
  const { mounted, state } = usePresence(ambient, EXIT_MS);
  if (!mounted) return null;
  return (
    <Portal layer="ambient">
      <Hud state={ambient ? state : 'exit'} calm={calm} />
    </Portal>
  );
}
