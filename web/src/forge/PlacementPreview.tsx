/**
 * Placement preview: where the app's instances could land for the chosen geolocation.
 *
 * It draws the diorama's `placement` scene (the real component, loaded on demand) with the rules of the spec
 * applied: only the countries the rules allow can host a copy, and the size of the app decides which node
 * tiers are in play. If the diorama cannot load or draw, a plain map of the same sample world takes its
 * place, so the preview never disappears.
 *
 * Either way it is labelled a simulation: there is no scheduler, each qualifying node decides for itself, so
 * the picture is one possible outcome and says so. What it counts are the sample world's nodes: the real
 * registration check counts every node the rules cannot rule out (a node whose location the network could not
 * resolve counts too) and refuses only when that number is above zero and below the instance count (FACTS 3.5).
 */

import {
  Component,
  type CSSProperties,
  type ErrorInfo,
  lazy,
  type ReactNode,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type Bench, buildSampleBench, REGION_NAMES, REGIONS, type Region } from '@/diorama/model';
import type { DioramaHandle } from '@/diorama/types';
import { Chip, FreshnessChip, Skeleton, useElementSize, useReducedMotion } from '@/ui';
import { allowedContinents } from './model';
import { appSizeFor, eligibleIndices, placeInstances, placeOptionsFor } from './placement';
import styles from './placement.module.css';

const LazyDiorama = lazy(() => import('@/diorama').then((m) => ({ default: m.Diorama })));

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.warn('[forge] the diorama failed, drawing the built-in map', error, info.componentStack);
    }
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

export interface PlacementTotals {
  cpu: number;
  ram: number;
  hdd: number;
}

interface Summary {
  eligible: number;
  nodes: number;
  /** Instances that are placed. */
  placed: number;
  byRegion: [Region, number][];
  places: { id: string; label: string; tier: string }[];
}

function Caption({
  summary,
  geolocation,
  instances,
  fits,
}: {
  summary: Summary | null;
  geolocation: readonly string[];
  instances: number;
  fits: boolean;
}) {
  let first: string;
  if (!fits) first = 'This app is larger than the biggest total the network allows, so it is refused.';
  else if (geolocation.length === 0) first = 'No location rules, so any node can host a copy.';
  else if (summary && summary.eligible === 0) {
    first =
      'No sample node matches these rules. The network still accepts a registration that matches no node, and nothing is promised to run.';
  } else if (summary) first = `${summary.eligible} of ${summary.nodes} sample nodes qualify.`;
  else first = '';
  let second: string;
  if (summary && fits && summary.eligible > 0 && summary.placed < instances) {
    second = `Only ${summary.placed} of ${instances} instances fit. On the real network, a list that leaves some nodes but fewer than the instances is refused at registration.`;
  } else {
    second =
      'One possible outcome: no scheduler assigns copies, each node that qualifies decides for itself.';
  }
  return (
    <p className={styles.caption}>
      {first} {second}
    </p>
  );
}

function Regions({ byRegion }: { byRegion: [Region, number][] }) {
  if (byRegion.length === 0) return null;
  return (
    <ul className={styles.regions} aria-label="Instances by region">
      {byRegion.map(([r, n]) => (
        <li key={r}>
          <Chip size="sm">{REGION_NAMES[r] ?? r}</Chip>
          <span className={styles.count}>{n}</span>
        </li>
      ))}
    </ul>
  );
}

function summaryOf(bench: Bench, geolocation: readonly string[], nodeIndices: readonly number[]): Summary {
  const byRegion = new Map<Region, number>();
  const places: Summary['places'] = [];
  for (const i of nodeIndices) {
    const n = bench.nodes[i];
    if (!n) continue;
    byRegion.set(n.region, (byRegion.get(n.region) ?? 0) + 1);
    places.push({ id: n.id, label: n.label, tier: n.tier });
  }
  return {
    eligible: eligibleIndices(bench.nodes, geolocation).length,
    nodes: bench.nodes.length,
    placed: nodeIndices.length,
    byRegion: REGIONS.filter((r) => byRegion.has(r)).map((r) => [r, byRegion.get(r) as number]),
    places,
  };
}

// ---------------------------------------------------------------------------
// The real diorama
// ---------------------------------------------------------------------------

