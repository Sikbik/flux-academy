import { anchor } from '@/content/reference';
import { money } from '@/content/reference/derive';
import {
  buildCustomFacts,
  buildCustomPriceRows,
  buildCustomRows,
  buildGlanceLines,
  buildGlanceTiles,
  buildPlanFacts,
  buildPlanRows,
  type CustomPriceRow,
  type CustomRow,
  ORBIT_READ_ON,
  type PlanRow,
} from '@/content/reference/orbit';
import { Dated } from '../../parts/Dated';
import { type Column, DataTable, FactList } from '../../parts/Facts';
import { Section } from '../../parts/Heading';
import { Tiles } from '../../parts/Tiles';
import styles from './orbit.module.css';

const PLAN_COLUMNS: Column<PlanRow>[] = [
  { id: 'plan', label: 'Plan', primary: true, render: (r) => r.name },
  { id: 'resources', label: 'Resources', render: (r) => r.resources },
  {
    id: 'instances',
    label: 'Instances',
    render: (r) => (
      <span className={styles.stack}>
        <span>{r.instances}</span>
        <span className={styles.dim}>
          {r.persistentFolders ? 'Persistent folders' : 'No persistent folders'},{' '}
          {r.secondPort ? 'second port' : 'no second port'}
        </span>
      </span>
    ),
  },
  {
    id: 'published',
    label: 'Published a month',
    cardLabel: 'Published price',
    numeric: true,
    render: (r) => <span className={styles.price}>{money(r.publishedUsd)}</span>,
  },
  {
    id: 'quote',
    label: 'quote() a month',
    cardLabel: 'quote() price',
    numeric: true,
    render: (r) => (
      <span className={styles.stack}>
        <span className={styles.price}>{money(r.engineUsd)}</span>
        <span className={styles.dim}>{r.agree ? 'Matches' : 'Differs'}</span>
      </span>
    ),
  },
];

const RANGE_COLUMNS: Column<CustomRow>[] = [
  { id: 'label', label: 'Setting', primary: true, render: (r) => r.label },
  { id: 'value', label: 'Range', render: (r) => r.value },
  { id: 'note', label: 'Note', render: (r) => r.note },
];

const PRICE_COLUMNS: Column<CustomPriceRow>[] = [
  { id: 'label', label: 'Size', primary: true, render: (r) => r.label },
  { id: 'size', label: 'Resources', render: (r) => r.size },
  { id: 'instances', label: 'Instances', numeric: true, render: (r) => r.instances },
  {
    id: 'usd',
    label: 'quote() a month',
    cardLabel: 'quote() price',
    numeric: true,
    render: (r) => <span className={styles.price}>{money(r.usd)}</span>,
  },
];

/** What Orbit is, in four lines, and the figures that stay fixed. */
export function Glance() {
  return (
    <Section id="at-a-glance">
      <Dated date={ORBIT_READ_ON}>The plan table, the variable list and the button page were read on</Dated>
      <FactList section="at-a-glance" rows={buildGlanceLines()} />
      <Tiles tiles={buildGlanceTiles()} label="Orbit at a glance" />
    </Section>
  );
}

/** The plan table and the three plan prices against the engine, then the custom ranges. */
export function Plans() {
  return (
    <>
      <Section id="plans">
        <Dated date={ORBIT_READ_ON}>Published plan sizes and prices, read on</Dated>
        <DataTable
          caption="Orbit plans: resources, instances, the published price and the price quote() gives for the same resources"
          columns={PLAN_COLUMNS}
          rows={buildPlanRows()}
          rowId={(r) => anchor.plan(r.id)}
        />
        <FactList section="plans" rows={buildPlanFacts()} />
      </Section>

      <Section id="custom-sizes">
        <DataTable
          caption="Custom size ranges as the product page states them"
          columns={RANGE_COLUMNS}
          rows={buildCustomRows()}
          rowId={(r) => `custom-range-${r.id}`}
        />
        <FactList section="custom-sizes" rows={buildCustomFacts()} />
        <DataTable
          caption="What quote() says at the ends of the custom ranges: the network price, not an Orbit price"
          columns={PRICE_COLUMNS}
          rows={buildCustomPriceRows()}
          rowId={(r) => `custom-price-${r.id}`}
        />
      </Section>
    </>
  );
}
