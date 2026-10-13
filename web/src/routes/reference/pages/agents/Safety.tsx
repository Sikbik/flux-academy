import { MCP_SERVERS, type McpServerId, toolsOf } from '@shared/flux';
import { anchor } from '@/content/reference';
import {
  buildConfirmFacts,
  buildConfirmSteps,
  buildHostedFacts,
  buildKeyFacts,
  buildKeyNeeds,
  buildPolicyRows,
  buildSpendFacts,
  type KeyNeedRow,
  type PolicyRow,
} from '@/content/reference/agents';
import { type Column, DataTable, FactList } from '../../parts/Facts';
import { Section } from '../../parts/Heading';
import { KeyFact, Md } from '../../parts/Prose';
import { Steps } from '../../parts/Steps';
import styles from './agents.module.css';

const SERVERS = ['flux-cloud', 'orbit'] as const satisfies readonly McpServerId[];
const TOTALS: Record<McpServerId, number> = {
  'flux-cloud': toolsOf('flux-cloud').length,
  orbit: toolsOf('orbit').length,
};

const KEY_COLUMNS: Column<KeyNeedRow>[] = [
  { id: 'name', label: 'Tool', primary: true, mono: true, render: (r) => <code>{r.name}</code> },
  {
    id: 'owner',
    label: 'Flux ID key',
    render: (r) => (r.owner ? 'Needed' : <span className={styles.dim}>Not needed</span>),
  },
  {
    id: 'payment',
    label: 'Payment key',
    render: (r) => (r.payment ? 'Needed' : <span className={styles.dim}>Not needed</span>),
  },
  { id: 'note', label: 'Note', render: (r) => r.note },
];

/** Tool names, grouped by server. A server whose every tool is listed reads "Every tool". */
function Names({ names }: { names: Record<McpServerId, string[]> }) {
  const present = SERVERS.filter((id) => names[id].length > 0);
  if (present.length === 0) return <span className={styles.dim}>None</span>;
  return (
    <span className={styles.stack}>
      {present.map((id) => (
        <span key={id} className={styles.serverLine}>
          <span className={styles.serverName}>{MCP_SERVERS[id].name}</span>
          {names[id].length === TOTALS[id] ? (
            <span>Every tool</span>
          ) : (
            <ul className={styles.names}>
              {names[id].map((n) => (
                <li key={n}>
                  <code>{n}</code>
                </li>
              ))}
            </ul>
          )}
        </span>
      ))}
    </span>
  );
}

const POLICY_COLUMNS: Column<PolicyRow>[] = [
  {
    id: 'policy',
    label: 'Policy',
    primary: true,
    render: (r) => (
      <span className={styles.stack}>
        <span>{r.label}</span>
        <span className={styles.dim}>
          <Md text={r.rule} />
        </span>
      </span>
    ),
  },
  { id: 'asks', label: 'Asks before', render: (r) => <Names names={r.asks} /> },
  {
    id: 'runs',
    label: 'Runs without asking, though not read only',
    cardLabel: 'Runs unasked',
    render: (r) => (r.advice ? <span className={styles.dim}>Only reads</span> : <Names names={r.runs} />),
  },
];

const POLICIES = buildPolicyRows();

/** The four steps of a deploy that spends, and who has to agree. */
export function PlanConfirm() {
  return (
    <Section id="plan-confirm">
      <Steps
        steps={buildConfirmSteps()}
        idOf={anchor.confirmStep}
        label="Plan, then confirm, in four steps"
      />
      <KeyFact label="confirm is not a person">
        <p>
          <Md text="On the FluxCloud server `confirm` is a flag the agent sets, which is what the {{term:confirm-gate}} is. The server cannot know whether anyone agreed. What stands between the agent and your FLUX is your client's tool approval and the balance of the payment address." />
        </p>
      </KeyFact>
      <FactList section="plan-confirm" rows={buildConfirmFacts()} />
    </Section>
  );
}

/** The two keys, what each is for and which tool needs which. */
export function KeyModel() {
  return (
    <Section id="key-model">
      <FactList section="key-model" rows={buildKeyFacts()} />
      <DataTable
        caption="Which key each FluxCloud tool needs"
        columns={KEY_COLUMNS}
        rows={buildKeyNeeds()}
        rowId={(r) => `key-need-${r.name}`}
      />
    </Section>
  );
}

/** What changes between your machine, the hosted server and a container you run. */
export function HostedOrLocal() {
  return (
    <Section id="hosted-or-local">
      <FactList section="hosted-or-local" rows={buildHostedFacts()} />
    </Section>
  );
}

/** What the tools that spend, cancel or control do to money and data. */
export function WhatSpends() {
  return (
    <Section id="what-spends">
      <FactList section="what-spends" rows={buildSpendFacts()} />
    </Section>
  );
}

/** What each approval policy asks about and what it lets through. */
export function Policies() {
  return (
    <Section id="policies">
      <DataTable
        caption="Approval policies: what each asks before and what it lets through"
        columns={POLICY_COLUMNS}
        rows={POLICIES}
        rowId={(r) => anchor.policy(r.id)}
      />
      <KeyFact label="The gap to know">
        <p>
          A client set to ask only before spending runs the tools that handle keys, change an app or delete
          data without a prompt, because they spend nothing by themselves. Setting a policy by what a tool
          costs is not the same as setting it by what a tool can destroy.
        </p>
      </KeyFact>
    </Section>
  );
}
