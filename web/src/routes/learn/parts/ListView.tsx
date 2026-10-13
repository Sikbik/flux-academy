import { TRACKS } from '@shared/curriculum';
import { Link } from 'react-router';
import { moduleArt } from '@/content/art';
import { prefetchLesson } from '@/learn/loader';
import { type CourseModel, KIND_LABEL, type MapLesson, modulesOfTrack, shortDate } from '../model';
import { Chip, Glyph, type GlyphName, Panel, Progress } from '../ui';
import { Art } from './Art';
import { BandHeader } from './BandHeader';
import { plural } from './geometry';
import styles from './ListView.module.css';

const KIND_GLYPH: Record<MapLesson['meta']['kind'], GlyphName> = {
  concept: 'kind-concept',
  'hands-on': 'kind-hands-on',
  project: 'kind-project',
};

function StatusChip({ lesson }: { lesson: MapLesson }) {
  if (lesson.status === 'complete') {
    return (
      <Chip kind="status" status="ok" size="sm">
        Done
      </Chip>
    );
  }
  if (lesson.status === 'in-progress') {
    return (
      <Chip kind="status" status="pending" size="sm">
        In progress
      </Chip>
    );
  }
  if (!lesson.hasContent) {
    return (
      <Chip kind="status" status="warn" size="sm">
        Coming soon
      </Chip>
    );
  }
  if (lesson.recommended) {
    return (
      <Chip tone="accent" icon="arrow-right" size="sm">
        Next
      </Chip>
    );
  }
  return (
    <Chip size="sm" icon="status-off">
      Not started
    </Chip>
  );
}

function LessonRow({ lesson, model }: { lesson: MapLesson; model: CourseModel }) {
  const { meta } = lesson;
  const helps = meta.prerequisites.map((id) => model.byId.get(id)).filter((l): l is MapLesson => Boolean(l));
  const when = shortDate(lesson.completedAt);
  return (
    <Panel
      as={Link}
      to={`/learn/${meta.id}`}
      variant="slab"
      size="sm"
      padding="md"
      pattern="br"
      marks={false}
      halo={false}
      interactive
      data-tier={meta.track}
      data-status={lesson.status}
      data-next={lesson.recommended ? 'true' : undefined}
      className={styles.row}
      contentClassName={styles.rowBody}
      onPointerEnter={() => prefetchLesson(meta.id)}
      onFocus={() => prefetchLesson(meta.id)}
    >
      <span className={styles.badge} aria-hidden="true">
        {lesson.status === 'complete' ? <Glyph name="check" size={18} strokeWidth={2.2} /> : meta.order}
      </span>

      <span className={styles.main}>
        <span className={styles.title}>
          <span className="sr-only">Lesson {meta.order}: </span>
          {meta.title}
        </span>
        <span className={styles.summary}>{meta.summary}</span>
        {helps.length > 0 ? (
          <span className={styles.helps}>
            <span className={styles.helpsK}>Helps first</span>
            {helps.map((h) => (
              <span
                key={h.meta.id}
                className={styles.help}
                data-done={h.status === 'complete' ? 'true' : 'false'}
              >
                <Glyph name={h.status === 'complete' ? 'check' : 'status-off'} size={12} />
                {h.meta.title}
                <span className="sr-only">{h.status === 'complete' ? ', done' : ', not done yet'}</span>
              </span>
            ))}
          </span>
        ) : null}
      </span>

      <span className={styles.meta}>
        <span className={styles.kind}>
          <Glyph name={KIND_GLYPH[meta.kind]} size={15} />
          {KIND_LABEL[meta.kind]}
        </span>
        <span className={styles.min}>{meta.minutes} min</span>
      </span>

      <span className={styles.status}>
        <StatusChip lesson={lesson} />
        {lesson.status === 'in-progress' ? (
          <span className={styles.bar}>
            <Progress
              label="Progress through this lesson"
              value={lesson.fraction}
              valueText={
                lesson.stepNumber !== null && lesson.stepCount !== null
                  ? `Step ${lesson.stepNumber} of ${lesson.stepCount}`
                  : 'In progress'
              }
              showLabel={false}
              showValue={lesson.stepNumber !== null}
              size="sm"
              tier={meta.track}
            />
          </span>
        ) : null}
        {lesson.status === 'complete' && when ? <span className={styles.when}>{when}</span> : null}
      </span>

      <Glyph name="arrow-right" size={18} className={styles.arrow} />
    </Panel>
  );
}

/**
 * The list view: the same lessons, in the same states, grouped by track and module. It is the reading and
 * keyboard route through the course: one link per lesson, in recommended order, with the words for every
 * state spelled out.
 */
export function ListView({ model }: { model: CourseModel }) {
  return (
    <div className={styles.list}>
      {TRACKS.map((track, ti) => {
        const lessons = model.lessons.filter((l) => l.meta.track === track.id);
        const groups = modulesOfTrack(lessons, track.id);
        return (
          <section
            key={track.id}
            className={styles.track}
            data-tier={track.id}
            aria-labelledby={`list-${track.id}`}
          >
            <BandHeader
              track={track}
              index={ti}
              lessons={lessons}
              modules={[]}
              selectedModule={null}
              onModulePreview={() => {}}
              onModuleToggle={() => {}}
              variant="row"
              headingId={`list-${track.id}`}
              className={styles.trackHead}
            />
            <div className={styles.modules}>
              {groups.map((g) => {
                const art = moduleArt(g.module);
                const minutes = g.items.reduce((s, l) => s + l.meta.minutes, 0);
                const done = g.items.filter((l) => l.status === 'complete').length;
                return (
                  <div key={g.module} className={styles.module}>
                    <div className={styles.moduleHead}>
                      {art ? <Art id={art} size={76} className={styles.moduleArt} /> : null}
                      <h3 className={styles.moduleName}>{g.module}</h3>
                      <p className={styles.moduleMeta}>
                        {plural(g.items.length, 'lesson', 'lessons')}, {minutes} min
                        <br />
                        {done} done
                      </p>
                    </div>
                    <ol className={styles.rows}>
                      {g.items.map((l) => (
                        <li key={l.meta.id}>
                          <LessonRow lesson={l} model={model} />
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
