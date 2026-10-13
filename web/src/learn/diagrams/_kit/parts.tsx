/**
 * The parts a diagram is drawn from. Every part takes a state `s` ('off' | 'on' | 'focus') and an
 * optional start delay `d` (ms, relative to the beat change), and renders into the `.k` state group that
 * kit.module.css animates. Parts never hold state: a beat change is a prop change and CSS does the rest.
 *
 * Coordinates are CSS pixels in the diagram's own space (see Diagram.tsx).
 */

import { type CSSProperties, type ReactNode, useId } from 'react';
import {
  arrowHeadD,
  type CutStyle,
  chamferD,
  crossD,
  dimD,
  endAngle,
  hexD,
  leader,
  monoWidth,
  type Pt,
  plateD,
  polyD,
  rulerD,
} from './geometry';
import styles from './kit.module.css';
import type { S } from './state';

export type Tone = 'crit' | 'ok' | 'warn';
export type Tier = 'cumulus' | 'nimbus' | 'stratus';

/** Props every part shares. */
export interface Base {
  /** The state this part is in. Optional only for `bare` parts, which inherit their parent's. */
  s?: S;
  /**
   * Draw inside a parent part (a Hex, Slab or Plate) without a state group of its own, so the text or
   * glyph shares the parent's state and is not dimmed twice.
   */
  bare?: boolean;
  /** Start delay in ms, relative to the beat change. */
  delay?: number;
  /** A status tone for the part (always pair with a word or a glyph in the diagram). */
  tone?: Tone;
  /** Re-points the accent to a tier colour for the part. Only for things that ARE tiers. */
  tier?: Tier;
  /** Text shown in the probe readout when the pointer is over this part. */
  probe?: string;
}

const cx = (...a: Array<string | false | undefined>): string => a.filter(Boolean).join(' ');

function groupProps(b: Base, extra?: string): Record<string, unknown> {
  if (b.bare) {
    return { style: b.delay ? ({ '--d': `${b.delay}ms` } as CSSProperties) : undefined };
  }
  return {
    className: cx(styles.k, b.tone && styles[b.tone], extra),
    'data-s': b.s ?? 'on',
    'data-tier': b.tier,
    'data-probe': b.probe,
    style: b.delay ? ({ '--d': `${b.delay}ms` } as CSSProperties) : undefined,
  };
}

