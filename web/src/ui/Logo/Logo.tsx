import type { AnchorHTMLAttributes, CSSProperties, HTMLAttributes } from 'react';
import { cn } from '../internal/cn';
import styles from './Logo.module.css';
import { ARTBOARDS, type MarkShape } from './marks';
import { ACADEMY_TEXT, type LogoFills, type LogoTone, type LogoVariant, logoSource } from './variants';

export type { LogoTone, LogoVariant } from './variants';

export interface LogoProps extends Omit<HTMLAttributes<HTMLElement>, 'title' | 'children'> {
  /**
   * `mark` the bare symbol; `round` the symbol on its disc; `lockup` the round mark with the
   * FLUX wordmark (the official file); `academy` the round mark with "Flux" 700 and
   * "Academy" 300 set live in Montserrat (the header lockup). Default `round`.
   */
  variant?: LogoVariant;
  /**
   * The Brand Book colourways and nothing else. `blue` Blue Wave, `white`, `black`, `gray`.
   * Round and lockup use the official negative files for the dark UI. Default `blue`.
   */
  tone?: LogoTone;
  /** Height of the symbol in px; the width follows the artwork. Default 32. */
  size?: number;
  /** The accessible name. Without it the mark is decorative (hidden from assistive tech). */
  title?: string;
  /** Pad by the brand's clear space, x = symbol diameter / 3.6 (Brand Book p. 11). Default false. */
  clearSpace?: boolean;
  /** Render as a link. A link with no `title` is named "Flux". */
  href?: string;
  rel?: AnchorHTMLAttributes<HTMLAnchorElement>['rel'];
  target?: AnchorHTMLAttributes<HTMLAnchorElement>['target'];
}

// The artwork is fixed, so the keys are too: role and position within the artboard.
const KEYED = Object.fromEntries(
  Object.entries(ARTBOARDS).map(([id, board]) => [
    id,
    board.shapes.map((shape, i) => ({ shape, key: `${shape.role}-${i}` })),
  ]),
) as Record<keyof typeof ARTBOARDS, { shape: MarkShape; key: string }[]>;

function shapeFill(role: MarkShape['role'], fills: LogoFills): string {
  if (role === 'disc') return fills.disc ?? '#000000';
  if (role === 'word') return fills.word ?? '#000000';
  return fills.symbol;
}

/**
 * The Flux marks: official artwork only, in official colours only, never distorted.
 *
 *   <Logo variant="academy" size={32} href="/" title="Flux Academy, home" />
 *   <Logo variant="round" tone="white" size={48} clearSpace />
 *
 * Never recolour it, never place it on a gradient, never stretch it. The `size` is the
 * symbol height; every other dimension follows from the artwork.
 */
export function Logo({
  variant = 'round',
  tone = 'blue',
  size = 32,
  title,
  clearSpace = false,
  href,
  rel,
  target,
  className,
  style,
  ...rest
}: LogoProps) {
  const source = logoSource(variant, tone);
  const board = ARTBOARDS[source.artboard];
  const width = (size * board.w) / board.h;
  const hasDisc = source.fills.disc !== undefined;
  const academy = variant === 'academy';
  const Tag = (href ? 'a' : 'span') as 'span';
  const linkProps = href ? { href, rel, target } : {};
  const named = !!title && !academy;
  const label = href && !title && !academy ? 'Flux' : href && title && academy ? title : undefined;

  return (
    <Tag
      className={cn(styles.logo, className)}
      data-variant={variant}
      data-tone={tone}
      data-clear={clearSpace ? 'true' : undefined}
      aria-label={label}
      style={
        {
          '--logo-size': `${size}px`,
          '--logo-x': `${(size / 3.6).toFixed(2)}px`,
          '--logo-word': ACADEMY_TEXT[tone],
          ...style,
        } as CSSProperties
      }
      {...linkProps}
      {...rest}
    >
      <svg
        className={styles.svg}
        data-disc={hasDisc ? 'true' : 'false'}
        viewBox={`0 0 ${board.w} ${board.h}`}
        width={Number(width.toFixed(2))}
        height={size}
        role={named ? 'img' : undefined}
        aria-label={named ? title : undefined}
        aria-hidden={named ? undefined : true}
        focusable="false"
      >
        {KEYED[source.artboard].map(({ shape: s, key }) => {
          const t = [s.group, s.transform].filter(Boolean).join(' ') || undefined;
          const fill = shapeFill(s.role, source.fills);
          return s.tag === 'ellipse' ? (
            <ellipse
              key={key}
              className={styles[s.role]}
              cx={s.cx}
              cy={s.cy}
              rx={s.rx}
              ry={s.ry}
              transform={t}
              fill={fill}
            />
          ) : (
            <path key={key} className={styles[s.role]} d={s.d} transform={t} fill={fill} />
          );
        })}
      </svg>
      {academy ? (
        <span className={styles.words}>
          <b className={styles.flux}>Flux</b> <span className={styles.academy}>Academy</span>
        </span>
      ) : null}
    </Tag>
  );
}
