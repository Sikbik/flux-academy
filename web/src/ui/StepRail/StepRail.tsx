import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from 'react';
import { cn } from '../internal/cn';
import { rovingTarget } from '../Tabs/roving';
import { Tooltip } from '../Tooltip/Tooltip';
import styles from './StepRail.module.css';
import {
  deriveStates,
  focusIndex,
  newlyDone,
  type StepKind,
  type StepState,
  spokenState,
  stepAnnouncement,
} from './states';

export type { StepKind, StepState } from './states';

export interface StepRailStep {
  /** Unique inside the rail. */
  id: string;
  /** Names the step: spoken, and shown in the tooltip and the caption. */
  label: string;
  /** `step` (default) or `check`: a checkpoint challenge, drawn with a hex bead. */
  kind?: StepKind;
  /** An explicit state. Without it the state follows `current`. */
  state?: StepState;
  /** A pseudo-state hook for the kit gallery and visual tests. */
  force?: 'hover' | 'press' | 'focus';
}

export interface StepRailProps {
  steps: readonly StepRailStep[];
  /** The id of the current step. Steps before it are done, steps after it are to do. */
  current?: string;
  /** Makes the segments buttons. Locked steps stay inert. Without it the rail is static. */
  onSelect?: (id: string, index: number) => void;
  /** Wears a tier colour (the lesson's track). Without it the page accent. */
  tier?: 'cumulus' | 'nimbus' | 'stratus';
  /** Phone density: thinner segments, and the current step's name shows beneath. */
  compact?: boolean;
  /** Show the current step's name beneath the rail (always on when `compact`). */
  showLabel?: boolean;
  /** Names the rail for assistive tech. Required. */
  'aria-label': string;
  className?: string;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * The lesson player's progress rail: one segment per step, checkpoints drawn with a hex
 * bead. Completing a step lands its segment with a snap and a tiny ring; the current
 * segment pulses softly (twice, then rests). Interactive when `onSelect` is given: one tab
 * stop, arrows and Home and End move, Enter selects.
 *
 *   <StepRail aria-label="Lesson progress" steps={steps} current={stepId} onSelect={goTo} tier="cumulus" />
 */
export function StepRail({
  steps,
  current,
  onSelect,
  tier,
  compact = false,
  showLabel,
  'aria-label': ariaLabel,
  className,
}: StepRailProps) {
  const states = deriveStates(steps, current);
  const total = steps.length;
  const interactive = typeof onSelect === 'function';
  // Where the learner is. A step that has been completed is `done`, not `current`, so with explicit states
  // the position cannot be read from them: `current` names it, and the tab stop and aria-current follow it.
  const named = current === undefined ? -1 : steps.findIndex((s) => s.id === current);
  const stop = focusIndex(states, named >= 0 ? named : undefined);
  const listRef = useRef<HTMLOListElement>(null);

  // Landing: which segments just completed, for a second.
  const prev = useRef<StepState[] | null>(null);
  const timers = useRef<Set<number>>(new Set());
  const [landed, setLanded] = useState<number[]>([]);
  const key = states.join('|');
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the identity of `states`
  useEffect(() => {
    const done = newlyDone(prev.current, states);
    prev.current = states;
    if (done.length === 0) return;
    setLanded((l) => [...new Set([...l, ...done])]);
    const t = window.setTimeout(() => {
      timers.current.delete(t);
      setLanded((l) => l.filter((i) => !done.includes(i)));
    }, 1000);
    timers.current.add(t);
  }, [key]);

  useEffect(() => {
    const set = timers.current;
    return () => {
      for (const t of set) window.clearTimeout(t);
      set.clear();
    };
  }, []);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLOListElement>) => {
    if (!interactive) return;
    const buttons = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('button[data-seg]') ?? [],
    );
    const at = buttons.indexOf(e.target as HTMLButtonElement);
    if (at < 0) return;
    const to = rovingTarget(
      buttons.map(() => ({})),
      at,
      e.key,
      {
        orientation: 'horizontal',
        wrap: false,
        rtl: listRef.current ? getComputedStyle(listRef.current).direction === 'rtl' : false,
      },
    );
    if (to === null) return;
    e.preventDefault();
    buttons[to]?.focus();
  };

  const currentIndex = named >= 0 ? named : states.indexOf('current');
  const captionIndex = currentIndex >= 0 ? currentIndex : stop;
  const caption = (showLabel ?? compact) && total > 0 ? steps[captionIndex] : undefined;

  return (
    <div className={cn(styles.root, className)} data-tier={tier} data-compact={compact ? 'true' : undefined}>
      <ol ref={listRef} className={styles.list} aria-label={ariaLabel} onKeyDown={onKeyDown}>
        {steps.map((step, i) => {
          const state = states[i] ?? 'todo';
          const kind = step.kind ?? 'step';
          const locked = state === 'locked';
          const inner = (
            <>
              <span className={styles.bar} aria-hidden="true">
                <span className={styles.fill} />
              </span>
              {kind === 'check' ? <span className={styles.bead} aria-hidden="true" /> : null}
              <span className={styles.ring} aria-hidden="true" />
              <span className={styles.srOnly}>{stepAnnouncement(i, total, step.label, state, kind)}</span>
            </>
          );
          const common = {
            className: cn('chamfer', styles.hit),
            'aria-current': i === currentIndex ? ('step' as const) : undefined,
            'data-force': step.force,
          };
          return (
            <li
              key={step.id}
              className={styles.seg}
              data-state={state}
              data-kind={kind}
              data-landed={landed.includes(i) ? 'true' : undefined}
            >
              {interactive && !locked ? (
                <Tooltip content={step.label} placement="top">
                  <button
                    type="button"
                    data-seg=""
                    tabIndex={i === stop ? 0 : -1}
                    onClick={() => onSelect?.(step.id, i)}
                    {...common}
                  >
                    <span className={styles.edge} aria-hidden="true" />
                    {inner}
                  </button>
                </Tooltip>
              ) : (
                <span {...common} data-static="">
                  {inner}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {caption ? (
        <p className={styles.caption} aria-hidden="true">
          <span className={styles.captionCount}>
            {pad2(captionIndex + 1)} / {pad2(total)}
          </span>
          <span className={styles.captionName}>{caption.label}</span>
          <span className={styles.captionState}>{spokenState(states[captionIndex] ?? 'todo')}</span>
        </p>
      ) : null}
    </div>
  );
}
