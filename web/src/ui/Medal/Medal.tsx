import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { Glyph } from '../Glyph/Glyph';
import type { GlyphName } from '../Glyph/glyphs';
import { cn } from '../internal/cn';
import { hexPoints } from '../internal/hex';
import { fitArt, HEX_ASPECT, type LitBox } from './fit';
import styles from './Medal.module.css';

export type MedalState = 'locked' | 'unlocked' | 'new';

export interface MedalProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** The achievement's name. Always read by assistive tech; shown when `showLabel`. */
  label: string;
  /** `locked` (dim, a lock badge), `unlocked` (lit edge and glow), `new` (unlocked with a one-shot burst and shine). */
  state?: MedalState;
  /** Emissive art on pure black (composited with `screen`, so there is no box). */
  image?: string;
  /** An AVIF twin of `image`, offered first. */
  imageAvif?: string;
  /** Where the lit content sits in the image, as [left, top, right, bottom] fractions. */
  imageBox?: LitBox;
  /** A glyph, when there is no art. */
  glyph?: GlyphName;
  /** Tint with a tier colour (tier colour means tier: use for the rank and track medals). */
  tier?: 'cumulus' | 'nimbus' | 'stratus';
  /** The badge height in px (a pointy-top hexagon). Default 96. */
  size?: number;
  /** The rule to earn it. Shown even when locked. */
  rule?: ReactNode;
  /** Show the name under the badge. Default true. */
  showLabel?: boolean;
  /** Show the state word (`Locked`, `Earned`, `New`) as a tag. Default true. */
  showState?: boolean;
}

const STATE_WORD: Record<MedalState, string> = { locked: 'Locked', unlocked: 'Earned', new: 'New' };
const DEFAULT_BOX: LitBox = [0.12, 0.08, 0.88, 0.92];

// Registration ticks at the six vertices, in a 100 x 115.47 viewBox, pointing outward.
const VIEW_H = 100 / HEX_ASPECT;
const TICKS = (() => {
  const c = [50, VIEW_H / 2] as const;
  return hexPoints(c[0], c[1], VIEW_H / 2)
    .map(([x, y]) => {
      const dx = x - c[0];
      const dy = y - c[1];
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const f = (n: number) => Number(n.toFixed(2));
      return `M${f(x + ux * 2.4)} ${f(y + uy * 2.4)}L${f(x + ux * 6.4)} ${f(y + uy * 6.4)}`;
    })
    .join('');
})();

/**
 * A hex badge for an achievement or a rank. Emissive art (or a glyph) sits in a lit hex frame
 * with six registration ticks; the state is carried by the lock badge and the words as well as
 * by the light, never by colour alone.
 *
 *   <Medal label="First light" state="unlocked" image="/art/medal-first-light.webp" rule="Open your first lesson" />
 *   <Medal label="Spec whisperer" state="locked" glyph="check" rule="Take a spec from 3 errors to none" />
 */
export function Medal({
  label,
  state = 'unlocked',
  image,
  imageAvif,
  imageBox = DEFAULT_BOX,
  glyph,
  tier,
  size = 96,
  rule,
  showLabel = true,
  showState = true,
  className,
  style,
  ...rest
}: MedalProps) {
  const fit = image ? fitArt(imageBox) : null;
  const w = size * HEX_ASPECT;
  const vars = {
    '--s': `${size}px`,
    ...(fit ? { '--art-k': fit.k.toFixed(4), '--art-x': fit.x.toFixed(4), '--art-y': fit.y.toFixed(4) } : {}),
    ...style,
  } as CSSProperties;

  return (
    <figure
      className={cn(styles.medal, className)}
      data-state={state}
      data-tier={tier}
      data-art={image ? 'image' : 'glyph'}
      style={vars}
      {...rest}
    >
      <div
        className={styles.badge}
        style={{ inlineSize: `${w}px`, blockSize: `${size}px` }}
        aria-hidden="true"
      >
        <span className={styles.aura} />
        <span className={styles.window}>
          {image ? (
            <picture>
              {imageAvif ? <source srcSet={imageAvif} type="image/avif" /> : null}
              <img className={styles.art} src={image} alt="" decoding="async" draggable={false} />
            </picture>
          ) : null}
          {!image ? <span className={styles.inner} /> : null}
          {glyph ? (
            <span className={styles.glyph}>
              <Glyph name={glyph} size={Math.round(size * 0.38)} strokeWidth={1.4} />
            </span>
          ) : null}
          <span className={styles.shine}>
            <span />
          </span>
        </span>
        <span className={styles.ring} />
        <svg
          className={styles.ticks}
          viewBox={`0 0 100 ${VIEW_H.toFixed(3)}`}
          focusable="false"
          aria-hidden="true"
        >
          <path d={TICKS} />
        </svg>
        {state === 'new' ? <span className={styles.burst} /> : null}
        {state === 'locked' ? (
          <span className={styles.lock}>
            <Glyph name="lock" size={Math.max(10, Math.round(size * 0.17))} />
          </span>
        ) : null}
      </div>
      <figcaption className={styles.caption}>
        <span className={showLabel ? styles.name : 'sr-only'}>{label}</span>
        <span className={showState ? styles.state : 'sr-only'} data-state={state}>
          {showState ? null : ', '}
          {STATE_WORD[state]}
        </span>
        {rule ? <span className={styles.rule}>{rule}</span> : null}
      </figcaption>
    </figure>
  );
}
