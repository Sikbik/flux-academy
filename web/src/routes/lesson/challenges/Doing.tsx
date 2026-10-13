/**
 * The narrative side of the challenges that happen on a stage: edit a broken spec, build one from a
 * brief, run terminal commands. The stage is in the stage column; here the learner sees what is asked
 * and, live, what is still missing.
 */

import { useMemo } from 'react';
import { checkContext } from '@/learn/engine';
import { MarkupText } from '@/learn/MarkupText';
import type { ChallengeRuntime } from '@/learn/player';
import { challengeAsTask, requirementStates } from '@/learn/player';
import { buildSpec } from '@/learn/specs';
import { taskFeedback } from '@/learn/tasks';
import type { SpecBuildChallenge, SpecFixChallenge, TerminalChallenge } from '@/learn/types';
import { Glyph } from '@/ui';
import { usePlayerCtx } from '../PlayerContext';
import styles from './challenges.module.css';
import { Feedback } from './Feedback';

export function SpecBuildBody({
  challenge,
  runtime,
  open,
}: {
  challenge: SpecBuildChallenge;
  runtime: ChallengeRuntime;
  open: boolean;
}) {
  const { engine } = usePlayerCtx();
  // Before the editor reports its first change, evaluate the starting spec so the list is never blank.
  const initial = useMemo(
    () => (engine ? checkContext(engine, buildSpec(engine, challenge.spec)) : null),
    [engine, challenge.spec],
  );
  const states = requirementStates(challenge, runtime.facts ?? initial);
  const met = states.filter((s) => s.pass === true).length;
  return (
    <div>
      <p className={styles.reqHead} aria-live="polite">
        Requirements: {open ? met : states.length} of {states.length} met
      </p>
      <ul className={styles.reqs} style={{ marginBlockStart: 'var(--space-3)' }}>
        {states.map((s) => (
          <li key={s.id} className={styles.req} data-pass={!open || s.pass === true ? 'true' : undefined}>
            <span className={styles.reqMark} aria-hidden="true">
              <Glyph name="check" size={13} />
            </span>
            <span>
              <MarkupText text={s.label} />
              <span className="sr-only">{!open || s.pass ? '. Met' : '. Not met yet'}</span>
              {open && s.pass === false && s.message ? (
                <span className={styles.reqNote}>
                  <MarkupText text={s.message} />
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SpecFixBody({
  challenge,
  runtime,
  open,
}: {
  challenge: SpecFixChallenge;
  runtime: ChallengeRuntime;
  open: boolean;
}) {
  const task = challengeAsTask(challenge);
  const fb = open ? taskFeedback(task, runtime.progress) : null;
  return (
    <div>
      <p className={styles.reqHead}>Edit the spec in the editor</p>
      <p className={styles.hintNote} style={{ marginBlockStart: 'var(--space-2)' }}>
        The editor reports what is wrong as you go. This check passes when the spec does what the task asks.
      </p>
      <Feedback lines={fb?.lines ?? []} title={fb ? 'Still to fix' : undefined} />
    </div>
  );
}

export function TerminalBody({
  challenge,
  runtime,
  open,
}: {
  challenge: TerminalChallenge;
  runtime: ChallengeRuntime;
  open: boolean;
}) {
  const labels = new Map(challenge.script.goals.map((g) => [g.id, g.label]));
  const done = runtime.progress.goals;
  return (
    <div>
      <p className={styles.reqHead}>
        Goals: {open ? done.length : challenge.goals.length} of {challenge.goals.length} done
      </p>
      <ul className={styles.reqs} style={{ marginBlockStart: 'var(--space-3)' }}>
        {challenge.goals.map((g) => {
          const ok = !open || done.includes(g);
          return (
            <li key={g} className={styles.req} data-pass={ok ? 'true' : undefined}>
              <span className={styles.reqMark} aria-hidden="true">
                <Glyph name="check" size={13} />
              </span>
              <span>
                <MarkupText text={labels.get(g) ?? g} />
                <span className="sr-only">{ok ? '. Done' : '. Not done yet'}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className={styles.hintNote} style={{ marginBlockStart: 'var(--space-3)' }}>
        This is a simulation. Type the commands into the terminal on the stage.
      </p>
    </div>
  );
}
