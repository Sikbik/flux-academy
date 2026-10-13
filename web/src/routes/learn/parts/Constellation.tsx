import { TRACKS, type Track, type TrackId } from '@shared/curriculum';
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router';
import { preloadRoute } from '@/app/routes';
import { moduleArt } from '@/content/art';
import { prefetchLesson } from '@/learn/loader';
import { hexPath } from '@/lib/hex';
import {
  ancestorsOf,
  type CourseLayout,
  dependantsOf,
  HORIZONTAL_DEFAULTS,
  type LayoutLesson,
  layoutCourse,
} from '../layout';
import { type CourseModel, KIND_LABEL, type MapLesson, statusPhrase } from '../model';
import { Glyph, usePointerFine, useReducedMotion } from '../ui';
import { BandHeader, type ModuleSummary } from './BandHeader';
import styles from './Constellation.module.css';
import { chamferRectPath, gemFacets, planCard } from './geometry';
import { LessonCard } from './LessonCard';

/** Below this container width the map turns to vertical bands and drops the labels. */
const NARROW_PX = 760;

/** The header zone never grows past this many layout units, and keeps this much air under its content. */
const HEADER_MAX = 300;
const HEADER_AIR = 12;

/** The room wanted between two rows of lessons on screen (a two line label and a node), and its limit. */
const ROW_PX = 86;
const PITCH_MAX = 150;

export interface ConstellationProps {
  model: CourseModel;
  /** Called when the map settles on an orientation, so the page can describe it. */
  onOrientation?: (o: 'horizontal' | 'vertical') => void;
}

/**
 * The element's width in px, rounded to a coarse step so a window drag re-renders the map a handful of
 * times, not on every pixel. Zero until measured.
 */
function useWidth(ref: React.RefObject<HTMLElement | null>, step = 32): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.round(el.getBoundingClientRect().width / step) * step);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, step]);
  return width;
}

type Rel = 'self' | 'req' | 'anc' | 'dep' | 'none';

/** How much of its header a band can show at its current on-screen width. */
function bandDensity(px: number): 'full' | 'compact' | 'tiny' {
  return px >= 300 ? 'full' : px >= 200 ? 'compact' : 'tiny';
}

function edgeStateOf(from: MapLesson | undefined, to: MapLesson | undefined): 'idle' | 'open' | 'walked' {
  if (from?.status !== 'complete') return 'idle';
  return to?.status === 'complete' ? 'walked' : 'open';
}

/**
 * The constellation: the lessons as hexagonal nodes in three tier-coloured bands, prerequisites as lines.
 *
 * Drawing and interaction are separate layers. The SVG (hidden from assistive technology) draws bands,
 * lines, halos and the hex geometry. On top sits an ordered list of real links, one per lesson in
 * recommended order, positioned over the nodes; those carry focus, the accessible names and the click.
 * The list view is the full alternative for anyone who would rather read than look.
 */
