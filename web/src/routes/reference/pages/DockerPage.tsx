import { topicById } from '@/content/reference';
import { TopicFrame } from '../TopicFrame';
import { CommonImages, Dockerfiles, DockerTrouble } from './docker/Dockerfiles';
import { Architecture, ImageNames, Registries, SizeAndStartup } from './docker/Images';
import {
  Binding,
  EnvironmentVariables,
  Health,
  Logs,
  Stateless,
  UsersAndPermissions,
} from './docker/Runtime';

const TOPIC = topicById('docker');

/** /reference/docker: images that are small, safe and quick to start. */
export default function DockerPage() {
  if (!TOPIC) return null;
  return (
    <TopicFrame topic={TOPIC}>
      <ImageNames />
      <Architecture />
      <Registries />
      <SizeAndStartup />
      <Binding />
      <EnvironmentVariables />
      <UsersAndPermissions />
      <Logs />
      <Health />
      <Stateless />
      <CommonImages />
      <Dockerfiles />
      <DockerTrouble />
    </TopicFrame>
  );
}
