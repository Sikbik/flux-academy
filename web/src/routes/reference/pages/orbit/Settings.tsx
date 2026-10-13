import {
  deployToFluxMarkdown,
  ORBIT_BUTTON_IMAGE,
  ORBIT_DEPLOY_BASE,
  ORBIT_PLANS,
  tryDeployToFluxUrl,
} from '@shared/flux';
import { useMemo, useState } from 'react';
import { anchor } from '@/content/reference';
import {
  type ButtonParam,
  buildButtonFacts,
  buildButtonParams,
  buildVariableFacts,
  buildVariableRows,
  buildWebhookFacts,
  ORBIT_READ_ON,
  VARIABLE_GROUPS,
  type VariableRow,
} from '@/content/reference/orbit';
import { Chip, CodeBlock, Glyph, SegmentedControl, TextField } from '@/ui';
import { Dated } from '../../parts/Dated';
import { type Column, DataTable, FactList } from '../../parts/Facts';
import { Section } from '../../parts/Heading';
import { Md, Note } from '../../parts/Prose';
import styles from './orbit.module.css';

const VARIABLES = buildVariableRows();
const PARAMS = buildButtonParams();

const VARIABLE_COLUMNS: Column<VariableRow>[] = [
  {
    id: 'name',
    label: 'Variable',
    primary: true,
    render: (r) => (
      <span className={styles.nameCell}>
        <code>{r.name}</code>
        {r.required ? (
          <Chip size="sm" kind="status" status="pending" icon="flag">
            Required
          </Chip>
        ) : null}
      </span>
    ),
  },
  { id: 'what', label: 'What it does', render: (r) => r.what },
  { id: 'example', label: 'Example', mono: true, render: (r) => <code>{r.example}</code> },
  {
    id: 'secret',
    label: 'Secret',
    render: (r) =>
      r.secret ? (
        <Chip size="sm" kind="status" status="warn" icon="lock">
          Secret
        </Chip>
      ) : (
        <span className={styles.dim}>No</span>
      ),
  },
  {
    id: 'seen',
    label: 'In live specs',
    render: (r) => <span className={styles.dim}>{r.seen ? 'Seen' : 'Not seen'}</span>,
  },
];

const PARAM_COLUMNS: Column<ButtonParam>[] = [
  { id: 'id', label: 'Parameter', primary: true, mono: true, render: (r) => <code>{r.id}</code> },
  {
    id: 'required',
    label: 'Required',
    render: (r) => (r.required ? 'Yes' : <span className={styles.dim}>No</span>),
  },
  { id: 'accepts', label: 'What it accepts', render: (r) => <Md text={r.accepts} /> },
  { id: 'rules', label: 'What the builder checks', render: (r) => <Md text={r.rules} /> },
  { id: 'example', label: 'Example', mono: true, render: (r) => <code>{r.example}</code> },
];

const TEMPLATE = [
  ORBIT_DEPLOY_BASE,
  '  ?repo=<https URL of the repository>',
  '  &branch=<branch>',
  '  &projectPath=<folder in the repository>',
  '  &plan=<starter, standard or pro>',
].join('\n');

const ANSWER = JSON.stringify(
  { status: 'success', message: 'Deployment queued', delivery_id: '<id>' },
  null,
  2,
);

/** Every variable the Orbit image reads, in groups, each a linkable row. */
export function Variables() {
  return (
    <Section id="build-variables">
      <Dated date={ORBIT_READ_ON}>
        Names, descriptions and examples come from the docs, and which names appear in plain specs was counted
        on
      </Dated>
      <FactList section="build-variables" rows={buildVariableFacts()} />
      {VARIABLE_GROUPS.map((g) => {
        const rows = VARIABLES.filter((v) => v.group === g.id);
        return (
          <div key={g.id} className={styles.block}>
            <p className={styles.groupLabel}>
              {g.label} <span className={styles.dim}>{rows.length}</span>
            </p>
            <DataTable
              caption={`${g.label} variables of the Orbit image`}
              columns={VARIABLE_COLUMNS}
              rows={rows}
              rowId={(r) => anchor.variable(r.name)}
            />
          </div>
        );
      })}
    </Section>
  );
}

