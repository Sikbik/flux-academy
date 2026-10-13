// Development harness for the diorama (not part of the production build: only diorama-lab.html loads it).
// Query: scene, instances, controls (comma list, `kill-region` among them), region, annotate (comma list),
// volume=local|replicated|primary-standby, reduced=1, bare=1, w (px width of the figure), rate (requests
// per second), highlight (comma list of country codes), resolution=low|default|high, aspect ("16 / 9"),
// accent (flux|cumulus|nimbus|stratus), cycle (ms: step through every scene on a timer, for soak
// tests), seed.
import '@/styles/index.css';
import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Diorama, {
  type DioramaControl,
  type DioramaHandle,
  SCENE_IDS,
  type SceneId,
  type VolumeMode,
} from '../index';

const q = new URLSearchParams(location.search);
const list = (k: string): string[] | undefined => {
  const v = q.get(k);
  return v ? v.split(',').filter(Boolean) : undefined;
};
const num = (k: string): number | undefined => {
  const v = q.get(k);
  return v === null ? undefined : Number(v);
};

const accent = q.get('accent');
if (accent) document.documentElement.dataset.accent = accent;

function Lab() {
  const ref = useRef<DioramaHandle>(null);
  const [scene, setScene] = useState<SceneId>((q.get('scene') ?? 'placement') as SceneId);
  const cycle = num('cycle');
  useEffect(() => {
    if (!cycle) return;
    let i = 0;
    const id = window.setInterval(() => {
      i = (i + 1) % SCENE_IDS.length;
      setScene(SCENE_IDS[i] as SceneId);
    }, cycle);
    return () => window.clearInterval(id);
  }, [cycle]);
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__handle = ref.current;
    const id = window.setInterval(() => {
      (window as unknown as Record<string, unknown>).__handle = ref.current;
    }, 500);
    return () => window.clearInterval(id);
  }, []);
  const width = num('w');
  return (
    <div
      style={{
        width: width ? `${width}px` : 'auto',
        margin: width ? '12px' : '0',
        padding: width ? 0 : '12px',
      }}
    >
      <Diorama
        ref={ref}
        scene={scene}
        instances={num('instances')}
        controls={list('controls') as DioramaControl[] | undefined}
        region={q.get('region')}
        annotate={list('annotate')}
        volume={(q.get('volume') as VolumeMode | null) ?? undefined}
        highlight={list('highlight')}
        reducedMotion={q.get('reduced') === '1' ? true : undefined}
        bare={q.get('bare') === '1'}
        requestRate={num('rate')}
        aspect={q.get('aspect') ?? undefined}
        resolution={(q.get('resolution') as 'low' | 'default' | 'high' | null) ?? undefined}
        seed={num('seed')}
      />
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    q.get('strict') === '0' ? (
      <Lab />
    ) : (
      <StrictMode>
        <Lab />
      </StrictMode>
    ),
  );
}
