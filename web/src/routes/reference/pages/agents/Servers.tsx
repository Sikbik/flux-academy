import { MCP_SERVERS } from '@shared/flux';
import { anchor } from '@/content/reference';
import {
  AGENTS_READ_ON,
  buildConfigSamples,
  buildConnectingFacts,
  buildConnectionRows,
  buildGlanceFacts,
  buildGlanceTiles,
  buildServerRows,
  type ConnectionRow,
  type ServerRow,
} from '@/content/reference/agents';
import { CodeBlock } from '@/ui';
import { Dated } from '../../parts/Dated';
import { type Column, DataTable, FactList } from '../../parts/Facts';
import { Section } from '../../parts/Heading';
import { Md } from '../../parts/Prose';
import { ProvChips } from '../../parts/Prov';
import { Tiles } from '../../parts/Tiles';
import styles from './agents.module.css';

const CLOUD = MCP_SERVERS['flux-cloud'];
const ORBIT = MCP_SERVERS.orbit;

const SERVER_COLUMNS: Column<ServerRow>[] = [
  { id: 'label', label: 'What', primary: true, render: (r) => r.label },
  { id: 'cloud', label: CLOUD.name, render: (r) => <Md text={r.cloud} /> },
  { id: 'orbit', label: ORBIT.name, render: (r) => <Md text={r.orbit} /> },
];

const CONNECTION_COLUMNS: Column<ConnectionRow>[] = [
  {
    id: 'label',
    label: 'Way',
    primary: true,
    render: (r) => (
      <span className={styles.serverLine}>
        <span className={styles.serverName}>{r.serverName}</span>
        <span>{r.label}</span>
      </span>
    ),
  },
  { id: 'how', label: 'How a client connects', render: (r) => r.how },
  { id: 'credentials', label: 'Where the credentials are during a call', render: (r) => r.credentials },
  { id: 'basis', label: 'Basis', render: (r) => <ProvChips prov={r.prov} /> },
];

const SERVER_ROWS = buildServerRows();
const CONNECTIONS = buildConnectionRows();
const SAMPLES = buildConfigSamples();

/** What an agent changes, with the tool counts of both servers. */
export function Glance() {
  return (
    <Section id="at-a-glance">
      <Dated date={AGENTS_READ_ON}>Both tool catalogues were read on</Dated>
      <FactList section="at-a-glance" rows={buildGlanceFacts()} />
      <Tiles tiles={buildGlanceTiles()} label="The two MCP servers at a glance" />
    </Section>
  );
}

/** The two servers side by side, then the ways to connect to them. */
export function Servers() {
  return (
    <>
      <Section id="servers">
        <DataTable
          caption="The FluxCloud MCP server and the Orbit MCP server compared"
          columns={SERVER_COLUMNS}
          rows={SERVER_ROWS}
          rowId={(r) => anchor.serverRow(r.id)}
        />
      </Section>

      <Section id="connecting">
        <DataTable
          caption="The ways to connect to each server, and where the credentials are while a call runs"
          columns={CONNECTION_COLUMNS}
          rows={CONNECTIONS}
          rowId={(r) => anchor.connection(r.id)}
        />
        <div className={styles.snippets}>
          {SAMPLES.map((s) => (
            <div key={s.id} className={styles.snippet}>
              <p className={styles.blockTitle}>{s.label}</p>
              <CodeBlock
                lang={s.lang}
                filename={s.filename}
                code={s.code}
                wrap
                label={`${s.label} connection`}
              />
              <p className={styles.snippetNote}>{s.note}</p>
              <ProvChips prov={s.prov} />
            </div>
          ))}
        </div>
        <FactList section="connecting" rows={buildConnectingFacts()} />
      </Section>
    </>
  );
}
