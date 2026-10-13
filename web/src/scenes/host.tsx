// The React host of the WebGL scene: a sized div that owns one canvas and one engine. It is deliberately
// thin. It probes WebGL, imports the engine lazily (three.js and the simulation live in their own chunk),
// creates a fresh canvas per engine (a lost context cannot be reused), and switches to the 2D diorama
// when WebGL is unavailable, forced off, lost for good, or too slow to be worth it.
//
// The page never sees any of this: it renders <HeroScene /> or <AmbientScene /> and talks to the bus.

import { type CSSProperties, lazy, Suspense, useEffect, useRef, useState } from 'react';
import { initialPlan, webglAvailable } from '@/lib/quality';
import { type SceneReason, type SceneSlice, useSceneBus } from './bus';
import { coverStage } from './cover';
import type { EngineMode, SceneEngine } from './engine/engine';

const SceneFallback = lazy(() => import('./fallback'));

export interface SceneProps {
  className?: string;
  style?: CSSProperties;
  /** Skip WebGL and show the 2D scene (tests, the `?q=none` flag does the same). */
  forceFallback?: boolean;
}

type Phase = 'pending' | 'webgl' | 'fallback';

/** The `?stage=debug` flag, read lazily so the host does not import the overlay. */
function debugFlag(): boolean {
  try {
    return new URLSearchParams(location.search).get('stage') === 'debug';
  } catch {
    return false;
  }
}

export function SceneHost({ mode, className, style, forceFallback }: SceneProps & { mode: EngineMode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('pending');
  // While the GL context is lost the 2D scene covers the canvas; when it comes back the cover goes away.
  const [covered, setCovered] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let disposed = false;
    let engine: SceneEngine | null = null;
    let canvas: HTMLCanvasElement | null = null;
    const bus = useSceneBus.getState();

    // The hero scene owns the `scene` slice. An ambient scene is decoration under an overlay: it reads the
    // bus and never writes it, so it cannot overwrite the hero's counts, status line or announcements.
    const write = (patch: Partial<SceneSlice>): void => {
      if (mode === 'hero') useSceneBus.getState().writeScene(patch);
    };
    // While an ambient scene covers the page the hero scene behind it stops drawing (see cover.ts).
    const release = mode === 'ambient' ? coverStage() : null;

    const toFallback = (reason: SceneReason): void => {
      if (disposed) return;
      engine?.dispose();
      engine = null;
      canvas?.remove();
      canvas = null;
      write({ webgl: false, reason, fps: 0, hover: null });
      setPhase('fallback');
    };

    // A page that turns the scene off after it mounted (quality 0) gets the 2D scene at once. Turning it
    // back on takes effect on the next mount.
    const offQuality = useSceneBus.subscribe((s, prev) => {
      if (s.quality === 0 && prev.quality !== 0) toFallback('forced-off');
    });

    const { forced } = initialPlan();
    const tier = bus.quality ?? forced;
    if (forceFallback || tier === 0) {
      toFallback('forced-off');
    } else if (!webglAvailable()) {
      toFallback('no-webgl');
    } else {
      write({ reason: 'loading' });
      import('./engine/engine')
        .then(({ SceneEngine: Engine }) => {
          if (disposed) return;
          const c = document.createElement('canvas');
          c.setAttribute('aria-hidden', 'true');
          c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
          root.appendChild(c);
          canvas = c;
          try {
            engine = new Engine({
              canvas: c,
              host: root,
              mode,
              debug: debugFlag(),
              tier: tier && tier > 0 ? tier : null,
              onContextLost: () => {
                if (disposed) return;
                write({ webgl: false, reason: 'context-lost', fps: 0, hover: null });
                setCovered(true);
              },
              onContextRestored: () => {
                if (disposed) return;
                write({ webgl: true, reason: 'ok' });
                setCovered(false);
              },
              onTooSlow: () => toFallback('too-slow'),
            });
            engine.start();
            if (import.meta.env.DEV) {
              (window as unknown as Record<string, unknown>)[mode === 'hero' ? '__scene' : '__sceneAmbient'] =
                engine;
            }
            write({ webgl: true });
            setPhase('webgl');
          } catch {
            toFallback('no-webgl');
          }
        })
        .catch(() => toFallback('no-webgl'));
    }

    return () => {
      disposed = true;
      offQuality();
      release?.();
      engine?.dispose();
      engine = null;
      canvas?.remove();
      canvas = null;
    };
  }, [mode, forceFallback]);

  return (
    <div
      ref={rootRef}
      className={className}
      data-scene={mode}
      data-scene-phase={phase}
      aria-hidden="true"
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...style }}
    >
      {phase === 'fallback' || covered ? (
        <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
          <Suspense fallback={null}>
            <SceneFallback mode={mode} />
          </Suspense>
        </div>
      ) : null}
    </div>
  );
}
