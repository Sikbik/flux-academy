/**
 * The task block under a step's text: the prompt, specific feedback, a hint, "Show me" and Skip.
 *
 * Feedback is immediate and specific and lives in a polite live region. Help is a ladder, never a
 * wall: a hint on request, "Show me" after the first failed attempt (or a pause, or a hint), and Skip.
 */

import { type Ref, useEffect, useId, useMemo, useRef } from 'react';
import { MarkupText } from '@/learn/MarkupText';
import { effectiveStage } from '@/learn/player';
import { taskFeedback } from '@/learn/tasks';
import type { Step } from '@/learn/types';
import { Button, Glyph } from '@/ui';
import { usePlayer, usePlayerCtx } from './PlayerContext';
import styles from './TaskPanel.module.css';

export function TaskPanel({ step, ref }: { step: Step; ref?: Ref<HTMLElement> }) {
  const { lesson, store } = usePlayerCtx();
  const rt = usePlayer((s) => s.steps[step.id]);
  const hintId = useId();
  const hintRef = useRef<HTMLDivElement>(null);
  // Set when the learner pressed Hint, so only that opening moves focus (Show me opens the hint too).
  const hintAsked = useRef(false);
  const task = step.task;
  const progress = rt?.progress;
  const hintIsOpen = rt?.status === 'open' && rt.hintOpen;
  // The Hint button goes away when it is pressed: focus moves to the hint it revealed, not to the page.
  useEffect(() => {
    if (!hintIsOpen || !hintAsked.current) return;
    hintAsked.current = false;
    hintRef.current?.focus();
  }, [hintIsOpen]);
  // Derived here, not in the selector: feedback is a fresh object each time, and a selector that returns
  // a new object on every call never settles.
  const feedback = useMemo(() => {
    if (!task || !progress) return null;
    const labels: Record<string, string> = {};
    const stage = effectiveStage(lesson, lesson.steps.indexOf(step));
    if (stage?.kind === 'terminal') for (const g of stage.script.goals) labels[g.id] = g.label;
    return taskFeedback(task, progress, labels);
  }, [lesson, step, task, progress]);
  if (!task || task.kind === 'read' || !rt) return null;

  const open = rt.status === 'open';
  // "Show me" was pressed and the stage is still performing the task (a terminal types, then streams).
  const solving = open && rt.solving;
  const hint =
    task.kind === 'spec' || task.kind === 'terminal' || task.kind === 'widget' ? task.hint : undefined;
  const prompt = task.prompt;
  const offerHelp = open && (rt.stuck || rt.progress.attempts > 0 || rt.hintOpen);
  const a = store.getState();

  return (
    <section
      ref={ref}
      tabIndex={-1}
      className={styles.task}
      data-task-region=""
      data-status={rt.status}
      aria-label="Your task"
    >
      <header className={styles.head}>
        <span className={styles.label}>
          <span className={styles.bullet} aria-hidden="true" />
          {solving
            ? 'Showing you'
            : open
              ? 'Your turn'
              : rt.status === 'done'
                ? 'Done'
                : rt.status === 'shown'
                  ? 'Done for you'
                  : 'Skipped'}
        </span>
        {!open ? (
          <span className={styles.state}>
            <Glyph name={rt.status === 'skipped' ? 'status-off' : 'check'} size={16} />
          </span>
        ) : null}
      </header>

      <p className={styles.prompt}>
        <MarkupText text={prompt} />
      </p>

      {task.kind === 'confirm' && open ? (
        <label className={styles.confirm}>
          <input type="checkbox" checked={rt.progress.confirmed} onChange={() => a.confirm()} />
          <span className={styles.box} aria-hidden="true">
            <Glyph name="check" size={14} />
          </span>
          <span>
            <MarkupText text={task.label} plain />
          </span>
        </label>
      ) : null}

      <div className={styles.feedback} role="status" aria-live="polite">
        {open && feedback ? (
          <ul className={styles.lines} data-tone={feedback.tone}>
            {feedback.lines.map((l) => (
              <li key={l}>
                <MarkupText text={l} />
              </li>
            ))}
          </ul>
        ) : null}
        {solving ? (
          <span className={styles.note}>Watch the stage. Continue is available when it finishes.</span>
        ) : null}
        {rt.status === 'done' ? <span className="sr-only">Task complete.</span> : null}
        {rt.status === 'shown' ? (
          <span className={styles.note}>Finished with Show me, which earns half the XP.</span>
        ) : null}
        {rt.status === 'skipped' ? (
          <span className={styles.note}>Skipped. You can come back to it.</span>
        ) : null}
      </div>

      {/* Always in the DOM while the task is open, so the Hint button's aria-controls names a real element. */}
      {open && hint ? (
        <div id={hintId} ref={hintRef} tabIndex={-1} className={styles.hint} hidden={!rt.hintOpen}>
          <span className={styles.hintLabel}>Hint</span>
          <MarkupText text={hint} />
        </div>
      ) : null}

      {open ? (
        <div className={styles.actions}>
          {hint && !rt.hintOpen ? (
            <Button
              size="sm"
              variant="ghost"
              icon="help"
              aria-expanded={false}
              aria-controls={hintId}
              onClick={() => {
                hintAsked.current = true;
                a.openHint();
              }}
            >
              Hint
            </Button>
          ) : null}
          {offerHelp ? (
            <>
              {solving ? null : (
                <Button size="sm" variant="secondary" icon="eye" onClick={() => a.showMe()}>
                  Show me
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => a.skip()}>
                Skip
              </Button>
              {solving ? null : <span className={styles.xp}>Show me earns half the XP.</span>}
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
