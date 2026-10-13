/**
 * The lesson player: the rail on top, the narrative (a step, a checkpoint challenge or the completion
 * moment) beside the stage, and the outline drawer. Everything stateful is in the player store
 * (`learn/player.ts`); this file is layout, keyboard, focus and announcements.
 *
 * Keyboard (scope `lesson`): Right or Enter continue, Left back, `g o` the outline, `?` the shortcuts
 * overlay (the shell's). A key that a focused control already uses stays with that control.
 */

import { AnimatePresence, motion } from 'motion/react';
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDocumentMeta } from '@/app/meta';
import { continueAllowed, idAtPosition, layoutOf, phaseAt } from '@/learn/player';
import { announce } from '@/system/announce';
import { useHotkey, useHotkeyScope } from '@/system/hotkeys';
import { useReducedMotion } from '@/ui';
import { blockedMessage, blockedReason } from './blocked';
import { ChallengeView } from './ChallengeView';
import { Completion } from './Completion';
import { playerMayHandle } from './hotkeys';
import { NavBar } from './NavBar';
import { Outline } from './Outline';
import styles from './Player.module.css';
import { usePlayer, usePlayerCtx } from './PlayerContext';
import { Rail } from './Rail';
import { StageColumn } from './StageColumn';
import { StepView } from './StepView';
import { focusAndReveal, useCondensedHeader, usePinnedInsets } from './useChrome';
import { useLessonSearch } from './useLessonSearch';

const EASE = [0.16, 1, 0.3, 1] as const;

export function Player() {
  const { lesson, meta, store } = usePlayerCtx();
  const position = usePlayer((s) => s.position);
  const direction = usePlayer((s) => s.direction);
  const completion = usePlayer((s) => s.completion);
  const reason = usePlayer((s) => blockedReason(lesson, s));
  const reduced = useReducedMotion();
  const condensed = useCondensedHeader();
  const [outline, setOutline] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const arrived = useRef(false);
  const layout = layoutOf(lesson);
  const phase = phaseAt(layout, position);

  // The browser is told how much of the viewport the pinned stage and bar cover, so a control that gets
  // focus (or is scrolled to) lands in the clear band between them. It re-measures when the phase changes
  // shape: the completion moment has neither a stage nor a bar.
  usePinnedInsets(phase === 'complete' ? 'complete' : 'play');

  useLessonSearch(lesson, store, position);
  useHotkeyScope('lesson');
  useDocumentMeta({ title: meta.title, description: meta.summary });

  // The URL of the article view keeps the learner's place, so "back to the lesson" returns to it.
  const articleTo = useMemo(() => {
    const p = new URLSearchParams({ view: 'article' });
    const id = idAtPosition(lesson, position);
    if (id && position > 0) p.set('step', id);
    return `?${p.toString()}`;
  }, [lesson, position]);

  // Announce where the learner is after every move (not on the first render).
  useEffect(() => {
    if (!arrived.current) return;
    if (phase === 'step') {
      const step = lesson.steps[position];
      if (step) announce(`Step ${position + 1} of ${layout.steps}: ${step.title}`);
    } else if (phase === 'challenge') {
      const n = position - layout.steps + 1;
      announce(`Checkpoint ${n} of ${layout.challenges}`);
    }
  }, [position, phase, lesson, layout.steps, layout.challenges]);

  const nudge = useCallback(() => {
    const message = blockedMessage(lesson, store.getState());
    if (message) announce(message);
    const region = document.querySelector<HTMLElement>('[data-task-region]');
    if (!region) return;
    focusAndReveal(region);
    region.dataset.nudge = 'true';
    window.setTimeout(() => {
      delete region.dataset.nudge;
    }, 600);
  }, [lesson, store]);

  const advance = useCallback(
    (e: KeyboardEvent): undefined | false => {
      if (!playerMayHandle(e.key, e.target)) return false;
      const s = store.getState();
      if (phaseAt(layoutOf(lesson), s.position) === 'complete') return false;
      if (continueAllowed(lesson, s)) s.next();
      else nudge();
      return undefined;
    },
    [lesson, store, nudge],
  );

  useHotkey({
    id: 'lesson.next',
    keys: ['arrowright', 'enter'],
    label: 'Continue to the next step',
    group: 'Lesson',
    scope: 'lesson',
    run: advance,
  });
  useHotkey({
    id: 'lesson.back',
    keys: 'arrowleft',
    label: 'Back to the previous step',
    group: 'Lesson',
    scope: 'lesson',
    run: (e) => {
      if (!playerMayHandle(e.key, e.target)) return false;
      const s = store.getState();
      if (s.position === 0) return false;
      s.prev();
      return undefined;
    },
  });
  useHotkey({
    id: 'lesson.outline',
    keys: 'g o',
    label: 'Open the lesson outline',
    group: 'Lesson',
    scope: 'lesson',
    run: () => {
      if (document.documentElement.dataset.scrollLocked === 'true') return false;
      setOutline(true);
      return undefined;
    },
  });

  // After the first view has been shown, every arrival moves focus to the new heading.
  useEffect(() => {
    const t = window.setTimeout(() => {
      arrived.current = true;
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const viewKey = phase === 'complete' ? 'complete' : (idAtPosition(lesson, position) ?? String(position));
  const t = reduced ? 0.12 : 0.34;

  const view = (() => {
    if (phase === 'step') {
      const step = lesson.steps[position];
      if (!step) return null;
      return (
        <StepView
          step={step}
          index={position}
          total={layout.steps}
          module={meta.module}
          headingRef={headingRef}
        />
      );
    }
    if (phase === 'challenge') {
      const index = position - layout.steps;
      const challenge = lesson.checkpoint[index];
      if (!challenge) return null;
      return (
        <ChallengeView
          challenge={challenge}
          index={index}
          total={layout.challenges}
          headingRef={headingRef}
        />
      );
    }
    return completion ? <Completion headingRef={headingRef} /> : null;
  })();

  const style = {
    '--bar-h': condensed ? 'var(--header-h-condensed, 52px)' : 'var(--header-h, 64px)',
  } as CSSProperties;

  return (
    <div className={styles.player} style={style} data-phase={phase}>
      <Rail onOutline={() => setOutline(true)} articleTo={articleTo} />

      <div className={styles.grid} data-phase={phase}>
        <div className={styles.narrative}>
          <div className={styles.content}>
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={viewKey}
                custom={direction}
                variants={{
                  enter: (d: number) => ({ opacity: 0, x: reduced ? 0 : d >= 0 ? 28 : -28 }),
                  center: { opacity: 1, x: 0 },
                  exit: (d: number) => ({ opacity: 0, x: reduced ? 0 : d >= 0 ? -28 : 28 }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: t, ease: EASE }}
                onAnimationStart={(def) => {
                  if (def === 'center' && arrived.current && headingRef.current) {
                    focusAndReveal(headingRef.current);
                  }
                }}
              >
                {view}
              </motion.div>
            </AnimatePresence>
          </div>
          <div ref={endRef} className={styles.end} aria-hidden="true" />
          {phase !== 'complete' ? <NavBar onBlocked={nudge} reason={reason} endRef={endRef} /> : null}
        </div>
        {phase !== 'complete' ? <StageColumn /> : null}
      </div>

      <Outline open={outline} onClose={() => setOutline(false)} articleTo={articleTo} />
    </div>
  );
}