/** What the Deploy to Flux link is. */
export function DeployButton() {
  return (
    <Section id="deploy-button">
      <FactList section="deploy-button" rows={buildButtonFacts()} />
    </Section>
  );
}

export function ButtonAnatomy() {
  return (
    <Section id="deploy-button-anatomy">
      <CodeBlock lang="text" filename="Link" code={TEMPLATE} wrap />
      <DataTable
        caption="The four parameters of the Deploy to Flux link"
        columns={PARAM_COLUMNS}
        rows={PARAMS}
        rowId={(r) => anchor.buttonParam(r.id)}
      />
    </Section>
  );
}

/** The value of the "Not set" segment: a radio value that is not a plan. */
const NO_PLAN = 'none';

function example(id: ButtonParam['id']): string {
  return PARAMS.find((p) => p.id === id)?.example ?? '';
}

/** A link builder over the engine's `tryDeployToFluxUrl`: what you type is what the engine accepts. */
export function ButtonBuilder() {
  const [repo, setRepo] = useState(() => example('repo'));
  const [branch, setBranch] = useState(() => example('branch'));
  const [path, setPath] = useState(() => example('projectPath'));
  const [plan, setPlan] = useState(() => example('plan'));

  const result = useMemo(() => {
    const options = {
      repo,
      ...(branch === '' ? {} : { branch }),
      ...(path === '' ? {} : { projectPath: path }),
      ...(plan === NO_PLAN ? {} : { plan }),
    };
    const built = tryDeployToFluxUrl(options);
    return built.ok ? { ...built, markdown: deployToFluxMarkdown(options) } : built;
  }, [repo, branch, path, plan]);

  const errorOf = (field: ButtonParam['id']): string | undefined =>
    !result.ok && result.field === field ? result.message : undefined;

  return (
    <Section id="deploy-button-builder">
      <div className={styles.builder}>
        <div className={styles.fields}>
          <TextField
            label="Repository"
            hint="A full https address. No credentials in it."
            mono
            value={repo}
            onValueChange={setRepo}
            error={errorOf('repo')}
            spellCheck={false}
            autoComplete="off"
          />
          <TextField
            label="Branch"
            hint="Optional."
            mono
            value={branch}
            onValueChange={setBranch}
            error={errorOf('branch')}
            spellCheck={false}
            autoComplete="off"
          />
          <TextField
            label="Project path"
            hint="Optional. A folder inside the repository."
            mono
            value={path}
            onValueChange={setPath}
            error={errorOf('projectPath')}
            spellCheck={false}
            autoComplete="off"
          />
          <div className={styles.control}>
            <span className={styles.controlLabel} aria-hidden="true">
              Plan
            </span>
            <SegmentedControl
              size="sm"
              aria-label="Plan parameter"
              value={plan}
              onValueChange={setPlan}
              options={[
                { value: NO_PLAN, label: 'Not set' },
                ...ORBIT_PLANS.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          </div>
        </div>

        <div className={styles.result}>
          {result.ok ? (
            <>
              <CodeBlock lang="text" filename="Link" code={result.url} wrap />
              <CodeBlock lang="text" filename="README badge" code={result.markdown} wrap />
              <p className={styles.resultNote}>
                The link opens the Orbit wizard with these fields filled in. It deploys nothing on its own.
                The badge image is <code>{ORBIT_BUTTON_IMAGE}</code>.
              </p>
            </>
          ) : (
            <p className={styles.resultError}>
              <Glyph name="warning" size={16} />
              <span>No link yet. Fix the field that shows a message and the link appears here.</span>
            </p>
          )}
          <Note>
            Built by <code>tryDeployToFluxUrl</code> in the Academy engine, so the link is exactly what the
            documented format asks for.
          </Note>
        </div>
      </div>
    </Section>
  );
}

/** How a push reaches the app, how it is checked and what the status endpoints answer. */
export function Webhooks() {
  return (
    <Section id="webhooks">
      <FactList section="webhooks" rows={buildWebhookFacts()} />
      <CodeBlock lang="json" filename="Answer to POST /webhook" code={ANSWER} />
    </Section>
  );
}
