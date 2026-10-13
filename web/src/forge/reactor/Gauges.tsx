/**
 * Three hex gauges: CPU, RAM and disk of the whole app, each drawn as the share of the SMALLEST node tier
 * that can host it. So a 1.5 core app reads "50 percent of a Cumulus node" in the Cumulus colour, and the
 * moment it needs 3.5 cores the gauge restarts against a Nimbus node and turns violet: the cost of being
 * big is the shrinking list of nodes that will take you, and the gauge says so.
 *
 * Disk honesty: the validator's ceilings are 160, 380 and 820 GB, but the room a real node has left for
 * apps is lower (about 129, 338 and 756 GB). The numbers on the dial are the validator's; the popover says
 * both, and which is which.
 */

import { TIER_FACTS, TIER_ORDER, type TierId } from '@shared/flux/tiers';
import { Chip, CountUp, Gauge, Glyph, Popover } from '@/ui';
import { cores, disk, memory } from '../model/format';
import styles from './reactor.module.css';

interface Metric {
  key: 'cpu' | 'ram' | 'hdd';
  label: string;
  unit: string;
  decimals: number;
  cap: (t: TierId) => number;
  format: (n: number) => string;
  /** The runtime numbers, when they differ from the validator's. */
  runtime?: Record<TierId, number>;
}

const METRICS: readonly Metric[] = [
  {
    key: 'cpu',
    label: 'CPU',
    unit: 'cores',
    decimals: 1,
    cap: (t) => TIER_FACTS[t].appCapacity.cpu,
    format: (n) => `${cores(n)} cores`,
  },
  {
    key: 'ram',
    label: 'RAM',
    unit: 'GB',
    decimals: 1,
    cap: (t) => TIER_FACTS[t].appCapacity.ramMb,
    format: memory,
  },
  {
    key: 'hdd',
    label: 'Disk',
    unit: 'GB',
    decimals: 0,
    cap: (t) => TIER_FACTS[t].appCapacity.hddGb,
    format: disk,
    runtime: { cumulus: 129, nimbus: 338, stratus: 756 },
  },
];

function tierFor(metric: Metric, value: number): { tier: TierId; over: boolean } {
  for (const t of TIER_ORDER) if (value <= metric.cap(t) + 1e-9) return { tier: t, over: false };
  return { tier: 'stratus', over: true };
}

export function Gauges({
  totals,
  size = 'lg',
}: {
  totals: { cpu: number; ram: number; hdd: number };
  size?: 'md' | 'lg';
}) {
  return (
    <ul className={styles.gauges} aria-label="How much node the app needs">
      {METRICS.map((m) => {
        const value = totals[m.key];
        const { tier, over } = tierFor(m, value);
        const max = m.cap(tier);
        const share = Math.min(1, value / max);
        const name = TIER_FACTS[tier].name;
        const shown = m.key === 'ram' ? value / 1000 : value;
        return (
          <li className={styles.gauge} key={m.key} data-over={over ? 'true' : undefined}>
            <Gauge
              label={m.label}
              value={Math.min(value, max)}
              min={0}
              max={max}
              size={size}
              tier={over ? undefined : tier}
              tone={over ? 'crit' : 'accent'}
              showLabel={false}
              valueText={`${m.format(value)}, ${Math.round(share * 100)} percent of a ${name} node`}
            >
              <span className={styles.gaugeNum}>
                <CountUp value={shown} decimals={m.key === 'ram' && shown >= 10 ? 0 : m.decimals} />
                <small>{m.unit}</small>
              </span>
            </Gauge>
            <span className={styles.gaugeLabel}>{m.label}</span>
            <span className={styles.gaugeNote}>
              {over ? 'More than any node offers' : `${Math.round(share * 100)}% of a ${name} node`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Which node tiers have room for the app, as three chips (tier colour always with its name). */
export function TierFit({ tiers }: { tiers: readonly TierId[] }) {
  return (
    <div className={styles.fit}>
      <span className={styles.fitLabel}>Fits on</span>
      {TIER_ORDER.map((t) => {
        const ok = tiers.includes(t);
        return (
          <span key={t} className={styles.fitChip} data-fit={ok ? 'true' : 'false'}>
            <Chip size="sm" tier={t}>
              {TIER_FACTS[t].name}
            </Chip>
            <span className="sr-only">{ok ? ' has room' : ' is too small'}</span>
          </span>
        );
      })}
      <Popover
        title="How the gauges read"
        width={360}
        content={
          <div className={styles.help}>
            <p>
              Each dial is the share of the smallest node tier that can host your app. When a number grows
              past that tier the dial starts again against the next one, and its colour changes with it.
            </p>
            <ul>
              {TIER_ORDER.map((t) => {
                const c = TIER_FACTS[t].appCapacity;
                return (
                  <li key={t}>
                    <strong>{TIER_FACTS[t].name}</strong>: {cores(c.cpu)} cores, {memory(c.ramMb)} RAM,{' '}
                    {c.hddGb} GB disk
                  </li>
                );
              })}
            </ul>
            <p>
              The disk figures are the validator's limits. A real node has less room left for apps, about 129,
              338 and 756 GB, so a spec at the limit can validate and still wait for a bigger node. Smaller
              apps have more nodes to choose from.
            </p>
          </div>
        }
      >
        <button type="button" className={styles.helpBtn} aria-label="How the gauges read">
          <Glyph name="help" size={15} />
        </button>
      </Popover>
    </div>
  );
}
