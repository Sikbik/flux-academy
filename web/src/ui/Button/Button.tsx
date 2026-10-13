import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { useRef } from 'react';
import { Glyph } from '../Glyph/Glyph';
import type { GlyphName } from '../Glyph/glyphs';
import { useMagnetic } from '../hooks/useMagnetic';
import { cn } from '../internal/cn';
import { EXTERNAL_REL, isExternalHref } from '../internal/links';
import { mergeRefs } from '../internal/refs';
import styles from './Button.module.css';

export interface ButtonVisualProps {
  /**
   * `primary` (a lit accent slab), `secondary` (glass with an accent edge, default), `ghost`
   * (text that grows corner brackets), `danger` (a lit slab in the critical colour).
   */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** Recolours any variant for this button only. Prefer `variant="danger"` for deletes. */
  tone?: 'ok' | 'warn' | 'crit';
  /** sm 36 px, md 44 px (default), lg 52 px. Touch devices always get a 44 px target. */
  size?: 'sm' | 'md' | 'lg';
  /** A glyph before the label. */
  icon?: GlyphName;
  /** A glyph after the label. */
  iconEnd?: GlyphName;
  /**
   * Drift toward a fine pointer within 80 px (max 6 px). Defaults to true for `primary`. A
   * number sets the maximum drift in px.
   */
  magnetic?: boolean | number;
  /** Shows a spinner, keeps the width, and ignores presses. */
  loading?: boolean;
  /** Fill the container's width. */
  fullWidth?: boolean;
  className?: string;
  children?: ReactNode;
}

export type ButtonProps = ButtonVisualProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonVisualProps> & { ref?: Ref<HTMLButtonElement> };

export type LinkButtonProps = ButtonVisualProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof ButtonVisualProps> & {
    href: string;
    /** Open in a new tab. Defaults to true for external URLs. */
    newTab?: boolean;
    ref?: Ref<HTMLAnchorElement>;
  };

interface BaseProps extends ButtonVisualProps {
  Tag: 'button' | 'a';
  /** Square (or hex) icon-only rendering: used by IconButton. */
  iconOnly?: boolean;
  shape?: 'chamfer' | 'hex';
  forwardedRef?: Ref<HTMLElement>;
  rest: Record<string, unknown>;
  external?: boolean;
}

/** Shared by Button, LinkButton and IconButton. Not exported from the package index. */
export function ButtonBase({
  Tag,
  variant = 'secondary',
  tone,
  size = 'md',
  icon,
  iconEnd,
  magnetic,
  loading = false,
  fullWidth = false,
  iconOnly = false,
  shape = 'chamfer',
  className,
  children,
  forwardedRef,
  rest,
  external,
}: BaseProps) {
  const local = useRef<HTMLElement | null>(null);
  const magnet = magnetic ?? variant === 'primary';
  useMagnetic(local, {
    enabled: magnet !== false && !loading,
    strength: typeof magnet === 'number' ? magnet : 6,
  });

  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 20 : 18;
  const disabled = rest.disabled === true || rest['aria-disabled'] === true || loading;
  const Element = Tag as 'button';
  const extra: Record<string, unknown> = { ...rest };
  if (Tag === 'a' && disabled) {
    extra['aria-disabled'] = true;
    extra.tabIndex = -1;
    extra.onClick = (e: Event) => e.preventDefault();
  }
  if (Tag === 'button' && loading) extra['aria-disabled'] = true;
  const dataTone = variant === 'danger' ? 'crit' : tone;

  return (
    <Element
      ref={mergeRefs(local as unknown as Ref<HTMLButtonElement>, forwardedRef as Ref<HTMLButtonElement>)}
      className={cn('chamfer', styles.btn, className)}
      data-variant={variant}
      data-size={size}
      data-tone={dataTone}
      data-shape={shape === 'hex' ? 'hex' : undefined}
      data-icon-only={iconOnly ? 'true' : undefined}
      data-full={fullWidth ? 'true' : undefined}
      data-loading={loading ? 'true' : undefined}
      aria-busy={loading || undefined}
      {...(Tag === 'button'
        ? { type: (rest.type as 'button' | 'submit' | 'reset' | undefined) ?? 'button' }
        : {})}
      {...extra}
    >
      <span className={styles.edge} aria-hidden="true" />
      <span className={styles.face} aria-hidden="true" />
      <span className={styles.content}>
        {icon ? <Glyph name={icon} size={iconSize} /> : null}
        {!iconOnly && children != null ? <span className={styles.label}>{children}</span> : null}
        {iconEnd ? <Glyph name={iconEnd} size={iconSize} /> : null}
        {external ? <span className="sr-only"> (Opens in a new tab)</span> : null}
      </span>
      {loading ? (
        <span className={styles.spinner} aria-hidden="true">
          <svg viewBox="0 0 24 24" width={iconSize + 2} height={iconSize + 2} fill="none" aria-hidden="true">
            <path
              d="M12 2.5L20.2 7.25V16.75L12 21.5L3.8 16.75V7.25Z"
              stroke="currentColor"
              strokeWidth="2"
              opacity="0.28"
            />
            <path
              d="M12 2.5L20.2 7.25V16.75L12 21.5L3.8 16.75V7.25Z"
              stroke="currentColor"
              strokeWidth="2"
              pathLength="100"
              strokeDasharray="26 74"
            />
          </svg>
        </span>
      ) : null}
    </Element>
  );
}

/**
 * The button. Chamfered, with a focus beam; primary buttons are magnetic.
 *
 *   <Button variant="primary" iconEnd="arrow-right" onClick={go}>Start the course</Button>
 *   <Button variant="secondary" icon="copy">Copy JSON</Button>
 *   <Button variant="danger" icon="reset">Reset progress</Button>
 *
 * Icon-only buttons are `IconButton`, which requires an accessible name.
 */
export function Button({
  ref,
  variant,
  tone,
  size,
  icon,
  iconEnd,
  magnetic,
  loading,
  fullWidth,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <ButtonBase
      Tag="button"
      variant={variant}
      tone={tone}
      size={size}
      icon={icon}
      iconEnd={iconEnd}
      magnetic={magnetic}
      loading={loading}
      fullWidth={fullWidth}
      className={className}
      forwardedRef={ref as Ref<HTMLElement>}
      rest={rest}
    >
      {children}
    </ButtonBase>
  );
}

/**
 * A link that looks like a button. External URLs open in a new tab with
 * `rel="noopener noreferrer"` and a hidden "Opens in a new tab".
 *
 *   <LinkButton href="https://cloud.runonflux.com" variant="primary" iconEnd="external">Open FluxCloud</LinkButton>
 */
export function LinkButton({
  ref,
  href,
  newTab,
  variant,
  tone,
  size,
  icon,
  iconEnd,
  magnetic,
  loading,
  fullWidth,
  className,
  children,
  target,
  rel,
  ...rest
}: LinkButtonProps) {
  const external = isExternalHref(href);
  const openNew = newTab ?? external;
  return (
    <ButtonBase
      Tag="a"
      variant={variant}
      tone={tone}
      size={size}
      icon={icon}
      iconEnd={iconEnd}
      magnetic={magnetic}
      loading={loading}
      fullWidth={fullWidth}
      className={className}
      forwardedRef={ref as Ref<HTMLElement>}
      external={openNew}
      rest={{
        href,
        target: target ?? (openNew ? '_blank' : undefined),
        rel: rel ?? (openNew ? EXTERNAL_REL : undefined),
        ...rest,
      }}
    >
      {children}
    </ButtonBase>
  );
}
