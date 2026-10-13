import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode, Ref } from 'react';
import { Glyph } from '../Glyph/Glyph';
import type { GlyphName } from '../Glyph/glyphs';
import { cn } from '../internal/cn';
import type { Status } from '../StatusDot/StatusDot';
import styles from './Chip.module.css';

export type ChipTier = 'cumulus' | 'nimbus' | 'stratus';

interface ChipOwnProps {
  /**
   * `label` (default): a mono uppercase tag. `filter`: sentence case, selectable (toggles
   * `aria-pressed`). `status`: a label that wears a status colour (use with `status`).
   */
  kind?: 'label' | 'filter' | 'status';
  /** Status colour (ok, pending, warn, crit, off). Always paired with the words inside. */
  status?: Status;
  /** Tier colour and its layered tier glyph. Tier colour means tier, nothing else. */
  tier?: ChipTier;
  /** Quiet (default) or accent-tinted. */
  tone?: 'neutral' | 'accent';
  /** Filter chips: the pressed state. */
  selected?: boolean;
  /** A glyph before the text. */
  icon?: GlyphName;
  /** A count after the text, in tabular numerals. */
  count?: number | string;
  size?: 'sm' | 'md';
  className?: string;
  children?: ReactNode;
}

export type ChipProps = ChipOwnProps &
  Omit<HTMLAttributes<HTMLElement>, keyof ChipOwnProps> &
  Pick<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'disabled' | 'type'> & { ref?: Ref<HTMLElement> };

const TIER_GLYPH: Record<ChipTier, GlyphName> = {
  cumulus: 'tier-cumulus',
  nimbus: 'tier-nimbus',
  stratus: 'tier-stratus',
};

const STATUS_GLYPH: Record<Status, GlyphName> = {
  ok: 'status-ok',
  pending: 'status-pending',
  warn: 'status-warn',
  crit: 'status-crit',
  off: 'status-off',
};

/**
 * A small chamfered tag or toggle. With `onClick` it is a real button (filter chips are
 * `aria-pressed` toggles); without it, a span.
 *
 *   <Chip tier="cumulus">Cumulus</Chip>
 *   <Chip kind="filter" selected={on} onClick={toggle} count={12}>Beginner</Chip>
 *   <Chip kind="status" status="ok" icon="status-ok">Live</Chip>
 */
export function Chip({
  kind = 'label',
  status,
  tier,
  tone = 'neutral',
  selected,
  icon,
  count,
  size = 'md',
  className,
  children,
  onClick,
  disabled,
  type,
  ref,
  ...rest
}: ChipProps) {
  const interactive = typeof onClick === 'function';
  const Tag = (interactive ? 'button' : 'span') as 'button';
  const glyph = icon ?? (tier ? TIER_GLYPH[tier] : undefined);
  const glyphSize = size === 'sm' ? 12 : 14;
  const toggle = interactive && kind === 'filter';
  return (
    <Tag
      ref={ref as Ref<HTMLButtonElement>}
      className={cn('chamfer', styles.chip, className)}
      data-kind={kind}
      data-size={size}
      data-tone={tone === 'accent' ? 'accent' : undefined}
      data-status={status}
      data-tier={tier}
      data-selected={selected ? 'true' : undefined}
      data-interactive={interactive ? 'true' : undefined}
      {...(interactive ? { type: type ?? 'button', onClick, disabled } : {})}
      {...(toggle ? { 'aria-pressed': !!selected } : {})}
      {...rest}
    >
      <span className={styles.edge} aria-hidden="true" />
      <span className={styles.face} aria-hidden="true" />
      <span className={styles.content}>
        {glyph ? <Glyph name={glyph} size={glyphSize} /> : null}
        {!glyph && status && kind === 'status' ? (
          <Glyph name={STATUS_GLYPH[status]} size={glyphSize} />
        ) : null}
        {children != null ? <span className={styles.text}>{children}</span> : null}
        {count != null ? <span className={styles.count}>{count}</span> : null}
      </span>
    </Tag>
  );
}
