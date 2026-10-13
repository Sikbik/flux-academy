import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { copyText } from '@/lib/clipboard';
import { cn } from '@/lib/cn';
import { announce } from '@/system/announce';
import { Glyph } from '@/ui';
import { useTopic } from '../context';
import { absoluteLink } from '../model';
import styles from './parts.module.css';

const FEEDBACK_MS = 1600;

/**
 * Copies the address of an element on this page and puts it in the address bar, so the link can also be
 * shared by hand. Shown when the heading is hovered or focused, and always on touch screens.
 */
export function CopyLink({ id, label, className }: { id: string; label: string; className?: string }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onClick = async () => {
    navigate({ hash: `#${id}` }, { replace: true, preventScrollReset: true });
    const ok = await copyText(absoluteLink(window.location.origin, pathname, id));
    setState(ok ? 'copied' : 'failed');
    announce(ok ? 'Link copied' : 'The link could not be copied. It is in the address bar.');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), FEEDBACK_MS);
  };

  return (
    <button
      type="button"
      className={cn(styles.copyLink, className)}
      data-state={state}
      aria-label={`Copy link to ${label}`}
      onClick={onClick}
    >
      <Glyph name={state === 'copied' ? 'check' : 'link'} size={15} />
      <span className={styles.copyWord} aria-hidden="true">
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Failed' : ''}
      </span>
    </button>
  );
}

/** Zero-padded for sections (`02`), as is for subsections (`2.1`). */
function shown(number: string): string {
  return number.includes('.') ? number : number.padStart(2, '0');
}

/**
 * One section of a topic: a numbered, linkable heading, the one sentence summary from the topic list,
 * then the content. A level 3 section is an `h3` and sits under the level 2 before it.
 */
export function Section({
  id,
  children,
  actions,
}: {
  id: string;
  children?: ReactNode;
  /** Controls shown on the heading line, at the right. */
  actions?: ReactNode;
}) {
  const { sections } = useTopic();
  const meta = sections.get(id);
  if (!meta) throw new Error(`reference: section "${id}" is not in the topic list`);
  const Heading = meta.level === 2 ? 'h2' : 'h3';
  const headingId = `${id}-heading`;
  return (
    <section id={id} className={styles.section} data-level={meta.level} aria-labelledby={headingId}>
      <header className={styles.sectionHead}>
        <span className={styles.sectionNumber} aria-hidden="true">
          {shown(meta.number)}
        </span>
        <Heading id={headingId} className={styles.sectionTitle}>
          {meta.title}
        </Heading>
        <CopyLink id={id} label={meta.title} />
        {actions ? <span className={styles.sectionActions}>{actions}</span> : null}
      </header>
      <p className={styles.sectionSummary}>{meta.summary}</p>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}
