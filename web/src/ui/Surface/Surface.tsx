import type { ComponentPropsWithoutRef, ElementType, ReactNode, Ref } from 'react';
import { cn } from '../internal/cn';
import type { PanelCut, PanelTone } from '../Panel/Panel';
import styles from './Surface.module.css';

interface SurfaceOwnProps {
  /** Chamfer: sm 6 px (tooltips, chips), md 10 px (popovers, menus), lg 14 px. Default md. */
  size?: 'sm' | 'md' | 'lg';
  cut?: PanelCut;
  /** Recolours the edge and glow: a status or a tier. */
  tone?: PanelTone;
  /** The light that bleeds off the edge. Default true. */
  glow?: boolean;
  className?: string;
  children?: ReactNode;
  ref?: Ref<HTMLElement>;
}

export type SurfaceProps<T extends ElementType = 'div'> = SurfaceOwnProps & {
  as?: T;
} & Omit<ComponentPropsWithoutRef<T>, keyof SurfaceOwnProps | 'as'>;

const TIERS = new Set<string>(['cumulus', 'nimbus', 'stratus']);

/**
 * The light floating glass: tooltips, popovers, menus, toasts. A near-opaque ink fill with
 * the same gradient edge as Panel but none of its texture, and a glow that follows the cuts.
 * It has no backdrop blur (so it is cheap to stack) and no drop shadow.
 *
 *   <Surface size="md" role="dialog">...</Surface>
 */
export function Surface<T extends ElementType = 'div'>({
  as,
  size = 'md',
  cut = 'tr-bl',
  tone = 'neutral',
  glow = true,
  className,
  children,
  ref,
  ...rest
}: SurfaceProps<T>) {
  const Tag: ElementType = as ?? 'div';
  return (
    <Tag
      ref={ref}
      className={cn('chamfer', styles.surface, className)}
      data-size={size}
      data-cut={cut === 'tr-bl' ? undefined : cut}
      data-glow={glow ? undefined : 'false'}
      data-tier={TIERS.has(tone) ? tone : undefined}
      data-tone={tone === 'ok' || tone === 'warn' || tone === 'crit' ? tone : undefined}
      {...rest}
    >
      <span className={styles.edge} aria-hidden="true" />
      <span className={styles.fill} aria-hidden="true" />
      <div className={styles.content}>{children}</div>
    </Tag>
  );
}
