import { lazy, Suspense } from 'react';
import { topicById } from '@/content/reference';
import { BodyFallback } from '../parts/BodyFallback';
import { TopicFrame } from '../TopicFrame';

const TOPIC = topicById('agents');

// The sections and the tool catalogue are a separate chunk. The frame is static, so the heading is on the
// page at once, which is where the shell puts focus after a navigation.
const AgentsBody = lazy(() => import('./agents/AgentsBody'));

/** /reference/agents: the two MCP servers, every tool, what each can spend and what to approve. */
export default function AgentsPage() {
  if (!TOPIC) return null;
  return (
    <TopicFrame topic={TOPIC}>
      <Suspense fallback={<BodyFallback />}>
        <AgentsBody />
      </Suspense>
    </TopicFrame>
  );
}
