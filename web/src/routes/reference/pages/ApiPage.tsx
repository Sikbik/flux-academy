import { topicById } from '@/content/reference';
import { TopicFrame } from '../TopicFrame';
import { AcademyApi, BaseUrls, Calculator, Envelope, LeftOut, Limits, Misleading, TryIt } from './api/Api';
import { Endpoints } from './api/Endpoints';

const TOPIC = topicById('api');

/** /reference/api: the read-only endpoints, with real responses and copyable curl. */
export default function ApiPage() {
  if (!TOPIC) return null;
  return (
    <TopicFrame topic={TOPIC}>
      <BaseUrls />
      <Envelope />
      <Limits />
      <Endpoints />
      <Calculator />
      <Misleading />
      <LeftOut />
      <AcademyApi />
      <TryIt />
    </TopicFrame>
  );
}
