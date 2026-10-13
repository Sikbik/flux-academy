import { derivedNames } from '@shared/flux';
import { useMemo } from 'react';
import { NETWORK_EXAMPLE } from '@/content/reference/examples';
import {
  buildGeneratedDomainFacts,
  buildInternalFacts,
  buildInternalRows,
  buildLinkFacts,
  buildPairingRows,
} from '@/content/reference/networking';
import { type Column, DataTable, FactList } from '../../parts/Facts';
import { Section } from '../../parts/Heading';
import { LintChips } from '../../parts/LintChip';
import { KeyFact, Note, P } from '../../parts/Prose';
import styles from './networking.module.css';

export function InternalDns() {
  const rows = useMemo(() => buildInternalRows(NETWORK_EXAMPLE), []);
  const names = useMemo(() => derivedNames(NETWORK_EXAMPLE), []);
  const columns: Column<(typeof rows)[number]>[] = [
    { id: 'component', label: 'Component', primary: true, mono: true, render: (r) => r.component },
    { id: 'name', label: 'Container name', mono: true, render: (r) => r.containerName },
    { id: 'host', label: 'Hostname inside', mono: true, render: (r) => r.hostname },
    {
      id: 'address',
      label: 'Another component dials',
      mono: true,
      render: (r) =>
        r.address ? (
          <>
            {r.address}
            {r.portSource === 'image' ? <span className={styles.dim}> (the image default)</span> : null}
          </>
        ) : (
          <span className={styles.dim}>the port the image listens on</span>
        ),
    },
    {
      id: 'published',
      label: 'Public',
      render: (r) => (r.published ? 'Yes' : 'No, private'),
    },
  ];
  return (
    <Section id="internal-dns">
      <KeyFact label="The names">
        <p>
          Components of one app share a private network called <code>{names.network}</code>. A component is
          reached by its container name, <code>flux&lt;component&gt;_&lt;app&gt;</code>, on the port it
          listens on, so the database of <code>{NETWORK_EXAMPLE.name}</code> is{' '}
          <code>{rows.find((r) => r.component === 'db')?.containerName ?? 'fluxdb_<app>'}</code>. Other apps
          cannot use these names, except an app of yours on the same node that you join with{' '}
          <code>networkWith</code>.
        </p>
      </KeyFact>
      <DataTable
        caption={`Names inside the app ${NETWORK_EXAMPLE.name}`}
        columns={columns}
        rows={rows}
        rowId={(r) => `internal-${r.component}`}
      />
      <Note>
        The database of this example uses a <code>g:</code> volume, so only the elected primary instance runs
        its <code>g:</code> component. The other components of the app keep running on every instance, and the
        load balancer sends all of the app&apos;s ports to the primary node (read from the source, not
        observed live). Read the example for the names, not as a recommended layout for a production database.
      </Note>
      <FactList section="internal-dns" rows={buildInternalFacts()} />
    </Section>
  );
}

export function GeneratedDomains() {
  const rows = useMemo(() => buildPairingRows(NETWORK_EXAMPLE), []);
  const columns: Column<(typeof rows)[number]>[] = [
    {
      id: 'public',
      label: 'ports[i]',
      code: true,
      primary: true,
      numeric: true,
      mono: true,
      render: (r) => r.publicPort,
    },
    { id: 'component', label: 'Component', mono: true, render: (r) => r.component },
    { id: 'domain', label: 'Generated domain', mono: true, render: (r) => r.generatedDomain },
    {
      id: 'app',
      label: 'Also reached at',
      mono: true,
      render: (r) => r.appDomain ?? <span className={styles.dim}>nothing else</span>,
    },
  ];
  return (
    <Section id="generated-domains">
      <FactList section="generated-domains" rows={buildGeneratedDomainFacts()} />
      <DataTable
        caption={`Generated domains of the example app ${NETWORK_EXAMPLE.name}`}
        columns={columns}
        rows={rows}
        rowId={(r) => `generated-${r.publicPort}`}
      />
      <P
        text="The address uses the public port, `ports[i]`, and never the container port. A component with no public port has no domain of its own."
        className={styles.sectionNote}
      />
    </Section>
  );
}

export function LinkingApps() {
  return (
    <Section id="linking-apps">
      <FactList section="linking-apps" rows={buildLinkFacts()} />
      <LintChips codes={['NETWORK_WITH_FORMAT']} label="Caught by" />
    </Section>
  );
}
