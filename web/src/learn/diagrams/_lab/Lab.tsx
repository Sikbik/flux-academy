import { type ComponentType, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { StageComponentProps, StageHost, TaskEvent, WidgetComponent } from '@/learn/stage-api';
import type { WidgetStage } from '@/learn/types';
import { DiagramFigure } from '../_kit/Figure';
import { diagramIds, loadDiagram } from '../_kit/registry';
import styles from './lab.module.css';

const WIDTHS = [320, 390, 560, 760, 900] as const;

function param(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

export default function Lab() {
  const ids = useMemo(() => diagramIds(), []);
  const only = param('only');
  const widget = param('widget');
  const sheet = param('sheet') === '1';
  const wParam = Number(param('w')) || 0;
  const beatParam = Number(param('beat')) || 0;
  const reduced = param('reduced') === '1' || sheet;
  // ?stage=<height>: the figure the way a lesson stage shows it, frameless in a scrolling area of that height
  // (?cap=1 makes the height a max-height, as on a phone).
  const stageH = Number(param('stage')) || 0;
  const stageCap = param('cap') === '1';
  const [width, setWidth] = useState<number>(wParam || 760);
  const shown = widget ? [] : only ? ids.filter((i) => i === only) : ids;

  return (
    <main className={styles.lab}>
      <header className={styles.bar}>
        <strong>Diagram lab</strong>
        <span>{ids.length} diagrams</span>
        <span className={styles.widths}>
          {WIDTHS.map((w) => (
            <button key={w} type="button" data-on={w === width || undefined} onClick={() => setWidth(w)}>
              {w}
            </button>
          ))}
        </span>
        <nav className={styles.nav}>
          {ids.map((id) => (
            <a key={id} href={`?only=${id}&w=${width}`}>
              {id}
            </a>
          ))}
          <a href={`?widget=wiring-board&w=${width}`}>wiring-board</a>
          <a href={`?widget=block-converter&w=${width}`}>block-converter</a>
          <a href="?">all</a>
        </nav>
      </header>
      <div className={styles.grid}>
        {shown.map((id) => (
          <section key={id} id={id} className={styles.item}>
            <h2>{id}</h2>
            {sheet ? (
              <SheetOf id={id} width={width} />
            ) : (
              <div className={styles.slot} style={{ width }}>
                {stageH > 0 ? (
                  <div
                    className={styles.stageSim}
                    style={stageCap ? { maxBlockSize: stageH } : { blockSize: stageH }}
                    data-stage-sim=""
                  >
                    <DiagramFigure
                      id={id}
                      beat={beatParam}
                      reducedMotion={reduced}
                      framed={false}
                      compact={stageCap}
                    />
                  </div>
                ) : (
                  <DiagramFigure id={id} beat={beatParam} reducedMotion={reduced} />
                )}
              </div>
            )}
          </section>
        ))}
        {widget || (!only && !sheet) ? <Widgets only={widget} width={width} /> : null}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Every beat of a diagram, one under another (?sheet=1)
// ---------------------------------------------------------------------------

function SheetOf({ id, width }: { id: string; width: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let live = true;
    loadDiagram(id).then(
      (m) => live && setCount(m.meta.beats.length),
      () => live && setCount(0),
    );
    return () => {
      live = false;
    };
  }, [id]);
  return (
    <div className={styles.sheet}>
      {Array.from({ length: count }, (_, b) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: beats are a fixed ordered list
        <div key={b} className={styles.slot} style={{ width }} data-sheet-beat={b}>
          <DiagramFigure id={id} beat={b} reducedMotion scrubber={false} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The two widgets, in the shapes the lessons give them (?widget=wiring-board | block-converter)
// ---------------------------------------------------------------------------

interface WidgetCase {
  id: string;
  title: string;
  props: Record<string, unknown>;
}

const WIDGET_CASES: readonly WidgetCase[] = [
  {
    id: 'wiring-board',
    title: 'wiring-board: the multi-component lesson',
    props: {
      components: ['web', 'api', 'cache'],
      goal: {
        links: [
          ['web', 'api'],
          ['api', 'cache'],
        ],
        public: ['web'],
      },
    },
  },
  {
    id: 'wiring-board',
    title: 'wiring-board: four components with a database',
    props: {
      app: 'shop',
      components: [
        { id: 'front', label: 'Storefront', kind: 'web' },
        { id: 'orders', label: 'Orders API', kind: 'api' },
        { id: 'sessions', label: 'Sessions', kind: 'cache' },
        { id: 'pg', label: 'Postgres', kind: 'db' },
      ],
      goal: [
        { from: 'front', to: 'orders' },
        { from: 'orders', to: 'pg' },
        { from: 'orders', to: 'sessions' },
      ],
      expose: ['front'],
    },
  },
  {
    id: 'block-converter',
    title: 'block-converter: resources-pricing (months to blocks)',
    props: { case: { kind: 'months-to-blocks', value: 6 } },
  },
  {
    id: 'block-converter',
    title: 'block-converter: operate-your-app (expiry height)',
    props: { case: { kind: 'expiry-height', value: 264_000, startHeight: 3_030_000 } },
  },
  {
    id: 'block-converter',
    title: 'block-converter: blocks to days',
    props: { case: { kind: 'blocks-to-days', value: 88_000 } },
  },
  { id: 'block-converter', title: 'block-converter: free use', props: {} },
];

const loaders = import.meta.glob('../../widgets/*/index.tsx') as Record<
  string,
  () => Promise<{ default: WidgetComponent }>
>;

const lazies = new Map<string, ComponentType<StageComponentProps<WidgetStage>>>();

function widgetFor(id: string): ComponentType<StageComponentProps<WidgetStage>> | null {
  const hit = lazies.get(id);
  if (hit) return hit;
  const key = Object.keys(loaders).find((k) => k.includes(`/widgets/${id}/index.tsx`));
  const load = key ? loaders[key] : undefined;
  if (!load) return null;
  const c = lazy(load) as unknown as ComponentType<StageComponentProps<WidgetStage>>;
  lazies.set(id, c);
  return c;
}

function Widgets({ only, width }: { only: string | null; width: number }) {
  const cases = WIDGET_CASES.filter((c) => !only || c.id === only);
  return (
    <>
      {cases.map((c) => (
        <section key={c.title} className={styles.item}>
          <h2>{c.title}</h2>
          <div className={styles.slot} style={{ width }}>
            <WidgetHost widgetId={c.id} props={c.props} />
          </div>
        </section>
      ))}
    </>
  );
}

function WidgetHost({ widgetId, props }: { widgetId: string; props: Record<string, unknown> }) {
  const Widget = widgetFor(widgetId);
  const [log, setLog] = useState<string[]>([]);
  const solver = useRef<(() => void) | null>(null);
  const [hasSolver, setHasSolver] = useState(false);
  const host = useMemo<StageHost>(
    () => ({
      emit: (e: TaskEvent) => setLog((l) => [...l.slice(-5), `emit ${e.type}`]),
      registerSolver: (s) => {
        solver.current = s;
        setHasSolver(s !== null);
      },
      unlock: (id) => setLog((l) => [...l.slice(-5), `unlock ${id}`]),
    }),
    [],
  );
  const stage = useMemo<WidgetStage>(() => ({ kind: 'widget', id: widgetId, props }), [widgetId, props]);
  if (!Widget) return <p>No widget called {widgetId}.</p>;
  return (
    <div data-widget-host={widgetId}>
      <Suspense fallback={<p>Loading the widget</p>}>
        <Widget stage={stage} host={host} active stepKey="lab" />
      </Suspense>
      <p className={styles.log} data-lab-log="">
        <button type="button" disabled={!hasSolver} onClick={() => solver.current?.()}>
          Show me
        </button>{' '}
        {log.length ? log.join(' | ') : 'no events yet'}
      </p>
    </div>
  );
}