export function Constellation({ model, onOrientation }: ConstellationProps) {
  const uid = useId().replace(/:/g, '');
  const gradientId = (edgeId: string) => `${uid}-eg-${edgeId.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const width = useWidth(wrapRef);
  const narrow = width > 0 && width < NARROW_PX;
  const fine = usePointerFine();
  const reduced = useReducedMotion();
  const orientation = narrow ? 'vertical' : 'horizontal';

  useEffect(() => onOrientation?.(orientation), [orientation, onOrientation]);

  const layoutLessons = useMemo<LayoutLesson[]>(
    () =>
      model.lessons.map((l) => ({
        id: l.meta.id,
        track: l.meta.track,
        module: l.meta.module,
        order: l.meta.order,
        prerequisites: l.meta.prerequisites,
      })),
    [model.lessons],
  );
  const trackIds = useMemo(() => TRACKS.map((t) => t.id), []);

  // The band headers are real text at a fixed size while the map scales with the page, so a narrow page
  // needs a taller header zone (in layout units) than a wide one. The header's own height is measured after
  // render and fed back as `headerSize`; the map's width does not depend on it, so this settles in one step.
  const [headPx, setHeadPx] = useState(0);
  const baseWidth = useMemo(
    () => layoutCourse(layoutLessons, trackIds, { orientation }).width,
    [layoutLessons, trackIds, orientation],
  );
  const unit = width > 0 ? width / baseWidth : 1;
  const headerSize =
    orientation === 'horizontal' && headPx > 0
      ? Math.min(HEADER_MAX, Math.max(HORIZONTAL_DEFAULTS.headerSize, Math.ceil(headPx / unit) + HEADER_AIR))
      : undefined;
  // Labels are real text at a fixed size, so when the map is scaled down the rows must be spaced further
  // apart (in layout units) to keep the same room between a label and the node under it.
  const pitchV =
    orientation === 'horizontal'
      ? Math.min(PITCH_MAX, Math.max(HORIZONTAL_DEFAULTS.pitchV, Math.ceil(ROW_PX / unit / 4) * 4))
      : undefined;
  const layout: CourseLayout = useMemo(
    () => layoutCourse(layoutLessons, trackIds, { orientation, headerSize, pitchV }),
    [layoutLessons, trackIds, orientation, headerSize, pitchV],
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [previewModule, setPreviewModule] = useState<string | null>(null);
  const [pinnedModule, setPinnedModule] = useState<string | null>(null);
  const closeTimer = useRef(0);
  const focusModule = previewModule ?? pinnedModule;
  // What was open when the finger went down: a tap opens the card first and the lesson second, and the
  // focus a tap may also cause must not count as "already open".
  const activeRef = useRef<string | null>(null);
  const downFor = useRef<string | null>(null);
  activeRef.current = activeId;

  const open = useCallback((id: string) => {
    window.clearTimeout(closeTimer.current);
    setActiveId(id);
  }, []);
  const closeSoon = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setActiveId(null), 110);
  }, []);
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  // Escape puts the highlight away, as in every popup.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveId(null);
        setPinnedModule(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const byTrack = useMemo(() => {
    const out = new Map<TrackId, MapLesson[]>();
    for (const t of TRACKS) out.set(t.id, []);
    for (const l of model.lessons) out.get(l.meta.track)?.push(l);
    return out;
  }, [model.lessons]);

  const modulesOf = useMemo(() => {
    const out = new Map<TrackId, ModuleSummary[]>();
    for (const t of TRACKS) {
      const groups = new Map<string, MapLesson[]>();
      for (const l of byTrack.get(t.id) ?? []) {
        const g = groups.get(l.meta.module);
        if (g) g.push(l);
        else groups.set(l.meta.module, [l]);
      }
      out.set(
        t.id,
        [...groups.entries()].map(([module, ls]) => ({
          module,
          key: `${t.id}|${module}`,
          count: ls.length,
          done: ls.filter((l) => l.status === 'complete').length,
          minutes: ls.reduce((s, l) => s + l.meta.minutes, 0),
          art: moduleArt(module),
        })),
      );
    }
    return out;
  }, [byTrack]);

  // Relations of the lesson in focus, or of the module in focus.
  const relation = useMemo(() => {
    const rel = new Map<string, Rel>();
    const edgeRel = new Map<string, Rel>();
    if (activeId) {
      const anc = ancestorsOf(activeId, layoutLessons);
      const direct = new Set(model.byId.get(activeId)?.meta.prerequisites ?? []);
      const deps = new Set(dependantsOf(activeId, layoutLessons));
      for (const l of model.lessons) {
        const id = l.meta.id;
        rel.set(
          id,
          id === activeId
            ? 'self'
            : direct.has(id)
              ? 'req'
              : anc.has(id)
                ? 'anc'
                : deps.has(id)
                  ? 'dep'
                  : 'none',
        );
      }
      for (const e of layout.edges) {
        const lit = new Set([...anc, activeId]);
        edgeRel.set(
          e.id,
          e.to === activeId && direct.has(e.from)
            ? 'req'
            : lit.has(e.from) && lit.has(e.to)
              ? 'anc'
              : e.from === activeId
                ? 'dep'
                : 'none',
        );
      }
    } else if (focusModule) {
      const ids = new Set(
        model.lessons.filter((l) => `${l.meta.track}|${l.meta.module}` === focusModule).map((l) => l.meta.id),
      );
      for (const l of model.lessons) rel.set(l.meta.id, ids.has(l.meta.id) ? 'self' : 'none');
      for (const e of layout.edges) edgeRel.set(e.id, ids.has(e.from) || ids.has(e.to) ? 'anc' : 'none');
    }
    return { rel, edgeRel, active: Boolean(activeId || focusModule) };
  }, [activeId, focusModule, layoutLessons, model.byId, model.lessons, layout.edges]);

  const nodeAt = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n])), [layout.nodes]);
  const trackById = useMemo(() => new Map<TrackId, Track>(TRACKS.map((t) => [t.id, t])), []);
  const activeLesson = activeId ? model.byId.get(activeId) : undefined;

  const W = layout.width;
  const H = layout.height;
  const R = layout.radius;

  // `--u`: how many CSS pixels one layout pixel is. Written straight to the element, so a resize never
  // re-renders React.
  useLayoutEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const apply = () => el.style.setProperty('--u', `${el.clientWidth / W}px`);
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [W]);
  const vertical = layout.orientation === 'vertical';

  // The natural height of the tallest band header: from the top of the header to the bottom of its last
  // child (not `scrollHeight`, which would never be less than the box it is given and so could only grow).
  // Runs after every render and only sets state when the number moved.
  useLayoutEffect(() => {
    const root = mapRef.current;
    if (!root || vertical) return;
    const measure = () => {
      let tallest = 0;
      for (const el of root.querySelectorAll<HTMLElement>(`.${styles.bandHead}`)) {
        const top = el.getBoundingClientRect().top;
        let bottom = top;
        for (const child of Array.from(el.children))
          bottom = Math.max(bottom, child.getBoundingClientRect().bottom);
        tallest = Math.max(tallest, bottom - top);
      }
      setHeadPx((prev) => (Math.abs(prev - tallest) > 2 ? Math.round(tallest) : prev));
    };
    measure();
    let alive = true;
    void document.fonts?.ready.then(() => {
      if (alive) measure();
    });
    return () => {
      alive = false;
    };
  });
  const hexFacets = useMemo(() => gemFacets(R), [R]);

  const describe = `Course map. ${model.total} lessons in ${TRACKS.length} tracks, ${model.completed} done. Lines join a lesson to the lessons that help before it. The lessons are listed below in recommended order.`;

  const style = { '--w': W, '--h': H, '--r': R, '--pitch': vertical ? 88 : 136 } as CSSProperties;

  // On touch, a tap on the map's empty space puts the card away. A listener, not a handler on the div:
  // the map itself is not a control, the lesson links inside it are.
  useEffect(() => {
    const el = mapRef.current;
    if (!el || fine) return;
    const onTap = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('a, button')) setActiveId(null);
    };
    el.addEventListener('click', onTap);
    return () => el.removeEventListener('click', onTap);
  }, [fine]);

  const warm = (id: string) => {
    prefetchLesson(id);
    preloadRoute(`/learn/${id}`);
  };

  // Where the card opens: the side that hides the fewest lessons, worked out when the focus changes.
  const cardPlan = useMemo(() => {
    if (!activeId) return null;
    const unit = (mapRef.current?.clientWidth ?? W) / W || 1;
    const requires = new Set<string>();
    const leadsTo = new Set<string>();
    for (const [id, rel] of relation.rel) {
      if (rel === 'req' || rel === 'anc') requires.add(id);
      else if (rel === 'dep') leadsTo.add(id);
    }
    return planCard({
      nodes: layout.nodes,
      activeId,
      requires,
      leadsTo,
      topLimit: vertical ? 0 : (layout.bands[0]?.headerSize ?? 0),
      width: W,
      height: H,
      radius: R,
      cardWidth: 296 / unit,
      cardHeight: 330 / unit,
      labelSpace: vertical ? 6 : 38,
    });
  }, [activeId, layout, W, H, R, vertical, relation.rel]);

  return (
    <div
      className={styles.wrap}
      ref={wrapRef}
      data-orientation={orientation}
      data-calm={reduced ? 'true' : undefined}
    >
      <div
        ref={mapRef}
        className={styles.map}
        style={style}
        data-active={relation.active ? 'true' : undefined}
      >
        <svg
          className={styles.svg}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={describe}
          focusable="false"
        >
          <defs>
            {TRACKS.map((t) => (
              <g key={t.id}>
                <radialGradient id={`${uid}-halo-${t.id}`}>
                  <stop offset="0%" style={{ stopColor: `var(--${t.id})`, stopOpacity: 0.55 }} />
                  <stop offset="55%" style={{ stopColor: `var(--${t.id})`, stopOpacity: 0.14 }} />
                  <stop offset="100%" style={{ stopColor: `var(--${t.id})`, stopOpacity: 0 }} />
                </radialGradient>
                <linearGradient id={`${uid}-band-${t.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" style={{ stopColor: `var(--${t.id})`, stopOpacity: 0.12 }} />
                  <stop offset="60%" style={{ stopColor: `var(--${t.id})`, stopOpacity: 0.035 }} />
                  <stop offset="100%" style={{ stopColor: `var(--${t.id})`, stopOpacity: 0.015 }} />
                </linearGradient>
              </g>
            ))}
            <pattern id={`${uid}-ticks`} width="12" height="8" patternUnits="userSpaceOnUse">
              <path d="M0.5 0V3M6.5 0V6" className={styles.tick} />
            </pattern>
            {vertical ? (
              <>
                {/* On a phone each band's header is a strip across its top. Lines pass behind it (they
                    fade out at its edge) so a long line never runs through the words. */}
                <linearGradient id={`${uid}-strip-fade`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#000" />
                  <stop offset="0.72" stopColor="#000" />
                  <stop offset="1" stopColor="#fff" />
                </linearGradient>
                <mask id={`${uid}-strip-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
                  <rect x="0" y="0" width={W} height={H} fill="#fff" />
                  {layout.bands.map((b) => (
                    <rect
                      key={b.track}
                      x={b.x}
                      y={b.y}
                      width={b.width}
                      height={b.headerSize + 10}
                      fill={`url(#${uid}-strip-fade)`}
                    />
                  ))}
                </mask>
              </>
            ) : null}
            {layout.edges.map((e) => {
              const a = e.points[0];
              const z = e.points[e.points.length - 1];
              const from = trackById.get(nodeAt.get(e.from)?.track as TrackId);
              const to = trackById.get(nodeAt.get(e.to)?.track as TrackId);
              if (!a || !z || !from || !to) return null;
              return (
                <linearGradient
                  key={e.id}
                  id={gradientId(e.id)}
                  gradientUnits="userSpaceOnUse"
                  x1={a.x}
                  y1={a.y}
                  x2={z.x}
                  y2={z.y}
                >
                  <stop offset="0%" style={{ stopColor: `var(--${from.id})` }} />
                  <stop offset="100%" style={{ stopColor: `var(--${to.id})` }} />
                </linearGradient>
              );
            })}
          </defs>

          <g className={styles.bands}>
            {layout.bands.map((b) => (
              <g key={b.track} data-tier={b.track}>
                <path
                  className={styles.band}
                  d={chamferRectPath(b.x, b.y, b.width, b.height, 20, 6)}
                  style={{ fill: `url(#${uid}-band-${b.track})` }}
                />
                {vertical ? (
                  <rect
                    x={b.x + 14}
                    y={b.y + b.headerSize - 2}
                    width={b.width - 28}
                    height="8"
                    fill={`url(#${uid}-ticks)`}
                    className={styles.ticks}
                  />
                ) : (
                  <rect
                    x={b.x + 14}
                    y={b.y + 6}
                    width={Math.max(0, b.width - 40)}
                    height="8"
                    fill={`url(#${uid}-ticks)`}
                    className={styles.ticks}
                  />
                )}
              </g>
            ))}
          </g>

          <g className={styles.edges} mask={vertical ? `url(#${uid}-strip-mask)` : undefined}>
            {layout.edges.map((e) => {
              const from = model.byId.get(e.from);
              const to = model.byId.get(e.to);
              const state = edgeStateOf(from, to);
              const toNext = Boolean(to?.recommended && from?.status === 'complete');
              const rel = relation.edgeRel.get(e.id) ?? 'none';
              return (
                <g
                  key={e.id}
                  data-state={state}
                  data-rel={rel}
                  data-long={e.span > 1 ? 'true' : undefined}
                  style={{ '--k': to?.meta.order ?? 0 } as CSSProperties}
                >
                  {state === 'walked' ? <path className={styles.edgeGlow} d={e.path} /> : null}
                  <path
                    className={styles.edge}
                    d={e.path}
                    pathLength={1}
                    style={
                      state === 'idle'
                        ? undefined
                        : ({ '--edge-stroke': `url(#${gradientId(e.id)})` } as CSSProperties)
                    }
                  />
                  {toNext ? <path className={styles.pulse} d={e.path} pathLength={1} /> : null}
                </g>
              );
            })}
          </g>

          <g className={styles.nodes}>
            {model.lessons.map((l) => {
              const n = nodeAt.get(l.meta.id);
              if (!n) return null;
              const rel = relation.rel.get(l.meta.id) ?? 'none';
              return (
                <g
                  key={l.meta.id}
                  className={styles.node}
                  transform={`translate(${n.x} ${n.y})`}
                  data-tier={n.track}
                  data-status={l.status}
                  data-rel={rel}
                  data-next={l.recommended ? 'true' : undefined}
                  data-soon={l.hasContent ? undefined : 'true'}
                  style={{ '--k': n.col } as CSSProperties}
                >
                  <g className={styles.pop}>
                    <circle
                      className={styles.halo}
                      r={R * 2.4}
                      style={{ fill: `url(#${uid}-halo-${n.track})` }}
                    />
                    <path className={styles.ringOuter} d={hexPath(0, 0, R + 15)} />
                    <path className={styles.ringInner} d={hexPath(0, 0, R + 8.5)} />
                    <path className={styles.base} d={hexPath(0, 0, R)} />
                    <g className={styles.facets}>
                      <path className={styles.facetTop} d={hexFacets.top} />
                      <path className={styles.facetLeft} d={hexFacets.left} />
                      <path className={styles.facetRight} d={hexFacets.right} />
                    </g>
                    <path className={styles.arcTrack} d={hexPath(0, 0, R + 5.5)} />
                    <path
                      className={styles.arc}
                      d={hexPath(0, 0, R + 5.5)}
                      pathLength={1}
                      style={{ strokeDasharray: `${l.fraction.toFixed(3)} 1.01` }}
                    />
                    <path className={styles.rim} d={hexPath(0, 0, R + 4)} />
                  </g>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Band headers, positioned over their bands. */}
        {layout.bands.map((b) => {
          const t = trackById.get(b.track as TrackId);
          if (!t) return null;
          const ti = TRACKS.findIndex((x) => x.id === t.id);
          return (
            <BandHeader
              key={b.track}
              track={t}
              index={ti}
              lessons={byTrack.get(t.id) ?? []}
              modules={modulesOf.get(t.id) ?? []}
              selectedModule={pinnedModule}
              onModulePreview={setPreviewModule}
              onModuleToggle={(key) => setPinnedModule((cur) => (cur === key ? null : key))}
              variant={vertical ? 'strip' : 'band'}
              density={bandDensity(b.width * (width > 0 ? width / W : 1))}
              className={styles.bandHead}
              style={
                {
                  '--x': b.x,
                  '--y': b.y,
                  '--bw': b.width,
                  '--bh': vertical ? b.headerSize : b.headerSize + 8,
                } as CSSProperties
              }
            />
          );
        })}

        <ol className={styles.items} aria-label="Lessons in recommended order">
          {model.lessons.map((l, i) => {
            const n = nodeAt.get(l.meta.id);
            if (!n) return null;
            const label = [
              `${i + 1}. ${l.meta.title}`,
              `${KIND_LABEL[l.meta.kind]}, ${l.meta.minutes} minutes`,
              statusPhrase(l),
              l.hasContent ? '' : 'Coming soon',
            ]
              .filter(Boolean)
              .join('. ');
            const describedBy = `${uid}-d-${l.meta.id}`;
            const pendingTitles = l.pending
              .map((id) => model.byId.get(id)?.meta.title)
              .filter((t): t is string => Boolean(t));
            const rel = relation.rel.get(l.meta.id) ?? 'none';
            return (
              <li
                key={l.meta.id}
                className={styles.item}
                style={{ '--x': n.x, '--y': n.y, '--k': n.col } as CSSProperties}
                data-rel={rel}
              >
                <Link
                  to={`/learn/${l.meta.id}`}
                  className={styles.link}
                  data-tier={l.meta.track}
                  data-status={l.status}
                  data-next={l.recommended ? 'true' : undefined}
                  data-selected={activeId === l.meta.id ? 'true' : undefined}
                  aria-label={label}
                  aria-describedby={describedBy}
                  onPointerEnter={(e: ReactPointerEvent) => {
                    if (e.pointerType === 'touch') return;
                    open(l.meta.id);
                    warm(l.meta.id);
                  }}
                  onPointerLeave={(e: ReactPointerEvent) => {
                    if (e.pointerType === 'touch') return;
                    closeSoon();
                  }}
                  onFocus={() => {
                    open(l.meta.id);
                    warm(l.meta.id);
                  }}
                  onBlur={closeSoon}
                  onPointerDown={() => {
                    downFor.current = activeRef.current;
                  }}
                  onClick={(e) => {
                    // Touch has no hover: the first tap shows the card, the second opens the lesson. A
                    // click from the keyboard (detail 0) always opens it.
                    if (!fine && e.detail > 0 && downFor.current !== l.meta.id) {
                      e.preventDefault();
                      open(l.meta.id);
                    }
                  }}
                >
                  <span className={styles.face} aria-hidden="true">
                    <span className={styles.focusRing} />
                    {l.status === 'complete' ? (
                      <Glyph name="check" size={18} strokeWidth={2.2} className={styles.check} />
                    ) : (
                      <span className={styles.num}>{l.meta.order}</span>
                    )}
                  </span>
                  {vertical ? null : <span className={styles.label}>{l.meta.title}</span>}
                  {l.recommended ? (
                    <span className={styles.tag} aria-hidden="true">
                      Next
                    </span>
                  ) : null}
                  <span className="sr-only" id={describedBy}>
                    {l.meta.summary}
                    {pendingTitles.length > 0
                      ? ` Helps to finish first, not required: ${pendingTitles.join(', ')}.`
                      : ' Needs nothing first, or everything that helps is done.'}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>

        {fine && activeLesson && cardPlan ? (
          <LessonCard
            lesson={activeLesson}
            trackName={trackById.get(activeLesson.meta.track)?.name ?? ''}
            requires={activeLesson.meta.prerequisites.map((id) => ({
              id,
              title: model.byId.get(id)?.meta.title ?? id,
              done: model.byId.get(id)?.status === 'complete',
            }))}
            leadsTo={dependantsOf(activeLesson.meta.id, layoutLessons).length}
            mode="float"
            side={cardPlan.side}
            href={`/learn/${activeLesson.meta.id}`}
            className={styles.card}
            style={{ '--cx': cardPlan.left, '--cy': cardPlan.top } as CSSProperties}
            onPointerEnter={() => open(activeLesson.meta.id)}
            onPointerLeave={closeSoon}
          />
        ) : null}
      </div>

      {fine ? null : (
        <div className={styles.dock} aria-live="polite" data-open={activeLesson ? 'true' : undefined}>
          {activeLesson ? (
            <LessonCard
              lesson={activeLesson}
              trackName={trackById.get(activeLesson.meta.track)?.name ?? ''}
              requires={activeLesson.meta.prerequisites.map((id) => ({
                id,
                title: model.byId.get(id)?.meta.title ?? id,
                done: model.byId.get(id)?.status === 'complete',
              }))}
              leadsTo={dependantsOf(activeLesson.meta.id, layoutLessons).length}
              mode="dock"
              href={`/learn/${activeLesson.meta.id}`}
            />
          ) : (
            <p className={styles.dockHint}>Tap a lesson to see what it covers. Tap it again to open it.</p>
          )}
        </div>
      )}
    </div>
  );
}
