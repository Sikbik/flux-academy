import { BAKED_PRICING, BUNDLE_INSTANCES, LIMITS, monthsToBlocks } from '@shared/flux';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { anchor } from '@/content/reference';
import { feePortsText, money, num, perInstanceFee, usd } from '@/content/reference/derive';
import {
  CURVE_INSTANCES,
  EXAMPLE_INSTANCES,
  EXAMPLE_MONTHS,
  FREE_PORT_EXAMPLE,
  PRICE_EXAMPLES,
  VERIFIED_CURVE,
} from '@/content/reference/examples';
import { FORM_STEPS } from '@/content/reference/facts';
import { buildPriceSteps } from '@/content/reference/spec';
import {
  cliffExplanation,
  curveFor,
  forgeShareLink,
  type PriceSize,
  priceFor,
} from '@/content/reference/tools';
import { FreshnessChip, SegmentedControl, StatusDot } from '@/ui';
import { type Column, DataTable, Slab } from '../../parts/Facts';
import { CopyLink, Section } from '../../parts/Heading';
import { KeyFact, Md } from '../../parts/Prose';
import { ProvChips } from '../../parts/Prov';
import { Ul } from '../../parts/Semantics';
import styles from './spec.module.css';

const STEPS = buildPriceSteps();

interface RateRow {
  id: string;
  item: string;
  rate: string;
  note: string;
}

function rates(): RateRow[] {
  const p = BAKED_PRICING.params;
  return [
    {
      id: 'cpu',
      item: 'CPU',
      rate: `${usd(p.cpu)} per ${FORM_STEPS.cpu} core`,
      note: `For a bundle of ${BUNDLE_INSTANCES} instances.`,
    },
    {
      id: 'ram',
      item: 'RAM',
      rate: `${usd(p.ram)} per ${FORM_STEPS.ramMb} MB`,
      note: `For a bundle of ${BUNDLE_INSTANCES} instances.`,
    },
    {
      id: 'hdd',
      item: 'Disk',
      rate: `${usd(p.hdd)} per GB`,
      note: `For a bundle of ${BUNDLE_INSTANCES} instances.`,
    },
    {
      id: 'port',
      item: 'Each fee port',
      rate: usd(p.port),
      note: `${feePortsText()}. Added to the bundle: ${perInstanceFee(p.port)}. See Networking.`,
    },
    {
      id: 'scope',
      item: 'Enterprise or pinned nodes',
      rate: usd(p.scope),
      note: `Added to the bundle: ${perInstanceFee(p.scope)}.`,
    },
    {
      id: 'staticip',
      item: 'Static IP',
      rate: usd(p.staticip),
      note: `Added to the bundle: ${perInstanceFee(p.staticip)}.`,
    },
    { id: 'minimum', item: 'Minimum price', rate: usd(p.minUSDPrice), note: 'Whatever the length.' },
    {
      id: 'flux',
      item: 'Paying in FLUX',
      rate: `x ${p.fluxmultiplier}`,
      note: 'Applied to the USD price at market.',
    },
  ];
}

