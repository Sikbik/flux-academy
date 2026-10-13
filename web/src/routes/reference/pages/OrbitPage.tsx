import { lazy, Suspense } from 'react';
import { topicById } from '@/content/reference';
import { BodyFallback } from '../parts/BodyFallback';
import { TopicFrame } from '../TopicFrame';

const TOPIC = topicById('orbit');

// The sections and the Orbit catalogue are a separate chunk. The frame is static, so the heading is on the
// page at once, which is where the shell puts focus after a navigation.
const OrbitBody = lazy(() => import('./orbit/OrbitBody'));

/** /reference/orbit: plans, the build pipeline, the variables and the Deploy to Flux link. */
export default function OrbitPage() {
  if (!TOPIC) return null;
  return (
    <TopicFrame topic={TOPIC}>
      <Suspense fallback={<BodyFallback />}>
        <OrbitBody />
      </Suspense>
    </TopicFrame>
  );
}
