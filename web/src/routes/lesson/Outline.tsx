/**
 * The outline drawer: every step and challenge with its state, one press to jump. The path is advice,
 * not a lock, so any entry can be opened; XP accounting (not the interface) is what keeps skipping honest.
 */

import { Link } from 'react-router';
import { MarkupText } from '@/learn/MarkupText';
import { type Segment, segmentsOf } from '@/learn/player';
import type { Lesson, Task } from '@/learn/types';
import { Drawer, Glyph, type GlyphName } from '@/ui';
import styles from './Outline.module.css';
import { usePlayer, usePlayerCtx } from './PlayerContext';

const STATE_LABEL: Record<Segment['state'], string> = {
  done: 'Done',
  assisted: 'Done with Show me',
  skipped: 'Skipped',
  current: 'You are here',
  todo: 'To do',
};

const STATE_GLYPH: Partial<Record<Segment['state'], GlyphName>> = {
  done: 'check',
  assisted: 'eye',
  skipped: 'status-off',
};

function taskLabel(task: Task | undefined): string | null {
  switch (task?.kind) {
    case 'set-instances':
    case 'kill-nodes':
    case 'send-requests':
      return 'Diorama task';
    case 'spec':
      return 'Spec task';
    case 'terminal':
      return 'Terminal task';
    case 'widget':
      return 'Exercise';
    case 'confirm':
      return 'Confirm';
    default:
      return null;
  }
}

function titleOf(lesson: Lesson, seg: Segment): { text: string; note: string | null } {
  if (seg.kind === 'step') {
    const step = lesson.steps[seg.position];
    return { text: step?.title ?? seg.label, note: taskLabel(step?.task) };
  }
  const c = lesson.checkpoint[seg.position - lesson.steps.length];
  return { text: c?.prompt ?? seg.label, note: seg.label };
}

export interface OutlineProps {
  open: boolean;
  onClose: () => void;
  articleTo: string;
}

export function Outline({ open, onClose, articleTo }: OutlineProps) {
  const { lesson, meta, store } = usePlayerCtx();
  const snapshot = usePlayer((s) => s);
  const segments = segmentsOf(lesson, snapshot);
  const steps = segments.filter((s) => s.kind === 'step');
  const checks = segments.filter((s) => s.kind === 'challenge');
  const done = segments.filter(
    (s) => s.state === 'done' || s.state === 'assisted' || s.state === 'skipped',
  ).length;

  const go = (seg: Segment) => {
    store.getState().go(seg.position);
    onClose();
  };

  const item = (seg: Segment) => {
    const t = titleOf(lesson, seg);
    const glyph = STATE_GLYPH[seg.state];
    return (
      <li key={seg.key}>
        <button
          type="button"
          className={styles.item}
          data-state={seg.state}
          aria-current={seg.state === 'current' ? 'step' : undefined}
          data-autofocus={seg.state === 'current' ? '' : undefined}
          onClick={() => go(seg)}
        >
          <span className={styles.mark} aria-hidden="true">
            {glyph ? <Glyph name={glyph} size={13} /> : null}
          </span>
          <span className={styles.text}>
            <span className={styles.name}>
              <MarkupText text={t.text} plain />
            </span>
            <span className={styles.sub}>
              {t.note ? <span>{t.note}</span> : null}
              <span className="sr-only">{STATE_LABEL[seg.state]}</span>
            </span>
          </span>
          {seg.state === 'current' ? <span className={styles.here}>Here</span> : null}
        </button>
      </li>
    );
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Outline"
      description={`${done} of ${segments.length} done in ${meta.title}`}
      footer={
        <Link className={styles.article} to={articleTo} onClick={onClose}>
          <Glyph name="book" size={16} />
          Read it as one article
        </Link>
      }
    >
      <nav aria-label="Lesson outline" className={styles.nav}>
        <h3 className={styles.group}>Steps</h3>
        <ol className={styles.list}>{steps.map(item)}</ol>
        {checks.length > 0 ? (
          <>
            <h3 className={styles.group}>Checkpoint</h3>
            <ol className={styles.list}>{checks.map(item)}</ol>
          </>
        ) : null}
      </nav>
    </Drawer>
  );
}
