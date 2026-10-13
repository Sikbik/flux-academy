import { SPEC_VERSION } from '@shared/flux';
import { anchor } from '@/content/reference';
import { num } from '@/content/reference/derive';
import { VERSION_HISTORY } from '@/content/reference/facts';
import { Chip } from '@/ui';
import { type Column, DataTable } from '../../parts/Facts';
import { CopyLink, Section } from '../../parts/Heading';
import { Md } from '../../parts/Prose';
import { ProvChips } from '../../parts/Prov';
import styles from './spec.module.css';

type Row = (typeof VERSION_HISTORY)[number];

export function Versions() {
  const columns: Column<Row>[] = [
    {
      id: 'version',
      label: 'Version',
      primary: true,
      mono: true,
      render: (v) => (
        <span className={styles.formCell}>
          {v.version}
          {v.version === SPEC_VERSION ? (
            <Chip size="sm" tone="accent">
              Current
            </Chip>
          ) : null}
          <CopyLink id={anchor.version(v.version)} label={`version ${v.version}`} />
        </span>
      ),
    },
    {
      id: 'from',
      label: 'Enforced from block',
      numeric: true,
      mono: true,
      render: (v) => (v.fromBlock === 0 ? 'the start' : num(v.fromBlock)),
    },
    { id: 'added', label: 'What it changed', render: (v) => <Md text={v.added} /> },
    { id: 'prov', label: 'Basis', bare: true, render: () => <ProvChips prov={['source']} /> },
  ];
  return (
    <Section id="versions">
      <DataTable
        caption="Spec versions, the block each was enforced from and what it added"
        columns={columns}
        rows={VERSION_HISTORY}
        rowId={(v) => anchor.version(v.version)}
      />
      <p className={styles.tableNote}>
        The network still accepts versions 1 to {SPEC_VERSION} so it can replay old apps. Only version{' '}
        {SPEC_VERSION} is accepted for a new app or for an update that changes the version.
      </p>
    </Section>
  );
}
