/**
 * The states around the player that are not the player: loading (a skeleton shaped like the lesson),
 * a lesson in the curriculum that has no content yet, and a lesson that failed to load. An id that is not
 * in the curriculum at all is the shell's `NotFoundView`.
 */

import { type LessonMeta, labById, lessonById, trackById } from '@shared/curriculum';
import { Link } from 'react-router';
import { useDocumentMeta } from '@/app/meta';
import { PlaceholderPage } from '@/app/PlaceholderPage';
import { Button, Chip, Glyph } from '@/ui';
import styles from './states.module.css';

export function LessonSkeleton() {
  return (
    <div className={styles.skeleton} role="status" aria-busy="true">
      <span className="sr-only">Loading the lesson</span>
      <div className={styles.rail} aria-hidden="true">
        <span className={styles.bar} style={{ inlineSize: '9rem' }} />
        <span className={styles.bar} style={{ inlineSize: 'min(30rem, 40%)' }} />
      </div>
      <div className={styles.grid} aria-hidden="true">
        <div className={styles.text}>
          <span className={styles.eyebrow} />
          <span className={styles.title} />
          <span className={styles.line} />
          <span className={styles.line} style={{ inlineSize: '92%' }} />
          <span className={styles.line} style={{ inlineSize: '74%' }} />
          <span className={styles.task} />
        </div>
        <div className={styles.stage} />
      </div>
    </div>
  );
}

/** A curriculum lesson with no content file yet. Says so plainly and offers the way on. */
export function ComingSoon({ meta }: { meta: LessonMeta }) {
  useDocumentMeta({ title: meta.title, description: meta.summary });
  const track = trackById(meta.track);
  const prerequisites = meta.prerequisites
    .map((id) => lessonById(id))
    .filter((l): l is LessonMeta => Boolean(l));
  const labs = meta.labs.map((id) => labById(id)).filter((l): l is NonNullable<typeof l> => Boolean(l));
  return (
    <PlaceholderPage
      eyebrow="Being written"
      title={meta.title}
      summary={`${meta.summary} This lesson is still being written. It opens here as soon as it is published.`}
    >
      <p className={styles.facts}>
        <Chip tier={meta.track} size="sm">
          {track.name}
        </Chip>
        <span>{meta.module}</span>
        <span>{meta.minutes} min</span>
      </p>
      {prerequisites.length > 0 ? (
        <div className={styles.related}>
          <p className={styles.label}>Worth finishing first</p>
          <ul>
            {prerequisites.map((l) => (
              <li key={l.id}>
                <Link to={`/learn/${l.id}`}>
                  {l.title}
                  <Glyph name="arrow-right" size={14} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {labs.length > 0 ? (
        <div className={styles.related}>
          <p className={styles.label}>Labs it uses</p>
          <ul>
            {labs.map((l) => (
              <li key={l.id}>
                <Link to={`/labs/${l.id}`}>
                  {l.title}
                  <Glyph name="arrow-right" size={14} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </PlaceholderPage>
  );
}

/** The lesson file exists but could not be loaded or is malformed. Nothing is lost. */
export function LessonError({ message }: { message: string }) {
  useDocumentMeta({ title: 'Lesson problem', noindex: true });
  return (
    <PlaceholderPage
      eyebrow="Problem"
      title="This lesson could not be loaded"
      summary="The rest of the Academy still works and your progress is saved in this browser. Reloading usually fixes it."
    >
      <p className={styles.detail}>
        <code>{message}</code>
      </p>
      <div className={styles.actions}>
        <Button variant="primary" icon="refresh" onClick={() => window.location.reload()}>
          Reload the page
        </Button>
      </div>
    </PlaceholderPage>
  );
}
