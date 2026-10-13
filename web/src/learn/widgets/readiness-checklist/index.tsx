/**
 * Widget `readiness-checklist` (docs/CONTENT.md section 5): the pre-deploy checklist. Seven things a first
 * deployer needs before registering on FluxCloud, each with the real link, a "what this is and why you
 * need it" disclosure and three honest answers (not yet, I have this, I will do this later), a hex
 * readiness meter, and a closing summary: "You are ready" or "Here is what is left".
 *
 * Props (`stage.props`):
 *   items   string[]  item ids to show (login, registry, image, payment, funds, window, domain). Omit for all.
 *
 * Emits `widget-done` when every item has an answer, "I will do this later" included. Registers a solver
 * for "Show me" that answers what is still open with "I will do this later": it never claims the learner
 * has something they do not. The answers are kept in `localStorage` (every access guarded), so the
 * checklist is still filled in when the learner comes back; "Start over" clears it.
 *
 * Nothing here contacts any service. The one number shown (the smallest app) is computed by the shared
 * pricing engine at the current rates and labelled with its basis.
 */
import { BAKED_PRICING, defaultSpec, quote } from '@shared/flux';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useInRouterContext } from 'react-router';
import { usePricing } from '@/data';
import type { WidgetComponent } from '@/learn/stage-api';
import { readJson, writeJson } from '@/lib/storage';
import { Button, Chip, FreshnessChip, Glyph, HexRing, LinkButton, Panel } from '@/ui';
import { type ChecklistItem, selectItems } from './items';
import styles from './ReadinessChecklist.module.css';
import {
  announcement,
  deferUnanswered,
  type ItemState,
  parseStored,
  STORAGE_KEY,
  type States,
  setAnswer,
  stateOf,
  summarise,
  toStored,
} from './state';

function readIds(raw: Record<string, unknown> | undefined): string[] | undefined {
  const v = raw?.items;
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined;
}

const STATE_WORD: Record<ItemState, string> = {
  todo: 'Not yet',
  done: 'I have this',
  later: 'Later',
};

const usd = (n: number): string => `$${n.toFixed(2)}`;

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function LessonLink({ lessonId, label }: { lessonId: string; label: string }) {
  const inRouter = useInRouterContext();
  const to = `/learn/${lessonId}`;
  const content = (
    <>
      <Glyph name="book" size={14} />
      <span>{label}</span>
    </>
  );
  return inRouter ? (
    <Link to={to} className={styles.lessonLink}>
      {content}
    </Link>
  ) : (
    <a href={to} className={styles.lessonLink}>
      {content}
    </a>
  );
}

/** The one computed figure: what the smallest app costs, from the engine, with its basis. */
function SmallestApp() {
  const pricing = usePricing();
  const params = pricing.data?.params ?? BAKED_PRICING.params;
  const fluxUsd = pricing.data?.fluxUsd ?? null;
  const basis = pricing.data ? pricing.data.paramsSource : 'baked';
  const spec = useMemo(() => defaultSpec(), []);
  const q = useMemo(() => quote(spec, params, { fluxUsd }), [spec, params, fluxUsd]);
  const c = spec.compose[0];
  // The sentence below describes the spec that is priced, so a change to `defaultSpec()` cannot drift from it.
  const described = c
    ? `${spec.instances} instances of a ${c.cpu} core, ${c.ram} MB, ${c.hdd} GB container`
    : 'The default app';
  return (
    <div className={styles.figure}>
      <dl className={styles.figureRow}>
        <div>
          <dt>Smallest app, one month</dt>
          <dd>
            <span className={styles.big}>{usd(q.usdPerMonth)}</span>
            <span className={styles.unit}>by card</span>
          </dd>
        </div>
        <div>
          <dt>The same in FLUX</dt>
          <dd>
            <span className={styles.big}>{q.fluxPerMonth === null ? '--' : q.fluxPerMonth.toFixed(2)}</span>
            <span className={styles.unit}>FLUX</span>
          </dd>
        </div>
      </dl>
      <p className={styles.figureNote}>
        <FreshnessChip kind={basis === 'baked' ? 'baked' : 'computed'} />
        <span>
          {`${described}, priced by the same rules the network uses. A bigger app costs more, and the minimum is ${usd(params.minUSDPrice)}.`}
        </span>
      </p>
    </div>
  );
}

