/**
 * What each policy does at each call that is not a read: the table the debrief ends on, and, on the lab's
 * set-up screen, the same table for every such tool of a server.
 *
 * A real `<table>` on a wide container and a list of small cards on a narrow one (only one of them is
 * rendered visible at a time, the other is `display: none`, so a screen reader meets one). Meaning is never
 * colour alone: a cell says "Asks you" or "Runs", and carries a glyph.
 */

import type { ToolRisk } from '@shared/flux';
import { Chip, Glyph } from '@/ui';
import styles from './AgentSession.module.css';
import { POLICY_IDS, type PolicyId } from './engine/types.ts';
import { POLICY_SHORT } from './words.ts';

export type HappenedAs = 'approved' | 'refused' | 'ran-unasked' | 'earlier';

export interface PolicyTableRow {
  tool: string;
  risk: ToolRisk;
  riskLabel: string;
  /** A short line of what the call carried, when there is one. */
  summary?: string;
  asks: Record<PolicyId, boolean>;
  /** What happened in the run (the debrief only). */
  happened?: HappenedAs;
}

export interface PolicyTableProps {
  rows: readonly PolicyTableRow[];
  /** The policy the session ran under, marked in its column. */
  active?: PolicyId;
  caption: string;
  /** Show the "what happened" column. */
  showRun?: boolean;
}

const HAPPENED: Record<HappenedAs, string> = {
  approved: 'You approved it',
  refused: 'You refused it',
  'ran-unasked': 'Ran without asking you',
  earlier: 'Ran earlier',
};

function Cell({ asks }: { asks: boolean }) {
  return asks ? (
    <span className={styles.cellAsks}>
      <Glyph name="shield" size={14} />
      <span>Asks you</span>
    </span>
  ) : (
    <span className={styles.cellRuns}>
      <Glyph name="arrow-right" size={14} />
      <span>Runs</span>
    </span>
  );
}

function Happened({ value }: { value: HappenedAs | undefined }) {
  if (!value) return null;
  return (
    <span className={styles.happened} data-happened={value}>
      {value === 'ran-unasked' ? <Glyph name="warning" size={14} /> : null}
      <span>{HAPPENED[value]}</span>
    </span>
  );
}

export function PolicyTable({ rows, active, caption, showRun = false }: PolicyTableProps) {
  if (rows.length === 0) return null;
  return (
    <div className={styles.policyTable}>
      <table className={styles.ptable}>
        <caption className={styles.ptCaption}>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Call</th>
            {POLICY_IDS.map((p) => (
              <th key={p} scope="col" data-active={p === active ? '' : undefined}>
                {POLICY_SHORT[p]}
                {p === active ? <span className={styles.thRun}>This run</span> : null}
              </th>
            ))}
            {showRun ? <th scope="col">What happened</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a tool can be called more than once in a run
            <tr key={`${r.tool}:${i}`}>
              <th scope="row" className={styles.ptTool}>
                <code>{r.tool}</code>
                <span className={styles.ptRisk}>{r.riskLabel}</span>
                {r.summary ? <span className={styles.ptSummary}>{r.summary}</span> : null}
              </th>
              {POLICY_IDS.map((p) => (
                <td key={p} data-active={p === active ? '' : undefined}>
                  <Cell asks={r.asks[p]} />
                </td>
              ))}
              {showRun ? (
                <td>
                  <Happened value={r.happened} />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>

      <ul className={styles.plist} aria-label={caption}>
        {rows.map((r, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a tool can be called more than once in a run
          <li key={`${r.tool}:${i}`} className={styles.pitem}>
            <p className={styles.pitemHead}>
              <code>{r.tool}</code> <Chip size="sm">{r.riskLabel}</Chip>
            </p>
            {r.summary ? <p className={styles.ptSummary}>{r.summary}</p> : null}
            <dl className={styles.pitemPolicies}>
              {POLICY_IDS.map((p) => (
                <div key={p} data-active={p === active ? '' : undefined}>
                  <dt>
                    {POLICY_SHORT[p]}
                    {p === active ? <span className={styles.thRun}>This run</span> : null}
                  </dt>
                  <dd>
                    <Cell asks={r.asks[p]} />
                  </dd>
                </div>
              ))}
            </dl>
            {showRun ? (
              <p className={styles.pitemRun}>
                <Happened value={r.happened} />
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
