import { topicById } from '@/content/reference';
import { TopicFrame } from '../TopicFrame';
import { CustomDomains, LoadBalancing, NonHttp } from './networking/Domains';
import { Environment, NetworkingTrouble } from './networking/Env';
import { GeneratedDomains, InternalDns, LinkingApps } from './networking/Names';
import { Ports } from './networking/Ports';
import { RequestPath } from './networking/RequestPath';

const TOPIC = topicById('networking');

/** /reference/networking: from the browser to your process. */
export default function NetworkingPage() {
  if (!TOPIC) return null;
  return (
    <TopicFrame topic={TOPIC}>
      <RequestPath />
      <Ports />
      <InternalDns />
      <GeneratedDomains />
      <CustomDomains />
      <LoadBalancing />
      <NonHttp />
      <Environment />
      <LinkingApps />
      <NetworkingTrouble />
    </TopicFrame>
  );
}