interface ItemRowProps {
  item: ChecklistItem;
  index: number;
  state: ItemState;
  open: boolean;
  onAnswer: (answer: 'done' | 'later') => void;
  onToggle: () => void;
}

function ItemRow({ item, index, state, open, onAnswer, onToggle }: ItemRowProps) {
  const uid = useId();
  const titleId = `${uid}-t`;
  const panelId = `${uid}-p`;
  return (
    <li className={styles.item} data-state={state} data-required={item.required ? 'true' : 'false'}>
      <span className={styles.marker} aria-hidden="true">
        {state === 'done' ? (
          <Glyph name="check" size={16} />
        ) : state === 'later' ? (
          <Glyph name="clock" size={16} />
        ) : (
          <span className={styles.num}>{index + 1}</span>
        )}
      </span>

      <div className={styles.titles}>
        <h4 id={titleId} className={styles.title}>
          {item.title}
          {!item.required ? <span className={styles.tag}>Optional</span> : null}
          <span className="sr-only">. Status: {STATE_WORD[state]}.</span>
        </h4>
        <p className={styles.summary}>{item.summary}</p>
      </div>

      <fieldset className={styles.answers}>
        <legend className="sr-only">Your answer for {item.title}</legend>
        <Chip
          kind="filter"
          size="md"
          icon={state === 'done' ? 'check' : undefined}
          selected={state === 'done'}
          onClick={() => onAnswer('done')}
        >
          I have this
        </Chip>
        <Chip
          kind="filter"
          size="md"
          icon={state === 'later' ? 'clock' : undefined}
          selected={state === 'later'}
          onClick={() => onAnswer('later')}
        >
          I will do this later
        </Chip>
      </fieldset>

      <div className={styles.extras}>
        <button
          type="button"
          className={styles.disclose}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <Glyph name="chevron-down" size={14} className={styles.chev} />
          <span>What this is and why you need it</span>
        </button>
        <span className={styles.links}>
          {item.link ? (
            <LinkButton href={item.link.href} variant="ghost" size="sm" iconEnd="external">
              {item.link.label}
            </LinkButton>
          ) : null}
          {item.lesson ? <LessonLink lessonId={item.lesson.lessonId} label={item.lesson.label} /> : null}
        </span>
      </div>

      <div id={panelId} className={styles.panel} data-open={open ? 'true' : 'false'}>
        <div className={styles.panelInner} inert={!open || undefined}>
          <h5 className={styles.sub}>What it is</h5>
          {item.what.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <h5 className={styles.sub}>Why you need it</h5>
          {item.why.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {item.id === 'funds' ? <SmallestApp /> : null}
        </div>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// The widget
// ---------------------------------------------------------------------------

const ReadinessChecklist: WidgetComponent = ({ stage, host }) => {
  const ids = readIds(stage.props);
  const idsKey = ids ? ids.join('|') : '';
  // biome-ignore lint/correctness/useExhaustiveDependencies: `idsKey` is the identity of `ids`
  const items = useMemo(() => selectItems(ids), [idsKey]);

  // Stored answers. Reading is guarded inside `readJson`; a failure just gives an empty checklist.
  const [states, setStates] = useState<States>(() => parseStored(readJson(STORAGE_KEY)));
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(true);
  const firstWrite = useRef(true);

  useEffect(() => {
    if (firstWrite.current) {
      firstWrite.current = false;
      return;
    }
    setSaved(writeJson(STORAGE_KEY, toStored(states)));
  }, [states]);

  const summary = useMemo(() => summarise(items, states), [items, states]);

  // Report done on the transition to complete (and once on mount if the learner already finished).
  const reported = useRef(false);
  useEffect(() => {
    if (!summary.complete) {
      reported.current = false;
      return;
    }
    if (reported.current) return;
    reported.current = true;
    host.emit({ type: 'widget-done' });
  }, [summary.complete, host]);

  // "Show me": answer what is open with "I will do this later".
  useEffect(() => {
    host.registerSolver(() => setStates((prev) => deferUnanswered(items, prev)));
    return () => host.registerSolver(null);
  }, [host, items]);

  const answer = (id: string, a: 'done' | 'later') => setStates((prev) => setAnswer(prev, id, a));
  const startOver = () => {
    setStates({});
    setOpen({});
  };

  const meterLabel = `Readiness: ${summary.requiredDone} of ${summary.requiredTotal} required items done`;
  const headline = summary.complete
    ? summary.ready
      ? 'You are ready'
      : 'Here is what is left'
    : summary.requiredDone === 0 && summary.todo === summary.total
      ? 'Where do you stand?'
      : 'Getting ready';

  return (
    <Panel variant="glass" padding="md" container contentClassName={styles.root}>
      <div className={styles.head}>
        <p className={styles.eyebrow}>Before you register</p>
        <Chip size="sm" tone="accent" icon="check">
          Kept in this browser
        </Chip>
      </div>

      <section className={styles.meter} aria-label="Readiness">
        <HexRing value={summary.readiness} size={104} stroke={5} label={meterLabel}>
          <span className={styles.ringNum}>
            {summary.requiredDone}
            <span className={styles.ringOf}>/{summary.requiredTotal}</span>
          </span>
        </HexRing>
        <div className={styles.meterText}>
          <h3 className={styles.headline}>{headline}</h3>
          <p>
            {summary.requiredDone} of {summary.requiredTotal} required{' '}
            {summary.requiredTotal === 1 ? 'item' : 'items'} done
            {summary.later > 0 ? `, ${summary.later} marked for later` : ''}
            {summary.todo > 0 ? `, ${summary.todo} not answered yet` : ''}.
          </p>
        </div>
      </section>

      <ol className={styles.list} aria-label="Checklist">
        {items.map((item, i) => (
          <ItemRow
            key={item.id}
            item={item}
            index={i}
            state={stateOf(states, item.id)}
            open={open[item.id] === true}
            onAnswer={(a) => answer(item.id, a)}
            onToggle={() => setOpen((o) => ({ ...o, [item.id]: !o[item.id] }))}
          />
        ))}
      </ol>

      {/* One polite sentence per change, for screen readers. */}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement(summary)}
      </p>

      {summary.complete ? (
        <section
          className={styles.verdict}
          data-ready={summary.ready ? 'true' : 'false'}
          aria-labelledby="readiness-verdict"
        >
          <span className={styles.verdictMark} aria-hidden="true">
            <Glyph name={summary.ready ? 'check' : 'flag'} size={20} />
          </span>
          <div className={styles.verdictBody}>
            <h3 id="readiness-verdict" className={styles.verdictTitle}>
              {summary.ready ? 'You are ready' : 'Here is what is left'}
            </h3>
            {summary.ready ? (
              <p>
                Every required item is done. Open FluxCloud and register: the simulator in a later step walks
                the same screens first, if you want a rehearsal.
              </p>
            ) : (
              <>
                <p>
                  Marking something for later is a fine answer. These are still to do before a first
                  registration:
                </p>
                <ul className={styles.left}>
                  {summary.left.map((item) => (
                    <li key={item.id}>
                      <span>{item.title}</span>
                      {item.link ? (
                        <a href={item.link.href} target="_blank" rel="noopener noreferrer">
                          {item.link.label}
                          <span className="sr-only"> (Opens in a new tab)</span>
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>
      ) : null}

      <div className={styles.foot}>
        <Button variant="ghost" size="sm" icon="reset" onClick={startOver}>
          Start over
        </Button>
        {!saved ? (
          <span className={styles.footNote}>
            This browser would not keep your answers, so they last until you leave the page.
          </span>
        ) : null}
      </div>
    </Panel>
  );
};

export default ReadinessChecklist;
