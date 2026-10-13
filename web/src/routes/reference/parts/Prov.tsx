import type { Provenance } from '@/content/reference';
import { Chip, Popover } from '@/ui';
import { PROV, PROV_ORDER, sortedProv } from '../model';
import styles from './parts.module.css';

const ICON = {
  source: 'code',
  live: 'status-live',
  docs: 'book',
  inference: 'lightbulb',
  unverified: 'warning',
} as const;

/** One provenance label. The word is always there: colour only adds emphasis to Unverified. */
export function ProvChip({ prov }: { prov: Provenance }) {
  const info = PROV[prov];
  const unverified = prov === 'unverified';
  return (
    <Chip
      size="sm"
      kind={unverified ? 'status' : 'label'}
      status={unverified ? 'warn' : undefined}
      icon={ICON[prov]}
      title={info.meaning}
      className={styles.prov}
      data-prov={prov}
    >
      {info.label}
    </Chip>
  );
}

/** The provenance of a statement, in the fixed order. Renders nothing for an empty list. */
export function ProvChips({ prov }: { prov: readonly Provenance[] }) {
  if (prov.length === 0) return null;
  return (
    <span className={styles.provList}>
      <span className="sr-only">Basis: </span>
      {sortedProv(prov).map((p) => (
        <ProvChip key={p} prov={p} />
      ))}
    </span>
  );
}

/** A button that explains the five labels. */
export function ProvLegend({ label = 'What the labels mean' }: { label?: string }) {
  return (
    <Popover
      title="How well a statement is known"
      width={380}
      placement="bottom"
      content={
        <dl className={styles.legend}>
          {PROV_ORDER.map((p) => (
            <div key={p} className={styles.legendRow}>
              <dt>
                <ProvChip prov={p} />
              </dt>
              <dd>{PROV[p].meaning}</dd>
            </div>
          ))}
        </dl>
      }
    >
      <button type="button" className={styles.textButton}>
        {label}
      </button>
    </Popover>
  );
}
