import { LIMITS, parseContainerData } from '@shared/flux';
import { useMemo, useState } from 'react';
import { anchor } from '@/content/reference';
import { CONTAINER_DATA_EXAMPLES } from '@/content/reference/examples';
import { buildMountForms, buildStorageGuarantees, buildStorageMechanics } from '@/content/reference/spec';
import { describeMount, guaranteeId } from '@/content/reference/tools';
import { Chip, StatusDot, TextField } from '@/ui';
import { type Column, DataTable, FactList, Slab } from '../../parts/Facts';
import { CopyLink, Section } from '../../parts/Heading';
import { KeyFact, Md } from '../../parts/Prose';
import { ProvChips } from '../../parts/Prov';
import { Group, Ul } from '../../parts/Semantics';
import styles from './spec.module.css';

const FORMS = buildMountForms();
const GUARANTEES = buildStorageGuarantees();
const MECHANICS = buildStorageMechanics();

/** `r`, `g` and `s` as code, with commas. */
function Codes({ items }: { items: readonly string[] }) {
  return (
    <>
      {items.map((item, i) => (
        <span key={item}>
          {i > 0 ? ', ' : ''}
          <code>{item}</code>
        </span>
      ))}
    </>
  );
}

export function ContainerData() {
  const L = LIMITS.containerData;
  return (
    <>
      <Section id="container-data">
        <KeyFact label="The shape">
          <p>
            A list of definitions separated by <code>|</code>, {L.minLength} to {L.maxLength} characters in
            all. The first is the <strong>primary mount</strong>: a path, optionally with one of the sync
            flags <Codes items={L.syncFlags} /> in front. The others add folders and files of the same volume
            with <Codes items={L.mountPrefixes} /> or reach into another component. When no data is wanted,
            write <code>/tmp</code>.
          </p>
        </KeyFact>
      </Section>

      <Section id="container-data-forms">
        <MountTable />
      </Section>

      <Section id="container-data-guarantees">
        <GuaranteeTable />
      </Section>

      <Section id="container-data-mechanics">
        <FactList
          section="container-data-mechanics"
          rows={MECHANICS.map((m) => ({ id: m.id, label: m.topic, text: m.fact, prov: m.prov }))}
          idOf={(row) => anchor.mechanic(row.id)}
        />
      </Section>

      <Section id="container-data-try">
        <MountTry />
      </Section>
    </>
  );
}

function MountTable() {
  const columns: Column<(typeof FORMS)[number]>[] = [
    {
      id: 'form',
      label: 'Form',
      primary: true,
      mono: true,
      render: (f) => (
        <span className={styles.formCell}>
          <code>{f.form}</code>
          <CopyLink id={anchor.mountForm(f.id)} label={f.form} />
        </span>
      ),
    },
    { id: 'example', label: 'Example', mono: true, render: (f) => <code>{f.example}</code> },
    {
      id: 'meaning',
      label: 'Meaning',
      render: (f) => (
        <>
          <p>
            <Md text={f.meaning} />
          </p>
          {f.note ? (
            <p className={styles.cellNote}>
              <Md text={f.note} />
            </p>
          ) : null}
        </>
      ),
    },
    {
      id: 'valid',
      label: 'The node parser',
      render: (f) => {
        const ok = parseContainerData(f.example).errors.length === 0;
        return (
          <span className={ok ? styles.ok : styles.warn}>
            <StatusDot status={ok ? 'ok' : 'crit'} />
            <span>{ok ? 'Accepts the example' : 'Refuses the example'}</span>
          </span>
        );
      },
    },
    { id: 'prov', label: 'Basis', bare: true, render: (f) => <ProvChips prov={f.prov} /> },
  ];
  return (
    <DataTable
      caption="Forms of a containerData definition"
      columns={columns}
      rows={FORMS}
      rowId={(f) => anchor.mountForm(f.id)}
    />
  );
}

function GuaranteeTable() {
  const columns: Column<(typeof GUARANTEES)[number]>[] = [
    {
      id: 'prefix',
      label: 'Prefix',
      primary: true,
      mono: true,
      render: (g) => (
        <span className={styles.formCell}>
          <code>{g.prefix}</code>
          <CopyLink id={anchor.storage(g.id)} label={`prefix ${g.prefix}`} />
        </span>
      ),
    },
    { id: 'lives', label: 'Where it lives', render: (g) => <Md text={g.lives} /> },
    { id: 'restart', label: 'Survives a restart', render: (g) => g.restart },
    { id: 'loss', label: 'Survives losing a node', render: (g) => <Md text={g.nodeLoss} /> },
    { id: 'consistency', label: 'Consistency', render: (g) => <Md text={g.consistency} /> },
    { id: 'prov', label: 'Basis', bare: true, render: (g) => <ProvChips prov={g.prov} /> },
  ];
  return (
    <DataTable
      caption="What each sync prefix of the primary mount guarantees"
      columns={columns}
      rows={GUARANTEES}
      rowId={(g) => anchor.storage(g.id)}
    />
  );
}

function MountTry() {
  const [value, setValue] = useState(CONTAINER_DATA_EXAMPLES[2]?.value ?? '/data');
  const parsed = useMemo(() => parseContainerData(value), [value]);
  const g = GUARANTEES.find((x) => x.id === guaranteeId(parsed));
  const ok = parsed.errors.length === 0;

  return (
    <div className={styles.tool}>
      <Group className={styles.toolRow} label="Example values">
        {CONTAINER_DATA_EXAMPLES.map((e) => (
          <Chip
            key={e.value}
            kind="filter"
            size="sm"
            selected={value === e.value}
            onClick={() => setValue(e.value)}
          >
            {e.label}
          </Chip>
        ))}
      </Group>
      <TextField
        label="containerData"
        hint={`Up to ${LIMITS.containerData.maxLength} characters.`}
        mono
        value={value}
        onValueChange={setValue}
        spellCheck={false}
      />
      <Slab padded>
        <div className={styles.verdict} role="status" data-ok={ok ? 'true' : 'false'}>
          <p className={styles.verdictHead}>
            <StatusDot status={ok ? 'ok' : 'crit'} />
            <span>
              {ok
                ? `The node parser accepts it: ${parsed.mounts.length} ${parsed.mounts.length === 1 ? 'mount' : 'mounts'}.`
                : 'The node parser would refuse it when it installs the component.'}
            </span>
          </p>
          {parsed.errors.length > 0 ? (
            <Ul className={styles.reasons}>
              {parsed.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </Ul>
          ) : null}
          {parsed.mounts.length > 0 ? (
            <ol className={styles.mountList}>
              {parsed.mounts.map((m, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: definitions may repeat, the order is the identity
                <li key={i}>
                  <code>{m.raw}</code>
                  <span>{describeMount(m)}</span>
                </li>
              ))}
            </ol>
          ) : null}
          {ok && g ? (
            <p className={styles.guaranteeLine}>
              Primary mount guarantee: <strong>{g.prefix === 'none' ? 'no sync prefix' : g.prefix}</strong>.{' '}
              {g.nodeLoss} <ProvChips prov={g.prov} />
            </p>
          ) : null}
        </div>
      </Slab>
    </div>
  );
}
