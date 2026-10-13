import type { MouseEventHandler, ReactNode } from 'react';
import { Link } from 'react-router';
import { Glyph, type GlyphName } from '@/ui';
import styles from './LinkChip.module.css';

export interface LinkChipProps {
  /** A site path (`/learn/what-is-flux`, `/glossary#image`) or a full https URL. */
  to: string;
  children: ReactNode;
  /** Tier colour, for a track or a lesson of that track. */
  tier?: 'cumulus' | 'nimbus' | 'stratus';
  tone?: 'neutral' | 'accent';
  icon?: GlyphName;
  /** Mono caps, like a label chip. Default is sentence case. */
  mono?: boolean;
  /** A small figure before the text, for example a lesson number. */
  lead?: string;
  size?: 'sm' | 'md';
  /** Overrides the spoken name when the visible text is not enough. */
  'aria-label'?: string;
  title?: string;
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}

/**
 * A link that looks like a chip: a chamfered pill, one line, truncating long text. The design system's
 * `Chip` is a button or a label; this is the link form, for "see also", "taught in" and the like.
 */
export function LinkChip({
  to,
  children,
  tier,
  tone = 'neutral',
  icon,
  mono = false,
  lead,
  size = 'md',
  'aria-label': ariaLabel,
  title,
  className,
  onClick,
}: LinkChipProps) {
  const external = /^https?:\/\//.test(to);
  const body = (
    <>
      <span className={styles.edge} aria-hidden="true" />
      <span className={styles.face} aria-hidden="true" />
      <span className={styles.content}>
        {icon ? <Glyph name={icon} size={size === 'sm' ? 12 : 14} /> : null}
        {lead ? (
          <span className={styles.lead} aria-hidden="true">
            {lead}
          </span>
        ) : null}
        <span className={styles.text}>{children}</span>
        {external ? (
          <>
            <Glyph name="arrow-up-right" size={12} className={styles.ext} />
            <span className="sr-only">. Opens in a new tab</span>
          </>
        ) : null}
      </span>
    </>
  );
  const cls = [styles.chip, 'chamfer', className].filter(Boolean).join(' ');
  const common = {
    className: cls,
    'data-tier': tier,
    'data-tone': tone === 'accent' ? 'accent' : undefined,
    'data-mono': mono ? 'true' : undefined,
    'data-size': size,
    'aria-label': ariaLabel,
    title,
  } as const;
  if (external) {
    return (
      <a {...common} href={to} target="_blank" rel="noopener noreferrer" onClick={onClick}>
        {body}
      </a>
    );
  }
  return (
    <Link {...common} to={to} onClick={onClick}>
      {body}
    </Link>
  );
}
