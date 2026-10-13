/**
 * The goal tracker. Goals complete in any order and tick with a snap when they do.
 *
 *   <GoalTracker goals={state.goals} />                     a strip that opens into the list
 *   <GoalTracker goals={state.goals} variant="list" />      the plain list (a side panel)
 *   <GoalTracker goals={state.goals} only={task.goals} />   only the goals one lesson step asks for
 */

import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Glyph } from '@/ui';
import type { GoalState } from '../engine/types';
import { cx } from './classes';
import styles from './GoalTracker.module.css';
import { renderInline } from './inline';

export interface GoalTrackerProps {
  goals: readonly GoalState[];
  /** `strip` (default): segments, a count and the next goal, opening into the list. `list`: always open. */
  variant?: 'strip' | 'list';
  /** Show only these goal ids, in script order. */
  only?: readonly string[];
  renderMarkup?: (text: string) => ReactNode;
  /** The strip starts open. */
  defaultOpen?: boolean;
  /** Heading word for the strip. Default "Goals". */
  label?: string;
  className?: string;
}

const FRESH_MS = 1100;

/** Ids of goals that completed since the last render, for a short while. */
function useFreshGoals(goals: readonly GoalState[]): ReadonlySet<string> {
  const doneKey = goals
    .filter((g) => g.done)
    .map((g) => g.id)
    .join('|');
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    const now = new Set(doneKey === '' ? [] : doneKey.split('|'));
    const before = seen.current;
    seen.current = now;
    if (before === null) return; // the first render: what is already done is not news
    const added = [...now].filter((id) => !before.has(id));
    if (added.length === 0) return;
    setFresh(new Set(added));
    const t = window.setTimeout(() => setFresh(new Set()), FRESH_MS);
    return () => window.clearTimeout(t);
  }, [doneKey]);

  return fresh;
}

export function GoalTracker({
  goals,
  variant = 'strip',
  only,
  renderMarkup = renderInline,
  defaultOpen = false,
  label = 'Goals',
  className,
}: GoalTrackerProps) {
  const shown = only ? goals.filter((g) => only.includes(g.id)) : goals;
  const fresh = useFreshGoals(shown);
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  if (shown.length === 0) return null;

  const done = shown.filter((g) => g.done).length;
  const next = shown.find((g) => !g.done);
  const stateOf = (g: GoalState): 'done' | 'next' | 'open' =>
    g.done ? 'done' : g === next ? 'next' : 'open';

  const list = (
    <ol className={styles.list} aria-label={label}>
      {shown.map((g) => {
        const st = stateOf(g);
        return (
          <li
            key={g.id}
            className={styles.item}
            data-state={st}
            data-fresh={fresh.has(g.id) ? 'true' : undefined}
          >
            <span className={styles.tick} aria-hidden="true">
              <Glyph name="check" size={13} strokeWidth={2.4} />
            </span>
            <span className={styles.text}>
              {renderMarkup(g.label)}
              <span className="sr-only">
                {st === 'done' ? '. Done' : st === 'next' ? '. Next' : '. Not done yet'}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );

  if (variant === 'list') {
    return (
      <div className={cx(styles.strip, className)} data-complete={done === shown.length ? 'true' : undefined}>
        {list}
        {done === shown.length ? <p className={styles.allDone}>All goals done.</p> : null}
      </div>
    );
  }

  return (
    <div className={cx(styles.strip, className)} data-complete={done === shown.length ? 'true' : undefined}>
      <button
        type="button"
        className={styles.head}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.label}>{label}</span>
        <span className={styles.segs} aria-hidden="true">
          {shown.map((g) => (
            <span key={g.id} className={styles.seg} data-state={stateOf(g)} />
          ))}
        </span>
        <span className={styles.count}>
          {done} of {shown.length}
          <span className="sr-only"> done</span>
        </span>
        <span className={styles.nextText}>
          {next ? (
            <>
              <b>Next</b>
              {renderMarkup(next.label)}
            </>
          ) : (
            <b>All goals done</b>
          )}
        </span>
        <span className={styles.chev} aria-hidden="true">
          <Glyph name="chevron-down" size={14} />
        </span>
      </button>
      <div id={panelId} className={styles.panel} hidden={!open}>
        {list}
      </div>
    </div>
  );
}
