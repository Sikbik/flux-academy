import type { CSSProperties } from 'react';
import { cn } from '../internal/cn';
import styles from './Annotations.module.css';
import { useDraw } from './draw';
import {
  type Box,
  crisp,
  crosshairGeometry,
  type DimensionInput,
  type DimSide,
  dimensionGeometry,
  fitDimension,
  fitLeader,
  fmt,
  LABEL_GAP,
  type LeaderRoute,
  labelBeside,
  leaderGeometry,
  monoWidth,
  type Point,
  pointOnRing,
  polyline,
  routeBetween,
  rulerTicks,
  type Side8,
  tickPath,
} from './geometry';

/*
 * Every part here is SVG-native and draws in the units of the <svg> it sits in. Inside
 * `Annotated` and `Figure` that is rendered pixels (a 1:1 viewBox), so a stroke is exactly
 * 1 px. Inside an author's own scaled viewBox the strokes scale with the drawing. There is
 * no `vector-effect: non-scaling-stroke` here on purpose: Chromium ignores `pathLength`
 * for dash patterns when it is set, which would break the draw-in.
 */

/** Props every drawing part shares. */
export interface DrawProps {
  /**
   * Whether the part is drawn. Defaults to the nearest `DrawContext`, else true. Flip it
   * from false to true to play the draw-in (strokes draw along their length; dots snap in).
   */
  draw?: boolean;
  /** Milliseconds before the draw starts. */
  delay?: number;
  /** Milliseconds the draw takes. Default: the `--dur-4` token (700 ms). */
  duration?: number;
  className?: string;
}

/** The nominal draw duration, used only to stagger sub-parts in JS. Matches `--dur-4`. */
const NOMINAL_MS = 700;

function timing(delay?: number, duration?: number): CSSProperties {
  const style: Record<string, string> = {};
  if (delay) style['--draw-delay'] = `${delay}ms`;
  if (duration) style['--draw-duration'] = `${duration}ms`;
  return style as CSSProperties;
}

/** Inline custom properties for the draw timeline of one element: start and span, as fractions. */
function at(start: number, span = 1): CSSProperties {
  return { '--s': start, '--k': span } as CSSProperties;
}

// ---------------------------------------------------------------------------
// LeaderLine
// ---------------------------------------------------------------------------

export interface LeaderLineProps extends DrawProps {
  /** The start: usually the point on the thing being annotated. */
  from: Point;
  /** The end: usually the edge of a callout ring. */
  to: Point;
  /** Where to put a filled anchor dot. Default `start`. */
  dot?: 'start' | 'end' | 'both' | 'none';
  /** `elbow` runs 45 degrees, then straight along the longer axis (the reference style). */
  route?: LeaderRoute;
  /** Anchor dot radius, px. Default 2.5. */
  dotRadius?: number;
}

/**
 * A one pixel leader line with an anchor dot. It draws from `from` to `to`; the dot snaps in
 * as the line starts. For use inside an `<svg>`.
 *
 *   <LeaderLine from={{ x: 40, y: 120 }} to={{ x: 110, y: 60 }} route="elbow" />
 */
export function LeaderLine({
  from,
  to,
  dot = 'start',
  route = 'straight',
  dotRadius = 2.5,
  draw,
  delay,
  duration,
  className,
}: LeaderLineProps) {
  const drawn = useDraw(draw);
  const pts = routeBetween(from, to, route);
  return (
    <g
      className={cn(styles.part, className)}
      data-kind="callout"
      data-drawn={drawn}
      style={timing(delay, duration)}
    >
      <path className={styles.stroke} d={polyline(pts)} pathLength={1} style={at(0, 1)} />
      {dot === 'start' || dot === 'both' ? (
        <circle className={styles.dot} cx={from.x} cy={from.y} r={dotRadius} style={at(0, 0.3)} />
      ) : null}
      {dot === 'end' || dot === 'both' ? (
        <circle className={styles.dot} cx={to.x} cy={to.y} r={dotRadius} style={at(1, 0.3)} />
      ) : null}
    </g>
  );
}

// ---------------------------------------------------------------------------
// CalloutMarker
// ---------------------------------------------------------------------------

