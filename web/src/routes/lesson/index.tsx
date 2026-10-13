/**
 * `/learn/:lessonId`: the lesson player.
 *
 * This file is only the states around the player. Loading shows a skeleton shaped like the lesson, an id
 * that is not in the curriculum is the shell's not-found, a curriculum lesson with no content yet says so,
 * and a lesson that fails to load says what went wrong. Everything else is `Player`.
 *
 *   /learn/first-deploy                  resume (or start) the lesson
 *   /learn/first-deploy?step=spec        a deep link to a step or a checkpoint challenge
 *   /learn/first-deploy?view=article     the whole lesson as one page, with static stages
 */

import { useParams, useSearchParams } from 'react-router';
import { NotFoundView } from '@/app/NotFoundView';
import { useLesson } from '@/learn/loader';
import { ArticleView } from './ArticleView';
import { Player } from './Player';
import { PlayerProvider } from './PlayerContext';
import { ComingSoon, LessonError, LessonSkeleton } from './states';

export default function LessonRoute() {
  const { lessonId = '' } = useParams();
  const [search] = useSearchParams();
  const load = useLesson(lessonId);

  switch (load.status) {
    case 'loading':
      return <LessonSkeleton />;
    case 'missing':
      return load.reason === 'coming-soon' && load.meta ? (
        <ComingSoon meta={load.meta} />
      ) : (
        <NotFoundView
          title="That lesson does not exist"
          body="Check the address, or pick a lesson from the course map."
          documentTitle="Lesson not found"
        />
      );
    case 'error':
      return <LessonError message={load.message} />;
    case 'ready': {
      if (search.get('view') === 'article') {
        return <ArticleView lesson={load.lesson} meta={load.meta} fixture={load.fixture} />;
      }
      return (
        <PlayerProvider
          key={load.lesson.id}
          lesson={load.lesson}
          meta={load.meta}
          fixture={load.fixture}
          startId={search.get('step')}
        >
          <Player />
        </PlayerProvider>
      );
    }
  }
}
