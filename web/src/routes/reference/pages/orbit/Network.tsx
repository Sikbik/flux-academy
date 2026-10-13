import { labById, lessonById } from '@shared/curriculum';
import { Link } from 'react-router';
import { anchor } from '@/content/reference';
import { num } from '@/content/reference/derive';
import {
  buildLimitFacts,
  buildMarkerRows,
  buildNetworkFacts,
  buildNotPublished,
  buildOrbitMcpText,
  buildSampleRows,
  type MarkerRow,
  ORBIT_LINKS,
  type SampleRow,
} from '@/content/reference/orbit';
import { Dated } from '../../parts/Dated';
import { type Column, DataTable, FactList } from '../../parts/Facts';
import { Section } from '../../parts/Heading';
import { Note, P } from '../../parts/Prose';
import { ProvChip } from '../../parts/Prov';
import { Ul } from '../../parts/Semantics';
import styles from './orbit.module.css';

const MARKER_COLUMNS: Column<MarkerRow>[] = [
  { id: 'field', label: 'Field', primary: true, mono: true, render: (r) => <code>{r.field}</code> },
  { id: 'value', label: 'Value', mono: true, render: (r) => <code>{r.value}</code> },
  {
    id: 'strength',
    label: 'Weight',
    render: (r) => (r.strength === 'defining' ? 'Defines an Orbit app' : 'Supporting'),
  },
  {
    id: 'seen',
    label: 'Seen on',
    numeric: true,
    render: (r) => <span className={styles.price}>{r.seen}</span>,
  },
  { id: 'basis', label: 'Basis', render: (r) => <ProvChip prov={r.basis} /> },
  { id: 'note', label: 'Note', render: (r) => r.note },
];

const SAMPLE_COLUMNS: Column<SampleRow>[] = [
  {
    id: 'value',
    label: 'Count',
    primary: true,
    numeric: true,
    render: (r) => <span className={styles.price}>{num(r.value)}</span>,
  },
  { id: 'what', label: 'What it counts', render: (r) => r.what },
  { id: 'readOn', label: 'Read on', mono: true, render: (r) => <time dateTime={r.readOn}>{r.readOn}</time> },
  { id: 'basis', label: 'Basis', render: (r) => <ProvChip prov={r.basis} /> },
];

const MARKERS = buildMarkerRows();
const SAMPLES = buildSampleRows();

/** How an Orbit app looks in the global specs: markers, then dated counts. */
export function OnTheNetwork() {
  const readOn = SAMPLES[0]?.readOn ?? '';
  return (
    <>
      <Section id="on-the-network">
        <FactList section="on-the-network" rows={buildNetworkFacts()} />
      </Section>

      <Section id="orbit-markers">
        <DataTable
          caption="Fields that identify an Orbit app in the global specs, and how many of the plain specs read showed each"
          columns={MARKER_COLUMNS}
          rows={MARKERS}
          rowId={(r) => anchor.marker(r.id)}
        />
        <Note>
          Only the image defines an Orbit app. The other markers are seen on most and prove nothing alone, and
          reading the component name as a signature is an inference.
        </Note>
      </Section>

      <Section id="orbit-samples">
        <Dated date={readOn}>
          Counts taken from the live network and baked in. They are samples, not current values: two reads
          minutes apart can differ by a few. Read on
        </Dated>
        <DataTable
          caption="Dated counts of the global specs and their locations"
          columns={SAMPLE_COLUMNS}
          rows={SAMPLES}
          rowId={(r) => anchor.sample(r.id)}
        />
      </Section>
    </>
  );
}

/** What Orbit does not do, what it includes and where the network ceilings apply. */
export function Limits() {
  return (
    <Section id="limits">
      <FactList section="limits" rows={buildLimitFacts()} />
    </Section>
  );
}

/** What the page and the docs leave unsaid. Each row is Unverified by definition. */
export function NotPublished() {
  return (
    <Section id="not-published">
      <FactList section="not-published" rows={buildNotPublished()} />
    </Section>
  );
}

/** The Orbit MCP server, in one paragraph, and where its tools are listed. */
export function OrbitMcp() {
  return (
    <Section id="orbit-mcp">
      <P text={buildOrbitMcpText()} />
      <Ul className={styles.related} aria-label="The Orbit MCP server">
        <li>
          <Link to="/reference/agents#tools-orbit" className={styles.relatedLink}>
            <span className={styles.relatedKind}>Reference</span>
            <span className={styles.relatedTitle}>The Orbit tool list</span>
            <span className={styles.relatedText}>
              Every tool, its group and what to show before the call.
            </span>
          </Link>
        </li>
        <li>
          <a href={ORBIT_LINKS.mcpGuide} className={styles.relatedLink} rel="noreferrer noopener">
            <span className={styles.relatedKind}>Vendor guide</span>
            <span className={styles.relatedTitle}>Orbit MCP server guide</span>
            <span className={styles.relatedText}>The page this reference was read from.</span>
          </a>
        </li>
      </Ul>
    </Section>
  );
}

interface RelatedLink {
  to: string;
  kind: string;
  title: string;
  text: string;
  external?: boolean;
}

function related(): RelatedLink[] {
  const out: RelatedLink[] = [];
  for (const id of ['deploy-from-git', 'env-and-secrets', 'agents-and-mcp']) {
    const l = lessonById(id);
    if (l) out.push({ to: `/learn/${l.id}`, kind: 'Lesson', title: l.title, text: l.summary });
  }
  const forge = labById('spec-forge');
  if (forge) out.push({ to: `/labs/${forge.id}`, kind: 'Lab', title: forge.title, text: forge.summary });
  out.push({
    to: '/troubleshoot',
    kind: 'Troubleshooter',
    title: 'Troubleshoot a deployment',
    text: 'Pick what you see and get the likely cause and the fix.',
  });
  out.push({
    to: '/reference/spec',
    kind: 'Reference',
    title: 'Application spec reference',
    text: 'Every field of the spec an Orbit app registers.',
  });
  out.push(
    {
      to: ORBIT_LINKS.page,
      kind: 'Vendor page',
      title: 'The Orbit product page',
      text: 'The plans, the sizes and the prices as the page publishes them.',
      external: true,
    },
    {
      to: ORBIT_LINKS.button,
      kind: 'Vendor page',
      title: 'The Deploy to Flux button page',
      text: 'The page that describes the link and what it fills in.',
      external: true,
    },
    {
      to: ORBIT_LINKS.docs,
      kind: 'Vendor docs',
      title: 'Deploy with Git, in the Flux docs',
      text: 'The documentation of the pipeline, the variables and the webhook.',
      external: true,
    },
  );
  return out;
}

const RELATED = related();

/** The lessons, the lab and the pages that go with this one. */
export function Related() {
  return (
    <Section id="related">
      <Ul className={styles.related} aria-label="Related lessons and tools">
        {RELATED.map((r) => (
          <li key={r.to}>
            {r.external ? (
              <a href={r.to} className={styles.relatedLink} rel="noreferrer noopener">
                <span className={styles.relatedKind}>{r.kind}</span>
                <span className={styles.relatedTitle}>{r.title}</span>
                <span className={styles.relatedText}>{r.text}</span>
              </a>
            ) : (
              <Link to={r.to} className={styles.relatedLink}>
                <span className={styles.relatedKind}>{r.kind}</span>
                <span className={styles.relatedTitle}>{r.title}</span>
                <span className={styles.relatedText}>{r.text}</span>
              </Link>
            )}
          </li>
        ))}
      </Ul>
    </Section>
  );
}
