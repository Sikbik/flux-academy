import { useState } from 'react';
import {
  buildBindingFacts,
  buildEnvFacts,
  buildHealthFacts,
  buildLogFacts,
  buildStatelessFacts,
  buildUserFacts,
} from '@/content/reference/docker';
import { BIND_SNIPPETS } from '@/content/reference/examples';
import { CodeBlock, SegmentedControl } from '@/ui';
import { FactList } from '../../parts/Facts';
import { Section } from '../../parts/Heading';
import { LintChips } from '../../parts/LintChip';
import { KeyFact } from '../../parts/Prose';
import styles from './docker.module.css';

export function Binding() {
  const [runtime, setRuntime] = useState(BIND_SNIPPETS[0]?.runtime ?? '');
  const snippet = BIND_SNIPPETS.find((s) => s.runtime === runtime) ?? BIND_SNIPPETS[0];
  return (
    <Section id="binding">
      <KeyFact label="The one rule">
        <p>
          Listen on <code>0.0.0.0</code>, the address that means every interface. A process bound to{' '}
          <code>localhost</code> or <code>127.0.0.1</code> accepts nothing from outside its own container, and
          the symptom on Flux is a refused connection or an empty reply from a container that looks healthy.
        </p>
      </KeyFact>
      <div className={styles.bindBox}>
        <SegmentedControl
          size="sm"
          aria-label="Runtime"
          value={runtime}
          onValueChange={setRuntime}
          options={BIND_SNIPPETS.map((s) => ({ value: s.runtime, label: s.runtime }))}
        />
        {snippet ? (
          <CodeBlock lang={snippet.lang} filename={snippet.runtime} code={snippet.code} wrap />
        ) : null}
      </div>
      <FactList section="binding" rows={buildBindingFacts()} />
      <LintChips codes={['BIND_LOCALHOST', 'PORT_ENV_MISMATCH']} label="Caught by" />
    </Section>
  );
}

export function EnvironmentVariables() {
  return (
    <Section id="environment-variables">
      <FactList section="environment-variables" rows={buildEnvFacts()} />
      <LintChips
        codes={[
          'ENV_TOO_MANY',
          'ENV_TOO_LONG',
          'ENV_FORMAT',
          'ENV_WHITESPACE',
          'ENV_SECRET_PUBLIC',
          'ENV_RESERVED_NAME',
          'COMMANDS_TOO_MANY',
          'COMMAND_TOO_LONG',
          'COMMAND_UNSPLIT',
        ]}
        label="Caught by"
      />
    </Section>
  );
}

export function UsersAndPermissions() {
  return (
    <Section id="users-and-permissions">
      <FactList section="users-and-permissions" rows={buildUserFacts()} />
      <LintChips codes={['PORT_PRIVILEGED_CONTAINER', 'COMMAND_PRIVILEGED']} label="Caught by" />
    </Section>
  );
}

export function Logs() {
  return (
    <Section id="logs">
      <FactList section="logs" rows={buildLogFacts()} />
    </Section>
  );
}

export function Health() {
  return (
    <Section id="health">
      <FactList section="health" rows={buildHealthFacts()} />
      <LintChips codes={['HEALTH_NOT_CHECKED']} label="Caught by" />
    </Section>
  );
}

export function Stateless() {
  return (
    <Section id="stateless">
      <FactList section="stateless" rows={buildStatelessFacts()} />
      <LintChips
        codes={['STATEFUL_SINGLE_INSTANCE', 'STATEFUL_NO_VOLUME', 'STATEFUL_NOT_SYNCED']}
        label="Caught by"
      />
    </Section>
  );
}
