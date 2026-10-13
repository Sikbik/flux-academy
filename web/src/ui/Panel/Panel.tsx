import { type ComponentPropsWithoutRef, type ElementType, type ReactNode, type Ref, useRef } from 'react';
import { useSpotlight } from '../hooks/useSpotlight';
import { useTilt } from '../hooks/useTilt';
import { cn } from '../internal/cn';
import { mergeRefs } from '../internal/refs';
import styles from './Panel.module.css';

export type PanelCorner = 'tl' | 'tr' | 'bl' | 'br';
export type PanelCut = 'tr-bl' | 'tl-br' | 'all' | 'tl' | 'tr' | 'bl' | 'br' | 'none';
export type PanelTone = 'neutral' | 'ok' | 'warn' | 'crit' | 'cumulus' | 'nimbus' | 'stratus';

interface PanelOwnProps {
  /**
   * `glass` (default): blurred glass. `slab`: near-opaque, no backdrop blur (use for long
   * lists and wherever panels stack). `ghost`: edge, ticks and pattern only.
   */
  variant?: 'glass' | 'slab' | 'ghost';
  /** Chamfer size: sm 8 px, md 14 px (default), lg 22 px. */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Which corners are cut. `tr-bl` (default) is the family silhouette; `tl-br` is its mirror;
   * `all` cuts four; `tl`, `tr`, `bl`, `br` cut one; `none` keeps only the micro bevels.
   */
  cut?: PanelCut;
  /** Inner padding. Default `md`. `none` for full-bleed media (pair with `clip`). */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Recolours the edge, pattern and glow for the subtree: a status or a tier. */
  tone?: PanelTone;
  /** Which corner the edge burns hottest at. Default: the first big cut. */
  hot?: PanelCorner | 'none';
  /** Which corner the hex pattern fades in from. Default `br`. */
  pattern?: PanelCorner | 'none';
  /** Corner crosshairs. Default true. */
  marks?: boolean;
  /** A tick ruler along one inner edge (as in the blueprint reference). Default none. */
  ruler?: 'left' | 'right' | 'top' | 'bottom' | 'none';
  /** Cursor spotlight with a crosshair, edge catch and press compression. Default false. */
  interactive?: boolean;
  /** Tilt up to 5 degrees toward the pointer (needs `interactive`). A number sets the maximum. */
  tilt?: boolean | number;
  /** The soft accent bloom around the slab. Default true for glass; turn off for dense lists. */
  halo?: boolean;
  /** Clip the content to the chamfer (for full-bleed media). Default false. */
  clip?: boolean;
  /** Make the panel a size container so children can use `@container` queries. */
  container?: boolean;
  className?: string;
  /** Class for the inner content wrapper (flex, grid, scrolling). */
  contentClassName?: string;
  children?: ReactNode;
  ref?: Ref<HTMLElement>;
}

export type PanelProps<T extends ElementType = 'div'> = PanelOwnProps & {
  /** The element to render. Default `div`. Use `a`, `button`, `li`, `article`, `section`... */
  as?: T;
} & Omit<ComponentPropsWithoutRef<T>, keyof PanelOwnProps | 'as'>;

const TIERS = new Set<string>(['cumulus', 'nimbus', 'stratus']);

function defaultHot(cut: PanelCut): PanelCorner {
  if (cut === 'tl-br' || cut === 'tl') return 'tl';
  if (cut === 'bl') return 'bl';
  if (cut === 'br') return 'br';
  return 'tr';
}

/**
 * The glass slab: chamfered corners, a gradient edge that burns hot on one cut, a faint hex
 * lattice, grain, corner crosshairs, an optional tick ruler and a cursor spotlight. The
 * surface every card, tile and stat sits on.
 *
 *   <Panel padding="lg" ruler="left">...</Panel>
 *   <Panel as="a" href="/learn" interactive tilt tone="cumulus">...</Panel>
 */
export function Panel<T extends ElementType = 'div'>({
  as,
  variant = 'glass',
  size = 'md',
  cut = 'tr-bl',
  padding = 'md',
  tone = 'neutral',
  hot,
  pattern = 'br',
  marks = true,
  ruler = 'none',
  interactive = false,
  tilt = false,
  halo,
  clip = false,
  container = false,
  className,
  contentClassName,
  children,
  ref,
  ...rest
}: PanelProps<T>) {
  const Tag: ElementType = as ?? 'div';
  const local = useRef<HTMLElement | null>(null);
  const tiltMax = typeof tilt === 'number' ? tilt : 5;
  const hotCorner = hot ?? defaultHot(cut);
  const bloom = halo ?? variant === 'glass';

  useSpotlight(local, { enabled: interactive });
  useTilt(local, { max: tiltMax, enabled: interactive && tilt !== false });

  const props = rest as Record<string, unknown>;
  const clickable = Tag === 'a' || Tag === 'button' || typeof props.onClick === 'function';

  return (
    <Tag
      ref={mergeRefs(local, ref)}
      className={cn('chamfer', styles.panel, className)}
      data-cut={cut === 'tr-bl' ? undefined : cut}
      data-variant={variant}
      data-size={size}
      data-pad={padding}
      data-interactive={interactive || undefined}
      data-clickable={clickable && interactive ? 'true' : undefined}
      data-tilt={interactive && tilt !== false ? 'true' : undefined}
      data-hot={hotCorner}
      data-pattern={pattern}
      data-marks={marks ? undefined : 'false'}
      data-ruler={ruler === 'none' ? undefined : ruler}
      data-halo={bloom ? undefined : 'false'}
      data-clip={clip ? 'true' : undefined}
      data-container={container ? '' : undefined}
      data-tier={TIERS.has(tone) ? tone : undefined}
      data-tone={tone === 'ok' || tone === 'warn' || tone === 'crit' ? tone : undefined}
      {...rest}
    >
      <span className={styles.halo} aria-hidden="true" />
      <span className={styles.edge} aria-hidden="true" />
      <span className={styles.glow} aria-hidden="true" />
      <span className={styles.fill} aria-hidden="true" />
      <span className={styles.pattern} aria-hidden="true" />
      <span className={styles.grain} aria-hidden="true" />
      <span className={styles.spot} aria-hidden="true" />
      <span className={styles.marks} aria-hidden="true" />
      <span className={styles.ruler} aria-hidden="true" />
      <div className={cn(styles.content, contentClassName)}>{children}</div>
    </Tag>
  );
}
