import { LIMITS } from '@shared/flux';
import { useMemo, useState } from 'react';
import {
  buildArchitectureFacts,
  buildImageNameFacts,
  buildRegistryFacts,
  buildSizeFacts,
  buildTagFacts,
  imageFindings,
} from '@/content/reference/docker';
import { IMAGE_EXAMPLES } from '@/content/reference/examples';
import { Chip, StatusDot, TextField } from '@/ui';
import { FactList, Slab } from '../../parts/Facts';
import { Section } from '../../parts/Heading';
import { LintChips } from '../../parts/LintChip';
import { KeyFact } from '../../parts/Prose';
import { ProvChips } from '../../parts/Prov';
import { Group, Ul } from '../../parts/Semantics';
import styles from './docker.module.css';

export function ImageNames() {
  return (
    <>
      <Section id="image-names">
        <FactList section="image-names" rows={buildImageNameFacts()} />
        <LintChips
          codes={[
            'REPOTAG_EMPTY',
            'REPOTAG_FORMAT',
            'REPOTAG_TOO_LONG',
            'IMAGE_UNTAGGED',
            'IMAGE_DOCKER_IO_HOST',
            'IMAGE_UPPERCASE',
            'IMAGE_IMPLICIT_REGISTRY',
          ]}
          label="Caught by"
        />
      </Section>
      <Section id="pin-tags">
        <KeyFact label="Pin the tag">
          <p>
            Nodes look for a newer image behind the tag you gave. With <code>latest</code>, or any tag you
            move, an app can change under you without you touching the spec. A tag you never move keeps the
            same bytes on every node.
          </p>
        </KeyFact>
        <FactList section="pin-tags" rows={buildTagFacts()} />
        <LintChips codes={['IMAGE_LATEST', 'IMAGE_UNTAGGED']} label="Caught by" />
      </Section>
      <Section id="try-an-image">
        <ImageTry />
      </Section>
    </>
  );
}

function Part({ label, value }: { label: string; value: string | null }) {
  return (
    <div className={styles.part}>
      <dt>{label}</dt>
      <dd data-empty={value === null ? 'true' : undefined}>{value ?? 'none'}</dd>
    </div>
  );
}

function ImageTry() {
  const [value, setValue] = useState(IMAGE_EXAMPLES[0] ?? 'nginx:1.27-alpine');
  const found = useMemo(() => imageFindings(value), [value]);
  const p = found.parsed;
  const ok = p.problems.length === 0;
  return (
    <div className={styles.tool}>
      <Group className={styles.toolRow} label="Example image names">
        {IMAGE_EXAMPLES.map((e) => (
          <Chip key={e} kind="filter" size="sm" selected={value === e} onClick={() => setValue(e)}>
            {e.length > 28 ? `${e.slice(0, 26)}...` : e}
          </Chip>
        ))}
      </Group>
      <TextField
        label="repotag"
        hint={`Up to ${LIMITS.repotag.maxLength} characters.`}
        mono
        value={value}
        onValueChange={setValue}
        spellCheck={false}
      />
      <Slab padded>
        <div className={styles.verdictBox} role="status">
          <p className={styles.verdictLine}>
            <StatusDot status={ok ? 'ok' : 'crit'} />
            <span>{ok ? 'The engine reads it as:' : 'The engine cannot read it as an image name:'}</span>
          </p>
          <dl className={styles.parts}>
            <Part label="Host" value={p.registry ?? (ok ? 'Docker Hub (implied)' : null)} />
            <Part label="Namespace" value={p.namespace ?? (ok ? 'library (official image)' : null)} />
            <Part label="Repository" value={p.repository || null} />
            <Part label="Tag" value={p.tag ?? (ok && !p.digest ? 'none, so latest' : null)} />
            <Part label="Digest" value={p.digest} />
          </dl>
          {p.problems.length > 0 ? (
            <Ul className={styles.problems}>
              {p.problems.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </Ul>
          ) : null}
          {found.codes.length > 0 ? (
            <LintChips codes={found.codes} label="The linter says" />
          ) : ok ? (
            <p className={styles.fine}>The linter has no complaint about this name.</p>
          ) : null}
          <ProvChips prov={['source', 'inference']} />
        </div>
      </Slab>
    </div>
  );
}

export function Architecture() {
  return (
    <Section id="architecture">
      <FactList section="architecture" rows={buildArchitectureFacts()} />
      <LintChips codes={['ENTERPRISE_AMD64']} label="Caught by" />
    </Section>
  );
}

export function Registries() {
  return (
    <Section id="registries">
      <FactList section="registries" rows={buildRegistryFacts()} />
      <LintChips
        codes={['REPOAUTH_NEEDS_ENTERPRISE', 'REPOAUTH_FORMAT', 'REPOAUTH_TOO_LONG']}
        label="Caught by"
      />
    </Section>
  );
}

export function SizeAndStartup() {
  return (
    <Section id="size-and-startup">
      <FactList section="size-and-startup" rows={buildSizeFacts()} />
      <LintChips codes={['IMAGE_MAYBE_HUGE', 'RAM_TOO_SMALL_FOR_IMAGE']} label="Caught by" />
    </Section>
  );
}
