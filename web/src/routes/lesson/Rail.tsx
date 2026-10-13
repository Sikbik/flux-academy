/**
 * The slim rail under the shell header: where you are (back to the course map, the lesson title, its
 * track and length), how far (the step rail, one segment per step and per checkpoint challenge) and the
 * two ways around the lesson (the outline and the article view).
 */

import { trackById } from '@shared/curriculum';
import { Link } from 'react-router';
import { type Segment, segmentsOf } from '@/learn/player';
import { Chip, Glyph, IconButton, StepRail, type StepRailStep, type StepState } from '@/ui';
import { usePlayer, usePlayerCtx } from './PlayerContext';
import styles from './Rail.module.css';
import { useStacked } from './useStacked';

const STATE: Record<Segment['state'], StepState> = {
  done: 'done',
  assisted: 'done',
  skipped: 'skipped',
  current: 'current',
  todo: 'todo',
};

/** The state word beside the caption on the stacked layout. A step the learner was shown counts as done. */
const WORD: Record<Segment['state'], string> = {
  done: 'done',
  assisted: 'done',
  skipped: 'skipped',
  current: 'current',
  todo: 'to do',
};

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * Where the learner is, in words, under the compact rail: "04 / 11  The spec: one number must match  done".
 *
 * The design system's own caption follows the one segment whose state is `current`. A step that has just
 * been completed is `done`, not `current`, so with a deep link (nothing before it visited) that caption
 * fell back to the first unvisited step and read "01 / 11 ... to do". This one follows the player's
 * position, whatever state the step is in.
 */
export function RailCaption({ segments, position }: { segments: readonly Segment[]; position: number }) {
  const total = segments.length;
  if (total === 0) return null;
  const complete = position >= total;
  const at = segments.find((s) => s.position === position);
  const index = complete ? total : (at?.position ?? 0) + 1;
  const name = complete ? 'Lesson complete' : (at?.label ?? '');
  const word = complete ? 'done' : at ? WORD[at.state] : '';
  return (
    <p className={styles.caption} aria-hidden="true">
      <span className={styles.captionCount}>
        {pad2(index)} / {pad2(total)}
      </span>
      <span className={styles.captionName}>{name}</span>
      <span className={styles.captionState}>{word}</span>
    </p>
  );
}

export interface RailProps {
  onOutline: () => void;
  /** Where the article view lives. */
  articleTo: string;
}

export function Rail({ onOutline, articleTo }: RailProps) {
  const { lesson, meta, store } = usePlayerCtx();
  const snapshot = usePlayer((s) => s);
  const segments = segmentsOf(lesson, snapshot);
  const steps: StepRailStep[] = segments.map((s) => ({
    id: s.key,
    label: s.label,
    kind: s.kind === 'challenge' ? 'check' : 'step',
    state: STATE[s.state],
  }));
  // The segment at the player's position, whatever its state: a finished step is `done`, not `current`,
  // and the rail's tab stop and aria-current have to stay on it all the same.
  const current = segments.find((s) => s.position === snapshot.position)?.key;
  const track = trackById(meta.track);
  const stacked = useStacked();

  return (
    <div className={styles.rail} data-lesson-rail="">
      <div className={styles.inner}>
        <Link className={styles.back} to="/learn" aria-label="Back to the course map">
          <Glyph name="arrow-left" size={16} />
          <span className={styles.backText}>Course map</span>
        </Link>

        <div className={styles.title}>
          <h1 className={styles.h1}>{meta.title}</h1>
          <p className={styles.meta}>
            <Chip tier={meta.track} size="sm">
              {track.name}
            </Chip>
            <span>{meta.minutes} min</span>
          </p>
        </div>

        <div className={styles.steps}>
          <StepRail
            aria-label="Lesson progress"
            steps={steps}
            current={current}
            tier={meta.track}
            compact={stacked}
            showLabel={false}
            onSelect={(_id, index) => {
              const seg = segments[index];
              if (seg) store.getState().go(seg.position);
            }}
          />
          {stacked ? <RailCaption segments={segments} position={snapshot.position} /> : null}
        </div>

        <div className={styles.tools}>
          <IconButton
            icon="list"
            label="Outline"
            shortcut="g o"
            variant="ghost"
            size="sm"
            onClick={onOutline}
            tooltipPlacement="bottom"
          />
          <Link
            className={styles.tool}
            to={articleTo}
            aria-label="Article view: read the whole lesson on one page"
          >
            <Glyph name="book" size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
