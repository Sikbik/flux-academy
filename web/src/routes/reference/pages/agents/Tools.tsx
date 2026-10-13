import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router';
import { fragmentId } from '@/content/reference';
import {
  AGENTS_READ_ON,
  buildArgRows,
  buildFluxCloudToolFacts,
  buildOrbitToolFacts,
  buildRiskFilters,
  buildToolEntries,
  RISK_STATUS,
  type RiskKey,
  riskKeyLabel,
  type ToolEntry,
} from '@/content/reference/agents';
import { Chip } from '@/ui';
import { useOpenSet } from '../../hooks';
import { Dated } from '../../parts/Dated';
import { DisclosureRow, ExpandAll } from '../../parts/Disclosure';
import { type Column, DataTable, FactList, Slab } from '../../parts/Facts';
import { Section } from '../../parts/Heading';
import { P } from '../../parts/Prose';
import { ProvChips } from '../../parts/Prov';
import { Group, Ul } from '../../parts/Semantics';
import styles from './agents.module.css';

const CLOUD = buildToolEntries('flux-cloud');
const ORBIT = buildToolEntries('orbit');
const ALL = [...CLOUD, ...ORBIT];
const FILTERS = buildRiskFilters();
const CLOUD_IDS = CLOUD.map((e) => e.anchor);

type Filter = RiskKey | 'all';

function RiskChip({ risk, word }: { risk: RiskKey; word: string }) {
  return (
    <Chip size="sm" kind="status" status={RISK_STATUS[risk]}>
      {word}
    </Chip>
  );
}

function Args({ entry }: { entry: ToolEntry }) {
  const args = buildArgRows(entry.tool);
  if (args.length === 0) {
    return <p className={styles.noArgs}>No arguments of its own.</p>;
  }
  return (
    <div>
      <p className={styles.label}>Arguments</p>
      <Ul className={styles.args}>
        {args.map((a) => (
          <li key={a.name} className={styles.arg}>
            <code className={styles.argName}>{a.name}</code>
            <span className={styles.argMeta}>
              {a.type}, {a.required ? 'required' : 'optional'}
            </span>
            <span className={styles.argText}>{a.note}</span>
          </li>
        ))}
      </Ul>
    </div>
  );
}

function ToolBody({ entry }: { entry: ToolEntry }) {
  const t = entry.tool;
  return (
    <>
      <div>
        <p className={styles.label}>Show the person before the call</p>
        <p className={styles.approval}>{entry.approval}</p>
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>Needs</dt>
          <dd>{entry.needs}</dd>
        </div>
        <div>
          <dt>Money</dt>
          <dd>{entry.spends}</dd>
        </div>
        <div>
          <dt>The academy recommends</dt>
          <dd>{entry.ask ? 'Ask before the call' : 'Let it run'}</dd>
        </div>
        {t.readsPrivateAppData ? (
          <div>
            <dt>Returns</dt>
            <dd>Data that is private to the app owner, and it goes to the model</dd>
          </div>
        ) : null}
        {entry.confirmArg ? (
          <div>
            <dt>confirm</dt>
            <dd>A flag the agent sets. It is not a prompt to a person.</dd>
          </div>
        ) : null}
      </dl>
      <Args entry={entry} />
      {t.watch ? (
        <p className={styles.watch}>
          <span className={styles.label}>Watch for </span>
          {t.watch}
        </p>
      ) : null}
      <ProvChips prov={entry.prov} />
    </>
  );
}

function ToolRow({
  entry,
  open,
  onOpenChange,
}: {
  entry: ToolEntry;
  open: boolean;
  onOpenChange: (id: string, open: boolean) => void;
}) {
  const t = entry.tool;
  return (
    <DisclosureRow
      id={entry.anchor}
      label={t.name}
      level={4}
      open={open}
      onOpenChange={onOpenChange}
      title={<span className={styles.toolName}>{t.name}</span>}
      meta={
        <>
          <RiskChip risk={entry.risk} word={entry.riskWord} />
          <span className={styles.spendNote}>{t.group}</span>
        </>
      }
      summary={<p className={styles.toolSummary}>{t.summary}</p>}
    >
      <ToolBody entry={entry} />
    </DisclosureRow>
  );
}

