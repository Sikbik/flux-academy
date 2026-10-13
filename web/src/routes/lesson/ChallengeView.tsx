/**
 * One checkpoint challenge in the narrative column: the prompt, the kind's own answer surface, specific
 * feedback, the help ladder (Hint, then Show me, then Skip) and, once it is over, the result with the
 * `explain` text and the XP.
 *
 * Wrong answers keep the learner here to try again. Nothing times out and nothing is lost: help costs
 * XP, never access.
 */

import { type Ref, useEffect, useId, useRef } from 'react';
import { MarkupText } from '@/learn/MarkupText';
import type { Challenge } from '@/learn/types';
import { challengeBaseXp } from '@/learn/xp';
import { Button } from '@/ui';
import styles from './ChallengeView.module.css';
import { SpecBuildBody, SpecFixBody, TerminalBody } from './challenges/Doing';
import { Estimate } from './challenges/Estimate';
import { Match } from './challenges/Match';
import { Options } from './challenges/Options';
import { Order } from './challenges/Order';
import { Tick } from './challenges/Tick';
import { usePlayer, usePlayerCtx } from './PlayerContext';

const KIND_LABEL: Record<Challenge['kind'], string> = {
  choice: 'Question',
  multi: 'Select all that apply',
  order: 'Put in order',
  match: 'Match',
  'spec-fix': 'Fix the spec',
  'spec-build': 'Build a spec',
  terminal: 'Terminal',
  estimate: 'Estimate',
};

export interface ChallengeViewProps {
  challenge: Challenge;
  index: number;
  total: number;
  headingRef: Ref<HTMLHeadingElement>;
}

export function ChallengeView({ challenge, index, total, headingRef }: ChallengeViewProps) {
  const { lesson, store } = usePlayerCtx();
  const rt = usePlayer((s) => s.challenges[challenge.id]);
  const hintId = useId();
  const hintRef = useRef<HTMLDivElement>(null);
  // Set when the learner pressed Hint, so only that opening moves focus (a first wrong answer opens it too).
  const hintAsked = useRef(false);
  const hintIsOpen = rt?.status === 'open' && rt.hintOpen;
  // The Hint button goes away when it is pressed: focus moves to the hint it revealed, not to the page.
  useEffect(() => {
    if (!hintIsOpen || !hintAsked.current) return;
    hintAsked.current = false;
    hintRef.current?.focus();
  }, [hintIsOpen]);
  if (!rt) return null;

  const open = rt.status === 'open';
  const solving = open && rt.solving;
  const a = store.getState();
  const attempted = rt.attempts > 0 || rt.progress.attempts > 0;
  const hint = challenge.hint;
  const hintVisible = open && Boolean(hint) && (rt.hintOpen || attempted);
  const offer = open && (rt.stuck || attempted || rt.hintOpen);
  const seed = `${lesson.id}:${challenge.id}`;
  const base = challengeBaseXp(challenge);

  const body = (() => {
    switch (challenge.kind) {
      case 'choice':
      case 'multi':
        return <Options challenge={challenge} open={open} />;
      case 'order':
        return <Order challenge={challenge} open={open} seed={seed} />;
      case 'match':
        return <Match challenge={challenge} open={open} seed={seed} />;
      case 'estimate':
        return <Estimate challenge={challenge} open={open} attempts={rt.attempts} />;
      case 'spec-fix':
        return <SpecFixBody challenge={challenge} runtime={rt} open={open} />;
      case 'spec-build':
        return <SpecBuildBody challenge={challenge} runtime={rt} open={open} />;
      case 'terminal':
        return <TerminalBody challenge={challenge} runtime={rt} open={open} />;
    }
  })();

  const resultLabel =
    rt.status === 'correct' ? 'Correct' : rt.status === 'shown' ? 'Done for you' : 'Skipped';
  const xpText = rt.alreadyEarned
    ? `${rt.xp} XP earned before`
    : rt.status === 'skipped'
      ? 'No XP'
      : rt.status === 'shown'
        ? `+${rt.xp} XP, half for Show me`
        : `+${rt.xp} XP`;

  return (
    <article className={styles.challenge} aria-labelledby={`challenge-${challenge.id}`}>
      <p className={styles.eyebrow}>
        <span className={styles.hex} aria-hidden="true" />
        Checkpoint {index + 1} of {total}
        <span className={styles.sep}>{KIND_LABEL[challenge.kind]}</span>
        <span className={styles.xp}>{base} XP</span>
      </p>
      <h2 id={`challenge-${challenge.id}`} ref={headingRef} tabIndex={-1} className={styles.prompt}>
        <MarkupText text={challenge.prompt} reveal baseDelay={80} />
      </h2>

      <section
        className={styles.region}
        data-task-region=""
        tabIndex={-1}
        aria-label="Your answer"
        data-status={rt.status}
      >
        {body}

        {/* Always in the DOM while the challenge is open, so the Hint button's aria-controls names a real element. */}
        {open && hint ? (
          <div id={hintId} ref={hintRef} tabIndex={-1} className={styles.hint} hidden={!hintVisible}>
            <span className={styles.hintLabel}>Hint</span>
            <MarkupText text={hint} />
          </div>
        ) : null}

        {open ? (
          <div className={styles.actions}>
            {hint && !hintVisible ? (
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
            {offer ? (
              <>
                {solving ? null : (
                  <Button size="sm" variant="secondary" icon="eye" onClick={() => a.showMe()}>
                    Show me
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => a.skip()}>
                  Skip
                </Button>
                <span className={styles.note}>
                  {solving
                    ? 'Watch the stage. The result appears when it finishes.'
                    : 'Show me earns half the XP. Skip earns none.'}
                </span>
              </>
            ) : null}
          </div>
        ) : null}
      </section>

      {!open ? (
        <section className={styles.result} data-status={rt.status} aria-label="Result" aria-live="polite">
          <div className={styles.resultHead}>
            <Tick tone={rt.status === 'correct' ? 'ok' : 'muted'} />
            <span className={styles.resultLabel}>{resultLabel}</span>
            <span className={styles.xpPill}>{xpText}</span>
          </div>
          <p className={styles.explain}>
            <MarkupText text={challenge.explain} />
          </p>
        </section>
      ) : null}
    </article>
  );
}
