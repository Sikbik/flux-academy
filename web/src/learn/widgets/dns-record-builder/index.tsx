/**
 * Widget `dns-record-builder` (docs/CONTENT.md section 5): build the DNS record that points a custom domain
 * at a Flux app, and see what a resolver would answer. The rules are in `dns.ts` (pure, tested).
 *
 * Props (`stage.props`), two shapes accepted:
 *   case      { domain: string; kind: 'subdomain' | 'apex'; provider?: 'cloudflare' | 'namecheap' | 'generic' }
 *             or the string 'subdomain' | 'apex' with `domain` beside it (the form the lessons use)
 *   appName   the Flux app name (also accepted as `app`). Default `lanternshop`.
 *   domain, kind, provider   top-level spellings of the same three fields.
 * With no props it builds the record for shop.example.com at a provider of the learner's choice.
 *
 * Emits `widget-done` when the record is correct for the case. Registers a solver ("Show me") that fills in
 * a correct record for the provider in use. Everything is a simulation: no DNS provider and no resolver is
 * contacted, and every address is from a documentation range.
 *
 * The second half of the job, the spec's `domains` entry, is shown below the record with the real grammar
 * (FACTS 3.3, 6.4): `domains[i]` belongs to `ports[i]`.
 */
import { defaultComponent, defaultSpec, derivedNames, lintSpec } from '@shared/flux';
import { Fragment, type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { WidgetComponent } from '@/learn/stage-api';
import {
  Chip,
  CodeBlock,
  FreshnessChip,
  Glyph,
  Panel,
  SegmentedControl,
  Select,
  Switch,
  TextField,
} from '@/ui';
import styles from './DnsRecordBuilder.module.css';
import {
  AUTO_TTL,
  appDomainOf,
  DEMO_PORTS,
  type DnsCase,
  type DnsIssue,
  type Draft,
  domainsFor,
  type Evaluation,
  emptyDraft,
  evaluate,
  freeAddressChain,
  type Hop,
  type Outcome,
  PROVIDERS,
  type Provider,
  type RecordType,
  readCase,
  solutionFor,
  TTL_CHOICES,
} from './dns';

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

const OUTCOME_TEXT: Record<Outcome, string> = {
  empty: 'Fill in the record to see what a resolver would answer.',
  flux: "A resolver follows the chain to Flux's load balancer, which serves the app.",
  'flux-proxied':
    "A resolver gets the provider's addresses. The proxy forwards each request to your target, which leads to Flux.",
  elsewhere: "The answer leads to a server that is not Flux's, so visitors would not reach your app.",
  nxdomain:
    'A name in the chain is not your app. In this simulation a resolver reports NXDOMAIN and the browser shows an error.',
  'no-answer': 'The name exists but has no address record, so there is nothing for a browser to connect to.',
  refused: 'Your provider would not save this record, so nothing changes in DNS.',
};

const OWNER_WORD: Record<Hop['owner'], string> = {
  you: 'Your record',
  provider: 'Provider',
  flux: 'Flux',
  dns: 'DNS',
};

/** A host name with a line-break opportunity after each dot, so a narrow cell breaks between labels. */
function hostBreaks(host: string): ReactNode {
  const parts = host.split('.');
  return parts.map((part, i) => {
    const key = `${i}-${part}`;
    return i < parts.length - 1 ? (
      <Fragment key={key}>
        {part}.<wbr />
      </Fragment>
    ) : (
      <Fragment key={key}>{part}</Fragment>
    );
  });
}

/** How long the record must sit unchanged before a wrong record counts as an attempt. */
const ATTEMPT_PAUSE_MS = 1200;

function ttlLabel(ttl: number): string {
  return `${ttl}`;
}

/** A dig style answer line, column spaced. */
function digLine(h: Hop): string {
  if (h.type === 'NXDOMAIN' || h.type === 'NODATA') return `${h.name}.  ${h.type}`;
  return `${h.name}.  ${ttlLabel(h.ttl)}  IN  ${h.type}  ${h.data}${h.type === 'CNAME' ? '.' : ''}`;
}

function Chain({ hops, label }: { hops: Hop[]; label: string }) {
  return (
    <ol className={styles.chain} aria-label={label}>
      {hops.map((h) => (
        <li key={`${h.name}|${h.type}|${h.data}`} className={styles.hop} data-ok={h.ok ? 'true' : 'false'}>
          <span className={styles.hopMark} aria-hidden="true">
            <Glyph name={h.ok ? 'check' : 'cross'} size={14} />
          </span>
          <div className={styles.hopBody}>
            <div className={styles.hopHead}>
              <span className={styles.owner} data-owner={h.owner}>
                {OWNER_WORD[h.owner]}
              </span>
              {!h.ok ? <span className="sr-only">This link fails. </span> : null}
            </div>
            <code className={styles.dig}>{digLine(h)}</code>
            {h.note ? <span className={styles.hopNote}>{h.note}</span> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function IssueList({ issues }: { issues: DnsIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className={styles.issues}>
      {issues.map((i) => (
        <li key={i.code} className={styles.issue} data-severity={i.severity}>
          <Glyph
            name={i.severity === 'error' ? 'status-crit' : i.severity === 'warning' ? 'status-warn' : 'info'}
            size={16}
          />
          <span>
            {i.inference ? <span className={styles.inference}>Inference</span> : null}
            <span className="sr-only">
              {i.severity === 'error' ? 'Problem: ' : i.severity === 'warning' ? 'Warning: ' : 'Note: '}
            </span>
            {i.message}
            {i.fix ? <span className={styles.fix}> {i.fix}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

function fieldError(ev: Evaluation, field: DnsIssue['field']): ReactNode {
  const issue = ev.issues.find((i) => i.field === field && i.severity === 'error');
  if (!issue) return undefined;
  return (
    <>
      {issue.message}
      {issue.fix ? ` ${issue.fix}` : ''}
    </>
  );
}

// ---------------------------------------------------------------------------
// The widget
// ---------------------------------------------------------------------------

const DnsRecordBuilder: WidgetComponent = ({ stage, host, stepKey }) => {
  const uid = useId();
  // The props object may be a new identity on every render; its content is what matters.
  const propsKey = JSON.stringify(stage.props ?? {});
  const c: DnsCase = useMemo(() => readCase(JSON.parse(propsKey) as Record<string, unknown>), [propsKey]);
  const locked = c.provider !== null;
  const caseKey = `${c.domain}|${c.kind}|${c.provider ?? ''}|${c.appName}`;

  const [provider, setProvider] = useState<Provider>(c.provider ?? 'generic');
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(c.provider ?? 'generic'));
  const [portIndex, setPortIndex] = useState(0);
  const [lookedUp, setLookedUp] = useState(false);

  // A new case (the lesson moved to another step) or a new step starts from a clean record.
  const lastKey = useRef(`${caseKey}|${stepKey}`);
  useEffect(() => {
    const key = `${caseKey}|${stepKey}`;
    if (lastKey.current === key) return;
    lastKey.current = key;
    lastAttempt.current = '';
    const p = c.provider ?? 'generic';
    setProvider(p);
    setDraft(emptyDraft(p));
    setPortIndex(0);
    setLookedUp(false);
  }, [caseKey, stepKey, c.provider]);

  const info = PROVIDERS[provider];
  const ev = useMemo(() => evaluate(draft, c, provider), [draft, c, provider]);
  const appDomain = appDomainOf(c.appName);

  // Done: the record is correct for the case.
  const reported = useRef(false);
  useEffect(() => {
    if (!ev.correct) {
      reported.current = false;
      return;
    }
    if (reported.current) return;
    reported.current = true;
    host.emit({ type: 'widget-done' });
  }, [ev.correct, host]);

  // A filled-in record that is not right is an attempt: the first one offers "Show me". It is counted once
  // the learner pauses, and once per distinct record.
  const hostRef = useRef(host);
  hostRef.current = host;
  const lastAttempt = useRef('');
  useEffect(() => {
    if (ev.correct || draft.name.trim() === '' || draft.value.trim() === '') return;
    const key = `${draft.type}|${draft.name}|${draft.value}|${draft.ttl}|${draft.proxied}`;
    const id = window.setTimeout(() => {
      if (lastAttempt.current === key) return;
      lastAttempt.current = key;
      hostRef.current.emit({ type: 'custom', name: 'attempt' });
    }, ATTEMPT_PAUSE_MS);
    return () => window.clearTimeout(id);
  }, [draft, ev.correct]);

  // "Show me": a correct record for the provider in use.
  useEffect(() => {
    host.registerSolver(() => setDraft(solutionFor(c, provider)));
    return () => host.registerSolver(null);
  }, [host, c, provider]);

  const patch = (over: Partial<Draft>) => setDraft((d) => ({ ...d, ...over }));

  const chooseProvider = (next: Provider) => {
    setProvider(next);
    const nextInfo = PROVIDERS[next];
    setDraft((d) => ({
      ...d,
      type: nextInfo.types.includes(d.type) ? d.type : 'CNAME',
      proxied: nextInfo.proxy ? d.proxied : false,
    }));
  };

  // The spec half: the domain on the chosen port, linted with the real engine.
  const part2 = useMemo(() => {
    const comp = defaultComponent({
      name: 'web',
      description: 'The site and its metrics page',
      repotag: 'nginx:1.27',
      ports: DEMO_PORTS.map((p) => p.port),
      containerPorts: DEMO_PORTS.map((p) => p.containerPort),
      domains: domainsFor(c.domain, portIndex),
      cpu: 0.5,
      ram: 500,
      hdd: 5,
    });
    const spec = { ...defaultSpec(), name: c.appName, compose: [comp] };
    const report = lintSpec(spec);
    const names = derivedNames(spec);
    const issues = report.issues.filter((i) => i.code.startsWith('DOMAIN') || i.severity === 'error');
    const list = (xs: readonly (string | number)[]) => `[${xs.map((x) => JSON.stringify(x)).join(', ')}]`;
    const json = [
      '{',
      `  "name": ${JSON.stringify(c.appName)},`,
      '  "compose": [',
      '    {',
      `      "name": ${JSON.stringify(comp.name)},`,
      `      "ports": ${list(comp.ports)},`,
      `      "containerPorts": ${list(comp.containerPorts)},`,
      `      "domains": ${list(comp.domains)}`,
      '    }',
      '  ]',
      '}',
    ].join('\n');
    return { names, issues, json };
  }, [c.domain, c.appName, portIndex]);

  type PortName = (typeof part2.names.ports)[number];
  const freeAddress = (p: PortName): ReactNode => (
    <>
      <code>{hostBreaks(p.generatedDomain)}</code>
      {p.isFirst ? (
        <>
          {' '}
          or <code>{hostBreaks(part2.names.appDomain)}</code>
        </>
      ) : null}
    </>
  );
  const customDomain = (p: PortName): ReactNode =>
    p.customDomains.length > 0 ? <code>{hostBreaks(p.customDomains.join(', '))}</code> : <span>none</span>;

  const nameField = info.nameLabel;
  const free = freeAddressChain(c.appName);

  const typeOptions = info.types.map((t) => ({ value: t, label: info.typeLabel(t) }));
  const ttlOptions = TTL_CHOICES.map((t) => ({
    value: String(t.value),
    label: t.value === 'auto' ? `${info.autoLabel} (${AUTO_TTL} s)` : t.label,
  }));

  const nameHint = 'The part before your domain, or @ for the bare domain.';

  const valueHint =
    draft.type === 'A'
      ? 'An IPv4 address.'
      : draft.type === 'CNAME' || draft.type === 'ALIAS'
        ? 'A host name, written without https://.'
        : 'Not used to send visitors anywhere.';

  const goalWord = c.kind === 'apex' ? 'bare domain' : 'subdomain';

  return (
    <Panel variant="glass" padding="md" container contentClassName={styles.root}>
      <div className={styles.head}>
        <p className={styles.eyebrow}>DNS record builder</p>
        <div className={styles.headChips}>
          <Chip size="sm" tone="accent">
            {c.kind === 'apex' ? 'Bare domain' : 'Subdomain'}
          </Chip>
          <FreshnessChip kind="simulation" />
        </div>
      </div>

      <p className={styles.goal}>
        Point the {goalWord} <code>{c.domain}</code> at your Flux app <code>{c.appName}</code>. Its free
        address is <code>{appDomain}</code>. Build the record you would create at your DNS provider.
      </p>

      <div className={styles.grid}>
        {/* ---- 1. The record ----------------------------------------------------------------- */}
        <section className={styles.col} aria-labelledby={`${uid}-rec`}>
          <h3 id={`${uid}-rec`} className={styles.colTitle}>
            <span className={styles.step}>1</span> The record at your DNS provider
          </h3>

          {locked ? (
            <p className={styles.providerFixed}>
              <Glyph name="globe" size={14} />
              <span>
                Provider: <strong>{info.label}</strong>
              </span>
            </p>
          ) : (
            <SegmentedControl
              aria-label="Your DNS provider"
              size="sm"
              fullWidth
              value={provider}
              onValueChange={(v) => chooseProvider(v as Provider)}
              options={[
                { value: 'cloudflare', label: 'Cloudflare' },
                { value: 'namecheap', label: 'Namecheap' },
                { value: 'generic', label: 'Other' },
              ]}
            />
          )}
          <p className={styles.quirk}>{info.quirk}</p>

          <div className={styles.form}>
            <div className={styles.formRow}>
              <Select
                label="Type"
                size="md"
                value={draft.type}
                options={typeOptions}
                onValueChange={(v) => patch({ type: v as RecordType })}
                error={fieldError(ev, 'type')}
              />
              <Select
                label="TTL"
                size="md"
                value={String(draft.ttl)}
                options={ttlOptions}
                onValueChange={(v) => patch({ ttl: v === 'auto' ? 'auto' : Number(v) })}
                hint="How long resolvers may keep the answer."
              />
            </div>
            <TextField
              label={nameField}
              mono
              value={draft.name}
              onValueChange={(v) => patch({ name: v })}
              hint={nameHint}
              error={fieldError(ev, 'name')}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
            <TextField
              label={info.valueLabel(draft.type)}
              mono
              value={draft.value}
              onValueChange={(v) => patch({ value: v })}
              hint={valueHint}
              error={fieldError(ev, 'value')}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
            {info.proxy ? (
              <Switch
                checked={draft.proxied}
                onCheckedChange={(v) => patch({ proxied: v })}
                description="The orange cloud. Requests go to the provider first, which forwards them."
              >
                Proxy status: {draft.proxied ? 'Proxied' : 'DNS only'}
              </Switch>
            ) : null}
          </div>

          {ev.correct ? (
            <p className={styles.verdict} data-tone="ok">
              <Glyph name="status-ok" size={18} />
              <span>
                This record points <strong>{c.domain}</strong> at <strong>{c.appName}</strong>.
              </span>
            </p>
          ) : null}

          <IssueList
            issues={ev.issues.filter(
              (i) =>
                i.severity !== 'error' || i.field === 'record' || i.field === 'proxy' || i.field === 'ttl',
            )}
          />
        </section>

        {/* ---- What a resolver sees ---------------------------------------------------------- */}
        <section className={styles.col} aria-labelledby={`${uid}-res`}>
          <h3 id={`${uid}-res`} className={styles.colTitle}>
            What a resolver sees
          </h3>
          <p className={styles.asked}>
            Asking for <code>{c.domain}</code>
            {ev.stored && ev.stored.fqdn !== c.domain ? (
              <>
                {' '}
                with your record stored as <code>{ev.stored.fqdn}</code>
              </>
            ) : null}
          </p>

          {ev.hops.length > 0 ? (
            <Chain hops={ev.hops} label="The answer a resolver follows" />
          ) : (
            <div className={styles.emptyChain} data-outcome={ev.outcome}>
              <Glyph name={ev.outcome === 'refused' ? 'cross' : 'route'} size={18} />
              <span>
                {ev.outcome === 'refused'
                  ? 'No record is saved, so a resolver finds nothing at this name.'
                  : 'Nothing is stored yet.'}
              </span>
            </div>
          )}

          <p
            className={styles.outcome}
            data-good={ev.outcome === 'flux' || ev.outcome === 'flux-proxied' ? 'true' : 'false'}
            role="status"
            aria-live="polite"
          >
            {OUTCOME_TEXT[ev.outcome]}
          </p>

          <div className={styles.lookup}>
            <button
              type="button"
              className={styles.lookupBtn}
              aria-expanded={lookedUp}
              onClick={() => setLookedUp((v) => !v)}
            >
              <Glyph name="search" size={14} />
              <span>Look up {appDomain}</span>
            </button>
            {lookedUp ? (
              <div className={styles.lookupBody}>
                <Chain hops={free} label={`The free address of ${c.appName}, resolved`} />
                <p>
                  The first link is the free address of your app. The last is the address to use for an A
                  record. These are documentation addresses in this simulation.
                </p>
              </div>
            ) : null}
          </div>

          <p className={styles.fineprint}>
            DNS answers are cached. A resolver may keep an old answer until the TTL runs out, so a record you
            fixed can still look wrong for a while. Flux does not publish a figure for that wait.
          </p>
        </section>
      </div>

      {/* ---- 2. The other half --------------------------------------------------------------- */}
      <section className={styles.half} aria-labelledby={`${uid}-spec`}>
        <h3 id={`${uid}-spec`} className={styles.colTitle}>
          <span className={styles.step}>2</span> The other half: tell Flux the domain
        </h3>
        <p className={styles.halfText}>
          DNS only brings visitors to Flux. The spec has to list the domain too, in the component&apos;s{' '}
          <code>domains</code> array, at the same position as the public port that should answer on it.
        </p>

        <SegmentedControl
          aria-label="Public port that answers on the domain"
          size="sm"
          value={String(portIndex)}
          onValueChange={(v) => setPortIndex(Number(v))}
          options={DEMO_PORTS.map((p, i) => ({
            value: String(i),
            label: `${p.port}, ${p.label}`,
          }))}
        />

        <CodeBlock
          code={part2.json}
          lang="json"
          filename="spec excerpt"
          highlight={[8]}
          wrap
          label="The domains entry of the spec"
        />

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="sr-only">Public ports, their free addresses and custom domains</caption>
            <thead>
              <tr>
                <th scope="col">Port</th>
                <th scope="col">Free address</th>
                <th scope="col">Custom domain</th>
              </tr>
            </thead>
            <tbody>
              {part2.names.ports.map((p) => (
                <tr key={p.port}>
                  <td>
                    <code>{p.port}</code>
                  </td>
                  <td>{freeAddress(p)}</td>
                  <td>{customDomain(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* The same facts as cards, for a narrow container (the table is hidden there). */}
        <ul className={styles.portCards} aria-label="Public ports, their free addresses and custom domains">
          {part2.names.ports.map((p) => (
            <li key={p.port} className={styles.portCard}>
              <dl>
                <div>
                  <dt>Port</dt>
                  <dd>
                    <code>{p.port}</code>
                  </dd>
                </div>
                <div>
                  <dt>Free address</dt>
                  <dd>{freeAddress(p)}</dd>
                </div>
                <div>
                  <dt>Custom domain</dt>
                  <dd>{customDomain(p)}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>

        <ul className={styles.notes}>
          <li>
            Keep <code>domains</code> the same length as <code>ports</code>, with an empty string where a port
            has no custom domain.
          </li>
          <li>
            Write only the host name. FDM strips a leading <code>http://</code> or <code>https://</code>, and
            it ignores a name that ends in <code>app.runonflux.io</code>.
          </li>
          <li>
            FDM also sets up <code>www.{c.domain}</code> and <code>test.{c.domain}</code>. Each needs a DNS
            record of its own to resolve.
          </li>
        </ul>
        {part2.issues.length > 0 ? (
          <ul className={styles.issues}>
            {part2.issues.map((i) => (
              <li key={`${i.code}-${i.path}`} className={styles.issue} data-severity={i.severity}>
                <Glyph name={i.severity === 'error' ? 'status-crit' : 'info'} size={16} />
                <span>
                  {i.message} {i.why}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </Panel>
  );
};

export default DnsRecordBuilder;