function RealView({
  geolocation,
  instances,
  totals,
  onSummary,
}: {
  geolocation: readonly string[];
  instances: number;
  totals?: PlacementTotals;
  onSummary: (s: Summary | null) => void;
}) {
  const [handle, setHandle] = useState<DioramaHandle | null>(null);
  const [tick, setTick] = useState(0);

  const cpu = totals?.cpu;
  const ram = totals?.ram;
  const hdd = totals?.hdd;
  const options = useMemo(() => {
    const o = placeOptionsFor(geolocation);
    const known = cpu !== undefined && ram !== undefined && hdd !== undefined;
    const size = appSizeFor(known ? { cpu, ram, hdd } : undefined);
    return {
      none: o.none || !size.fits,
      place: {
        spread: 'random' as const,
        countries: o.countries,
        regions: o.regions,
        denyRegions: o.denyRegions,
        appSize: size.size,
        waitedMin: 120,
      },
    };
  }, [geolocation, cpu, ram, hdd]);

  // The scene tells us when something moved; the summary is read from its own state so the words always
  // match the picture, whatever size the bench has on this device.
  useEffect(() => {
    if (!handle) return;
    let raf = 0;
    const off = handle.on('*', () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setTick((t) => t + 1);
      });
    });
    return () => {
      off();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [handle]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `tick` is the signal that the scene moved
  useEffect(() => {
    const bench = handle?.bench;
    const state = handle?.state();
    if (!bench || !state) {
      onSummary(null);
      return;
    }
    const placed = state.instances.filter((s) => s.node >= 0 && s.status !== 'unplaced').map((s) => s.node);
    onSummary(summaryOf(bench, geolocation, placed));
  }, [handle, tick, geolocation, onSummary]);

  return (
    <div className={styles.real}>
      <Suspense
        fallback={
          <div style={{ aspectRatio: '16 / 10' }}>
            <Skeleton shape="block" height="100%" label="Loading the map" />
          </div>
        }
      >
        <LazyDiorama
          scene="placement"
          instances={options.none ? 0 : Math.min(instances, 100)}
          place={options.place}
          annotate={['specimen', 'instances']}
          bare
          hideFreshness
          aspect="16 / 10"
          label="Where the instances could land"
          onReady={setHandle}
        />
      </Suspense>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The built-in map (fallback)
// ---------------------------------------------------------------------------

let cachedBench: Bench | null = null;
function sampleBench(): Bench {
  cachedBench ??= buildSampleBench(1, { resolution: 'low', nodes: 140 });
  return cachedBench;
}

function cssRgb(el: Element, name: string, fallback: string): string {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

function MapView({
  geolocation,
  instances,
  seed,
  height,
  onSummary,
}: {
  geolocation: readonly string[];
  instances: number;
  seed: string;
  height: number;
  onSummary: (s: Summary | null) => void;
}) {
  const bench = useMemo(() => sampleBench(), []);
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { width } = useElementSize(wrap);
  const reduced = useReducedMotion();

  const result = useMemo(
    () => placeInstances(bench.nodes, geolocation, instances, seed),
    [bench, geolocation, instances, seed],
  );
  const allowed = useMemo(() => new Set<string>(allowedContinents([...geolocation])), [geolocation]);

  useEffect(() => {
    onSummary(summaryOf(bench, geolocation, result.chosen));
  }, [bench, geolocation, result, onSummary]);

  // Map bench units to pixels, fitting the land extent into the box.
  const view = useMemo(() => {
    const e = bench.extent;
    const w = e.maxX - e.minX;
    const h = e.maxY - e.minY;
    const pad = 10;
    const scale = Math.min((width - pad * 2) / w, (height - pad * 2) / h);
    const ox = (width - w * scale) / 2 - e.minX * scale;
    const oy = (height - h * scale) / 2 - e.minY * scale;
    return { scale: Number.isFinite(scale) && scale > 0 ? scale : 1, ox, oy };
  }, [bench, width, height]);

  const px = (x: number) => x * view.scale + view.ox;
  const py = (y: number) => y * view.scale + view.oy;

  // The terrain: drawn once per size and rule change, not per frame.
  useEffect(() => {
    const el = canvas.current;
    if (!el || width < 10) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = Math.round(width * dpr);
    el.height = Math.round(height * dpr);
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const tx = (x: number) => x * view.scale + view.ox;
    const ty = (y: number) => y * view.scale + view.oy;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const accent = cssRgb(el, '--accent-rgb', '79 122 212').split(/\s+/).join(',');
    const hot = cssRgb(el, '--accent-hot-rgb', '174 198 255').split(/\s+/).join(',');
    const { cells } = bench;
    const r = view.scale * 0.94;
    const hex = (cx: number, cy: number) => {
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + (k * Math.PI) / 3;
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };
    const restricted = allowed.size > 0;
    for (let i = 0; i < cells.count; i++) {
      const region = REGIONS[cells.region[i] as number] as Region | undefined;
      const lit = !restricted || (region !== undefined && allowed.has(region));
      ctx.fillStyle = lit ? `rgba(${accent},0.2)` : 'rgba(255,255,255,0.045)';
      hex(tx(cells.x[i] as number), ty(cells.y[i] as number));
      ctx.fill();
    }
    // Nodes: the ones that qualify glow, the rest are dim.
    const eligible = new Set(result.eligible);
    bench.nodes.forEach((n, i) => {
      const ok = eligible.has(i);
      ctx.beginPath();
      ctx.arc(tx(n.x), ty(n.y), ok ? 2.4 : 1.6, 0, Math.PI * 2);
      ctx.fillStyle = ok ? `rgba(${hot},0.95)` : 'rgba(255,255,255,0.18)';
      ctx.fill();
    });
  }, [bench, width, height, view, allowed, result.eligible]);

  const source = { x: width / 2, y: 4 };
  const showArcs = result.chosen.length <= 16;

  return (
    <div ref={wrap} className={styles.map} style={{ blockSize: height }} aria-hidden="true">
      <canvas ref={canvas} className={styles.canvas} style={{ inlineSize: width, blockSize: height }} />
      <svg className={styles.overlay} viewBox={`0 0 ${Math.max(1, width)} ${height}`} aria-hidden="true">
        {showArcs
          ? result.chosen.map((nodeIndex, k) => {
              const n = bench.nodes[nodeIndex];
              if (!n) return null;
              const x = px(n.x);
              const y = py(n.y);
              const mx = (source.x + x) / 2;
              const my = Math.min(source.y, y) - 18;
              return (
                <path
                  key={`a${nodeIndex}`}
                  className={styles.arc}
                  d={`M${source.x} ${source.y} Q${mx} ${my} ${x} ${y}`}
                  style={{ '--k': k } as CSSProperties}
                  data-static={reduced ? 'true' : undefined}
                />
              );
            })
          : null}
        {result.chosen.map((nodeIndex, k) => {
          const n = bench.nodes[nodeIndex];
          if (!n) return null;
          return (
            <g key={`n${nodeIndex}`} transform={`translate(${px(n.x)} ${py(n.y)})`}>
              <circle className={styles.ring} r={9} style={{ '--k': k } as CSSProperties} />
              <polygon
                className={styles.marker}
                points="0,-6 5.2,-3 5.2,3 0,6 -5.2,3 -5.2,-3"
                style={{ '--k': k } as CSSProperties}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The component
// ---------------------------------------------------------------------------

export interface PlacementPreviewProps {
  /** The app's `geolocation` rules. */
  geolocation: readonly string[];
  instances: number;
  /** The app's CPU, RAM and disk totals. They decide which node tiers the picture considers. */
  totals?: PlacementTotals;
  /** Stable text for the built-in map's seeded placement (the app name). */
  seed?: string;
  /** Height of the built-in map in px. Default 176. */
  height?: number;
  className?: string;
}

export function PlacementPreview({
  geolocation,
  instances,
  totals,
  seed = 'app',
  height = 176,
  className,
}: PlacementPreviewProps) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const fits = useMemo(() => {
    if (!totals) return true;
    return appSizeFor(totals).fits;
  }, [totals]);

  const builtIn = (
    <MapView
      geolocation={geolocation}
      instances={fits ? instances : 0}
      seed={seed}
      height={height}
      onSummary={setSummary}
    />
  );

  return (
    <section
      className={`${styles.preview}${className ? ` ${className}` : ''}`}
      aria-label="Placement preview"
    >
      <header className={styles.head}>
        <h3 className={styles.title}>Where it could land</h3>
        <FreshnessChip kind="simulation" />
      </header>

      <Boundary fallback={builtIn}>
        <RealView geolocation={geolocation} instances={instances} totals={totals} onSummary={setSummary} />
      </Boundary>

      <Caption summary={summary} geolocation={geolocation} instances={instances} fits={fits} />
      <Regions byRegion={summary?.byRegion ?? []} />

      <ul className="sr-only">
        {(summary?.places ?? []).map((n) => (
          <li key={n.id}>
            {n.label}, {n.tier}
          </li>
        ))}
      </ul>
    </section>
  );
}
