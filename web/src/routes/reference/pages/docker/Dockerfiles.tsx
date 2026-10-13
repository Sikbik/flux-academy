import { Link } from 'react-router';
import { anchor } from '@/content/reference';
import type { DockerfileNote } from '@/content/reference/docker';
import {
  buildCommonImages,
  buildDockerTrouble,
  buildStaticNotes,
  buildWebNotes,
} from '@/content/reference/docker';
import {
  DOCKER_SPEC_STATIC,
  DOCKER_SPEC_WEB,
  DOCKERFILE_STATIC,
  DOCKERFILE_WEB,
} from '@/content/reference/examples';
import { forgeShareLink } from '@/content/reference/tools';
import { CodeBlock } from '@/ui';
import { type Column, DataTable, Slab, TroubleList } from '../../parts/Facts';
import { CopyLink, Section } from '../../parts/Heading';
import { LintChips } from '../../parts/LintChip';
import { P } from '../../parts/Prose';
import { ProvChips } from '../../parts/Prov';
import { Ul } from '../../parts/Semantics';
import styles from './docker.module.css';

const IMAGES = buildCommonImages();

export function CommonImages() {
  const columns: Column<(typeof IMAGES)[number]>[] = [
    {
      id: 'label',
      label: 'Image',
      primary: true,
      mono: true,
      render: (c) => (
        <span className={styles.rowLink}>
          {c.label}
          <CopyLink id={anchor.commonImage(c.id)} label={c.label} />
        </span>
      ),
    },
    { id: 'kind', label: 'Kind', render: (c) => c.kind },
    { id: 'port', label: 'Default port', numeric: true, mono: true, render: (c) => c.port ?? 'varies' },
    {
      id: 'data',
      label: 'Data folder',
      mono: true,
      render: (c) =>
        c.dataPaths.length > 0 ? c.dataPaths.join(', ') : <span className={styles.dim}>none</span>,
    },
    { id: 'ram', label: 'Memory floor', numeric: true, mono: true, render: (c) => `${c.minRamMb} MB` },
    {
      id: 'state',
      label: 'State',
      render: (c) => (c.stateful ? (c.singleWriter ? 'Stateful, one writer' : 'Stateful') : 'Stateless'),
    },
  ];
  return (
    <Section id="common-images">
      <DataTable
        caption="Images the linter knows"
        columns={columns}
        rows={IMAGES}
        rowId={(c) => anchor.commonImage(c.id)}
      />
      <p className={styles.sectionNote}>
        These values are general container knowledge that the linter uses to spot a wrong port or a data
        folder without a volume. They are not claims about how Flux runs the image.
      </p>
    </Section>
  );
}

function Notes({ kind, notes }: { kind: 'web' | 'static'; notes: DockerfileNote[] }) {
  return (
    <Slab>
      <Ul className={styles.notes}>
        {notes.map((n) => {
          const id = anchor.dockerNote(kind, n.id);
          return (
            <li key={n.id} id={id} className={styles.note}>
              <div className={styles.noteHead}>
                <code className={styles.noteLines}>{n.lines}</code>
                <CopyLink id={id} label={n.lines} />
              </div>
              <P text={n.text} className={styles.noteText} />
              <ProvChips prov={n.prov} />
            </li>
          );
        })}
      </Ul>
    </Slab>
  );
}

export function Dockerfiles() {
  const web = DOCKER_SPEC_WEB.compose[0];
  const site = DOCKER_SPEC_STATIC.compose[0];
  return (
    <>
      <Section id="dockerfiles">
        <P text="Both patterns build in one stage and run in another, so the image that every node pulls holds the runtime and your files and nothing else. The image names in the specs are placeholders for your own." />
        <LintChips codes={['IMAGE_LATEST', 'BIND_LOCALHOST', 'IMAGE_MAYBE_HUGE']} label="They avoid" />
      </Section>

      <Section id="dockerfile-web-app">
        <div className={styles.twoUp}>
          <CodeBlock lang="dockerfile" filename="Dockerfile" code={DOCKERFILE_WEB} />
          <CodeBlock
            lang="json"
            filename="The component"
            code={JSON.stringify(web, null, 2)}
            caption={
              <Link to={forgeShareLink(DOCKER_SPEC_WEB)} className="link">
                Open the spec in Spec Forge
              </Link>
            }
          />
        </div>
        <Notes kind="web" notes={buildWebNotes()} />
      </Section>

      <Section id="dockerfile-static-site">
        <div className={styles.twoUp}>
          <CodeBlock lang="dockerfile" filename="Dockerfile" code={DOCKERFILE_STATIC} />
          <CodeBlock
            lang="json"
            filename="The component"
            code={JSON.stringify(site, null, 2)}
            caption={
              <Link to={forgeShareLink(DOCKER_SPEC_STATIC)} className="link">
                Open the spec in Spec Forge
              </Link>
            }
          />
        </div>
        <Notes kind="static" notes={buildStaticNotes()} />
      </Section>
    </>
  );
}

export function DockerTrouble() {
  return (
    <Section id="docker-trouble">
      <TroubleList section="docker-trouble" rows={buildDockerTrouble()} />
    </Section>
  );
}