export interface CalloutMarkerProps extends DrawProps {
  /** The centre of the ring. */
  x: number;
  y: number;
  /** The number (or letter) inside the ring. */
  n?: number | string;
  /** Ring radius, px. Default 13. */
  r?: number;
  /** If given, a straight leader runs from this point (with a dot) to the ring. */
  anchor?: Point;
  /** A short label set beside the ring (mono, uppercase). */
  label?: string;
  /** Which side of the ring the label sits. Default `right`. */
  labelSide?: 'left' | 'right';
  /** Where the ring starts drawing, in degrees (0 is 3 o clock, clockwise). Default -90. */
  startAngle?: number;
}

/**
 * A numbered callout ring: a 1 px circle that draws around a dark disc holding the number.
 * With `anchor` it brings its own straight leader and anchor dot. For use inside an `<svg>`.
 *
 *   <CalloutMarker x={120} y={60} n={1} anchor={{ x: 90, y: 100 }} />
 */
export function CalloutMarker({
  x,
  y,
  n,
  r = 13,
  anchor,
  label,
  labelSide = 'right',
  startAngle,
  draw,
  delay,
  duration,
  className,
}: CalloutMarkerProps) {
  const drawn = useDraw(draw);
  const cx = crisp(x);
  const cy = crisp(y);
  const start = anchor ? Math.round((Math.atan2(anchor.y - cy, anchor.x - cx) * 180) / Math.PI) : -90;
  const rot = startAngle ?? start;
  const edge = anchor ? pointOnRing({ x: cx, y: cy }, r, anchor) : null;
  const lead = anchor && edge ? polyline([anchor, edge]) : null;
  const lx = labelSide === 'right' ? cx + r + LABEL_GAP : cx - r - LABEL_GAP;
  return (
    <g
      className={cn(styles.part, className)}
      data-kind="callout"
      data-drawn={drawn}
      style={timing(delay, duration)}
    >
      {lead && anchor ? (
        <>
          <path className={styles.stroke} d={lead} pathLength={1} style={at(0, 0.55)} />
          <circle className={styles.dot} cx={anchor.x} cy={anchor.y} r={2.5} style={at(0, 0.25)} />
        </>
      ) : null}
      <circle className={styles.disc} cx={cx} cy={cy} r={r - 0.5} style={at(anchor ? 0.5 : 0.35, 0.3)} />
      <circle
        className={styles.stroke}
        cx={cx}
        cy={cy}
        r={r}
        pathLength={1}
        transform={`rotate(${rot} ${cx} ${cy})`}
        style={at(anchor ? 0.45 : 0, anchor ? 0.55 : 0.75)}
      />
      {n !== undefined ? (
        <text
          className={cn(styles.text, styles.num)}
          x={cx}
          y={cy}
          dy="0.36em"
          textAnchor="middle"
          style={at(anchor ? 0.8 : 0.55, 0.25)}
        >
          {n}
        </text>
      ) : null}
      {label ? (
        <text
          className={cn(styles.text, styles.tag)}
          x={lx}
          y={cy}
          dy="0.36em"
          textAnchor={labelSide === 'right' ? 'start' : 'end'}
          style={at(0.85, 0.3)}
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Annotation: a leader plus a ring, the unit of a figure
// ---------------------------------------------------------------------------

export interface AnnotationProps extends DrawProps {
  /** The point on the thing being annotated. */
  anchor: Point;
  /** Which way the leader leaves the anchor. Default `tr`. */
  side?: Side8;
  /** Leader length from the anchor to the ring edge, px. Default 46. */
  length?: number;
  /** `elbow` (default for diagonal sides) bends the leader like the reference. */
  route?: LeaderRoute;
  n?: number | string;
  label?: string;
  r?: number;
  /**
   * When given, the ring flips to the side with room inside this box. If no side has room
   * for the label as well, the label is dropped and the ring stays (a legend carries it).
   */
  box?: Box;
  /** How far the ring may poke outside `box`, px. Default 0. */
  bleed?: number;
}

/**
 * The unit of annotation: an anchor dot on the object, a leader, and a numbered ring, drawn
 * in that order. Give it a `box` and it flips to the side that has room.
 *
 *   <Annotation anchor={{ x: 180, y: 140 }} side="tr" n={2} label="Instance" />
 */
export function Annotation({
  anchor,
  side = 'tr',
  length = 46,
  route,
  n,
  label,
  r = 13,
  box,
  bleed = 0,
  draw,
  delay = 0,
  duration,
  className,
}: AnnotationProps) {
  const drawn = useDraw(draw);
  const input = {
    anchor,
    side,
    length,
    ringRadius: r,
    route: route ?? (side.length === 2 ? ('elbow' as const) : ('straight' as const)),
  };
  // The tag is set at 10 px with 0.1em tracking (see `.tag` in the module CSS).
  const labelWidth = label ? monoWidth(label, 10, 1) : 0;
  let g = box ? fitLeader(input, box, bleed, labelWidth) : { ...leaderGeometry(input), fits: true };
  let text = label;
  if (box && label && !g.fits) {
    g = fitLeader(input, box, bleed);
    text = undefined;
  }
  const T = duration ?? NOMINAL_MS;
  const last = g.points[g.points.length - 1] ?? anchor;
  const elbow = g.points.length > 2;
  const labelSide = g.ring.x >= anchor.x ? 'right' : 'left';
  return (
    <g className={className}>
      <LeaderLine
        from={anchor}
        to={last}
        route={elbow ? 'elbow' : 'straight'}
        draw={drawn}
        delay={delay}
        duration={Math.round(T * 0.62)}
      />
      <CalloutMarker
        x={g.ring.x}
        y={g.ring.y}
        n={n}
        r={r}
        label={text}
        labelSide={labelSide}
        startAngle={Math.round((Math.atan2(last.y - g.ring.y, last.x - g.ring.x) * 180) / Math.PI)}
        draw={drawn}
        delay={delay + Math.round(T * 0.5)}
        duration={Math.round(T * 0.6)}
      />
    </g>
  );
}

// ---------------------------------------------------------------------------
// DimensionLine
// ---------------------------------------------------------------------------

export interface DimensionLineProps extends DrawProps {
  /** The two measured points (the edges of the object). */
  from: Point;
  to: Point;
  /** The value, in mono. The line breaks around it when it fits. */
  label?: string;
  /** Distance of the dimension line from the measured points, px. Default 22. */
  offset?: number;
  /** Which screen side the line sits on. Default `top`, or `left` for a vertical run. */
  side?: DimSide;
  /** End treatment: small arrowheads (default), perpendicular bars, or both. */
  caps?: 'bar' | 'arrow' | 'both';
  /** Draw the extension (witness) lines from the object. Default true. */
  extensions?: boolean;
  /** Label size, px. Default 11. */
  fontSize?: number;
  /**
   * When given, the line is kept inside this box: the offset shrinks to the room there is,
   * and the dimension flips to the other side of the object when the requested side has none.
   */
  box?: Box;
}

/**
 * An engineering dimension: two extension lines from the object, a dimension line with end
 * caps and a mono value set into a break in the line. Draws extension lines first, then the
 * line, then snaps the arrowheads and the value in. For use inside an `<svg>`.
 *
 *   <DimensionLine from={{ x: 40, y: 220 }} to={{ x: 360, y: 220 }} label="320 px" side="bottom" />
 */
export function DimensionLine({
  from,
  to,
  label,
  offset = 22,
  side,
  caps = 'arrow',
  extensions = true,
  fontSize = 11,
  box,
  draw,
  delay,
  duration,
  className,
}: DimensionLineProps) {
  const drawn = useDraw(draw);
  // Axis-aligned runs sit on pixel centres so the 1 px lines are crisp.
  const aligned = from.x === to.x || from.y === to.y;
  const a = aligned ? { x: crisp(from.x), y: crisp(from.y) } : from;
  const b = aligned ? { x: crisp(to.x), y: crisp(to.y) } : to;
  const labelWidth = label ? monoWidth(label, fontSize, 0.4) : 0;
  let input: DimensionInput = {
    from: a,
    to: b,
    offset,
    side,
    arrow: caps === 'bar' ? 0 : 7,
    labelWidth,
  };
  if (box) {
    // Room for the value above or below the line, and for the extension lines to overshoot.
    const inline = dimensionGeometry(input).labelInline;
    input = fitDimension(input, box, Math.ceil(fontSize * (inline ? 0.6 : 1.5)) + 4);
  }
  const g = dimensionGeometry(input);
  const showArrows = caps === 'arrow' || caps === 'both';
  const showBars = caps === 'bar' || caps === 'both';
  const labelPos = g.labelInline ? g.labelAt : labelBeside(g, fontSize * 0.9);
  return (
    <g
      className={cn(styles.part, className)}
      data-kind="furniture"
      data-drawn={drawn}
      style={timing(delay, duration)}
    >
      {extensions
        ? g.ext.map((e, i) => (
            <path
              // biome-ignore lint/suspicious/noArrayIndexKey: two fixed extension lines
              key={i}
              className={styles.stroke}
              d={polyline(e)}
              pathLength={1}
              style={at(0, 0.4)}
            />
          ))
        : null}
      {g.segments.map((s, i) => (
        <path
          // biome-ignore lint/suspicious/noArrayIndexKey: one or two fixed pieces
          key={i}
          className={styles.stroke}
          d={polyline(s)}
          pathLength={1}
          style={at(0.25, 0.65)}
        />
      ))}
      {showBars
        ? g.bars.map((bar, i) => (
            <path
              // biome-ignore lint/suspicious/noArrayIndexKey: two fixed end bars
              key={i}
              className={styles.stroke}
              d={polyline(bar)}
              pathLength={1}
              style={at(0.25, 0.3)}
            />
          ))
        : null}
      {showArrows
        ? g.arrows.map((ar, i) => (
            <polygon
              // biome-ignore lint/suspicious/noArrayIndexKey: two fixed arrowheads
              key={i}
              className={styles.arrow}
              points={`${fmt(ar.tip.x)},${fmt(ar.tip.y)} ${fmt(ar.a.x)},${fmt(ar.a.y)} ${fmt(ar.b.x)},${fmt(ar.b.y)}`}
              style={at(0.3, 0.3)}
            />
          ))
        : null}
      {label ? (
        <text
          className={cn(styles.text, styles.value)}
          x={labelPos.x}
          y={labelPos.y}
          dy="0.36em"
          textAnchor="middle"
          transform={
            g.labelAngle ? `rotate(${g.labelAngle} ${fmt(labelPos.x)} ${fmt(labelPos.y)})` : undefined
          }
          style={{ ...at(0.8, 0.25), fontSize }}
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Crosshair
// ---------------------------------------------------------------------------

export interface CrosshairProps extends DrawProps {
  x: number;
  y: number;
  /** Overall size, px. Default 13. */
  size?: number;
  /** An open gap at the centre, px. Default 0. */
  gap?: number;
  /** A reticle: a ring with the arms crossing it and a centre dot. */
  ring?: boolean;
}

/**
 * A thin "+" mark, or with `ring` a reticle. The arms draw out from the centre. For use
 * inside an `<svg>`.
 *
 *   <Crosshair x={80} y={80} size={15} ring />
 */
export function Crosshair({
  x,
  y,
  size = 13,
  gap = 0,
  ring = false,
  draw,
  delay,
  duration,
  className,
}: CrosshairProps) {
  const drawn = useDraw(draw);
  const g = crosshairGeometry({ x, y, size, gap, ring });
  return (
    <g
      className={cn(styles.part, className)}
      data-kind="furniture"
      data-drawn={drawn}
      style={timing(delay, duration)}
    >
      {g.ring ? (
        <circle
          className={styles.stroke}
          cx={g.ring.cx}
          cy={g.ring.cy}
          r={g.ring.r}
          pathLength={1}
          transform={`rotate(-90 ${g.ring.cx} ${g.ring.cy})`}
          style={at(0, 0.7)}
        />
      ) : null}
      <path
        className={styles.stroke}
        d={g.arms}
        pathLength={1}
        style={at(g.ring ? 0.3 : 0, g.ring ? 0.7 : 1)}
      />
      {g.dot ? (
        <circle className={styles.dot} cx={g.dot.cx} cy={g.dot.cy} r={g.dot.r} style={at(0.8, 0.2)} />
      ) : null}
    </g>
  );
}

// ---------------------------------------------------------------------------
// TickRuler
// ---------------------------------------------------------------------------

export interface TickRulerProps extends DrawProps {
  /** The origin: where the first tick stands. */
  x: number;
  y: number;
  /** Length of the ruler along its axis, px. */
  length: number;
  orientation?: 'horizontal' | 'vertical';
  /** Distance between ticks, px. Default 6. */
  step?: number;
  /** Every Nth tick is a long one. Default 5. */
  major?: number;
  minorLength?: number;
  majorLength?: number;
  /** Which way the ticks stand off the baseline. Default `down` (horizontal) or `right` (vertical). */
  side?: 'up' | 'down' | 'left' | 'right';
  /** Draw the baseline the ticks stand on. Default false. */
  baseline?: boolean;
  /** Number the major ticks in mono. */
  labels?: boolean;
  /** Label every Nth major tick. Default 1. */
  labelEvery?: number;
  /** The value of one tick step. Default 1. */
  valuePerTick?: number;
  /** Formats a label value. Default: the integer or one decimal. */
  format?: (value: number) => string;
  /** Label size, px. Default 10. */
  labelSize?: number;
}

function defaultFormat(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/**
 * A tick ruler: minor ticks every `step` px, a long tick every `major`th, optional mono
 * numerals under the majors. Ticks draw one after another along the ruler. For use inside
 * an `<svg>`.
 *
 *   <TickRuler x={20} y={300} length={300} step={6} labels valuePerTick={10} />
 */
export function TickRuler({
  x,
  y,
  length,
  orientation = 'horizontal',
  step = 6,
  major = 5,
  minorLength = 5,
  majorLength = 9,
  side,
  baseline = false,
  labels = false,
  labelEvery = 1,
  valuePerTick = 1,
  format = defaultFormat,
  labelSize = 10,
  draw,
  delay,
  duration,
  className,
}: TickRulerProps) {
  const drawn = useDraw(draw);
  const horizontal = orientation === 'horizontal';
  const dir = side ?? (horizontal ? 'down' : 'right');
  const sign = dir === 'up' || dir === 'left' ? -1 : 1;
  const d = tickPath({
    x,
    y,
    length,
    orientation,
    step,
    majorEvery: major,
    minorLength,
    majorLength,
    side: dir,
  });
  const majors = labels ? rulerTicks(length, step, major).filter((t) => t.major) : [];
  const every = Math.max(1, Math.round(labelEvery));
  const bx = crisp(x);
  const by = crisp(y);
  const base = horizontal
    ? `M${fmt(bx)} ${fmt(by)}H${fmt(crisp(x + length))}`
    : `M${fmt(bx)} ${fmt(by)}V${fmt(crisp(y + length))}`;
  // Distance from the baseline to the label centre (horizontal) or its near edge (vertical).
  const reach = majorLength + 4 + labelSize * 0.55;
  return (
    <g
      className={cn(styles.part, className)}
      data-kind="furniture"
      data-drawn={drawn}
      style={timing(delay, duration)}
    >
      {baseline ? <path className={styles.stroke} d={base} pathLength={1} style={at(0, 0.8)} /> : null}
      <path className={styles.stroke} d={d} pathLength={1} style={at(0.05, 0.95)} />
      {majors.map((t, i) => {
        if (i % every !== 0) return null;
        const along = t.at / Math.max(length, 1);
        return (
          <text
            key={t.index}
            className={cn(styles.text, styles.value)}
            x={horizontal ? crisp(x + t.at) : bx + sign * (majorLength + 5)}
            y={horizontal ? by + sign * reach : crisp(y + t.at)}
            dy="0.36em"
            textAnchor={horizontal ? 'middle' : sign > 0 ? 'start' : 'end'}
            style={{ ...at(0.55 + 0.35 * along, 0.2), fontSize: labelSize }}
          >
            {format(t.index * valuePerTick)}
          </text>
        );
      })}
    </g>
  );
}
