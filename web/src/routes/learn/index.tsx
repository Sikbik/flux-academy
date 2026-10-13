import { LESSONS } from '@shared/curriculum';
import { useMemo, useState } from 'react';
import { computeRankInfo } from '@/app/useRank';
import { contentLessonIds } from '@/learn/loader';
import { recommendedLesson, useLearner } from '@/learn/store';
import { readItem, writeItem } from '@/lib/storage';
import { buildCourseModel, resumeTarget } from './model';
import styles from './Page.module.css';
import { Constellation } from './parts/Constellation';
import { Frame } from './parts/Frame';
import { Legend } from './parts/Legend';
import { ListView } from './parts/ListView';
import { PageHeader } from './parts/PageHeader';
import { SegmentedControl } from './ui';
import { useStepInfo } from './useStepInfo';

type View = 'map' | 'list';
const VIEW_KEY = 'flux-academy:v2:learn-view';

function readView(): View {
  return readItem(VIEW_KEY) === 'list' ? 'list' : 'map';
}

/**
 * The course map. Header: where you are and one button to go on. Then the constellation (or, as the
 * reading and keyboard route, the grouped list) of all the lessons with their states.
 */
export default function Learn() {
  const progress = useLearner((s) => s.lessons);
  const xp = useLearner((s) => s.xp);
  const [view, setView] = useState<View>(readView);

  const recommendedId = useMemo(() => recommendedLesson(progress), [progress]);
  const contentIds = useMemo(() => new Set(contentLessonIds()), []);

  // Lessons that are started and not finished need their size, for the ring through them.
  const startedKey = LESSONS.filter((l) => progress[l.id] && !progress[l.id]?.completedAt)
    .map((l) => l.id)
    .join('|');
  const started = useMemo(() => (startedKey ? startedKey.split('|') : []), [startedKey]);
  const steps = useStepInfo(started);

  const model = useMemo(
    () => buildCourseModel({ lessons: LESSONS, progress, recommendedId, steps, contentIds }),
    [progress, recommendedId, steps, contentIds],
  );
  const rank = useMemo(() => computeRankInfo(progress), [progress]);
  const target = useMemo(() => resumeTarget(model, progress), [model, progress]);
  const targetInfo = target ? steps[target.lessonId] : undefined;

  const choose = (next: string) => {
    const v: View = next === 'list' ? 'list' : 'map';
    setView(v);
    writeItem(VIEW_KEY, v);
  };

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <PageHeader model={model} rank={rank} xp={xp} target={target} targetInfo={targetInfo} />

        <section className={styles.stage} aria-labelledby="course-lessons">
          <div className={styles.toolbar}>
            <h2 className={styles.toolbarTitle} id="course-lessons">
              The lessons
            </h2>
            {view === 'map' ? <Legend /> : null}
            <SegmentedControl
              aria-label="How to show the lessons"
              size="sm"
              value={view}
              onValueChange={choose}
              options={[
                { value: 'map', label: 'Map', icon: 'route' },
                { value: 'list', label: 'List', icon: 'list' },
              ]}
            />
          </div>

          {view === 'map' ? (
            <Frame>
              <div className={styles.mapBody}>
                <Constellation model={model} />
              </div>
            </Frame>
          ) : (
            <ListView model={model} />
          )}
        </section>
      </div>
    </div>
  );
}