export function Pricing() {
  const columns: Column<RateRow>[] = [
    { id: 'item', label: 'Item', primary: true, render: (r) => r.item },
    { id: 'rate', label: 'Rate', mono: true, render: (r) => r.rate },
    { id: 'note', label: 'Applies', render: (r) => r.note },
  ];
  return (
    <>
      <Section id="pricing">
        <KeyFact label="In plain words">
          <p>
            Resources are priced as a bundle of {BUNDLE_INSTANCES} instances and divided, so one instance
            costs a third. The fees below go into the same bundle, so they are divided too and grow with the
            instance count. You pay for the whole subscription in advance, from a minimum of{' '}
            {usd(BAKED_PRICING.params.minUSDPrice)}. The calculator is the authority: these numbers are its
            rates as read on {BAKED_PRICING.capturedAt}.
          </p>
        </KeyFact>
        <div className={styles.rateHead}>
          <FreshnessChip kind="baked" hideAge />
          <span className={styles.dim}>Rates read {BAKED_PRICING.capturedAt}</span>
        </div>
        <DataTable
          caption="The official rates"
          columns={columns}
          rows={rates()}
          rowId={(r) => `rate-${r.id}`}
        />
      </Section>

      <Section id="pricing-steps">
        <Slab>
          <ol className={styles.steps}>
            {STEPS.map((s, i) => {
              const id = anchor.priceStep(s.id);
              return (
                <li key={s.id} id={id} className={styles.step}>
                  <span className={styles.stepNum} aria-hidden="true">
                    {i + 1}
                  </span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepTitle}>
                      {s.title}
                      <CopyLink id={id} label={s.title} />
                    </p>
                    <p className={styles.stepText}>
                      <Md text={s.body} /> <ProvChips prov={s.prov ?? ['source', 'live']} />
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Slab>
      </Section>

      <Section id="pricing-example">
        <PricingExample />
      </Section>

      <Section id="pricing-curve">
        <PricingCurve />
      </Section>
    </>
  );
}

function PricingExample() {
  const [size, setSize] = useState<PriceSize>('small');
  const [instances, setInstances] = useState(EXAMPLE_INSTANCES[0] ?? 1);
  const [months, setMonths] = useState(EXAMPLE_MONTHS[0] ?? 1);
  const example = PRICE_EXAMPLES.find((e) => e.id === size) ?? PRICE_EXAMPLES[0];
  const q = useMemo(
    () => (example ? priceFor(example, instances, months) : null),
    [example, instances, months],
  );
  const share = useMemo(
    () =>
      example
        ? forgeShareLink({ ...example.spec, instances, expire: monthsToBlocks(months) })
        : '/labs/spec-forge',
    [example, instances, months],
  );

  if (!example || !q) return null;
  return (
    <div className={styles.tool}>
      <div className={styles.controls}>
        <div className={styles.control}>
          <span className={styles.controlLabel} aria-hidden="true">
            Size
          </span>
          <SegmentedControl
            size="sm"
            aria-label="Size of the app"
            value={size}
            onValueChange={(v) =>
              setSize((PRICE_EXAMPLES.find((e) => e.id === v)?.id ?? 'small') as PriceSize)
            }
            options={PRICE_EXAMPLES.map((e) => ({ value: e.id, label: e.label }))}
          />
        </div>
        <div className={styles.control}>
          <span className={styles.controlLabel} aria-hidden="true">
            Instances
          </span>
          <SegmentedControl
            size="sm"
            aria-label="Instances"
            value={String(instances)}
            onValueChange={(v) => setInstances(Number(v))}
            options={EXAMPLE_INSTANCES.map((n) => ({
              value: String(n),
              label: String(n),
            }))}
          />
        </div>
        <div className={styles.control}>
          <span className={styles.controlLabel} aria-hidden="true">
            Months
          </span>
          <SegmentedControl
            size="sm"
            aria-label="Subscription length in months"
            value={String(months)}
            onValueChange={(v) => setMonths(Number(v))}
            options={EXAMPLE_MONTHS.map((n) => ({
              value: String(n),
              label: String(n),
            }))}
          />
        </div>
      </div>
      <p className={styles.exampleNote}>
        One component: {example.summary}, one public port on {FREE_PORT_EXAMPLE}, so no fee port is involved.
      </p>

      <Slab padded>
        <div className={styles.statement} aria-live="polite">
          <Ul className={styles.lines} aria-label="Itemised price">
            {q.lines.map((l, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a line id can repeat per component
              <li key={`${l.id}-${i}`} className={styles.line} data-neg={l.usd < 0 ? 'true' : undefined}>
                <span className={styles.lineLabel}>{l.label}</span>
                <span className={styles.lineAmount}>{l.usd < 0 ? `-${money(-l.usd)}` : money(l.usd)}</span>
                {l.note ? <span className={styles.lineNote}>{l.note}</span> : null}
              </li>
            ))}
          </Ul>
          <div className={styles.total}>
            <span>
              Total for {months} {months === 1 ? 'month' : 'months'}
            </span>
            <strong>{q.usdTotal === undefined ? '--' : money(q.usdTotal)}</strong>
          </div>
          <div className={styles.totalSub}>
            <span>
              {money(q.usdPerMonth)} a month
              {q.minimumApplied ? ', the minimum price' : ''}
            </span>
            <span>
              {q.fluxTotal != null ? `${num(Number(q.fluxTotal.toFixed(2)))} FLUX at the baked price` : null}
            </span>
          </div>
        </div>
      </Slab>
      <p className={styles.exampleFoot}>
        Computed by the same <code>quote</code> function Spec Forge uses, at the baked rates of{' '}
        {BAKED_PRICING.capturedAt}.{' '}
        <Link to={share} className="link">
          Change this spec in Spec Forge
        </Link>
        .
      </p>
    </div>
  );
}

function PricingCurve() {
  const cliff = LIMITS.instances.smallAppDiscountBelow;
  const data = useMemo(() => PRICE_EXAMPLES.map((e) => ({ example: e, prices: curveFor(e) })), []);
  const small = PRICE_EXAMPLES.find((e) => e.id === 'small');
  const why = useMemo(() => (small ? cliffExplanation(small) : null), [small]);
  const matches = data.every((d) => {
    const v = VERIFIED_CURVE[d.example.id];
    return v.length === d.prices.length && v.every((x, i) => x === d.prices[i]);
  });
  const columns: Column<number>[] = [
    {
      id: 'n',
      label: 'Instances',
      primary: true,
      numeric: true,
      render: (n) => (
        <>
          {n}
          {n === cliff ? <span className={styles.cliffTag}>the cliff</span> : null}
        </>
      ),
    },
    ...data.map(
      (d): Column<number> => ({
        id: d.example.id,
        label: `${d.example.label}, ${d.example.summary}`,
        cardLabel: d.example.label,
        numeric: true,
        mono: true,
        render: (n) => money(d.prices[CURVE_INSTANCES.indexOf(n)] ?? 0),
      }),
    ),
  ];
  return (
    <>
      <DataTable
        caption={`Monthly price of three example apps from ${CURVE_INSTANCES[0]} to ${CURVE_INSTANCES[CURVE_INSTANCES.length - 1]} instances`}
        columns={columns}
        rows={CURVE_INSTANCES}
        rowId={(n) => `curve-${n}`}
      />
      <p className={styles.tableNote}>
        <span className={matches ? styles.ok : styles.warn}>
          <StatusDot status={matches ? 'ok' : 'warn'} />
          <span>
            {matches
              ? `Every figure matches the live calculator's answer of ${BAKED_PRICING.capturedAt}.`
              : 'These figures differ from the calculator answers recorded on the day they were checked.'}
          </span>
        </span>{' '}
        {PRICE_EXAMPLES.map((e) => `${e.label} is ${e.summary}.`).join(' ')} An app under the size caps gets a
        discount only with fewer than {cliff} instances, so the price steps up at {cliff}, then climbs in a
        straight line. <ProvChips prov={['source', 'live']} />
      </p>
      {why && small ? (
        <p className={styles.tableNote}>
          <strong>Why the step is so steep for a small app.</strong> Two rules start at {cliff} instances. The
          small app discount ends, and because one instance of the {small.label.toLowerCase()} example costs{' '}
          {money(why.perInstance)}
          {why.flatRuleApplies
            ? `, under ${money(why.flatRate)}, every instance after the first becomes a flat ${money(why.flatRate)}. That gives ${money(why.at4)} at ${cliff} instances against ${money(why.at3)} at ${cliff - 1}. The discount ending alone would give about ${money(why.withoutFlatRule)}.`
            : `, the flat rate does not apply and only the discount ends: ${money(why.at4)} at ${cliff} instances against ${money(why.at3)} at ${cliff - 1}.`}
        </p>
      ) : null}
    </>
  );
}
