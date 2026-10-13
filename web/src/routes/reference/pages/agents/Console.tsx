import { labById, lessonById } from '@shared/curriculum';
import { Link } from 'react-router';
import { anchor } from '@/content/reference';
import {
  AGENTS_LINKS,
  AGENTS_READ_ON,
  buildConsoleFacts,
  buildEstimateRows,
  buildGapNotes,
  buildGapRows,
  CONSOLE_NEVER,
  CONSOLE_TOOL_GROUPS,
  type ConsoleToolGroup,
  type EstimateRow,
  type GapRow,
} from '@/content/reference/agents';
import { money } from '@/content/reference/derive';
import { Glyph } from '@/ui';
import { Dated } from '../../parts/Dated';
import { type Column, DataTable, FactList } from '../../parts/Facts';
import { Section } from '../../parts/Heading';
import { KeyFact, Md, Note } from '../../parts/Prose';
import { ProvChips } from '../../parts/Prov';
import { Ul } from '../../parts/Semantics';
import styles from './agents.module.css';

const CONSOLE_COLUMNS: Column<ConsoleToolGroup>[] = [
  { id: 'label', label: 'What it can do', primary: true, render: (r) => r.label },
  {
    id: 'tools',
    label: 'Tools',
    render: (r) => (
      <ul className={styles.names}>
        {r.tools.map((t) => (
          <li key={t}>
            <code>{t}</code>
          </li>
        ))}
      </ul>
    ),
  },
  { id: 'what', label: 'What it does', render: (r) => r.what },
  {
    id: 'signed',
    label: 'Needs you signed in',
    render: (r) => (r.signedIn ? 'Yes' : <span className={styles.dim}>No</span>),
  },
];

const GAP_COLUMNS: Column<GapRow>[] = [
  { id: 'where', label: 'Where it says it', primary: true, render: (r) => <Md text={r.where} /> },
  { id: 'says', label: 'What it says', render: (r) => <Md text={r.says} /> },
  { id: 'shows', label: 'What the network shows', render: (r) => <Md text={r.shows} /> },
  { id: 'basis', label: 'Basis', render: (r) => <ProvChips prov={r.prov} /> },
];

const ESTIMATE_COLUMNS: Column<EstimateRow>[] = [
  { id: 'label', label: 'Size', primary: true, render: (r) => r.label },
  { id: 'size', label: 'Resources', render: (r) => r.size },
  { id: 'instances', label: 'Instances', numeric: true, render: (r) => r.instances },
  {
    id: 'estimator',
    label: 'flux_get_pricing prints',
    cardLabel: 'Estimator',
    numeric: true,
    render: (r) => <span className={styles.price}>{money(r.estimator)}</span>,
  },
  {
    id: 'network',
    label: 'Network quote',
    numeric: true,
    render: (r) => (
      <span className={styles.stack}>
        <span className={styles.price}>{money(r.network)}</span>
        <span className={styles.dim}>{Math.abs(r.estimator - r.network) < 0.005 ? 'Same' : 'Differs'}</span>
      </span>
    ),
  },
];

const GAPS = buildGapRows();
const ESTIMATES = buildEstimateRows();

/** The assistant inside the FluxCloud console: a separate thing from both MCP servers. */
export function ConsoleAssistant() {
  return (
    <Section id="console-assistant">
      <KeyFact label="Not an MCP server">
        <p>
          <Md text="The {{term:ai-assistant}} in the FluxCloud console does not connect to the tools above. It runs in the page, with your session, and it can only hand you a draft. It can never deploy, sign or pay." />
        </p>
      </KeyFact>
      <Dated date={AGENTS_READ_ON}>Read from the console front end that was served on</Dated>
      <DataTable
        caption="The tools of the FluxCloud console assistant, by what they let it do"
        columns={CONSOLE_COLUMNS}
        rows={[...CONSOLE_TOOL_GROUPS]}
        rowId={(r) => anchor.consoleTool(r.id)}
      />
      <div className={styles.block}>
        <p className={styles.blockTitle}>What it can never do</p>
        <Ul className={styles.never}>
          {CONSOLE_NEVER.map((n) => (
            <li key={n} className={styles.neverItem}>
              <Glyph name="cross" size={16} />
              <span>{n}</span>
            </li>
          ))}
        </Ul>
        <Note>
          There is no tool for any of these in the list the page sends the model, and the page runs no other
          name.
        </Note>
      </div>
      <FactList section="console-assistant" rows={buildConsoleFacts()} />
    </Section>
  );
}

/** Where a vendor guide, its estimator or some console copy disagrees with the network. */
export function KnownGaps() {
  return (
    <Section id="known-gaps">
      <Dated date={AGENTS_READ_ON}>These are the statements that disagree with the network, read on</Dated>
      <DataTable
        caption="Known gaps in the vendor guides, the price estimator and the console copy"
        columns={GAP_COLUMNS}
        rows={GAPS}
        rowId={(r) => anchor.gap(r.id)}
      />
      <div className={styles.block}>
        <p className={styles.blockTitle}>The pricing estimator against the network quote</p>
        <DataTable
          caption="The example sizes flux_get_pricing prints compared with the network quote for the same size"
          columns={ESTIMATE_COLUMNS}
          rows={ESTIMATES}
          rowId={(r) => `gap-estimate-${r.id}`}
        />
        <Note>
          <Md text={buildGapNotes()} />
        </Note>
      </div>
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
  for (const id of ['agents-and-mcp', 'ai-assisted-deploy']) {
    const l = lessonById(id);
    if (l) out.push({ to: `/learn/${l.id}`, kind: 'Lesson', title: l.title, text: l.summary });
  }
  const desk = labById('agent-desk');
  if (desk) out.push({ to: `/labs/${desk.id}`, kind: 'Lab', title: desk.title, text: desk.summary });
  out.push({
    to: '/reference/orbit',
    kind: 'Reference',
    title: 'Orbit and Git deploys reference',
    text: 'The product the Orbit MCP server works with: plans, variables and the Deploy to Flux link.',
  });
  out.push({
    to: '/troubleshoot',
    kind: 'Troubleshooter',
    title: 'Troubleshoot a deployment',
    text: 'Pick what you see and get the likely cause and the fix.',
  });
  out.push(
    {
      to: AGENTS_LINKS.hostedGuide,
      kind: 'Vendor docs',
      title: 'AI agents and MCP, in the Flux docs',
      text: 'The page the FluxCloud server is documented on.',
      external: true,
    },
    {
      to: AGENTS_LINKS.orbitGuide,
      kind: 'Vendor page',
      title: 'The Orbit MCP server guide',
      text: 'The page the Orbit server and its tool list were read from.',
      external: true,
    },
    {
      to: AGENTS_LINKS.npm,
      kind: 'Package',
      title: '@runonflux/flux-cloud-mcp on npm',
      text: 'The package the local FluxCloud server runs from, with its published versions.',
      external: true,
    },
    {
      to: AGENTS_LINKS.repository,
      kind: 'Source code',
      title: 'flux-cloud-mcp on GitHub',
      text: 'The repository of that package.',
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