const ORBIT_COLUMNS: Column<ToolEntry>[] = [
  { id: 'name', label: 'Tool', primary: true, mono: true, render: (e) => <code>{e.tool.name}</code> },
  { id: 'group', label: 'Group', render: (e) => e.tool.group },
  {
    id: 'risk',
    label: 'Risk',
    render: (e) => (
      <span className={styles.stack}>
        <RiskChip risk={e.risk} word={e.riskWord} />
        <span className={styles.spendNote}>{e.spends}</span>
      </span>
    ),
  },
  { id: 'what', label: 'What it does', render: (e) => e.tool.summary },
  { id: 'approval', label: 'Show before the call', render: (e) => e.approval },
];

/** The risk filter and both tool lists. One state, so the filter applies to both. */
export function ToolCatalogue() {
  const [risk, setRisk] = useState<Filter>('all');
  const { hash } = useLocation();
  const { open, set, setAll } = useOpenSet(CLOUD_IDS);

  // A link to a tool the filter hides clears the filter, so the target is there to land on.
  useEffect(() => {
    const hit = ALL.find((e) => e.anchor === fragmentId(hash));
    if (hit) setRisk((cur) => (cur !== 'all' && cur !== hit.risk ? 'all' : cur));
  }, [hash]);

  const cloud = useMemo(() => (risk === 'all' ? CLOUD : CLOUD.filter((e) => e.risk === risk)), [risk]);
  const orbit = useMemo(() => (risk === 'all' ? ORBIT : ORBIT.filter((e) => e.risk === risk)), [risk]);
  const shown = cloud.length + orbit.length;
  const allOpen = cloud.length > 0 && cloud.every((e) => open.has(e.anchor));

  return (
    <>
      <Section id="tools">
        <Dated date={AGENTS_READ_ON}>
          The FluxCloud tools come from the hosted tool list and the package source, the Orbit tools from the
          vendor guide. Read on
        </Dated>
        <P text="Each tool is one {{term:tool-call}} an agent can make. The risk is the academy's reading of what the call can do to money and data. A tool the client shows no warning for can still be the one that deletes." />
        <Group label="Filter the tools by risk" className={styles.filters}>
          <Chip
            kind="filter"
            size="sm"
            selected={risk === 'all'}
            onClick={() => setRisk('all')}
            count={ALL.length}
          >
            All
          </Chip>
          {FILTERS.map((f) => (
            <Chip
              key={f.key}
              kind="filter"
              size="sm"
              selected={risk === f.key}
              onClick={() => setRisk(risk === f.key ? 'all' : f.key)}
              count={f.count}
            >
              {f.label}
            </Chip>
          ))}
        </Group>
        <p className={styles.filterStatus} role="status">
          Showing {shown} of {ALL.length} tools
          {risk === 'all' ? '' : `: ${riskKeyLabel(risk)}`}.
        </p>
        <dl className={styles.legend} aria-label="What each risk word means">
          {FILTERS.map((f) => (
            <div key={f.key} className={styles.legendRow}>
              <dt>
                <RiskChip risk={f.key} word={f.label} />
              </dt>
              <dd>{f.meaning}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section
        id="tools-flux-cloud"
        actions={<ExpandAll allOpen={allOpen} onChange={setAll} count={cloud.length} />}
      >
        {cloud.length > 0 ? (
          <Slab>
            <div className={styles.rows}>
              {cloud.map((e) => (
                <ToolRow key={e.anchor} entry={e} open={open.has(e.anchor)} onOpenChange={set} />
              ))}
            </div>
          </Slab>
        ) : (
          <p className={styles.noArgs}>No FluxCloud tool has this risk.</p>
        )}
        <FactList section="tools-flux-cloud" rows={buildFluxCloudToolFacts()} />
      </Section>

      <Section id="tools-orbit">
        {orbit.length > 0 ? (
          <DataTable
            caption="The tools of the Orbit MCP server: group, risk, purpose and the sentence to show before the call"
            columns={ORBIT_COLUMNS}
            rows={orbit}
            rowId={(e) => e.anchor}
          />
        ) : (
          <p className={styles.noArgs}>No Orbit tool has this risk.</p>
        )}
        <FactList section="tools-orbit" rows={buildOrbitToolFacts()} />
      </Section>
    </>
  );
}
