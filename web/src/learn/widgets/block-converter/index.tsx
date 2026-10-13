/**
 * Widget `block-converter` (docs/CONTENT.md section 5): months, days, hours and blocks, side by side and
 * linked, with the constants they rest on, the duration discount bands and an expiry height calculator.
 *
 * Props (`stage.props`):
 *   case    { kind: 'months-to-blocks' | 'blocks-to-days' | 'expiry-height', value, startHeight? }
 *             months-to-blocks   `value` months, answer in blocks
 *             blocks-to-days     `value` blocks, answer in days
 *             expiry-height      a subscription of `value` blocks registered at `startHeight`, answer is the
 *                                block height where it ends
 *   target  without a case: the number of blocks the converter must show
 *
 * With a case the learner reads the question, can use the converter to work it out, and types the answer; it
 * is done when the answer is right. Without one, it is done when the target is reached (or on the first
 * change, when there is no target either). It reports `widget-done` only after the learner acted. "Show me"
 * types the answer. All constants come from `@shared/flux` (30 s blocks, 88,000 blocks to a pricing month,
 * 1,056,000 at most, the duration discounts).
 */

import { estimateTimeAtHeight, TARGET_BLOCK_SEC } from '@shared/flux';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useChainClock } from '@/data';
import type { StageHost, WidgetComponent } from '@/learn/stage-api';
import { formatDateLong, formatInt } from '@/lib/format';
import { Button, Chip, FreshnessChip, Panel, TextField } from '@/ui';
import styles from './BlockConverter.module.css';
import {
  answerText,
  barPosition,
  type ConverterCase,
  type ConverterConfig,
  constants,
  discountBands,
  discountFor,
  expiryFor,
  FIELDS,
  type Field,
  formatField,
  fromBlocks,
  type Grade,
  gradeAnswer,
  grouped,
  LONGEST_BLOCKS,
  parseNumber,
  questionFor,
  readConfig,
  SAMPLE_START_HEIGHT,
  toBlocks,
} from './logic';

const FIELD_LABEL: Record<Field, string> = {
  months: 'Months',
  days: 'Days',
  hours: 'Hours',
  blocks: 'Blocks',
};

const FIELD_HINT: Record<Field, string> = {
  months: 'subscription months',
  days: 'of 24 hours',
  hours: '',
  blocks: '',
};

const MAX_BLOCKS_FIELD = 99_999_999;

/** "1 month", "0.03 months", "6 months": a decimal count, so not the integer `plural`. */
const monthsPhrase = (n: number): string => `${formatField('months', n)} ${n === 1 ? 'month' : 'months'}`;

/** What the converter shows to begin with: one unit, so the constant is visible and the task is not. */
function startBlocks(c: ConverterConfig): number {
  if (c.case?.kind === 'blocks-to-days') return toBlocks('days', 1);
  return toBlocks('months', 1);
}

interface ConverterProps {
  config: ConverterConfig;
  host: StageHost;
}

