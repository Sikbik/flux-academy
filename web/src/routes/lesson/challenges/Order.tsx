/**
 * Put the items in order. Drag a row, or use the two buttons on it (the keyboard and assistive tech path;
 * each move is spoken). A wrong check marks which rows already sit in the right place and which do not,
 * so the learner fixes what is wrong rather than starting over.
 */

import { Reorder } from 'motion/react';
import { useMemo, useState } from 'react';
import { gradeOrder, shuffledOrder } from '@/learn/grade';
import { MarkupText } from '@/learn/MarkupText';
import { plainText } from '@/learn/markup';
import type { OrderChallenge } from '@/learn/types';
import { Button, IconButton, useReducedMotion } from '@/ui';
import { usePlayerCtx } from '../PlayerContext';
import styles from './challenges.module.css';
import { Feedback } from './Feedback';
import { moveItem } from './logic';

interface Props {
  challenge: OrderChallenge;
  open: boolean;
  seed: string;
}

export function Order({ challenge, open, seed }: Props) {
  const { store } = usePlayerCtx();
  const reduced = useReducedMotion();
  const [order, setOrder] = useState<string[]>(() => shuffledOrder(challenge, seed));
  const [marks, setMarks] = useState<boolean[] | null>(null);
  const [spoken, setSpoken] = useState('');
  const [note, setNote] = useState<string[]>([]);
  const items = useMemo(() => new Map(challenge.items.map((i) => [i.id, i])), [challenge]);
  const label = (id: string) => items.get(id)?.label ?? id;

  const change = (next: string[]) => {
    setOrder(next);
    setMarks(null);
    setNote([]);
  };

  const move = (index: number, delta: -1 | 1) => {
    const to = index + delta;
    if (to < 0 || to >= order.length) return;
    const id = order[index] as string;
    change(moveItem(order, index, to));
    setSpoken(`${plainText(label(id))} moved to position ${to + 1} of ${order.length}.`);
  };

  const check = () => {
    const v = gradeOrder(challenge, order);
    if (v.correct) {
      store.getState().answerOrder(order);
      return;
    }
    setMarks(v.positions);
    const right = v.positions.filter(Boolean).length;
    setNote([
      right === 0
        ? 'None of these is in the right place yet. Think about what has to happen first.'
        : `${right} of ${order.length} sit in the right place. The marked ones do not.`,
    ]);
    store.getState().answerOrder(order);
  };

  if (!open) {
    return (
      <ol className={styles.order} aria-label="The right order">
        {challenge.items.map((item, i) => (
          <li key={item.id} className={styles.row} data-verdict="right">
            <span className={styles.num}>{i + 1}</span>
            <span />
            <span className={styles.rowLabel}>
              <MarkupText text={item.label} />
            </span>
            <span />
          </li>
        ))}
      </ol>
    );
  }

  return (
    <div>
      <p className={styles.legend}>Drag the rows, or use the arrows on each one.</p>
      <Reorder.Group
        as="ol"
        axis="y"
        values={order}
        onReorder={change}
        className={styles.order}
        aria-label="Your order"
      >
        {order.map((id, i) => {
          const mark = marks ? (marks[i] ? 'right' : 'wrong') : undefined;
          return (
            <Reorder.Item
              key={id}
              value={id}
              as="li"
              className={styles.row}
              data-draggable="true"
              data-verdict={mark}
              layout="position"
              transition={reduced ? { duration: 0 } : undefined}
              whileDrag={reduced ? undefined : { scale: 1.015, zIndex: 2 }}
            >
              <span className={styles.grip} aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </span>
              <span className={styles.num} aria-hidden="true">
                {i + 1}
              </span>
              <span className={styles.rowLabel}>
                <span className="sr-only">Position {i + 1}. </span>
                <MarkupText text={label(id)} />
                {mark ? (
                  <span className="sr-only">
                    {mark === 'right' ? '. In the right place' : '. Not in the right place'}
                  </span>
                ) : null}
              </span>
              <span className={styles.moves}>
                <IconButton
                  icon="chevron-up"
                  size="sm"
                  variant="ghost"
                  label={`Move ${plainText(label(id))} earlier`}
                  tooltip={false}
                  aria-disabled={i === 0 ? true : undefined}
                  onClick={() => move(i, -1)}
                />
                <IconButton
                  icon="chevron-down"
                  size="sm"
                  variant="ghost"
                  label={`Move ${plainText(label(id))} later`}
                  tooltip={false}
                  aria-disabled={i === order.length - 1 ? true : undefined}
                  onClick={() => move(i, 1)}
                />
              </span>
            </Reorder.Item>
          );
        })}
      </Reorder.Group>

      <div className="sr-only" role="status" aria-live="polite">
        {spoken}
      </div>
      <Feedback lines={note} />

      <div className={styles.checkRow} style={{ marginBlockStart: 'var(--space-4)' }}>
        <Button variant="primary" size="sm" onClick={check}>
          Check order
        </Button>
      </div>
    </div>
  );
}
