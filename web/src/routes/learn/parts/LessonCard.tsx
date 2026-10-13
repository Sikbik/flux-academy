import type { CSSProperties } from 'react';
import { KIND_LABEL, type MapLesson, shortDate } from '../model';
import { Chip, Glyph, type GlyphName, Kbd, Panel, Progress } from '../ui';
import styles from './LessonCard.module.css';
import { RouteButton } from './RouteButton';

const KIND_GLYPH: Record<MapLesson['meta']['kind'], GlyphName> = {
  concept: 'kind-concept',
  'hands-on': 'kind-hands-on',
  project: 'kind-project',
};

export interface CardRequirement {
  id: string;
  title: string;
  done: boolean;
}

export interface LessonCardProps {
  lesson: MapLesson;
  trackName: string;
  /** Prerequisites with their state. Advice: the card says "helps to finish first", never "locked". */
  requires: readonly CardRequirement[];
  /** How many lessons list this one as a prerequisite. */
  leadsTo: number;
  /** `float` sits next to a node and is decorative (the node's own label carries the words); `dock` is a real region with a button. */
  mode: 'float' | 'dock';
  /** Which side of the node a floating card opens on. */
  side?: 'left' | 'right';
  href: string;
  style?: CSSProperties;
  className?: string;
  /** Keep the card open while the pointer is on it (the node closes it on leave otherwise). */
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
}

/**
 * The lesson card shown next to a node on hover or focus: title, time, kind, summary, progress and what
 * helps first. On touch it docks under the map and offers a button.
 */
export function LessonCard({
  lesson,
  trackName,
  requires,
  leadsTo,
  mode,
  side = 'right',
  href,
  style,
  className,
  onPointerEnter,
  onPointerLeave,
}: LessonCardProps) {
  const { meta } = lesson;
  const float = mode === 'float';

  let state: React.ReactNode;
  if (lesson.status === 'complete') {
    const when = shortDate(lesson.completedAt);
    state = (
      <p className={styles.state} data-status="complete">
        <Glyph name="check" size={16} />
        <span>{when ? `Done on ${when}` : 'Done'}</span>
      </p>
    );
  } else if (lesson.status === 'in-progress') {
    const text =
      lesson.stepNumber !== null && lesson.stepCount !== null
        ? `Step ${lesson.stepNumber} of ${lesson.stepCount}`
        : 'In progress';
    state = (
      <div className={styles.progress}>
        <Progress
          label="Progress through this lesson"
          value={lesson.fraction}
          valueText={text}
          showLabel={false}
          size="sm"
          tier={meta.track}
        />
      </div>
    );
  } else if (!lesson.hasContent) {
    state = (
      <p className={styles.state} data-status="soon">
        <Glyph name="clock" size={16} />
        <span>Coming soon</span>
      </p>
    );
  } else {
    state = (
      <p className={styles.state} data-status={lesson.recommended ? 'next' : 'idle'}>
        <Glyph name={lesson.recommended ? 'arrow-right' : 'status-off'} size={16} />
        <span>{lesson.recommended ? 'Next on the path' : 'Not started'}</span>
      </p>
    );
  }

  return (
    <Panel
      as="aside"
      variant="slab"
      size="md"
      padding="md"
      pattern="br"
      interactive={float}
      tilt={float ? 3 : false}
      data-tier={meta.track}
      data-mode={mode}
      data-side={float ? side : undefined}
      className={`${styles.card} ${className ?? ''}`}
      contentClassName={styles.content}
      style={style}
      aria-hidden={float ? true : undefined}
      aria-label={float ? undefined : `${meta.title}, lesson details`}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div className={styles.top}>
        <span className={styles.kind}>
          <Glyph name={KIND_GLYPH[meta.kind]} size={16} />
          {KIND_LABEL[meta.kind]}
        </span>
        <span className={styles.min}>{meta.minutes} min</span>
        <Chip tier={meta.track} size="sm" className={styles.track}>
          {trackName}
        </Chip>
      </div>

      <h3 className={styles.title}>{meta.title}</h3>
      <p className={styles.summary}>{meta.summary}</p>

      {state}

      {requires.length > 0 ? (
        <div className={styles.requires}>
          <p className={styles.k}>Helps to finish first</p>
          <ul className={styles.reqList}>
            {requires.map((r) => (
              <li key={r.id} data-done={r.done ? 'true' : 'false'}>
                <Glyph name={r.done ? 'check' : 'status-off'} size={13} />
                <span>{r.title}</span>
                <span className="sr-only">{r.done ? ', done' : ', not done yet'}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className={styles.k}>Needs nothing first</p>
      )}

      {leadsTo > 0 ? (
        <p className={styles.leads}>Leads to {leadsTo === 1 ? '1 lesson' : `${leadsTo} lessons`}.</p>
      ) : null}

      {float ? (
        <p className={styles.hint} aria-hidden="true">
          <Kbd>Enter</Kbd> or click to open
        </p>
      ) : (
        <div className={styles.actions}>
          <RouteButton to={href} variant="primary" size="sm" iconEnd="arrow-right" magnetic={false}>
            {lesson.status === 'in-progress'
              ? 'Continue lesson'
              : lesson.status === 'complete'
                ? 'Review lesson'
                : 'Open lesson'}
          </RouteButton>
        </div>
      )}
    </Panel>
  );
}
