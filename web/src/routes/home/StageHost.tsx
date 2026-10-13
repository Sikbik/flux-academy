import { Component, type ErrorInfo, type ReactNode, Suspense, useEffect, useState } from 'react';
import { ART } from '@/content/art';
import { useSceneBus } from '@/scenes/bus';
import { isFlatRenderer } from './renderer';
import { LazyHeroScene } from './sceneLoader';
import styles from './stage.module.css';
import { useStageStatus } from './stageStatus';
import type { StageMode } from './useStageMode';

class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[home] the hero scene failed, showing the 2D bench', error.message, info.componentStack);
    this.props.onError();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** True once the browser has had a chance to paint the page's own text: the scene starts after that. */
function useAfterFirstPaint(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(() => setReady(true), { timeout: 700 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setReady(true), 120);
    return () => window.clearTimeout(id);
  }, []);
  return ready;
}

const PLATE = ART['bg-bench'];

const pct = (n: number) => `${(Math.max(0, Math.min(0.8, n)) * 100).toFixed(2)}%`;

/**
 * The stage: one sticky, full-viewport layer behind the whole page. It holds the lazy WebGL bench (or, in
 * `lite` mode, only the calm plate), a poster frame while the chunk loads, and the veil that keeps text
 * legible as the sections change. The page talks to the scene through the bus and nothing else.
 */
export function StageHost({ mode }: { mode: StageMode }) {
  const ready = useSceneBus((s) => s.scene.ready);
  const section = useSceneBus((s) => s.section);
  const webgl = useSceneBus((s) => s.scene.webgl);
  const reason = useSceneBus((s) => s.scene.reason);
  const insets = useSceneBus((s) => s.insets);
  const fail = useStageStatus((s) => s.fail);
  const afterPaint = useAfterFirstPaint();
  const showScene = mode === 'scene' && afterPaint;
  // The WebGL camera frames the bench inside the free area itself (a lens shift). The 2D bench has no
  // camera for that, so it is simply given the free area as its box.
  const flat = showScene && isFlatRenderer(webgl, reason);
  const sceneStyle = flat
    ? { inset: `${pct(insets.top)} ${pct(insets.right)} ${pct(insets.bottom)} ${pct(insets.left)}` }
    : undefined;

  return (
    <div className={styles.rail} aria-hidden="true">
      <div
        className={styles.stage}
        data-mode={mode}
        data-ready={ready && mode === 'scene'}
        data-section={section}
      >
        <picture className={styles.plate}>
          {PLATE.avif ? <source srcSet={PLATE.avif} type="image/avif" /> : null}
          <img
            src={PLATE.src}
            alt=""
            width={PLATE.width}
            height={PLATE.height}
            decoding="async"
            fetchPriority="low"
          />
        </picture>
        <div className={styles.scene} data-renderer={flat ? '2d' : 'webgl'} style={sceneStyle}>
          {showScene ? (
            <SceneBoundary onError={fail}>
              <Suspense fallback={null}>
                <LazyHeroScene />
              </Suspense>
            </SceneBoundary>
          ) : null}
        </div>
        <div className={styles.veil} />
      </div>
    </div>
  );
}
