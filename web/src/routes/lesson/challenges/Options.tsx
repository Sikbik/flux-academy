/**
 * Choice (one answer) and multi (several). Native radios and checkboxes under a card skin, so the
 * keyboard and screen reader behaviour is the browser's own. Checking is explicit (a button), so an
 * arrow key never submits an answer.
 *
 * A wrong choice is struck with its `why` (teaching, not scolding) and cannot be picked again. After the
 * challenge is over (right, shown or skipped) the answer is revealed with every `why`.
 */

import { useId, useMemo, useState } from 'react';
import { gradeChoice, gradeMulti } from '@/learn/grade';
import { MarkupText } from '@/learn/MarkupText';
import type { ChoiceChallenge, MultiChallenge } from '@/learn/types';
import { Button, Glyph } from '@/ui';
import { usePlayerCtx } from '../PlayerContext';
import styles from './challenges.module.css';
import { Feedback } from './Feedback';

interface Props {
  challenge: ChoiceChallenge | MultiChallenge;
  open: boolean;
}

interface Note {
  lines: string[];
  /** False when the same words are already on a card. */
  visible: boolean;
}

export function Options({ challenge, open }: Props) {
  const { store } = usePlayerCtx();
  const multi = challenge.kind === 'multi';
  const groupName = useId();
  const [picked, setPicked] = useState<string[]>([]);
  const [struck, setStruck] = useState<string[]>([]);
  const [note, setNote] = useState<Note>({ lines: [], visible: true });

  const answers = useMemo(
    () => (challenge.kind === 'multi' ? challenge.answers : [challenge.answer]),
    [challenge],
  );

  const toggle = (id: string) => {
    if (!open) return;
    setNote({ lines: [], visible: true });
    if (multi) {
      setStruck((s) => s.filter((x) => x !== id));
      setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    } else {
      setPicked([id]);
    }
  };

  const check = () => {
    if (!open || picked.length === 0) return;
    if (challenge.kind === 'choice') {
      const id = picked[0] as string;
      if (gradeChoice(challenge, id)) {
        store.getState().answerChoice(id);
        return;
      }
      setStruck((s) => (s.includes(id) ? s : [...s, id]));
      setPicked([]);
      const why = challenge.options.find((o) => o.id === id)?.why;
      setNote(
        why
          ? { lines: [why], visible: false }
          : { lines: ['That is not it. Read the options again and pick another.'], visible: true },
      );
      store.getState().answerChoice(id);
      return;
    }
    const verdict = gradeMulti(challenge, picked);
    if (verdict.correct) {
      store.getState().answerMulti(picked);
      return;
    }
    setStruck(verdict.extra);
    const lines: string[] = [];
    if (verdict.extra.length > 0) {
      lines.push(
        verdict.extra.length === 1
          ? 'One of your picks does not belong. It is marked.'
          : `${verdict.extra.length} of your picks do not belong. They are marked.`,
      );
    }
    if (verdict.missing.length > 0) {
      lines.push(
        verdict.missing.length === 1
          ? 'One right answer is still missing.'
          : `${verdict.missing.length} right answers are still missing.`,
      );
    }
    setNote({ lines, visible: true });
    store.getState().answerMulti(picked);
  };

  return (
    <div>
      <fieldset className={styles.options}>
        <legend className={styles.legend}>
          {multi ? 'Pick every answer that applies' : 'Pick one answer'}
        </legend>
        {challenge.options.map((o) => {
          const isAnswer = answers.includes(o.id);
          const isStruck = struck.includes(o.id) && !isAnswer;
          const selected = picked.includes(o.id);
          let verdict: 'right' | 'wrong' | 'dim' | undefined;
          if (!open) verdict = isAnswer ? 'right' : selected || isStruck ? 'wrong' : 'dim';
          else if (isStruck) verdict = 'wrong';
          const showWhy = Boolean(o.why) && (verdict === 'wrong' || (!open && !isAnswer));
          const disabled = !open || (isStruck && !multi);
          return (
            <label key={o.id} className={styles.option} data-locked={disabled ? 'true' : undefined}>
              <input
                className={styles.input}
                type={multi ? 'checkbox' : 'radio'}
                name={groupName}
                checked={!open ? isAnswer : selected}
                disabled={disabled}
                onChange={() => toggle(o.id)}
              />
              <span className={styles.card} data-verdict={verdict}>
                <span className={styles.mark} data-kind={multi ? 'multi' : 'single'} aria-hidden="true">
                  <Glyph name={verdict === 'wrong' ? 'close' : 'check'} size={13} />
                </span>
                <span className={styles.optionText}>
                  <span>
                    <MarkupText text={o.label} />
                  </span>
                  {showWhy ? (
                    <span className={styles.why}>
                      <MarkupText text={o.why as string} />
                    </span>
                  ) : null}
                </span>
                {verdict === 'right' ? (
                  <span className={styles.tag}>Right</span>
                ) : verdict === 'wrong' ? (
                  <span className={styles.tag}>Not this</span>
                ) : (
                  <span />
                )}
              </span>
            </label>
          );
        })}
      </fieldset>

      <Feedback lines={open ? note.lines : []} hidden={!note.visible} />

      {open ? (
        <div className={styles.checkRow} style={{ marginBlockStart: 'var(--space-4)' }}>
          <Button
            variant="primary"
            size="sm"
            onClick={check}
            aria-disabled={picked.length === 0 ? true : undefined}
          >
            {multi ? 'Check answers' : 'Check answer'}
          </Button>
          {picked.length === 0 ? (
            <span className={styles.hintNote}>{multi ? 'Tick at least one.' : 'Pick an option first.'}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
