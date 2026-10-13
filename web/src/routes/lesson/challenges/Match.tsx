/**
 * Match each item on the left with one on the right. Click one, then click its partner (either order).
 * Pairs wear a shared letter, so the pairing never relies on colour. A wrong check keeps the pairs that
 * were right (locked, with a tick) and frees the rest.
 */

import { useMemo, useState } from 'react';
import { gradeMatch, shuffleIds } from '@/learn/grade';
import { MarkupText } from '@/learn/MarkupText';
import { plainText } from '@/learn/markup';
import type { MatchChallenge } from '@/learn/types';
import { Button } from '@/ui';
import { usePlayerCtx } from '../PlayerContext';
import styles from './challenges.module.css';
import { Feedback } from './Feedback';
import { applyVerdict, clickItem, freshMatch, holderOf, type MatchState, type Side } from './logic';

interface Props {
  challenge: MatchChallenge;
  open: boolean;
  seed: string;
}

const LETTERS = 'ABCDEFGHIJKLMNOP';

export function Match({ challenge, open, seed }: Props) {
  const { store } = usePlayerCtx();
  const [state, setState] = useState<MatchState>(freshMatch);
  const [note, setNote] = useState<string[]>([]);
  const [spoken, setSpoken] = useState('');
  const pairs = challenge.pairs;
  const rightOrder = useMemo(
    () =>
      shuffleIds(
        pairs.map((p) => p.id),
        seed,
      ),
    [pairs, seed],
  );
  const rightById = useMemo(() => new Map(pairs.map((p) => [p.id, p])), [pairs]);
  const letterOf = (leftId: string) => LETTERS[pairs.findIndex((p) => p.id === leftId)] ?? '?';

  const click = (side: Side, id: string) => {
    if (!open) return;
    const next = clickItem(state, side, id);
    if (next === state) return;
    setState(next);
    setNote([]);
    if (next.pending) {
      setSpoken(
        `${side === 'left' ? 'Left' : 'Right'} item selected. Now pick its partner in the other column.`,
      );
    } else if (Object.keys(next.assignment).length > Object.keys(state.assignment).length) {
      const left = side === 'left' ? id : (state.pending?.id ?? '');
      setSpoken(
        `Paired as ${letterOf(left)}. ${Object.keys(next.assignment).length} of ${pairs.length} paired.`,
      );
    } else {
      setSpoken('Pair removed.');
    }
  };

  const allPaired = Object.keys(state.assignment).length === pairs.length;

  const check = () => {
    if (!allPaired) return;
    const v = gradeMatch(challenge, state.assignment);
    if (v.correct) {
      store.getState().answerMatch(state.assignment);
      return;
    }
    setState(applyVerdict(state, v));
    setNote([
      `${v.right.length} of ${pairs.length} are right and now locked. The other ${v.wrong.length === 1 ? 'one is' : `${v.wrong.length} are`} free again.`,
    ]);
    store.getState().answerMatch(state.assignment);
  };

  const rows = (side: Side) => {
    const ids = side === 'left' ? pairs.map((p) => p.id) : rightOrder;
    return ids.map((id) => {
      const pair = rightById.get(id);
      if (!pair) return null;
      const text = side === 'left' ? pair.left : pair.right;
      const leftOf = side === 'left' ? id : holderOf(state.assignment, id);
      const partner = leftOf !== null && state.assignment[leftOf] !== undefined ? leftOf : null;
      const locked = partner !== null && state.locked.includes(partner);
      const revealed = !open;
      const pressed = open && state.pending?.side === side && state.pending.id === id;
      const letter = revealed ? letterOf(id) : partner !== null ? letterOf(partner) : null;
      return (
        <li key={`${side}:${id}`}>
          <button
            type="button"
            className={styles.pick}
            aria-pressed={pressed}
            data-paired={partner !== null ? 'true' : undefined}
            data-verdict={locked || revealed ? 'right' : undefined}
            disabled={!open || locked}
            onClick={() => click(side, id)}
          >
            <span>
              <MarkupText text={text} plain />
              {letter ? <span className="sr-only">. Paired as {letter}</span> : null}
            </span>
            {letter ? (
              <span className={styles.badge} aria-hidden="true">
                {letter}
              </span>
            ) : (
              <span className={styles.empty} aria-hidden="true" />
            )}
          </button>
        </li>
      );
    });
  };

  return (
    <div>
      {open ? (
        <p className={styles.legend}>Pick an item, then pick its partner in the other column.</p>
      ) : (
        <p className={styles.legend}>The right pairs</p>
      )}
      <div className={styles.board}>
        <div>
          <p className={styles.colHead}>Item</p>
          <ul className={styles.col} aria-label="Items to match">
            {rows('left')}
          </ul>
        </div>
        <div>
          <p className={styles.colHead}>Match</p>
          <ul className={styles.col} aria-label="Matches">
            {rows('right')}
          </ul>
        </div>
      </div>
      <div className="sr-only" role="status" aria-live="polite">
        {spoken}
      </div>
      <Feedback lines={note} />
      {open ? (
        <div className={styles.checkRow} style={{ marginBlockStart: 'var(--space-4)' }}>
          <Button variant="primary" size="sm" onClick={check} aria-disabled={allPaired ? undefined : true}>
            Check matches
          </Button>
          <span className={styles.hintNote}>
            {Object.keys(state.assignment).length} of {pairs.length} paired
          </span>
        </div>
      ) : null}
      <span className="sr-only">{plainText(challenge.prompt)}</span>
    </div>
  );
}
