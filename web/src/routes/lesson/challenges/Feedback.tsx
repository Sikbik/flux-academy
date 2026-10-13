/**
 * A polite live region for specific feedback. The element is always rendered (so assistive tech has a
 * region to watch before the first message), and empty when there is nothing to say. `hidden` keeps the
 * announcement but not the box, for a message that is already on screen elsewhere.
 */

import { MarkupText } from '@/learn/MarkupText';
import { plainText } from '@/learn/markup';
import styles from './challenges.module.css';

export interface FeedbackProps {
  lines: readonly string[];
  tone?: 'warn' | 'progress';
  title?: string;
  /** Announce without showing a box. */
  hidden?: boolean;
}

export function Feedback({ lines, tone = 'warn', title, hidden = false }: FeedbackProps) {
  if (hidden) {
    return (
      <div className={styles.srOnly} role="status" aria-live="polite">
        {lines.map((l) => (
          <p key={l}>{plainText(l)}</p>
        ))}
      </div>
    );
  }
  return (
    <div className={styles.feedback} role="status" aria-live="polite">
      {lines.length > 0 ? (
        <div className={styles.fb} data-tone={tone}>
          {title ? <span className={styles.fbTitle}>{title}</span> : null}
          {lines.map((l) => (
            <p key={l}>
              <MarkupText text={l} />
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
