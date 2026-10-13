import { BAKED_PRICING, BUNDLE_INSTANCES, LIMITS } from '@shared/flux';
import { useMemo, useState } from 'react';
import { anchor } from '@/content/reference';
import {
  bannedRangeOf,
  feePortsText,
  feePortUsd,
  feeRanges,
  money,
  perInstanceFee,
  rangeText,
  usd,
} from '@/content/reference/derive';
import {
  FEE_PORT_EXAMPLES,
  FREE_PORT_EXAMPLE,
  NETWORK_EXAMPLE,
  PORT_EXAMPLES,
} from '@/content/reference/examples';
import { FDM, FEE_PORT_NOTES } from '@/content/reference/facts';
import {
  buildBannedRows,
  buildPairingRows,
  buildPortFacts,
  checkContainerPort,
  checkPublicPort,
  nodeApiPorts,
} from '@/content/reference/networking';
import { type FeeEffectRow, feePortEffect } from '@/content/reference/tools';
import { Chip, StatusDot, TextField } from '@/ui';
import { type Column, DataTable, FactList, Slab } from '../../parts/Facts';
import { CopyLink, Section } from '../../parts/Heading';
import { LintChips } from '../../parts/LintChip';
import { KeyFact, Md, Note, P } from '../../parts/Prose';
import { ProvChips } from '../../parts/Prov';
import { Group, Ul } from '../../parts/Semantics';
import styles from './networking.module.css';

const BANNED = buildBannedRows();

export function Ports() {
  const P2 = LIMITS.ports;
  const node = nodeApiPorts();
  return (
    <>
      <Section id="ports">
        <KeyFact label="Two ports, one pair">
          <p>
            <code>ports[i]</code> is the public port on the node and <code>containerPorts[i]</code> is the
            port your process listens on. Public ports are {P2.min} to {P2.max}, minus a banned list, and{' '}
            {feePortsText()} are fee ports: each adds {usd(feePortUsd())} to the monthly bundle, which is
            divided by {BUNDLE_INSTANCES} and billed per instance. When the port you want is banned or costs
            money, keep it as the container port and publish a free one.
          </p>
        </KeyFact>
        <Ul className={styles.portTriad} aria-label="The three kinds of public port">
          <li className={styles.triad} data-kind="free">
            <StatusDot status="ok" />
            <span className={styles.triadTitle}>Free</span>
            <span className={styles.triadText}>
              Everything else, such as <code>{FREE_PORT_EXAMPLE}</code>.
            </span>
          </li>
          <li className={styles.triad} data-kind="fee">
            <StatusDot status="warn" />
            <span className={styles.triadTitle}>Fee port</span>
            <span className={styles.triadText}>
              {feePortsText()}, such as <code>{FEE_PORT_EXAMPLES.web}</code>. Adds {usd(feePortUsd())} to the
              bundle, {perInstanceFee(feePortUsd())}.
            </span>
          </li>
          <li className={styles.triad} data-kind="banned">
            <StatusDot status="crit" />
            <span className={styles.triadTitle}>Refused</span>
            <span className={styles.triadText}>
              {BANNED.length} entries. The network will not register the spec.
            </span>
          </li>
        </Ul>
      </Section>

      <Section id="public-and-container-ports">
        <FactList section="public-and-container-ports" rows={buildPortFacts()} />
      </Section>

      <Section id="fee-ports">
        <FeeTable />
        <FeeEffect />
        <UsageNote />
        <KeyFact label="How to avoid it">
          <p>
            Publish a port outside {feePortsText()} and map it to the container port you need, for example{' '}
            <code>ports: [{FREE_PORT_EXAMPLE}]</code> with{' '}
            <code>containerPorts: [{FEE_PORT_EXAMPLES.web}]</code>. Visitors never see the public port: the
            load balancer sends the request to it for them.
          </p>
        </KeyFact>
        <LintChips codes={['PORT_FEE']} label="Caught by" />
      </Section>

      <Section id="banned-ports">
        <BannedTable />
        <UsageNote />
        <P
          text={`The ${node.default} family (${node.text}) is what FluxOS itself listens on, which is why ${rangeText(bannedRangeOf(node.default) ?? { from: node.default, to: node.default })} is refused. Banned ports are refused as public ports only: a container port may be any number.`}
          className={styles.sectionNote}
        />
        <LintChips codes={['PORT_BANNED', 'PORT_RANGE']} label="Caught by" />
      </Section>

      <Section id="domains-and-ports">
        <PairingExample />
      </Section>

      <Section id="check-a-port">
        <PortChecker />
      </Section>
    </>
  );
}

