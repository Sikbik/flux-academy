import { topicById } from '@/content/reference';
import { WHOLE_SPEC_CODES } from '@/content/reference/spec';
import { TopicFrame } from '../TopicFrame';
import { AnnotatedSpec } from './spec/AnnotatedSpec';
import { ContainerData } from './spec/ContainerData';
import { Enterprise } from './spec/Enterprise';
import { Expire } from './spec/Expire';
import { FieldsSection } from './spec/Fields';
import { Geolocation } from './spec/Geolocation';
import { Glance } from './spec/Glance';
import { LintIndex } from './spec/LintIndex';
import { Pricing } from './spec/Pricing';
import { Validate } from './spec/Validate';
import { Versions } from './spec/Versions';

const TOPIC = topicById('spec');

/** /reference/spec: every field, limit and lint code of a version 8 spec. */
export default function SpecPage() {
  if (!TOPIC) return null;
  return (
    <TopicFrame topic={TOPIC}>
      <Glance />
      <AnnotatedSpec />
      <FieldsSection id="app-fields" scope="app" whole={WHOLE_SPEC_CODES} />
      <FieldsSection id="component-fields" scope="component" />
      <Geolocation />
      <ContainerData />
      <Enterprise />
      <Expire />
      <Pricing />
      <Validate />
      <Versions />
      <LintIndex />
    </TopicFrame>
  );
}
