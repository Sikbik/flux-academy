import { type CSSProperties, type ReactNode, useId, useRef } from 'react';
import { useElementSize } from '../hooks/useElementSize';
import { useInView } from '../hooks/useInView';
import { cn } from '../internal/cn';
import { Panel } from '../Panel/Panel';
import { Annotated } from './Annotated';
import { Annotation, DimensionLine } from './Annotations';
import { DrawContext, useDraw } from './draw';
import styles from './Figure.module.css';
import { type DimSide, defaultSide, type Side8, toPx } from './geometry';
import { ProbeReticle, type ProbeReticleProps } from './Probe';

// ---------------------------------------------------------------------------
// FigCaption
// ---------------------------------------------------------------------------

/** The ids a `FigCaption` with an `id` gives its title line and its note, for `aria-labelledby`. */
const captionTitleId = (id: string) => `${id}-title`;
const captionNoteId = (id: string) => `${id}-note`;

export interface FigCaptionProps {
  /** The figure number, for example `3.2`. Rendered as "FIG 3.2". */
  num?: string;
  /** The title: sentence case here, set in mono capitals. */
  title?: ReactNode;
  /** A sentence of explanation under the line. */
  note?: ReactNode;
  id?: string;
  /** Draw the rule. Defaults to the nearest `DrawContext`, else drawn. */
  draw?: boolean;
  className?: string;
}

/**
 * The caption of a figure: a drawn hairline, then `FIG 3.2  PLACEMENT OF THREE INSTANCES`
 * with a hex bullet, then an optional note. Renders a `<figcaption>`, so use it inside a
 * `<figure>` (or let `Figure` do it).
 *
 *   <FigCaption num="3.2" title="Placement of three instances" />
 */
export function FigCaption({ num, title, note, id, draw, className }: FigCaptionProps) {
  const drawn = useDraw(draw);
  return (
    <figcaption id={id} className={cn(styles.caption, className)} data-drawn={drawn}>
      <span className={styles.rule} aria-hidden="true" />
      <span id={id ? captionTitleId(id) : undefined} className={styles.line}>
        <span className={styles.bullet} aria-hidden="true" />
        {num ? <span className={styles.num}>Fig {num}</span> : null}
        {title ? <span className={styles.title}>{title}</span> : null}
      </span>
      {note ? (
        <span id={id ? captionNoteId(id) : undefined} className={styles.note}>
          {note}
        </span>
      ) : null}
    </figcaption>
  );
}

// ---------------------------------------------------------------------------
// Figure
// ---------------------------------------------------------------------------

/** One numbered callout on a figure. Coordinates are fractions (0..1) of the content box. */
export interface FigureAnnotation {
  id: string;
  /** Where on the content box the anchor dot sits: [x, y], each 0..1. */
  at: readonly [number, number];
  /** The number in the ring. Default: its position in the list, from 1. */
  n?: number | string;
  /** A short name, set beside the ring and listed in the legend. */
  label?: string;
  /** A sentence for the legend: what this callout points at. */
  note?: ReactNode;
  /** Which way the leader leaves the anchor. Default: toward the nearer open corner. */
  side?: Side8;
  /** Leader length from the anchor to the ring edge, px. Default 46. */
  length?: number;
  /** `straight` or `elbow`. Default: elbow for diagonal sides. */
  route?: 'straight' | 'elbow';
}

/** A dimension line on a figure. Points are fractions (0..1) of the content box. */
export interface FigureDimension {
  id?: string;
  from: readonly [number, number];
  to: readonly [number, number];
  /** The value shown on the line, for example "320 px". */
  label?: string;
  /** What is being measured, for the legend: "Width of the cell". */
  name?: string;
  /** Which screen side the dimension line sits on. */
  side?: DimSide;
  /** Distance from the measured points, px. Default 22. */
  offset?: number;
  caps?: 'bar' | 'arrow' | 'both';
}

