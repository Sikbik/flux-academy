/**
 * Back and Continue. Continue is `aria-disabled`, not `disabled`, while a task is open: it stays in the
 * tab order, and pressing it explains what is still missing instead of doing nothing.
 *
 * The reason Continue is blocked is a line of text beside the buttons (above them on a phone, where a long
 * button label leaves it no room). It is clamped to one line there, but the full sentence is always in the
 * DOM and is the button's description, so nothing depends on how much of it fits.
 *
 * When the step's content runs on below the bar, a fade above the bar and a "More below" label say so.
 */

import { type RefObject, useEffect, useId, useRef, useState } from 'react';
import { continueAllowed, layoutOf } from '@/learn/player';
import { Button, Glyph, Kbd } from '@/ui';
import styles from './NavBar.module.css';
import { usePlayer, usePlayerCtx } from './PlayerContext';
import { useCompactStage } from './useStacked';
import { useToastLift } from './useToastLift';

export interface NavBarProps {
  /** Called when Continue is pressed while blocked. */
  onBlocked: () => void;
  /** Why Continue is blocked, shown beside the buttons. */
  reason: string | null;
  /** The end of the step's content (an element in the flow just above the bar), for the "more below" cue. */
  endRef?: RefObject<HTMLElement | null>;
}

/**
 * True while the end of the content is below the top edge of the bar: some of it is under the bar, or
 * beyond it. Re-read on scroll, on resize and when the content changes size.
 */
export function useMoreBelow(
  barRef: RefObject<HTMLElement | null>,
  endRef: RefObject<HTMLElement | null> | undefined,
): boolean {
  const [more, setMore] = useState(false);
  useEffect(() => {
    const bar = barRef.current;
    const end = endRef?.current;
    if (!bar || !end) {
      setMore(false);
      return;
    }
    let raf = 0;
    const read = () => {
      raf = 0;
      setMore(end.getBoundingClientRect().top > bar.getBoundingClientRect().top + 1);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    observer?.observe(bar);
    // What sits above the end marker is what moves it: watch the column the marker is in.
    const column = end.parentElement;
    if (column) observer?.observe(column);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer?.disconnect();
    };
  }, [barRef, endRef]);
  return more;
}

export function NavBar({ onBlocked, reason, endRef }: NavBarProps) {
  const { lesson, store } = usePlayerCtx();
  const position = usePlayer((s) => s.position);
  const allowed = usePlayer((s) => continueAllowed(lesson, s));
  const layout = layoutOf(lesson);
  const total = layout.end;
  const onLastStep = position === layout.steps - 1;
  const onLastChallenge = position === layout.end - 1;
  const label = onLastChallenge
    ? 'Finish the lesson'
    : onLastStep && layout.challenges > 0
      ? 'Start the checkpoint'
      : 'Continue';
  const gated = reason !== null;
  const reasonId = useId();
  const navRef = useRef<HTMLElement>(null);
  // On a phone, upright (the bar is fixed to the screen) or on its side (the bar sits at the foot of a short
  // column), the help ladder is right above the bar, and a toast there would cover it: the toasts go to the
  // top, under the header. Elsewhere they sit just above the bar.
  const compact = useCompactStage();
  useToastLift(navRef, compact ? 'top' : 'bottom');
  const more = useMoreBelow(navRef, endRef);

  return (
    <nav
      ref={navRef}
      className={styles.nav}
      aria-label="Lesson navigation"
      data-gated={gated ? 'true' : undefined}
      data-more={more ? 'true' : undefined}
    >
      <span className={styles.more} aria-hidden="true">
        <Glyph name="chevron-down" size={14} />
        More below
      </span>
      <Button
        variant="ghost"
        icon="arrow-left"
        aria-label="Back to the previous step"
        aria-disabled={position === 0 ? true : undefined}
        onClick={() => {
          if (position > 0) store.getState().prev();
        }}
        className={styles.back}
      >
        <span className={styles.backText}>Back</span>
      </Button>
      <p className={styles.status} data-gated={gated ? 'true' : undefined}>
        <span className={styles.count}>
          {Math.min(position + 1, total)} of {total}
        </span>
        {gated ? (
          <span id={reasonId} className={styles.reason}>
            {reason}
          </span>
        ) : null}
      </p>
      <span className={styles.keys} aria-hidden="true">
        <Kbd combo="left" size="sm" />
        <Kbd combo="right" size="sm" />
      </span>
      <Button
        variant="primary"
        iconEnd="arrow-right"
        aria-disabled={allowed ? undefined : true}
        aria-describedby={gated ? reasonId : undefined}
        data-ready={allowed && !gated ? '' : undefined}
        onClick={() => {
          if (!allowed) onBlocked();
          else store.getState().next();
        }}
        data-continue=""
      >
        {label}
      </Button>
    </nav>
  );
}