function Converter({ config, host }: ConverterProps) {
  const task: ConverterCase | null = config.case;
  const question = task ? questionFor(task) : null;
  const uid = useId();
  const clock = useChainClock();
  const tip = clock.height;

  const [blocks, setBlocks] = useState(() => startBlocks(config));
  const [edit, setEdit] = useState<{ field: Field; text: string } | null>(null);
  const [answer, setAnswer] = useState('');
  const [grade, setGrade] = useState<Grade | null>(null);
  const [touched, setTouched] = useState(false);
  const [startText, setStartText] = useState(() =>
    task?.kind === 'expiry-height' ? formatInt(task.startHeight ?? SAMPLE_START_HEIGHT) : '',
  );

  // ---- the linked fields -------------------------------------------------------------------------
  const displayed = (field: Field): string => {
    if (edit?.field === field) return edit.text;
    return formatField(field, fromBlocks(field, blocks));
  };

  const onField = (field: Field, text: string) => {
    setEdit({ field, text });
    setTouched(true);
    const n = parseNumber(text);
    if (n === null) return;
    setBlocks(Math.min(MAX_BLOCKS_FIELD, toBlocks(field, n)));
  };

  // ---- the answer --------------------------------------------------------------------------------
  const done = task ? grade?.ok === true : config.target !== null ? blocks === config.target : touched;

  const reported = useRef(false);
  useEffect(() => {
    if (!touched || !done) {
      if (!done) reported.current = false;
      return;
    }
    if (reported.current) return;
    reported.current = true;
    host.emit({ type: 'widget-done' });
  }, [touched, done, host]);

  const check = (text: string) => {
    if (!task) return;
    setTouched(true);
    setGrade(gradeAnswer(task, text));
  };

  useEffect(() => {
    host.registerSolver(() => {
      setTouched(true);
      if (task) {
        const text = answerText(task);
        setAnswer(text);
        setGrade(gradeAnswer(task, text));
        // Put the work on the board too, so the learner sees where the number comes from.
        if (task.kind === 'months-to-blocks') setBlocks(toBlocks('months', task.value));
        if (task.kind === 'blocks-to-days') setBlocks(Math.round(task.value));
        if (task.kind === 'expiry-height') setBlocks(Math.round(task.value));
        setEdit(null);
      } else if (config.target !== null) {
        setBlocks(Math.round(config.target));
        setEdit(null);
      }
    });
    return () => host.registerSolver(null);
  }, [host, task, config.target]);

  // ---- the expiry calculator -------------------------------------------------------------------
  // An empty field means "registered now": the current block, when it is known.
  const typed = parseNumber(startText);
  const start = typed !== null ? Math.round(typed) : tip;
  const expiry = start === null ? null : expiryFor(start, blocks, tip);
  const when = useMemo(() => {
    if (!expiry || expiry.past || tip === null) return null;
    if (!clock.live || clock.lastBlockAt === null) return null;
    return formatDateLong(estimateTimeAtHeight(expiry.height, tip, clock.lastBlockAt));
  }, [expiry, tip, clock.live, clock.lastBlockAt]);

  const discount = discountFor(blocks);
  const months = fromBlocks('months', blocks);
  const bands = useMemo(() => discountBands(), []);
  const consts = useMemo(() => constants(), []);
  const maxMonths = bands[bands.length - 1]?.toMonths ?? 12;
  const overMax = months > maxMonths + 1e-9;
  const pos = barPosition(blocks);

  const goalReached = config.target !== null && blocks === config.target;

  let expiryLine: string;
  if (!expiry || start === null) {
    expiryLine = 'Enter the height it was registered at, or last updated at, to see where it ends.';
  } else if (expiry.past) {
    expiryLine = 'That height is already behind the chain, so such a subscription would have ended.';
  } else if (expiry.inWords) {
    expiryLine = `About ${expiry.inWords} from now${when ? `, around ${when}` : ''}, at a block every ${TARGET_BLOCK_SEC} seconds.`;
  } else {
    expiryLine = `It ends ${grouped(blocks)} blocks after block ${formatInt(start)}.`;
  }

  return (
    <Panel variant="glass" padding="md" container className={styles.root} contentClassName={styles.content}>
      <div className={styles.head}>
        <p className={styles.eyebrow}>Block converter</p>
        <Chip size="sm">A block is about {TARGET_BLOCK_SEC} s</Chip>
      </div>

      {task && question ? (
        <section
          className={styles.task}
          aria-labelledby={`${uid}-task`}
          data-ok={grade?.ok ? 'true' : undefined}
        >
          <p id={`${uid}-task`} className={styles.question}>
            {question.prompt}
          </p>
          <form
            className={styles.answerRow}
            onSubmit={(e) => {
              e.preventDefault();
              check(answer);
            }}
          >
            <TextField
              label="Your answer"
              mono
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              value={answer}
              onValueChange={(v) => {
                setAnswer(v);
                if (grade) setGrade(null);
              }}
              suffix={<span className={styles.unit}>{question.unit}</span>}
            />
            <Button type="submit" variant="primary" size="md">
              Check
            </Button>
          </form>
          <p className={styles.tool}>{question.tool}</p>
          <p
            className={styles.feedback}
            role="status"
            aria-live="polite"
            data-tone={grade ? (grade.ok ? 'ok' : 'no') : undefined}
          >
            {grade
              ? grade.ok
                ? task?.kind === 'expiry-height'
                  ? 'Correct. That is the block height where the subscription ends.'
                  : task?.kind === 'blocks-to-days'
                    ? 'Correct. That is how many days the blocks last.'
                    : 'Correct. That is the number to use in a spec.'
                : grade.hint
              : ''}
          </p>
        </section>
      ) : config.target !== null ? (
        <section className={styles.task} data-ok={goalReached ? 'true' : undefined}>
          <p className={styles.question}>Set the converter to {grouped(config.target)} blocks.</p>
          <p
            className={styles.feedback}
            role="status"
            aria-live="polite"
            data-tone={goalReached ? 'ok' : undefined}
          >
            {goalReached
              ? `Reached. That is ${formatField('months', fromBlocks('months', config.target))} subscription months.`
              : ''}
          </p>
        </section>
      ) : null}

      <section className={styles.fields} aria-label="Converter">
        {FIELDS.map((f) => (
          <TextField
            key={f}
            label={FIELD_LABEL[f]}
            mono
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            value={displayed(f)}
            onValueChange={(v) => onField(f, v)}
            onBlur={() => setEdit((e) => (e?.field === f ? null : e))}
            hint={FIELD_HINT[f] || undefined}
          />
        ))}
      </section>

      <section className={styles.bar} aria-label="Duration discount">
        <div className={styles.markRow} aria-hidden="true">
          <span
            className={styles.marker}
            data-edge={pos > 0.78 ? 'end' : pos < 0.12 ? 'start' : undefined}
            style={{ insetInlineStart: `${pos * 100}%` }}
          >
            <span className={styles.markerText}>{formatField('months', months)}</span>
          </span>
        </div>
        <div className={styles.track} role="img" aria-label={`${monthsPhrase(months)} of ${maxMonths}`}>
          {bands.map((b) => (
            <span
              key={b.label}
              className={styles.band}
              data-on={
                months >= b.fromMonths && (months < b.toMonths || b.toMonths === maxMonths)
                  ? 'true'
                  : undefined
              }
              style={{ flexGrow: b.toMonths - b.fromMonths }}
            >
              <span className={styles.bandName}>{b.label === 'none' ? 'no discount' : `${b.label} off`}</span>
            </span>
          ))}
        </div>
        <div className={styles.ticks} aria-hidden="true">
          {bands.map((b) => (
            <span key={b.label} style={{ flexGrow: b.toMonths - b.fromMonths }}>
              {b.fromMonths}
            </span>
          ))}
          <span className={styles.tickEnd}>{maxMonths} months</span>
        </div>
        <p className={styles.barText}>
          {overMax
            ? `Longer than the longest subscription of ${grouped(LONGEST_BLOCKS)} blocks (${maxMonths} months). The validator rejects a spec that long.`
            : discount
              ? `${monthsPhrase(months)} earns ${discount} off, before the total is rounded up to .49 or .99. Compare totals, not percentages.`
              : `${monthsPhrase(months)} is under the first band, so there is no duration discount.`}
        </p>
      </section>

      <section className={styles.expiry} aria-labelledby={`${uid}-expiry`}>
        <div className={styles.expiryHead}>
          <h3 id={`${uid}-expiry`} className={styles.h}>
            Expiry height
          </h3>
          <FreshnessChip kind={clock.live ? 'live' : 'offline'} />
        </div>
        <div className={styles.expiryRow}>
          <TextField
            label="Registered or updated at block"
            mono
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            value={startText}
            placeholder={tip === null ? '' : formatInt(tip, '')}
            onValueChange={(v) => {
              setStartText(v);
              setTouched(true);
            }}
            hint={tip === null ? undefined : `Empty means now, block ${formatInt(tip)}.`}
          />
          <span className={styles.plus} aria-hidden="true">
            +
          </span>
          <div className={styles.length}>
            <span className={styles.lengthKey}>Length</span>
            <span className={styles.lengthVal}>{formatInt(blocks)} blocks</span>
          </div>
          <span className={styles.plus} aria-hidden="true">
            =
          </span>
          <div className={styles.result} data-empty={expiry ? undefined : 'true'}>
            <span className={styles.lengthKey}>Ends at block</span>
            <span className={styles.resultVal}>{expiry ? formatInt(expiry.height) : '--'}</span>
          </div>
        </div>
        <p className={styles.barText}>
          {expiryLine} There is no grace after that block: the app and its data are removed.
        </p>
      </section>

      <details className={styles.consts}>
        <summary>The constants</summary>
        <dl className={styles.constList}>
          {consts.map((c) => (
            <div key={c.label} className={styles.constRow}>
              <dt>{c.label}</dt>
              <dd>{c.value}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.note}>
          A subscription month is the unit prices are quoted in. It is a little longer than 30 calendar days.
        </p>
      </details>
    </Panel>
  );
}

const BlockConverter: WidgetComponent = ({ stage, host, stepKey }) => {
  const config = useMemo(() => readConfig(stage.props), [stage.props]);
  const signature = useMemo(() => JSON.stringify(config), [config]);
  return <Converter key={`${stepKey}:${signature}`} config={config} host={host} />;
};

export default BlockConverter;