/** The usage column is the convention for the port number, not a statement of the network. */
function UsageNote() {
  return (
    <Note>
      The last column is what the port number is conventionally used for. The network publishes the list and
      the price, not the reasons.
    </Note>
  );
}

function FeeTable() {
  const rows = useMemo(() => feeRanges(), []);
  const columns: Column<(typeof rows)[number]>[] = [
    { id: 'ports', label: 'Public ports', primary: true, mono: true, render: (r) => rangeText(r) },
    { id: 'fee', label: 'Added to the bundle', mono: true, render: () => usd(feePortUsd()) },
    { id: 'per', label: 'Per instance', render: () => perInstanceFee(feePortUsd()) },
    {
      id: 'note',
      label: 'Usually used for',
      render: (r) =>
        r.to === LIMITS.ports.privilegedBelow - 1
          ? `Every port below ${LIMITS.ports.privilegedBelow}, including ${FDM.httpPort} and ${FDM.httpsPort}.`
          : (FEE_PORT_NOTES[r.from] ?? 'On the fee list, and the sources give no reason.'),
    },
  ];
  return (
    <DataTable
      caption="Public ports that carry a fee"
      columns={columns}
      rows={rows}
      rowId={(r) => `fee-${r.from}`}
    />
  );
}

/** What one fee port really adds, from the engine: the fee goes into the bundle that is divided by three. */
function FeeEffect() {
  const rows = useMemo(() => feePortEffect(), []);
  const columns: Column<FeeEffectRow>[] = [
    { id: 'n', label: 'Instances', primary: true, numeric: true, render: (r) => r.instances },
    {
      id: 'free',
      label: `Port ${FREE_PORT_EXAMPLE}`,
      numeric: true,
      mono: true,
      render: (r) => money(r.free),
    },
    {
      id: 'fee',
      label: `Port ${FEE_PORT_EXAMPLES.web}`,
      numeric: true,
      mono: true,
      render: (r) => money(r.fee),
    },
    { id: 'added', label: 'The fee port adds', numeric: true, mono: true, render: (r) => money(r.added) },
  ];
  return (
    <>
      <DataTable
        caption="One month of the small example app on a free port and on a fee port, at the baked rates"
        columns={columns}
        rows={rows}
        rowId={(r) => `fee-effect-${r.instances}`}
      />
      <P
        text={`The extra is ${usd(feePortUsd())} only at ${BUNDLE_INSTANCES} instances. Below that the minimum price can hide it, and above that it keeps growing. Quoted at the rates read on ${BAKED_PRICING.capturedAt}.`}
        className={styles.sectionNote}
      />
    </>
  );
}

function BannedTable() {
  const columns: Column<(typeof BANNED)[number]>[] = [
    {
      id: 'ports',
      label: 'Ports',
      primary: true,
      mono: true,
      render: (r) => (
        <span className={styles.rowLink}>
          {r.text}
          {r.count > 1 ? <span className={styles.rangeCount}>{r.count} ports</span> : null}
          <CopyLink id={anchor.banned(r.range.from)} label={`banned port ${r.text}`} />
        </span>
      ),
    },
    {
      id: 'for',
      label: 'Usually used for',
      render: (r) => r.usedFor || 'No reason is given in the sources.',
    },
  ];
  return (
    <DataTable
      caption="Public ports the network refuses"
      columns={columns}
      rows={BANNED}
      rowId={(r) => anchor.banned(r.range.from)}
    />
  );
}

