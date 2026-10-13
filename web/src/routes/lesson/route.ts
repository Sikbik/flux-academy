import type { RouteDef } from '@/app/routeTypes';

/**
 * The lesson player. It is an app-like page (a sticky stage, a bottom bar on phones), so it drops the
 * footer. `?view=article` renders the whole lesson as one readable page, `?step=<id>` deep-links a step.
 */
export default {
  path: '/learn/:lessonId',
  meta: { chrome: { footer: false } },
} satisfies RouteDef;