export interface FigureProps {
  /** The content: a diagram, a canvas, an image. It fills the content box. */
  children?: ReactNode;
  /** The figure number: `3.2` shows "FIG 3.2". */
  num?: string;
  /** The title in the caption. */
  caption?: ReactNode;
  /** A sentence under the caption. */
  note?: ReactNode;
  /** The content box's aspect ratio: `16 / 9`, `4 / 3`, or a number. Omit for natural height. */
  ratio?: string | number;
  /** `panel` (default, a slab), `ghost` (edge and ticks only) or `none` (bare). */
  frame?: 'panel' | 'ghost' | 'none';
  /** A tick ruler along one inner edge of the frame. */
  ruler?: 'left' | 'right' | 'top' | 'bottom' | 'none';
  annotations?: readonly FigureAnnotation[];
  dimensions?: readonly FigureDimension[];
  /**
   * The numbered legend. `hidden` (default) is visually hidden but read by assistive tech and
   * wired to the figure with `aria-describedby`; `visible` shows it under the caption.
   */
  legend?: 'hidden' | 'visible';
  /** Show the Probe reticle and readout over the content box (fine pointers only). */
  probe?: boolean | ProbeReticleProps;
  /** How far callout rings may poke outside the content box, px. Default 0. */
  bleed?: number;
  /**
   * Below this content width (px) the annotation layer goes compact: smaller rings, shorter
   * leaders and no labels beside the rings. The labels then show in the legend, which is
   * made visible (it stays announced either way). Default 520; 0 never compacts.
   */
  compactBelow?: number;
  /** Force the drawn state; by default the figure draws once when scrolled into view. */
  draw?: boolean;
  className?: string;
  /** Class for the content box. */
  plateClassName?: string;
  id?: string;
}

const ANNOTATION_STAGGER = 120;

/** The annotation layer's sizes when the plate is narrow. */
const COMPACT = { ring: 10, length: 30, offset: 24, fontSize: 10 };

/**
 * A figure: content in a frame, a blueprint annotation layer drawn over it, a caption with
 * `FIG n.m`, and an accessible legend of the callouts. Annotations are fractions of the
 * content box, so they follow it at any width. Everything draws itself in once, when the
 * figure scrolls into view.
 *
 *   <Figure num="3.2" caption="Placement of three instances" ratio="16 / 9"
 *     annotations={[{ id: 'a', at: [0.3, 0.4], label: 'Instance', note: 'A running copy.' }]}>
 *     <Diagram />
 *   </Figure>
 */
