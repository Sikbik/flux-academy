/**
 * What the stage column shows when no stage is in force: before a lesson's first stage, and during a
 * checkpoint challenge that needs no stage of its own (choice, order, match). Never empty: it says what
 * this lesson is for and, in the checkpoint, where the learner stands.
 */

import { MarkupText } from '@/learn/MarkupText';
import { layoutOf } from '@/learn/player';
import { challengeBaseXp } from '@/learn/xp';
import { Glyph } from '@/ui';
import styles from './LessonPanel.module.css';
import { usePlayer, usePlayerCtx } from './PlayerContext';

export function LessonPanel() {
  const { lesson, meta } = usePlayerCtx();
  const position = usePlayer((s) => s.position);
  const challenges = usePlayer((s) => s.challenges);
  const layout = layoutOf(lesson);
  const inCheckpoint = position >= layout.steps;
  const current = position - layout.steps;
  const earned = lesson.checkpoint.reduce((n, c) => n + (challenges[c.id]?.xp ?? 0), 0);
  const total = lesson.checkpoint.reduce((n, c) => n + challengeBaseXp(c), 0);

  return (
    <div className={styles.panel} data-mode={inCheckpoint ? 'checkpoint' : 'intro'}>
      <p className={styles.eyebrow}>{inCheckpoint ? 'Checkpoint' : 'In this lesson'}</p>
      <h3 className={styles.title}>
        {inCheckpoint ? 'Show what you can do now.' : <MarkupText text={lesson.hook} plain />}
      </h3>

      <h4 className={styles.sub}>You will be able to</h4>
      <ul className={styles.objectives}>
        {lesson.objectives.map((o) => (
          <li key={o}>
            <span className={styles.hex} aria-hidden="true" />
            <MarkupText text={o} />
          </li>
        ))}
      </ul>

      {inCheckpoint ? (
        <>
          <h4 className={styles.sub}>
            <span>Challenges</span>
            <span className={styles.xp}>
              {earned} of {total} XP
            </span>
          </h4>
          <ol className={styles.list}>
            {lesson.checkpoint.map((c, i) => {
              const rt = challenges[c.id];
              const state = rt?.status ?? 'open';
              return (
                <li
                  key={c.id}
                  className={styles.item}
                  data-state={state}
                  data-current={i === current ? 'true' : undefined}
                >
                  <span className={styles.mark} aria-hidden="true">
                    {state === 'correct' || state === 'shown' ? <Glyph name="check" size={14} /> : i + 1}
                  </span>
                  <span className={styles.name}>
                    <MarkupText text={c.prompt} plain />
                  </span>
                  <span className={styles.badge}>
                    {state === 'correct'
                      ? 'Done'
                      : state === 'shown'
                        ? 'Shown'
                        : state === 'skipped'
                          ? 'Skipped'
                          : i === current
                            ? 'Now'
                            : 'To do'}
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <p className={styles.meta}>
          {lesson.steps.length} steps, {lesson.checkpoint.length} checkpoint challenges, about {meta.minutes}{' '}
          minutes.
        </p>
      )}
    </div>
  );
}
