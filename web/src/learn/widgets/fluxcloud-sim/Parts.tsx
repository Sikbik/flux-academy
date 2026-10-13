/** Small shared pieces of the simulator's screens. */
import type { LintIssue, Quote } from '@shared/flux';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { FreshnessChip, Glyph } from '@/ui';
import { useSimEnv } from './context';
import styles from './FluxcloudSim.module.css';
import { fluxAmount, grouped, usd } from './format';
import { discountPercent, PERIODS } from './model';

/**
 * The heading of a screen. A screen that appears after the user did something takes focus here (when focus
 * was lost or was already inside the simulator), so the next Tab starts at the new screen instead of at the
 * top of the page. Nothing takes focus while the simulator is mounting.
 */
export function PageTitle({ children, screenKey }: { children: ReactNode; screenKey?: string }) {
  const { gate } = useSimEnv();
  const ref = useRef<HTMLHeadingElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: refocus when the screen key changes
  useEffect(() => {
    const el = ref.current;
    if (!el || !gate.armed) return;
    const active = document.activeElement;
    const lost = !active || active === document.body;
    const inside = active ? (gate.root?.contains(active) ?? false) : false;
    if (lost || inside) el.focus();
  }, [gate, screenKey]);
  return (
    <h3 ref={ref} tabIndex={-1} className={styles.pageTitle}>
      {children}
    </h3>
  );
}

/** A titled card of a form page. */
export function Card({
  title,
  hint,
  children,
  span,
}: {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
  span?: 'full';
}) {
  const id = useId();
  return (
    <section className={styles.card} aria-labelledby={id} data-span={span}>
      <h4 id={id} className={styles.cardTitle}>
        {title}
      </h4>
      {hint ? <p className={styles.cardHint}>{hint}</p> : null}
      {children}
    </section>
  );
}

/** Lint issues in plain language: what is wrong, and what to do. */
export function IssueList({ issues, label }: { issues: readonly LintIssue[]; label?: string }) {
  if (issues.length === 0) return null;
  return (
    <ul className={styles.issues} aria-label={label}>
      {issues.map((i) => (
        <li key={`${i.code}|${i.path}|${i.message}`} className={styles.issue} data-severity={i.severity}>
          <Glyph
            name={i.severity === 'error' ? 'cross' : i.severity === 'warning' ? 'warning' : 'info'}
            size={16}
            title={i.severity === 'error' ? 'Error' : i.severity === 'warning' ? 'Warning' : 'Note'}
          />
          <span>
            <span className={styles.issueMsg}>{i.message}</span>{' '}
            <span className={styles.issueFix}>{i.fix}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The price lines of a quote, stage by stage, with the engine's own one-sentence notes. */
export function Waterfall({ quote }: { quote: Quote }) {
  const rows = quote.lines;
  return (
    <div className={styles.waterfall}>
      <table>
        <caption className="sr-only">How the price is built, line by line</caption>
        <thead>
          <tr>
            <th scope="col">Step</th>
            <th scope="col" className={styles.num}>
              USD
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={`${l.id}|${l.component ?? ''}|${l.label}`}>
              <th scope="row">
                <span>{l.label}</span>
                {l.note ? <span className={styles.lineNote}>{l.note}</span> : null}
              </th>
              <td className={styles.num} data-negative={l.usd < 0 ? 'true' : 'false'}>
                {l.usd < 0 ? `-${usd(-l.usd)}` : usd(l.usd)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total for this subscription</th>
            <td className={styles.num}>{usd(quote.usdTotal ?? 0)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** The price of a spec: USD by card, FLUX with the 5 percent chip, and a disclosure for the lines. */
export function PriceFigure({
  quote,
  paramsSource,
  periodLabel,
  fluxMultiplier,
  startOpen = false,
  showCard = true,
}: {
  quote: Quote;
  paramsSource: 'live' | 'cache' | 'baked';
  periodLabel?: string;
  fluxMultiplier: number;
  startOpen?: boolean;
  /** Show the card price figure too. Off where the page already shows it in the Estimated cost block. */
  showCard?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const panelId = useId();
  const discount = Math.round((1 - fluxMultiplier) * 100);
  return (
    <div className={styles.price}>
      <dl className={styles.priceRow}>
        {showCard ? (
          <div>
            <dt>By card</dt>
            <dd>
              <span className={styles.big}>{usd(quote.usdTotal ?? 0)}</span>
              <span className={styles.unit}>USD + VAT{periodLabel ? `, ${periodLabel}` : ''}</span>
            </dd>
          </div>
        ) : null}
        <div>
          <dt>
            In FLUX {discount > 0 ? <span className={styles.discount}>{discount}% FLUX discount</span> : null}
          </dt>
          <dd>
            <span className={styles.big}>{fluxAmount(quote.fluxTotal)}</span>
            <span className={styles.unit}>FLUX</span>
          </dd>
        </div>
      </dl>
      <p className={styles.priceNote}>
        <FreshnessChip kind={paramsSource === 'baked' ? 'baked' : 'computed'} />
        <span>
          {quote.expireBlocks ? `${grouped(quote.expireBlocks)} blocks. ` : ''}
          {quote.fluxUsd === null
            ? 'No FLUX rate is known right now, so the FLUX figure is missing.'
            : `Converted at $${quote.fluxUsd.toFixed(4)} per FLUX.`}
        </span>
      </p>
      <button
        type="button"
        className={styles.disclose}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <Glyph name={open ? 'chevron-up' : 'chevron-down'} size={14} />
        {open ? 'Hide the price lines' : 'Show the price lines'}
      </button>
      <div id={panelId} hidden={!open}>
        {open ? <Waterfall quote={quote} /> : null}
      </div>
    </div>
  );
}

/** A spinner or a status mark for a review row. */
export function RowMark({ status }: { status: 'todo' | 'running' | 'done' | 'failed' }) {
  return (
    <span className={styles.rowMark} data-status={status} aria-hidden="true">
      {status === 'done' ? (
        <Glyph name="check" size={14} />
      ) : status === 'failed' ? (
        <Glyph name="cross" size={14} />
      ) : status === 'running' ? (
        <span className={styles.spinner} />
      ) : null}
    </span>
  );
}

/**
 * The six subscription periods of FACTS 9.4.2 as native radios: one tab stop, arrow keys, and a layout
 * that does not depend on measuring (a measured control re-flowed under the pointer while a field blurred).
 */
export function PeriodPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const name = useId();
  return (
    <fieldset className={styles.periods}>
      <legend className="sr-only">Subscription period</legend>
      {PERIODS.map((p) => {
        const d = discountPercent(p.blocks);
        const checked = p.id === value;
        return (
          <label key={p.id} className={styles.period} data-checked={checked ? 'true' : 'false'}>
            <input
              type="radio"
              name={name}
              value={p.id}
              checked={checked}
              onChange={() => onChange(p.id)}
              className={styles.periodInput}
            />
            <span className={styles.periodBody}>
              <span className={styles.periodLabel}>{p.label}</span>
              {d ? <span className={styles.periodOff}>-{d}%</span> : null}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