function PairingExample() {
  const rows = useMemo(() => buildPairingRows(NETWORK_EXAMPLE), []);
  const web = NETWORK_EXAMPLE.compose[0];
  const columns: Column<(typeof rows)[number]>[] = [
    { id: 'component', label: 'Component', primary: true, mono: true, render: (r) => r.component },
    { id: 'index', label: 'i', code: true, numeric: true, mono: true, render: (r) => r.index },
    { id: 'public', label: 'ports[i]', code: true, numeric: true, mono: true, render: (r) => r.publicPort },
    {
      id: 'container',
      label: 'containerPorts[i]',
      code: true,
      numeric: true,
      mono: true,
      render: (r) => r.containerPort,
    },
    {
      id: 'domains',
      label: 'domains[i]',
      code: true,
      mono: true,
      render: (r) => (r.domainEntry === '' ? <span className={styles.dim}>empty</span> : r.domainEntry),
    },
    {
      id: 'reach',
      label: 'Reached at',
      mono: true,
      render: (r) => (
        <span className={styles.stack}>
          {r.customDomains.map((d) => (
            <span key={d}>{d}</span>
          ))}
          <span>{r.generatedDomain}</span>
          {r.appDomain ? <span className={styles.dim}>{r.appDomain}</span> : null}
        </span>
      ),
    },
  ];
  return (
    <>
      <P
        text="The three lists are read by position. `domains[i]` is the custom domain for the public port `ports[i]`, and an empty string means that port has none. The lists must be the same length."
        className={styles.sectionNote}
      />
      {web ? (
        <Slab padded>
          <pre className={styles.snippet}>
            <code>{`"ports":          ${JSON.stringify(web.ports)},
"containerPorts": ${JSON.stringify(web.containerPorts)},
"domains":        ${JSON.stringify(web.domains)}`}</code>
          </pre>
        </Slab>
      ) : null}
      <DataTable
        caption="How ports, containerPorts and domains pair up in an example app"
        columns={columns}
        rows={rows}
        rowId={(r) => `pair-${r.component}-${r.index}`}
      />
      <LintChips
        codes={['PORT_LENGTH_MISMATCH', 'DOMAINS_LENGTH_MISMATCH', 'DOMAIN_FORMAT']}
        label="Caught by"
      />
    </>
  );
}

const STATUS = {
  free: 'ok',
  fee: 'warn',
  banned: 'crit',
  'out-of-range': 'crit',
  'not-integer': 'crit',
  empty: 'off',
} as const;
const STATUS_WORD = {
  free: 'Accepted, no fee',
  fee: 'Accepted, with a fee port',
  banned: 'Refused',
  'out-of-range': 'Refused',
  'not-integer': 'Refused',
  empty: 'Waiting',
} as const;

function PortChecker() {
  const [pub, setPub] = useState(String(FREE_PORT_EXAMPLE));
  const [cont, setCont] = useState(String(FEE_PORT_EXAMPLES.web));
  const pubCheck = useMemo(() => checkPublicPort(pub), [pub]);
  const contCheck = useMemo(() => checkContainerPort(cont), [cont]);
  const codes = [...pubCheck.lint, ...contCheck.lint];

  return (
    <div className={styles.tool}>
      <Group className={styles.toolRow} label="Example public ports">
        {PORT_EXAMPLES.map((p) => (
          <Chip
            key={p}
            kind="filter"
            size="sm"
            selected={pub === String(p)}
            onClick={() => setPub(String(p))}
          >
            {p}
          </Chip>
        ))}
      </Group>
      <div className={styles.toolGrid}>
        <TextField
          label="Public port"
          hint="ports[i]"
          mono
          inputMode="numeric"
          value={pub}
          onValueChange={setPub}
        />
        <TextField
          label="Container port"
          hint="containerPorts[i]"
          mono
          inputMode="numeric"
          value={cont}
          onValueChange={setCont}
        />
      </div>
      <Slab padded>
        <div className={styles.verdictBox} role="status">
          <p className={styles.verdictLine}>
            <StatusDot status={STATUS[pubCheck.status]} />
            <span>
              <strong>Public port: {STATUS_WORD[pubCheck.status]}.</strong> {pubCheck.summary}
            </span>
          </p>
          <p className={styles.verdictLine}>
            <StatusDot
              status={contCheck.status === 'ok' ? 'ok' : contCheck.status === 'invalid' ? 'crit' : 'off'}
            />
            <span>
              <strong>
                Container port:{' '}
                {contCheck.status === 'ok'
                  ? 'Accepted'
                  : contCheck.status === 'privileged'
                    ? 'Accepted, may need root on some images'
                    : contCheck.status === 'invalid'
                      ? 'Refused'
                      : 'Waiting'}
                .
              </strong>{' '}
              {contCheck.summary}
            </span>
          </p>
          {codes.length > 0 ? <LintChips codes={codes} label="The linter says" /> : null}
          <ProvChips prov={contCheck.status === 'privileged' ? ['source', 'unverified'] : ['source']} />
        </div>
      </Slab>
      <p className={styles.dim}>
        <Md text="This applies the same rules as the linter: the banned list, the fee list and the ranges are read from the engine." />
      </p>
    </div>
  );
}