export function Figure({
  children,
  num,
  caption,
  note,
  ratio,
  frame = 'panel',
  ruler = 'none',
  annotations = [],
  dimensions = [],
  legend = 'hidden',
  probe = false,
  bleed = 0,
  compactBelow = 520,
  draw,
  className,
  plateClassName,
  id,
}: FigureProps) {
  const root = useRef<HTMLElement>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  const { width: plateWidth } = useElementSize(plateRef);
  const compact = compactBelow > 0 && plateWidth > 0 && plateWidth < compactBelow;
  const inView = useInView(root, { once: true, threshold: 0.25 });
  const drawn = draw ?? inView;
  const uid = useId();
  const captionId = `${uid}-cap`;
  const legendId = `${uid}-legend`;
  const hasTitle = caption != null || num != null;
  const hasCaption = hasTitle || note != null;
  const hasLegend = annotations.length > 0 || dimensions.some((d) => d.label || d.name);
  // The title names the figure; the note and the legend describe it.
  const describedBy =
    [note != null ? captionNoteId(captionId) : null, hasLegend ? legendId : null].filter(Boolean).join(' ') ||
    undefined;
  // Compact plates drop the labels beside the rings, so the legend has to carry them.
  const legendShown = legend === 'visible' || (compact && annotations.some((a) => a.label));
  const probeProps: ProbeReticleProps = typeof probe === 'object' ? probe : {};

  const plateStyle: CSSProperties | undefined =
    ratio !== undefined ? { aspectRatio: typeof ratio === 'number' ? String(ratio) : ratio } : undefined;

  const plate = (
    <div
      ref={plateRef}
      className={cn(styles.plate, plateClassName)}
      style={plateStyle}
      data-ratio={ratio !== undefined ? '' : undefined}
    >
      {children}
      {annotations.length > 0 || dimensions.length > 0 ? (
        <Annotated draw={drawn}>
          {(box) => (
            <>
              {dimensions.map((d, i) => (
                <DimensionLine
                  key={d.id ?? `dim-${i}`}
                  from={toPx(d.from, box)}
                  to={toPx(d.to, box)}
                  label={d.label}
                  side={d.side}
                  offset={compact ? Math.min(d.offset ?? 22, COMPACT.offset) : d.offset}
                  caps={d.caps}
                  fontSize={compact ? COMPACT.fontSize : undefined}
                  box={box}
                  delay={120 + i * ANNOTATION_STAGGER}
                />
              ))}
              {annotations.map((a, i) => (
                <Annotation
                  key={a.id}
                  anchor={toPx(a.at, box)}
                  side={a.side ?? defaultSide(a.at)}
                  length={compact ? Math.min(a.length ?? 46, COMPACT.length) : a.length}
                  route={a.route}
                  n={a.n ?? i + 1}
                  label={compact ? undefined : a.label}
                  r={compact ? COMPACT.ring : undefined}
                  box={box}
                  bleed={bleed}
                  delay={240 + (dimensions.length + i) * ANNOTATION_STAGGER}
                />
              ))}
            </>
          )}
        </Annotated>
      ) : null}
      {probe ? <ProbeReticle {...probeProps} /> : null}
    </div>
  );

  return (
    <DrawContext.Provider value={drawn}>
      <figure
        ref={root}
        id={id}
        className={cn(styles.figure, className)}
        aria-labelledby={hasTitle ? captionTitleId(captionId) : undefined}
        aria-describedby={describedBy}
      >
        {frame === 'none' ? (
          plate
        ) : (
          <Panel
            variant={frame === 'ghost' ? 'ghost' : 'slab'}
            padding="sm"
            halo={false}
            ruler={ruler}
            pattern="br"
            className={styles.frame}
          >
            {plate}
          </Panel>
        )}
        {hasCaption ? <FigCaption id={captionId} num={num} title={caption} note={note} /> : null}
        {hasLegend ? (
          <Legend id={legendId} visible={legendShown} annotations={annotations} dimensions={dimensions} />
        ) : null}
      </figure>
    </DrawContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Legend: the DOM equivalent of the annotation layer
// ---------------------------------------------------------------------------

function Legend({
  id,
  visible,
  annotations,
  dimensions,
}: {
  id: string;
  visible: boolean;
  annotations: readonly FigureAnnotation[];
  dimensions: readonly FigureDimension[];
}) {
  const named = dimensions.filter((d) => d.label || d.name);
  return (
    // biome-ignore lint/a11y/noRedundantRoles: list-style: none drops list semantics in Safari and VoiceOver
    <ol id={id} className={visible ? styles.legend : 'sr-only'} role="list" aria-label="Annotations">
      {annotations.map((a, i) => {
        const n = a.n ?? i + 1;
        return (
          <li key={a.id} className={styles.item} value={typeof n === 'number' ? n : undefined}>
            <span className={styles.key} aria-hidden={visible ? undefined : true}>
              {n}
            </span>
            <span className={styles.itemText}>
              {a.label ? <span className={styles.itemLabel}>{a.label}</span> : null}
              {a.label && a.note ? <span className="sr-only">: </span> : null}
              {a.note ? <span className={styles.itemNote}>{a.note}</span> : null}
            </span>
          </li>
        );
      })}
      {named.map((d, i) => (
        <li key={d.id ?? `dim-${i}`} className={styles.item}>
          <span className={cn(styles.key, styles.keyDim)} aria-hidden="true" />
          <span className={styles.itemText}>
            {d.name ? <span className={styles.itemLabel}>{d.name}</span> : null}
            {d.name && d.label ? <span className="sr-only">: </span> : null}
            {d.label ? <span className={styles.itemNote}>{d.label}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
