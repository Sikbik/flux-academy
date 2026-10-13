/**
 * Estimate a number. The truth is worked out by the shared pricing engine on the baked rate card (or comes
 * from the challenge), the card the lessons quote, so an answer the lesson teaches stays right when the live
 * rates move. It is never shown until the challenge is over, and then with the date of the rates. A wrong
 * answer says which way it missed and how close counts, not the number.
 */

import { useMemo, useState } from 'react';
import { estimateTruth, gradeEstimate, parseNumberInput } from '@/learn/grade';
import { plainText } from '@/learn/markup';
import type { EstimateChallenge } from '@/learn/types';
import { Button } from '@/ui';
import { usePlayerCtx } from '../PlayerContext';
import styles from './challenges.module.css';
import { Feedback } from './Feedback';
import { estimateFeedback } from './logic';

interface Props {
  challenge: EstimateChallenge;
  open: boolean;
  attempts: number;
}

function unitOf(c: EstimateChallenge): { prefix: string; unit: string } {
  switch (c.quantity) {
    case 'usd-per-month':
      return { prefix: '$', unit: 'USD a month' };
    case 'flux-per-month':
      return { prefix: '', unit: 'FLUX a month' };
    case 'blocks':
      return { prefix: '', unit: c.unit ?? 'blocks' };
    case 'number':
      return { prefix: '', unit: c.unit ?? '' };
  }
}

export function formatTruth(c: EstimateChallenge, truth: number): string {
  switch (c.quantity) {
    case 'usd-per-month':
      return `$${truth.toFixed(2)} a month`;
    case 'flux-per-month':
      return `${truth.toFixed(2)} FLUX a month`;
    case 'blocks':
      return `${Math.round(truth).toLocaleString('en-US')} ${c.unit ?? 'blocks'}`;
    case 'number':
      return `${Number.isInteger(truth) ? truth.toLocaleString('en-US') : truth} ${c.unit ?? ''}`.trim();
  }
}

/** True when the figure is a price, which depends on the rate card it was worked out on. */
export function isPriced(c: EstimateChallenge): boolean {
  return c.quantity === 'usd-per-month' || c.quantity === 'flux-per-month';
}

/** What goes after a revealed figure: a price says which rates it was worked out at. */
export function revealTail(c: EstimateChallenge, capturedAt: string | null): string {
  if (!isPriced(c)) return '.';
  const rates = capturedAt ? `, at the rates read on ${capturedAt}` : '';
  return `, computed with the same pricing code the server uses${rates}.`;
}

export function Estimate({ challenge, open }: Props) {
  const { store, engine } = usePlayerCtx();
  const [raw, setRaw] = useState('');
  const [note, setNote] = useState<string[]>([]);
  const { prefix, unit } = unitOf(challenge);

  // The baked card, as the player grades it (`answerEstimate`): the live parameters are not passed on
  // purpose, so what this form says is right and what the store accepts cannot disagree.
  const truth = useMemo(() => (engine ? estimateTruth(challenge, engine) : null), [engine, challenge]);
  const capturedAt = engine ? engine.baked.capturedAt : null;

  const submit = () => {
    if (!open) return;
    const value = parseNumberInput(raw);
    if (value === null) {
      setNote(['Type a number, for example 2.50.']);
      return;
    }
    if (truth === null) return;
    const verdict = gradeEstimate(challenge, value, truth);
    if (!verdict.correct) {
      setNote([estimateFeedback(verdict, value, challenge.tolerance)]);
    } else {
      setNote([]);
    }
    store.getState().answerEstimate(value);
  };

  const ready = engine !== null || challenge.spec === undefined;

  return (
    <form
      className={styles.estimate}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className={styles.fieldLabel} htmlFor={`est-${challenge.id}`}>
        Your estimate{unit ? `, in ${unit}` : ''}
      </label>
      <div className={styles.field} data-verdict={!open ? 'right' : undefined}>
        <input
          id={`est-${challenge.id}`}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          placeholder={prefix ? `${prefix}0.00` : '0'}
          value={open ? raw : truth !== null ? String(Math.round(truth * 100) / 100) : ''}
          readOnly={!open}
          onChange={(e) => {
            setRaw(e.target.value);
            setNote([]);
          }}
          aria-describedby={`est-help-${challenge.id}`}
        />
        {unit ? <span className={styles.unit}>{unit}</span> : null}
      </div>
      <p id={`est-help-${challenge.id}`} className={styles.hintNote}>
        {open
          ? `Within ${Math.round(challenge.tolerance * 100)} percent counts as right.${
              isPriced(challenge) && capturedAt ? ` Priced at the rates read on ${capturedAt}.` : ''
            }${ready ? '' : ' Loading the pricing engine.'}`
          : truth !== null
            ? ''
            : plainText('The value could not be computed.')}
      </p>
      <Feedback lines={open ? note : []} />
      {!open && truth !== null ? (
        <p className={styles.truth}>
          The answer is <strong>{formatTruth(challenge, truth)}</strong>
          {revealTail(challenge, capturedAt)}
        </p>
      ) : null}
      {open ? (
        <div className={styles.checkRow}>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            aria-disabled={raw.trim() === '' || !ready || truth === null ? true : undefined}
          >
            Check estimate
          </Button>
        </div>
      ) : null}
    </form>
  );
}
