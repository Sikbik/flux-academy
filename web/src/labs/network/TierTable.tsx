/**
 * The tier panel: one row per tier, one column per number the Academy teaches about it. The column
 * headers are the anchors of the explainer notes, so each note describes a column, not a single cell.
 */
import type { NextReduction } from '@shared/api';
import type { ReactNode } from 'react';
import { formatDateShort, formatDecimal, formatInt, formatShare } from '@/lib/format';
import { Chip } from '@/ui';
import { formatWait, type TierFilter, type TierSummary } from './model';
import styles from './TierTable.module.css';

export interface TierTableProps {
  summaries: readonly TierSummary[] | null;
  filter: TierFilter;
  nextReduction: NextReduction | null;
  perBlockTotal: number | null;
  devFund: number | null;
  /** The freshness chip of the network snapshot. */
  chip: ReactNode;
  /** The sentence that says how fresh the numbers are, shown when they are not live. */
  note?: ReactNode;
}

const TIER_NAME = { cumulus: 'Cumulus', nimbus: 'Nimbus', stratus: 'Stratus' } as const;

function flux(n: number): string {
  return Number.isInteger(n) ? formatInt(n) : formatDecimal(n, 1);
}

export function TierTable({
  summaries,
  filter,
  nextReduction,
  perBlockTotal,
  devFund,
  chip,
  note,
}: TierTableProps) {
  const locked = summaries ? summaries.reduce((sum, t) => sum + t.lockedFlux, 0) : null;
  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <h2 className={styles.title}>Tiers</h2>
        {chip}
      </div>
      <table className={styles.table}>
        <caption className="sr-only">Nodes, share, collateral and rewards for each tier</caption>
        <thead>
          <tr>
            <th scope="col">Tier</th>
            <th scope="col" data-explain="tier-count">
              Nodes
            </th>
            <th scope="col" data-explain="tier-share">
              Share
            </th>
            <th scope="col" data-explain="collateral">
              Collateral
            </th>
            <th scope="col" data-explain="reward-block">
              Paid per block
            </th>
            <th scope="col" data-explain="payout-interval">
              Each node paid every
            </th>
          </tr>
        </thead>
        <tbody>
          {(summaries ?? []).map((t) => (
            <tr key={t.tier} data-dim={filter !== 'all' && filter !== t.tier ? '' : undefined}>
              <th scope="row">
                <Chip tier={t.tier} size="sm">
                  {TIER_NAME[t.tier]}
                </Chip>
              </th>
              <td data-label="Nodes">{formatInt(t.nodes)}</td>
              <td data-label="Share">
                <span className={styles.share}>
                  <span>{formatShare(t.share, 1)}</span>
                  <span className={styles.shareBar} aria-hidden="true">
                    <i style={{ inlineSize: `${t.share * 100}%`, background: `var(--${t.tier})` }} />
                  </span>
                </span>
              </td>
              <td data-label="Collateral">
                {formatInt(t.collateralFlux)} <span className={styles.unit}>FLUX</span>
              </td>
              <td data-label="Paid per block">
                {flux(t.rewardPerBlockFlux)} <span className={styles.unit}>FLUX</span>
              </td>
              <td data-label="Each node paid every">
                <span
                  className={styles.derived}
                  title="Derived: the nodes in the tier divided by the blocks in a day"
                >
                  {t.paidEveryDays === null ? '--' : `about ${formatWait(t.paidEveryDays)}`}
                </span>
              </td>
            </tr>
          ))}
          {!summaries ? (
            <tr>
              <td colSpan={6} className={styles.loading}>
                Waiting for the first snapshot.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <ul className={styles.notes}>
        {perBlockTotal !== null ? (
          <li>
            Each block creates {flux(perBlockTotal)} FLUX: one payout per tier
            {devFund !== null ? ` and ${flux(devFund)} to the development fund` : ''}.
          </li>
        ) : null}
        {nextReduction ? (
          <li>
            The total falls by {formatShare(nextReduction.fraction, 0)} to{' '}
            {formatDecimal(nextReduction.perBlockAfter, 1)} FLUX at block {formatInt(nextReduction.height)},{' '}
            {formatInt(nextReduction.blocksAway)} blocks away (about {formatDateShort(nextReduction.etaIso)}).
          </li>
        ) : null}
        {locked !== null && locked > 0 ? (
          <li>
            Derived: the nodes together keep about {formatDecimal(locked / 1_000_000, 1)} million FLUX locked
            as collateral.
          </li>
        ) : null}
        {note}
      </ul>
    </div>
  );
}