/** A generic state group: put several raw svg children under one state. */
export function Grp({
  s,
  delay,
  tone,
  tier,
  probe,
  bare,
  children,
  x = 0,
  y = 0,
}: Base & { children: ReactNode; x?: number; y?: number }) {
  const t = x || y ? `translate(${x} ${y})` : undefined;
  return (
    <g {...groupProps({ s, delay, tone, tier, probe, bare })} transform={t}>
      {children}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Strokes
// ---------------------------------------------------------------------------

export interface LineProps extends Base {
  /** Path data, or a list of points for a polyline. */
  d?: string;
  pts?: readonly Pt[];
  /** `ann` (bright blueprint line), `line` (quiet hairline) or `edge` (object outline). */
  kind?: 'ann' | 'line' | 'edge';
  strong?: boolean;
  dashed?: boolean;
  /** Draw a moving dash overlay while this is the focus (a live flow). */
  flow?: boolean;
  /** Add an arrow head at the end of `pts`. */
  arrow?: boolean;
  /** Add an arrow head at the start of `pts` too (a two-way link). */
  arrowStart?: boolean;
}

/** A drawn line: a path or polyline that draws on, with an optional arrow head and live flow. */
export function Line({ d: dd, pts, kind = 'ann', strong, dashed, flow, arrow, arrowStart, ...b }: LineProps) {
  const maskId = useId().replace(/:/g, '');
  const d = dd ?? (pts ? polyD(pts) : '');
  const cls = cx(
    styles.draw,
    kind === 'ann' && styles.ann,
    kind === 'line' && styles.line,
    strong && styles.strong,
  );
  const head =
    arrow && pts && pts.length > 1 ? arrowHeadD(pts[pts.length - 1] as Pt, endAngle(pts), 7) : null;
  const tail =
    arrowStart && pts && pts.length > 1
      ? arrowHeadD(pts[0] as Pt, endAngle([pts[1] as Pt, pts[0] as Pt]), 7)
      : null;
  const headDelay = { '--d': `${(b.delay ?? 0) + 360}ms` } as CSSProperties;
  return (
    <g {...groupProps(b)}>
      {dashed ? (
        <>
          <mask id={maskId} maskUnits="userSpaceOnUse" x={-10000} y={-10000} width={20000} height={20000}>
            <path className={cx(styles.draw, styles.maskStroke)} d={d} pathLength={1} />
          </mask>
          <path
            className={cx(styles.dashedLine, kind === 'ann' && styles.ann, kind === 'line' && styles.line)}
            d={d}
            mask={`url(#${maskId})`}
          />
        </>
      ) : (
        <path className={cls} d={d} pathLength={1} />
      )}
      {head && <path className={cx(styles.draw, styles.ann)} d={head} pathLength={1} style={headDelay} />}
      {tail && <path className={cx(styles.draw, styles.ann)} d={tail} pathLength={1} style={headDelay} />}
      {flow && <path className={styles.flow} d={d} />}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Objects: glass hexes, chamfered slabs, iso plates
// ---------------------------------------------------------------------------

export interface HexProps extends Base {
  cx: number;
  cy: number;
  r: number;
  /** Extra content drawn inside under the same state (glyphs, labels). */
  children?: ReactNode;
  /** A faint accent wash in the glass. */
  wash?: boolean;
  /** Draw the outline as a quiet hairline instead of the object edge. */
  quiet?: boolean;
  /** Breathing glow while in focus. */
  breathe?: boolean;
}

/** A glass hex cell (pointy-top, the Flux symbol's angle). */
export function Hex({ cx: x, cy: y, r, children, wash, quiet, breathe, ...b }: HexProps) {
  const d = hexD(x, y, r);
  return (
    <g {...groupProps(b)}>
      <path className={cx(styles.halo, breathe && styles.breathe)} d={d} />
      <path className={styles.fill} d={d} />
      {wash && <path className={cx(styles.fill, styles.wash)} d={d} />}
      <path className={cx(styles.draw, styles.hot, quiet && styles.line)} d={d} pathLength={1} />
      {children}
    </g>
  );
}

export interface SlabProps extends Base {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Big cut size (default 10) and micro bevel (default 3). */
  c?: number;
  cm?: number;
  cut?: CutStyle;
  wash?: boolean;
  quiet?: boolean;
  children?: ReactNode;
}

/** A chamfered glass slab: the family silhouette in two dimensions. */
export function Slab({ x, y, w, h, c = 10, cm = 3, cut = 'tr-bl', wash, quiet, children, ...b }: SlabProps) {
  const d = chamferD(x, y, w, h, c, cm, cut);
  return (
    <g {...groupProps(b)}>
      <path className={styles.halo} d={d} />
      <path className={styles.fill} d={d} />
      {wash && <path className={cx(styles.fill, styles.wash)} d={d} />}
      <path className={cx(styles.draw, styles.hot, quiet && styles.line)} d={d} pathLength={1} />
      {children}
    </g>
  );
}

export interface PlateProps extends Base {
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** Thickness in px. */
  t?: number;
  /** A lit top face: the layer is the subject. */
  wash?: boolean;
  children?: ReactNode;
}

/** An iso plate: a flat hexagonal slab with thickness, like the plates in the specimen. */
export function Plate({ cx: x, cy: y, w, h, t = 7, wash, children, ...b }: PlateProps) {
  const p = plateD(x, y, w, h, t);
  return (
    <g {...groupProps(b)}>
      <path className={styles.halo} d={p.top} />
      <path className={cx(styles.fill, styles.deep)} d={p.left} />
      <path className={cx(styles.fill, styles.deep)} d={p.front} />
      <path className={cx(styles.fill, styles.deep)} d={p.right} />
      <path className={styles.fill} d={p.top} />
      {wash !== false && <path className={cx(styles.fill, styles.wash)} d={p.top} />}
      <path className={cx(styles.draw, styles.line)} d={p.edges} pathLength={1} />
      <path className={cx(styles.draw, styles.hot)} d={p.top} pathLength={1} />
      {children}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export interface TxtProps extends Base {
  x: number;
  y: number;
  /** One line or several (each is a tspan, `lh` px apart). */
  children: string | readonly string[];
  anchor?: 'start' | 'middle' | 'end';
  /** Uppercase with tracking: the instrument voice. Off for literal identifiers. */
  caps?: boolean;
  /** `lit` text-1, `dim` text-3, `acc` accent. */
  ink?: 'lit' | 'dim' | 'acc';
  size?: number;
  semi?: boolean;
  /** Brighten to text-1 while this is the focus. */
  hot?: boolean;
  /** Knock lines out from behind the text with a glass-coloured halo. */
  knock?: boolean;
  /** Display face (Montserrat Light), for big numerals. */
  disp?: boolean;
  lh?: number;
}

/** A text label. y is the vertical centre of the first line. Wipes in from the left. */
export function Txt({
  x,
  y,
  children,
  anchor = 'start',
  caps = true,
  ink,
  size,
  semi,
  hot = true,
  knock,
  disp,
  lh = 14,
  ...b
}: TxtProps) {
  const lines = typeof children === 'string' ? [children] : [...children];
  const cls = cx(
    styles.txt,
    caps && !disp && styles.caps,
    ink === 'lit' && styles.lit,
    ink === 'dim' && styles.dim,
    ink === 'acc' && styles.acc,
    semi && styles.semi,
    hot && ink !== 'acc' && styles.hot,
    knock && styles.knock,
    disp && styles.disp,
  );
  return (
    <g {...groupProps(b)}>
      <text
        className={cls}
        x={x}
        y={y}
        textAnchor={anchor}
        dy=".35em"
        style={size ? { fontSize: size } : undefined}
      >
        {lines.map((line, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static line list
          <tspan key={i} x={x} dy={i === 0 ? undefined : lh}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Annotation furniture
// ---------------------------------------------------------------------------

export const MARKER_R = 9.5;

export interface MarkerProps extends Base {
  /** The number in the circle: the beat number (1-based), matching the caption's FIG n.m. */
  n: number;
  /** Where the leader touches the object. */
  anchor: Pt;
  /** Centre of the marker circle. */
  at: Pt;
}

/** The circle of a marker: the number inside a ring that draws on. */
function BadgeParts({ n, at }: { n: number; at: Pt }) {
  return (
    <>
      <circle className={styles.markerFill} cx={at.x} cy={at.y} r={MARKER_R} />
      <circle
        className={styles.markerRing}
        cx={at.x}
        cy={at.y}
        r={MARKER_R}
        pathLength={1}
        transform={`rotate(-90 ${at.x} ${at.y})`}
      />
      <text className={styles.markerNum} x={at.x} y={at.y + 0.5}>
        {n}
      </text>
    </>
  );
}

/** A numbered circle on its own (a station on a timeline). Same look as a callout marker, no leader. */
export function Badge({ n, at, ...b }: Base & { n: number; at: Pt }) {
  return (
    <g {...groupProps(b)}>
      <BadgeParts n={n} at={at} />
    </g>
  );
}

/** A numbered callout marker on a leader line, as in the blueprint reference. */
export function Marker({ n, anchor, at, ...b }: MarkerProps) {
  const ld = leader(anchor, at, MARKER_R);
  return (
    <g {...groupProps(b)}>
      <path className={cx(styles.draw, styles.ann)} d={ld.d} pathLength={1} />
      <circle className={cx(styles.fill, styles.dot)} cx={anchor.x} cy={anchor.y} r={2.2} />
      <BadgeParts n={n} at={at} />
    </g>
  );
}

export interface DimProps extends Base {
  a: Pt;
  b: Pt;
  /** Offset from the measured edge, px (positive is to the left of a to b). */
  offset: number;
  label?: string;
  /** Label side override; default follows the offset. */
  labelDy?: number;
  /** Put the label at the start/middle/end of the line. */
  labelAnchor?: 'middle' | 'start' | 'end';
}

/** A dimension line with extension lines, end ticks and a label. */
export function Dim({ a, b, offset, label, labelDy = 0, labelAnchor = 'middle', ...base }: DimProps) {
  const dm = dimD(a, b, offset);
  return (
    <g {...groupProps(base)}>
      <path className={cx(styles.draw, styles.line)} d={dm.d} pathLength={1} />
      {label && (
        <text
          className={cx(styles.txt, styles.caps, styles.dim, styles.hot)}
          x={dm.label.x}
          y={dm.label.y + labelDy}
          textAnchor={labelAnchor}
          dy=".35em"
        >
          {label}
        </text>
      )}
    </g>
  );
}

export interface RulerProps extends Base {
  a: Pt;
  b: Pt;
  step: number;
  major?: number;
  len?: number;
  side?: 1 | -1;
}

/** A tick ruler: baseline plus ticks, drawn in one stroke. */
export function Ruler({ a, b, step, major, len, side, ...base }: RulerProps) {
  return (
    <g {...groupProps(base)}>
      <path
        className={cx(styles.draw, styles.line)}
        d={rulerD(a, b, { step, major, len, side })}
        pathLength={1}
      />
    </g>
  );
}

export interface CrossProps extends Base {
  x: number;
  y: number;
  size?: number;
}

/** A registration crosshair. */
export function Cross({ x, y, size = 4, ...base }: CrossProps) {
  return (
    <g {...groupProps(base)}>
      <path className={cx(styles.draw, styles.line)} d={crossD(x, y, size)} pathLength={1} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Movers and pings
// ---------------------------------------------------------------------------

export interface MoverProps extends Base {
  x: number;
  y: number;
  children: ReactNode;
}

/** Something that travels: its transform transitions between beats. Children are centred on (0, 0). */
export function Mover({ x, y, children, ...b }: MoverProps) {
  return (
    <g {...groupProps(b)}>
      <g className={styles.mover} style={{ transform: `translate(${x}px, ${y}px)` }}>
        {children}
      </g>
    </g>
  );
}

export interface PingProps extends Base {
  cx: number;
  cy: number;
  r: number;
  hex?: boolean;
}

/** An expanding ring that repeats while this is the focus (the block beat, a heartbeat). */
export function Ping({ cx: x, cy: y, r, hex, ...b }: PingProps) {
  return (
    <g {...groupProps(b)}>
      {hex ? (
        <path className={styles.ping} d={hexD(x, y, r)} />
      ) : (
        <circle className={styles.ping} cx={x} cy={y} r={r} />
      )}
    </g>
  );
}

/** An arrow head on its own, for a reply head at the start of a line. `angle` is in radians. */
export function Head({ at, angle, size = 7, ...b }: Base & { at: Pt; angle: number; size?: number }) {
  return (
    <g {...groupProps(b)}>
      <path className={cx(styles.draw, styles.ann)} d={arrowHeadD(at, angle, size)} pathLength={1} />
    </g>
  );
}

/** A moving dash overlay along `pts`, alive while this is the focus. Reverse `pts` to run it backwards. */
export function Flow({ pts, ...b }: Base & { pts: readonly Pt[] }) {
  return (
    <g {...groupProps(b)}>
      <path className={styles.flow} d={polyD(pts)} />
    </g>
  );
}

/** A small filled dot (an anchor, a bullet). */
export function Dot({ x, y, r = 2.5, ...b }: Base & { x: number; y: number; r?: number }) {
  return (
    <g {...groupProps(b)}>
      <circle className={cx(styles.fill, styles.dot)} cx={x} cy={y} r={r} />
    </g>
  );
}

/** A check mark or an X, drawn as strokes, for done and failed states. */
export function Mark({
  x,
  y,
  kind,
  size = 5,
  ...b
}: Base & { x: number; y: number; kind: 'check' | 'x'; size?: number }) {
  const d =
    kind === 'check'
      ? `M${x - size} ${y}L${x - size / 3} ${y + size * 0.75}L${x + size} ${y - size * 0.7}`
      : `M${x - size} ${y - size}L${x + size} ${y + size}M${x + size} ${y - size}L${x - size} ${y + size}`;
  return (
    <g {...groupProps(b)}>
      <path className={cx(styles.draw, styles.ann, styles.strong)} d={d} pathLength={1} />
    </g>
  );
}

/** Width of a chip for `text`. Use it in layout before the chip is drawn. */
export function chipWidth(text: string, size = 11, pad = 8, tracking = 0): number {
  return Math.ceil(monoWidth(text, size, tracking) + pad * 2);
}

export interface ChipProps extends Base {
  x: number;
  y: number;
  text: string;
  /** `start` puts x at the left edge, `middle` at the centre, `end` at the right edge. */
  anchor?: 'start' | 'middle' | 'end';
  size?: number;
  h?: number;
  pad?: number;
  /** Uppercase with tracking, for labels; off for literal values such as ports and names. */
  caps?: boolean;
  /** Lit text. */
  lit?: boolean;
  wash?: boolean;
}

/** A small chamfered tag with mono text: a port, a name, a value. y is the vertical centre. */
export function Chip({
  x,
  y,
  text,
  anchor = 'start',
  size = 11,
  h = 22,
  pad = 8,
  caps = false,
  lit = true,
  wash,
  ...b
}: ChipProps) {
  const tracking = caps ? 0.08 : 0;
  const w = chipWidth(text, size, pad, tracking);
  const x0 = anchor === 'start' ? x : anchor === 'middle' ? x - w / 2 : x - w;
  const d = chamferD(x0, y - h / 2, w, h, 6, 2, 'tr-bl');
  return (
    <g {...groupProps(b)}>
      <path className={cx(styles.fill, styles.deep)} d={d} />
      {wash && <path className={cx(styles.fill, styles.wash)} d={d} />}
      <path className={cx(styles.draw, styles.hot)} d={d} pathLength={1} />
      <text
        className={cx(styles.txt, caps && styles.caps, lit && styles.lit, styles.hot)}
        x={x0 + w / 2}
        y={y}
        dy=".35em"
        textAnchor="middle"
        style={size !== 11 ? { fontSize: size } : undefined}
      >
        {text}
      </text>
    </g>
  );
}

export { styles as kitStyles };
