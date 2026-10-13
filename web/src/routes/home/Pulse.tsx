import { type CSSProperties, type ReactNode, useRef } from 'react';
import { useBlocks, useDataAge, useGeo, useNetworkSelect, useSectionAge } from '@/data';
import { type FreshnessChipKind, freshnessKind } from '@/data/chips';
import type { DataStatus } from '@/data/types';
import { formatDateShort, formatInt } from '@/lib/format';
import { FreshnessChip, Gauge, Panel, Skeleton, Sparkline, useReveal } from '@/ui';
import { PULSE_NOTES } from './copy';
import { asOfLine, cadence, tierShares, topCountries } from './logic';
import styles from './pulse.module.css';
import { SectionHead } from './SectionHead';
import section from './section.module.css';

const TIERS = [
  { id: 'cumulus', name: 'Cumulus' },
  { id: 'nimbus', name: 'Nimbus' },
  { id: 'stratus', name: 'Stratus' },
] as const;

function Chipped({
  kind,
  ageMs,
  hideAge,
}: {
  kind: FreshnessChipKind;
  ageMs: number | null;
  hideAge?: boolean;
}) {
  return <FreshnessChip kind={kind} ageMs={ageMs} hideAge={hideAge} />;
}

/** A line saying when a number that is not live was taken. Empty for live and cached numbers. */
function AsOf({ status, asOf }: { status: DataStatus | string; asOf: string | null | undefined }) {
  const line = asOfLine(status, asOf ?? null);
  return line ? <p className={styles.asOf}>{line}</p> : null;
}

// ---------------------------------------------------------------------------
// 1. Tiers
// ---------------------------------------------------------------------------

function Tiers() {
  const nodes = useNetworkSelect((n) => n.nodes);
  const sec = useSectionAge('nodes');
  const shares = nodes ? tierShares(nodes.tiers, nodes.total) : null;
  return (
    <>
      <header className={styles.head}>
        <h3 className={styles.title}>Three tiers</h3>
        <Chipped kind={freshnessKind(sec.status)} ageMs={sec.ageMs} hideAge={sec.status === 'fallback'} />
      </header>
      <ul className={styles.tiers}>
        {TIERS.map((t, i) => {
          const share = shares?.[i];
          const count = nodes ? nodes.tiers[t.id] : null;
          const collateral = nodes ? nodes.collateral[t.id] : null;
          return (
            <li key={t.id} className={styles.tier} data-tier={t.id}>
              {share ? (
                <Gauge
                  label={t.name}
                  value={share.share * 100}
                  unit="%"
                  decimals={0}
                  tier={t.id}
                  size="md"
                  valueText={`${t.name}: ${Math.round(share.share * 100)} percent of nodes`}
                />
              ) : (
                <Skeleton shape="block" width="72px" height="72px" />
              )}
              <span className={styles.count}>{count === null ? '--' : formatInt(count)}</span>
              <span className={styles.unit}>nodes</span>
              <span className={styles.collateral}>
                <b>{collateral === null ? '--' : formatInt(collateral)}</b> FLUX
              </span>
              <span className={styles.unit}>collateral</span>
            </li>
          );
        })}
      </ul>
      <AsOf status={sec.status} asOf={sec.asOf} />
    </>
  );
}

// ---------------------------------------------------------------------------
// 2. Blocks
// ---------------------------------------------------------------------------

