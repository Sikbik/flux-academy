import { useMemo } from 'react';
import { useLearner } from '@/learn/store';
import { AppLinkButton } from './AppLinkButton';
import styles from './hero.module.css';
import { resumeTarget } from './logic';

/** What the primary call to action says and where it goes, from this learner's progress. */
export function usePrimaryAction(): { href: string; label: string; detail: string | null } {
  const lessons = useLearner((s) => s.lessons);
  const target = useMemo(() => resumeTarget(lessons), [lessons]);
  if (target.kind === 'continue') return { href: target.href, label: 'Continue', detail: target.title };
  if (target.kind === 'done') return { href: target.href, label: 'Open the course map', detail: null };
  return { href: target.href, label: 'Start the course', detail: null };
}

/**
 * The one button that starts (or resumes) the course. "Start the course" for a new learner, "Continue"
 * with the lesson's title for one who is part way, the course map for one who has finished everything.
 */
export function PrimaryAction({ size = 'lg' }: { size?: 'md' | 'lg' }) {
  const a = usePrimaryAction();
  return (
    <AppLinkButton href={a.href} variant="primary" size={size} iconEnd="arrow-right">
      {a.label}
      {a.detail ? <span className={styles.detail}>{a.detail}</span> : null}
    </AppLinkButton>
  );
}
