/**
 * What a stage slot shows when the stage (or widget) it asks for has not been built yet. Honest and
 * calm: it says what is missing and that the rest of the lesson still works. In development it also
 * offers to simulate the events the real stage would send, so a lesson's gating can be tried today.
 */

import { Glyph } from '@/ui';
import type { StageHost } from '../stage-api';
import type { Stage, Task } from '../types';
import styles from './BuildingPanel.module.css';
import { SimulatePanel } from './SimulatePanel';

export interface BuildingPanelProps {
  /** What is missing, for the heading: "The network diorama", "The widget cost-reactor". */
  what: string;
  stage: Stage;
  host: StageHost;
  task?: Task;
  /** A line under the heading. */
  note?: string;
}

export function BuildingPanel({ what, stage, host, task, note }: BuildingPanelProps) {
  return (
    <div className={styles.panel} role="status">
      <span className={styles.glyph} aria-hidden="true">
        <Glyph name="layers" size={28} />
      </span>
      <p className={styles.eyebrow}>Being built</p>
      <p className={styles.title}>{what} is not ready yet.</p>
      <p className={styles.note}>
        {note ??
          'The lesson still works: read the step, then continue. Come back soon for the interactive part.'}
      </p>
      {import.meta.env.DEV ? <SimulatePanel stage={stage} host={host} task={task} /> : null}
    </div>
  );
}
