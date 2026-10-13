import { type HTMLAttributes, type ReactNode, useId } from 'react';
import { Glyph } from '../Glyph/Glyph';
import { type GlyphName, isGlyphName } from '../Glyph/glyphs';
import { cn } from '../internal/cn';
import styles from './Callout.module.css';

export type CalloutKind = 'why' | 'gotcha' | 'tip' | 'wild' | 'cost';

export interface CalloutProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** What sort of aside this is: it picks the tint, the glyph and the default label. */
  kind: CalloutKind;
  /** The label. Defaults to the kind's name. May be any inline content (a `Markup inline`). */
  title?: ReactNode;
  children?: ReactNode;
  /** Tighter: for margins of a step, lists and dense panels. */
  compact?: boolean;
}

/** The label each kind carries when `title` is left out. */
const DEFAULT_TITLE: Record<CalloutKind, string> = {
  why: 'Why it matters',
  gotcha: 'Gotcha',
  tip: 'Tip',
  wild: 'In the wild',
  cost: 'Cost',
};

/**
 * One glyph per kind, first available wins. This is the single place to swap a glyph: the
 * names are looked up at render time, so a missing one falls through to the next.
 */
const KIND_GLYPH: Record<CalloutKind, readonly string[]> = {
  why: ['question', 'info'],
  gotcha: ['warning', 'flag'],
  tip: ['lightbulb', 'spark'],
  wild: ['flag', 'globe', 'map-pin'],
  cost: ['price', 'wallet', 'gauge'],
};

function glyphFor(kind: CalloutKind): GlyphName {
  for (const name of KIND_GLYPH[kind]) if (isGlyphName(name)) return name;
  return 'info';
}

/**
 * A marginal note in a lesson: a slim chamfered slab with a tick-mark rail on the left, a
 * glyph in a hex, a mono label and the body in the lesson voice. Tint, glyph and words say
 * the kind together, so colour is never the only cue. It is a `note` landmark named by its
 * label (with the kind spoken first when the label is custom).
 *
 *   <Callout kind="gotcha">Ports below 1024 are not available to containers here.</Callout>
 *   <Callout kind="cost" title="Why three instances cost three times">...</Callout>
 */
export function Callout({ kind, title, children, compact = false, className, ...rest }: CalloutProps) {
  const id = useId();
  const known: CalloutKind = kind in DEFAULT_TITLE ? kind : 'tip';
  const custom = title !== undefined && title !== null && title !== '';
  return (
    <div
      {...rest}
      role="note"
      aria-labelledby={`${id}-l`}
      className={cn('chamfer', styles.callout, className)}
      data-kind={known}
      data-compact={compact ? 'true' : undefined}
    >
      <span className={styles.rail} aria-hidden="true" />
      <span className={styles.hex} aria-hidden="true">
        <Glyph name={glyphFor(known)} size={compact ? 14 : 16} />
      </span>
      <div className={styles.main}>
        <span id={`${id}-l`} className={styles.label}>
          {custom ? <span className={styles.kind}>{DEFAULT_TITLE[known]}: </span> : null}
          {custom ? title : DEFAULT_TITLE[known]}
        </span>
        {children != null && children !== false ? <div className={styles.body}>{children}</div> : null}
      </div>
    </div>
  );
}