function Blocks() {
  const blocks = useBlocks();
  const age = useDataAge('blocks');
  const series = cadence(blocks.data?.blocks ?? [], 60);
  const have = series.intervals.length > 0;
  const lo = have ? Math.min(30, series.min ?? 30) : 30;
  const hi = have ? Math.max(30, series.max ?? 30) : 30;
  const asOf = blocks.status === 'fallback' || blocks.status === 'offline' ? blocks.meta?.asOf : null;
  return (
    <>
      <header className={styles.head}>
        <h3 className={styles.title}>Block rhythm</h3>
        <Chipped kind={freshnessKind(blocks.status)} ageMs={age} hideAge={blocks.status === 'fallback'} />
      </header>
      {have ? (
        <div className={styles.spark}>
          <Sparkline
            values={series.intervals}
            target={30}
            targetLabel="30 s"
            label="Seconds between blocks, last 60 blocks"
            height={104}
            min={Math.max(0, lo - 4)}
            max={hi + 4}
            formatValue={(n) => `${n.toFixed(0)} s`}
            interactive
          />
          <dl className={styles.facts}>
            <div>
              <dt>Mean</dt>
              <dd>{series.mean === null ? '--' : `${series.mean.toFixed(1)} s`}</dd>
            </div>
            <div>
              <dt>Fastest</dt>
              <dd>{series.min === null ? '--' : `${series.min.toFixed(0)} s`}</dd>
            </div>
            <div>
              <dt>Slowest</dt>
              <dd>{series.max === null ? '--' : `${series.max.toFixed(0)} s`}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <p className={styles.empty}>Waiting for recent blocks to arrive.</p>
      )}
      {asOf ? <p className={styles.asOf}>As of {formatDateShort(asOf, '')}, not live</p> : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// 3. Places
// ---------------------------------------------------------------------------

function Places() {
  const geo = useGeo();
  const age = useDataAge('geo');
  const rows = geo.data ? topCountries(geo.data.countries, 6, geo.data.located) : [];
  const max = rows[0]?.nodes ?? 1;
  const asOf = geo.status === 'fallback' || geo.status === 'offline' ? geo.meta?.asOf : null;
  return (
    <>
      <header className={styles.head}>
        <h3 className={styles.title}>Where the machines are</h3>
        <Chipped kind={freshnessKind(geo.status)} ageMs={age} hideAge={geo.status === 'fallback'} />
      </header>
      {rows.length > 0 && geo.data ? (
        <>
          <ol className={styles.places} aria-label="Countries with the most nodes">
            {rows.map((r) => (
              <li key={r.code} className={styles.place}>
                <span className={styles.country}>{r.name}</span>
                <span
                  className={styles.bar}
                  aria-hidden="true"
                  style={{ '--w': r.nodes / max } as CSSProperties}
                >
                  <i data-tier="cumulus" style={{ flexGrow: r.tiers.cumulus }} />
                  <i data-tier="nimbus" style={{ flexGrow: r.tiers.nimbus }} />
                  <i data-tier="stratus" style={{ flexGrow: r.tiers.stratus }} />
                </span>
                <span className={styles.n}>{formatInt(r.nodes)}</span>
              </li>
            ))}
          </ol>
          <p className={styles.sum}>
            {formatInt(geo.data.countries.length)} countries. {formatInt(geo.data.located)} of{' '}
            {formatInt(geo.data.total)} nodes have a known location.
          </p>
        </>
      ) : (
        <p className={styles.empty}>Waiting for node locations to arrive.</p>
      )}
      {asOf ? <p className={styles.asOf}>As of {formatDateShort(asOf, '')}, not live</p> : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// the three columns
// ---------------------------------------------------------------------------

function Instrument({ n, note, children }: { n: number; note: string; children: ReactNode }) {
  const ref = useRef<HTMLLIElement>(null);
  const shown = useReveal(ref, { rootMargin: '0px 0px -12% 0px' });
  return (
    <li ref={ref} className={styles.col} data-drawn={shown ? 'true' : 'false'}>
      <Panel
        variant="glass"
        size="md"
        padding="md"
        pattern="br"
        className={styles.panel}
        contentClassName={styles.panelInner}
      >
        {children}
      </Panel>
      <div className={styles.note}>
        <span className={styles.leader} aria-hidden="true" />
        <span className={styles.ring} aria-hidden="true">
          {n}
        </span>
        <p className={styles.noteText}>
          <span className={styles.noteLabel}>What this means for you</span>
          {note}
        </p>
      </div>
    </li>
  );
}

/** The live network: three instruments on real data, each with the honest chip and a plain-words note. */
export function Pulse() {
  const connection = useSectionAge('chain');
  return (
    <section id="live" className={section.section} data-scene="live" aria-labelledby="live-title">
      <div className={section.inner}>
        <SectionHead
          id="live-title"
          number="05"
          label="Live network"
          title="The network, right now"
          lead="These are numbers read from the Flux network, each with its age beside it. If the connection drops, the page says so and shows the last figures it had, or a built-in sample marked with its date."
          aside={
            <Chipped
              kind={freshnessKind(connection.status)}
              ageMs={connection.ageMs}
              hideAge={connection.status === 'fallback'}
            />
          }
        />
        <ol className={styles.grid} aria-label="Three live instruments">
          <Instrument n={1} note={PULSE_NOTES.tiers}>
            <Tiers />
          </Instrument>
          <Instrument n={2} note={PULSE_NOTES.blocks}>
            <Blocks />
          </Instrument>
          <Instrument n={3} note={PULSE_NOTES.places}>
            <Places />
          </Instrument>
        </ol>
      </div>
    </section>
  );
}
