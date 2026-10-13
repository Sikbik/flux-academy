/**
 * Advanced mode, "Register New Application" (FACTS 9.4.3): a Terms of Service gate, then the tabs General,
 * Geolocation and Components, then Review & Validate. The same editor serves an update, with the name
 * locked. Labels, limits and the frontend messages are the ones FACTS quotes; everything else the
 * network enforces comes from the shared linter and is shown next to the field it belongs to.
 */
import {
  defaultComponent,
  type FluxAppSpec,
  type FluxComponentSpec,
  LIMITS,
  type LintIssue,
  parseContainerData,
} from '@shared/flux';
import { type ReactNode, useId, useState } from 'react';
import {
  Button,
  Chip,
  Dialog,
  IconButton,
  SegmentedControl,
  Select,
  Slider,
  Switch,
  TabPanel,
  Tabs,
  TextField,
} from '@/ui';
import styles from './FluxcloudSim.module.css';
import { usd } from './format';
import { CONTINENTS, type Draft, discountPercent, type Mode, PERIODS, secretKeys, splitEnv } from './model';
import { Card, IssueList, PageTitle, PriceFigure } from './Parts';
import type { ReviewResult } from './review';
import { SAMPLE_SITES } from './timeline';

interface AdvancedFormProps {
  draft: Draft;
  onChange: (d: Draft) => void;
  walletAccount: boolean;
  /** An update of the running app: the name and the owner cannot change, the period is the renewal's. */
  update?: boolean;
  result: ReviewResult;
  paramsSource: 'live' | 'cache' | 'baked';
  fluxMultiplier: number;
  mode: Mode;
  onMode?: (m: Mode) => void;
  onReview: () => void;
  reviewLabel?: string;
  /** Replaces the Estimated cost card (an update shows its credit there). */
  costSlot?: ReactNode;
}

const NAME_PATTERN = /^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$/;
const NAME_MESSAGE =
  'Flux App name contains special characters. Only a-z, A-Z, 0-9 and hyphens are allowed (hyphens cannot be first or last character)';

function setComp(draft: Draft, i: number, patch: Partial<FluxComponentSpec>): Draft {
  const compose = draft.spec.compose.map((c, k) => (k === i ? { ...c, ...patch } : c));
  return { ...draft, spec: { ...draft.spec, compose } };
}

function setSpec(draft: Draft, patch: Partial<FluxAppSpec>): Draft {
  return { ...draft, spec: { ...draft.spec, ...patch } };
}

function issuesFor(issues: readonly LintIssue[], prefix: string): LintIssue[] {
  return issues.filter(
    (i) => i.path === prefix || i.path.startsWith(`${prefix}.`) || i.path.startsWith(`${prefix}[`),
  );
}

/** Issues that are not about one component or the geolocation: the General tab's. */
function generalIssues(issues: readonly LintIssue[]): LintIssue[] {
  return issues.filter((i) => !i.path.startsWith('compose') && !i.path.startsWith('geolocation'));
}

function numeric(v: string): number {
  const n = Number(v.replace(/[^\d]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------------------

export function AdvancedForm({
  draft,
  onChange,
  walletAccount,
  update,
  result,
  paramsSource,
  fluxMultiplier,
  mode,
  onMode,
  onReview,
  reviewLabel = 'Review',
  costSlot,
}: AdvancedFormProps) {
  const uid = useId();
  const [tab, setTab] = useState<'general' | 'geolocation' | 'components'>('general');
  const [tosError, setTosError] = useState(false);
  const [publicAsk, setPublicAsk] = useState(false);
  const spec = draft.spec;
  const secrets = secretKeys(spec);
  const hasPrivate = spec.compose.some((c) => c.repoauth !== '');
  const synced = spec.compose.some((c) => parseContainerData(c.containerData).syncMode !== null);
  const minInstances = synced ? 2 : 1;
  const nameBad = spec.name !== '' && !NAME_PATTERN.test(spec.name);
  const descBad = spec.description.length > LIMITS.descriptionMaxLength;
  const period = PERIODS.findIndex((p) => p.blocks === spec.expire);
  const ready = draft.tos;

  const switchTab = (v: string) => {
    if (!draft.tos && v !== 'general') {
      setTosError(true);
      return;
    }
    setTosError(false);
    setTab(v as typeof tab);
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <PageTitle screenKey={update ? 'update' : 'advanced'}>
            {update ? 'Update Application' : 'Register New Application'}
          </PageTitle>
          <p className={styles.pageSub}>
            {update
              ? 'Change what you need. The name and the owner stay as they are.'
              : 'Every field of the spec, in tabs.'}
          </p>
        </div>
        {!update && onMode ? (
          <div className={styles.headActions}>
            <Button
              size="sm"
              variant="ghost"
              aria-disabled={!ready}
              title="Not part of this simulation"
              onClick={() => undefined}
            >
              Import compose / spec
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onMode('simple')}
              aria-pressed={mode === 'simple'}
            >
              Simple mode
            </Button>
          </div>
        ) : null}
      </div>

      {!update ? (
        <section className={styles.tos} aria-labelledby={`${uid}-tos`}>
          <h4 id={`${uid}-tos`} className={styles.cardTitle}>
            Terms of Service Agreement
          </h4>
          <Switch
            checked={draft.tos}
            onCheckedChange={(on) => {
              onChange({ ...draft, tos: on });
              if (on) setTosError(false);
            }}
          >
            I have read and accept the Terms of Service
          </Switch>
          {tosError ? (
            <p className={styles.fieldError} role="alert">
              Please read and accept the Terms of Service before proceeding to other tabs.
            </p>
          ) : null}
        </section>
      ) : null}

      <Tabs
        idBase={`${uid}-adv`}
        aria-label="Application sections"
        value={tab}
        onValueChange={switchTab}
        variant="plate"
        size="sm"
        items={[
          { value: 'general', label: 'General' },
          { value: 'geolocation', label: 'Geolocation' },
          { value: 'components', label: 'Components' },
        ]}
      >
        <TabPanel value="general">
          <div className={styles.cards}>
            <Card title="General">
              <TextField
                label="Application Name"
                mono
                value={spec.name}
                disabled={update}
                error={nameBad ? NAME_MESSAGE : undefined}
                onValueChange={(v) =>
                  onChange(setSpec(draft, { name: update ? spec.name : v.toLowerCase() }))
                }
                maxLength={63}
                spellCheck={false}
                autoComplete="off"
              />
              <TextField
                label="Description"
                value={spec.description}
                error={descBad ? 'Description is too long. Maximum of 256 characters is allowed' : undefined}
                onValueChange={(v) => onChange(setSpec(draft, { description: v }))}
                autoComplete="off"
              />
              <TextField
                label="Owner"
                mono
                value={spec.owner}
                readOnly
                hint="Your Flux ID. A placeholder here: nothing is signed in this simulation."
              />
            </Card>

            <Card
              title="Contact *"
              hint={`Up to ${LIMITS.contacts.maxCount} contacts, each at most ${LIMITS.contacts.maxLength} characters.`}
            >
              {spec.contacts.length === 0 ? (
                <p className={styles.fieldError}>At least one contact email is required</p>
              ) : null}
              {spec.contacts.map((c, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity of their own
                <div key={i} className={styles.portRow}>
                  <TextField
                    label={`Contact ${i + 1}`}
                    hideLabel
                    value={c}
                    readOnly={!walletAccount && i === 0}
                    hint={
                      !walletAccount && i === 0
                        ? 'Using your account email. Notifications go here.'
                        : undefined
                    }
                    maxLength={LIMITS.contacts.maxLength}
                    onValueChange={(v) =>
                      onChange(setSpec(draft, { contacts: spec.contacts.map((x, k) => (k === i ? v : x)) }))
                    }
                    autoComplete="off"
                  />
                  {i > 0 || walletAccount ? (
                    <IconButton
                      icon="close"
                      label={`Remove contact ${i + 1}`}
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        onChange(setSpec(draft, { contacts: spec.contacts.filter((_, k) => k !== i) }))
                      }
                    />
                  ) : null}
                </div>
              ))}
              <div>
                <Button
                  size="sm"
                  variant="secondary"
                  icon="plus"
                  disabled={spec.contacts.length >= LIMITS.contacts.maxCount}
                  onClick={() => onChange(setSpec(draft, { contacts: [...spec.contacts, ''] }))}
                >
                  Add contact
                </Button>
              </div>
            </Card>

            <Card title="Instances">
              <Slider
                label="Instances"
                min={minInstances}
                max={100}
                step={1}
                value={Math.max(minInstances, spec.instances)}
                format={(n) => `${n}`}
                unit={spec.instances === 1 ? 'instance' : 'instances'}
                onValueChange={(v) => onChange(setSpec(draft, { instances: v }))}
              />
              <p className={styles.fineprint}>
                {synced
                  ? 'The minimum instances for apps with decentralized persistent storage is 2. To use fewer instances, disable data synchronization in the volume path settings.'
                  : 'The minimum recommended for a decentralized network is 3 instances.'}
                {spec.instances === 1
                  ? ' With 1 instance your app may experience some minutes of downtime if the node running the app is rebooted or shutdown.'
                  : ''}
              </p>
              <p className={styles.fineprint}>~{usd(result.quote.usdTotal ?? 0)} (estimate)</p>
            </Card>

            {update ? null : (
              <Card title="Period">
                <Slider
                  label="Period"
                  min={0}
                  max={PERIODS.length - 1}
                  step={1}
                  value={period < 0 ? 2 : period}
                  format={(i) => {
                    const p = PERIODS[i];
                    if (!p) return '';
                    const d = discountPercent(p.blocks);
                    return `${p.longLabel}${d ? ` (${d}% off)` : ''}`;
                  }}
                  onValueChange={(i) => {
                    const p = PERIODS[i];
                    if (p) onChange(setSpec(draft, { expire: p.blocks }));
                  }}
                />
                <p className={styles.fineprint}>Total subscription is capped at 1 year (1,056,000 blocks).</p>
              </Card>
            )}

            <Card title="Additional Options">
              <Switch
                checked={spec.staticip}
                onCheckedChange={(on) => onChange(setSpec(draft, { staticip: on }))}
              >
                Static IP
              </Switch>
              <p className={styles.fineprint}>Enable static IP address for your application</p>
              <Switch
                checked={draft.enterprise}
                onCheckedChange={(on) => {
                  if (!on && (secrets.length > 0 || hasPrivate)) {
                    setPublicAsk(true);
                    return;
                  }
                  onChange({ ...draft, enterprise: on });
                }}
              >
                Enterprise
              </Switch>
              {draft.enterprise ? (
                <p className={styles.notice} data-tone="warn">
                  Enterprise mode enabled - your app specification will be encrypted.
                </p>
              ) : null}
            </Card>
          </div>
          <IssueList issues={generalIssues(result.issues)} label="Checks on the application" />
        </TabPanel>

        <TabPanel value="geolocation">
          <GeolocationTab
            draft={draft}
            onChange={onChange}
            issues={issuesFor(result.issues, 'geolocation')}
          />
        </TabPanel>

        <TabPanel value="components">
          <div className={styles.cards} data-single="true">
            {spec.compose.map((c, i) => (
              <ComponentCard
                // biome-ignore lint/suspicious/noArrayIndexKey: components are edited in place by position
                key={i}
                index={i}
                comp={c}
                draft={draft}
                onChange={onChange}
                issues={issuesFor(result.issues, `compose[${i}]`)}
                removable={spec.compose.length > LIMITS.component.min}
                enterprise={draft.enterprise}
              />
            ))}
          </div>
          <div>
            <Button
              size="sm"
              variant="secondary"
              icon="plus"
              className={styles.wrapBtn}
              disabled={spec.compose.length >= LIMITS.component.max}
              onClick={() =>
                onChange(
                  setSpec(draft, {
                    compose: [
                      ...spec.compose,
                      defaultComponent({
                        name: `component${spec.compose.length + 1}`,
                        description: '',
                        repotag: '',
                        ports: [],
                        containerPorts: [],
                        domains: [],
                      }),
                    ],
                  }),
                )
              }
            >
              Add Component to Application Composition
            </Button>
          </div>
        </TabPanel>
      </Tabs>

      {costSlot ?? (
        <Card title="Estimated cost" span="full">
          <PriceFigure
            quote={result.quote}
            paramsSource={paramsSource}
            fluxMultiplier={fluxMultiplier}
            periodLabel={update ? undefined : PERIODS.find((p) => p.blocks === spec.expire)?.label}
          />
        </Card>
      )}

      <div className={styles.submitRow}>
        <span className={styles.fineprint}>
          {draft.tos ? 'Ready to review.' : 'Accept the Terms of Service to continue.'}
        </span>
        <Button variant="primary" disabled={!draft.tos} onClick={onReview}>
          {reviewLabel}
        </Button>
      </div>

      <Dialog
        open={publicAsk}
        onClose={() => setPublicAsk(false)}
        title="Registering as a public app"
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setPublicAsk(false);
                onChange({ ...draft, enterprise: false });
              }}
            >
              Continue as public
            </Button>
            <Button
              variant="primary"
              data-autofocus
              onClick={() => {
                setPublicAsk(false);
                onChange({ ...draft, enterprise: true });
              }}
            >
              Continue with Enterprise
            </Button>
          </>
        }
      >
        <p>
          {secrets.length > 0
            ? `Your environment variables look like secrets (${secrets.join(', ')}). `
            : 'A component uses a private image, which only an Enterprise app may do. '}
          A public app's specification is readable by anyone through the network API, including its
          environment variables.
        </p>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Geolocation
// ---------------------------------------------------------------------------

function GeolocationTab({
  draft,
  onChange,
  issues,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  issues: LintIssue[];
}) {
  const uid = useId();
  const [continent, setContinent] = useState('');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const geo = draft.spec.geolocation;

  const countries = Array.from(
    new Map(SAMPLE_SITES.filter((s) => s.continent === continent).map((s) => [s.country, s.countryName])),
  );
  const regions = SAMPLE_SITES.filter((s) => s.country === country);

  const entryFor = (allow: boolean): string => {
    const head = allow ? 'ac' : 'a!c';
    let e = `${head}${continent}`;
    if (country) e += `_${country}`;
    if (country && region) e += `_${region.slice(3)}`;
    return e;
  };

  const add = (allow: boolean) => {
    if (!continent) {
      setError('Please select a continent or remove this row');
      return;
    }
    const e = entryFor(allow);
    const opposite = entryFor(!allow);
    if (geo.includes(e)) {
      setError('Duplicate location - already added');
      return;
    }
    if (geo.includes(opposite)) {
      setError('This location is both allowed and forbidden');
      return;
    }
    setError(null);
    onChange({ ...draft, spec: { ...draft.spec, geolocation: [...geo, e] } });
  };

  const label = (e: string) => {
    const allow = e.startsWith('ac');
    const body = e.replace(/^a!?c/, '');
    return `${allow ? 'Allow' : 'Forbid'} ${body.replaceAll('_', ' / ')}`;
  };

  return (
    <div className={styles.cards} data-single="true">
      <Card
        title="Allowed Geolocation and Forbidden Geolocation"
        hint="Default is none: anywhere. A node must match no forbidden entry and, when there are allowed entries, at least one of them."
      >
        <div className={styles.geoPickers}>
          <Select
            label="Continent"
            value={continent}
            placeholder="Continent"
            onValueChange={(v) => {
              setContinent(v);
              setCountry('');
              setRegion('');
              setError(null);
            }}
            options={CONTINENTS.map((c) => ({ value: c.code, label: c.label }))}
          />
          <Select
            label="Country"
            value={country}
            placeholder="Any country"
            disabled={countries.length === 0}
            onValueChange={(v) => {
              setCountry(v);
              setRegion('');
              setError(null);
            }}
            options={countries.map(([code, name]) => ({ value: code, label: name }))}
          />
          <Select
            label="Region"
            value={region}
            placeholder="Any region"
            disabled={regions.length === 0}
            onValueChange={(v) => {
              setRegion(v);
              setError(null);
            }}
            options={regions.map((s) => ({ value: s.region, label: s.region }))}
          />
        </div>
        <div className={styles.rowButtons}>
          <Button size="sm" variant="secondary" icon="plus" onClick={() => add(true)}>
            Add Allowed Location
          </Button>
          <Button size="sm" variant="secondary" icon="minus" onClick={() => add(false)}>
            Add Forbidden Location
          </Button>
        </div>
        {error ? (
          <p className={styles.fieldError} role="alert" id={`${uid}-geo-err`}>
            {error}
          </p>
        ) : null}
        {geo.length === 0 ? (
          <p className={styles.fineprint}>No location rules: the app can run anywhere.</p>
        ) : (
          <ul className={styles.chipList} aria-label="Location rules">
            {geo.map((e) => (
              <li key={e}>
                <Chip size="sm" tone={e.startsWith('a!c') ? 'neutral' : 'accent'}>
                  <code>{e}</code> {label(e)}
                </Chip>
                <IconButton
                  icon="close"
                  label={`Remove ${e}`}
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onChange({ ...draft, spec: { ...draft.spec, geolocation: geo.filter((g) => g !== e) } })
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <IssueList issues={issues} label="Checks on the locations" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// One component
// ---------------------------------------------------------------------------

function ComponentCard({
  index,
  comp,
  draft,
  onChange,
  issues,
  removable,
  enterprise,
}: {
  index: number;
  comp: FluxComponentSpec;
  draft: Draft;
  onChange: (d: Draft) => void;
  issues: LintIssue[];
  removable: boolean;
  enterprise: boolean;
}) {
  const patch = (p: Partial<FluxComponentSpec>) => onChange(setComp(draft, index, p));
  const env = comp.environmentParameters.map(splitEnv);
  const keys = env.map((e) => e.key);
  const parsed = parseContainerData(comp.containerData);
  const firstMount = comp.containerData.split('|')[0] ?? '';
  const path = firstMount.replace(/^[rgs]+:/, '');
  const prefix = /^([rgs]+):/.exec(firstMount)?.[1] ?? '';
  const rest = comp.containerData.includes('|') ? `|${comp.containerData.split('|').slice(1).join('|')}` : '';
  const builder = prefix.includes('g')
    ? 'g'
    : prefix.includes('r')
      ? 'r'
      : prefix.includes('s')
        ? 's'
        : 'local';
  const rows = Math.max(comp.ports.length, comp.containerPorts.length);

  const setRow = (i: number, p: { port?: number; container?: number; domain?: string }) => {
    const ports = [...comp.ports];
    const containers = [...comp.containerPorts];
    const domains = [...comp.domains];
    while (ports.length <= i) ports.push(0);
    while (containers.length <= i) containers.push(0);
    while (domains.length <= i) domains.push('');
    if (p.port !== undefined) ports[i] = p.port;
    if (p.container !== undefined) containers[i] = p.container;
    if (p.domain !== undefined) domains[i] = p.domain;
    patch({ ports, containerPorts: containers, domains });
  };

  return (
    <section className={styles.card} aria-label={`Component ${index + 1}: ${comp.name || 'unnamed'}`}>
      <div className={styles.cardHeadRow}>
        <h4 className={styles.cardTitle}>Component {index + 1}</h4>
        {removable ? (
          <IconButton
            icon="trash"
            label={`Remove component ${index + 1}`}
            variant="ghost"
            tone="crit"
            size="sm"
            onClick={() =>
              onChange(setSpec(draft, { compose: draft.spec.compose.filter((_, k) => k !== index) }))
            }
          />
        ) : null}
      </div>

      <div className={styles.twoCol}>
        <TextField
          label="Name"
          mono
          value={comp.name}
          error={
            comp.name !== '' && !LIMITS.component.namePattern.test(comp.name)
              ? 'Flux App component name contains special characters. Only a-z, A-Z and 0-9 are allowed'
              : undefined
          }
          onValueChange={(v) => patch({ name: v })}
          spellCheck={false}
          autoComplete="off"
        />
        <TextField
          label="Description"
          value={comp.description}
          onValueChange={(v) => patch({ description: v })}
          autoComplete="off"
        />
      </div>
      <TextField
        label="Repository Tag"
        mono
        placeholder="namespace/repo:tag"
        value={comp.repotag}
        onValueChange={(v) => patch({ repotag: v })}
        spellCheck={false}
        autoComplete="off"
      />
      <TextField
        label="Repository Authentication"
        mono
        placeholder="Docker authentication username:apikey"
        value={comp.repoauth}
        disabled={!enterprise}
        hint={
          enterprise
            ? 'This is a simulation: do not type real credentials.'
            : 'Needs Enterprise on (General tab).'
        }
        onValueChange={(v) => patch({ repoauth: v })}
        spellCheck={false}
        autoComplete="off"
      />

      <fieldset className={styles.group}>
        <legend>Container Data Path</legend>
        <div className={styles.twoCol}>
          <TextField
            label="Container Data Path"
            mono
            value={comp.containerData}
            error={parsed.errors.length > 0 ? parsed.errors[0] : undefined}
            onValueChange={(v) => patch({ containerData: v })}
            spellCheck={false}
            autoComplete="off"
          />
          <Select
            label="Data Path Builder"
            value={builder}
            disabled={parsed.mounts.length === 0 || parsed.errors.length > 0}
            onValueChange={(v) => {
              const pre = v === 'r' ? 'r:' : v === 'g' ? 'g:' : v === 's' ? 's:' : '';
              patch({ containerData: `${pre}${path}${rest}` });
            }}
            options={[
              { value: 'local', label: 'Local only (no prefix)' },
              { value: 'r', label: 'Replicated across copies (r:)' },
              { value: 'g', label: 'Primary and standby (g:)' },
              { value: 's', label: 'Synced, no restart (s:)' },
            ]}
          />
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Port Bindings</legend>
        {Array.from({ length: rows }).map((_, i) => {
          const p = comp.ports[i] ?? 0;
          const cp = comp.containerPorts[i] ?? 0;
          const dup = p !== 0 && comp.ports.filter((x) => x === p).length > 1;
          const badPort = p !== 0 ? p < 1 || p > 65535 : false;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
            <div key={i} className={styles.bindRow}>
              <TextField
                label={`Exposed Port ${i + 1}`}
                inputMode="numeric"
                mono
                value={p === 0 ? '' : String(p)}
                error={
                  badPort || dup
                    ? 'Invalid or duplicate port values.'
                    : p === 0
                      ? 'Port must be a number between 1 and 65535.'
                      : undefined
                }
                onValueChange={(v) => setRow(i, { port: numeric(v) })}
              />
              <TextField
                label={`Container Port ${i + 1}`}
                inputMode="numeric"
                mono
                value={cp === 0 ? '' : String(cp)}
                onValueChange={(v) => setRow(i, { container: numeric(v) })}
              />
              <TextField
                label={`Custom Domains ${i + 1}`}
                mono
                placeholder="Enter domain for this port"
                value={comp.domains[i] ?? ''}
                onValueChange={(v) => setRow(i, { domain: v })}
                spellCheck={false}
                autoComplete="off"
              />
              <IconButton
                icon="close"
                label={`Remove port mapping ${i + 1}`}
                variant="ghost"
                size="sm"
                onClick={() =>
                  patch({
                    ports: comp.ports.filter((_, k) => k !== i),
                    containerPorts: comp.containerPorts.filter((_, k) => k !== i),
                    domains: comp.domains.filter((_, k) => k !== i),
                  })
                }
              />
            </div>
          );
        })}
        <div>
          <Button
            size="sm"
            variant="secondary"
            icon="plus"
            disabled={rows >= LIMITS.ports.perComponentMax}
            onClick={() =>
              patch({
                ports: [...comp.ports, 0],
                containerPorts: [...comp.containerPorts, 0],
                domains: [...comp.domains, ''],
              })
            }
          >
            Add Port Mapping
          </Button>
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Environment Variables</legend>
        {env.map((e, i) => {
          const dup = e.key !== '' && keys.filter((k) => k === e.key).length > 1;
          const msg =
            e.key === '' && e.value !== ''
              ? 'Variable name is required'
              : dup
                ? `Duplicate key "${e.key}"`
                : e.key !== '' && e.value === '' && comp.environmentParameters[i]?.includes('=') !== true
                  ? 'Key and value are required.'
                  : undefined;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
            <div key={i} className={styles.envRow}>
              <TextField
                label={`Variable ${i + 1} name`}
                hideLabel
                mono
                placeholder="KEY"
                value={e.key}
                error={msg}
                onValueChange={(v) =>
                  patch({
                    environmentParameters: comp.environmentParameters.map((x, k) =>
                      k === i ? `${v}=${splitEnv(x).value}` : x,
                    ),
                  })
                }
                spellCheck={false}
                autoComplete="off"
              />
              <TextField
                label={`Variable ${i + 1} value`}
                hideLabel
                mono
                placeholder="value"
                value={e.value}
                onValueChange={(v) =>
                  patch({
                    environmentParameters: comp.environmentParameters.map((x, k) =>
                      k === i ? `${splitEnv(x).key}=${v}` : x,
                    ),
                  })
                }
                spellCheck={false}
                autoComplete="off"
              />
              <IconButton
                icon="close"
                label={`Remove variable ${i + 1}`}
                variant="ghost"
                size="sm"
                onClick={() =>
                  patch({ environmentParameters: comp.environmentParameters.filter((_, k) => k !== i) })
                }
              />
            </div>
          );
        })}
        <div>
          <Button
            size="sm"
            variant="secondary"
            icon="plus"
            disabled={comp.environmentParameters.length >= LIMITS.environment.maxCount}
            onClick={() => patch({ environmentParameters: [...comp.environmentParameters, '='] })}
          >
            Add Variable
          </Button>
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Commands</legend>
        {comp.commands.map((cmd, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
          <div key={i} className={styles.portRow}>
            <TextField
              label={`Command ${i + 1}`}
              hideLabel
              mono
              value={cmd}
              error={cmd.trim() === '' ? 'Command cannot be empty.' : undefined}
              onValueChange={(v) => patch({ commands: comp.commands.map((x, k) => (k === i ? v : x)) })}
              spellCheck={false}
              autoComplete="off"
            />
            <IconButton
              icon="close"
              label={`Remove command ${i + 1}`}
              variant="ghost"
              size="sm"
              onClick={() => patch({ commands: comp.commands.filter((_, k) => k !== i) })}
            />
          </div>
        ))}
        <div className={styles.rowButtons}>
          <Button
            size="sm"
            variant="secondary"
            icon="plus"
            disabled={comp.commands.length >= LIMITS.commands.maxCount}
            onClick={() => patch({ commands: [...comp.commands, ''] })}
          >
            Add Command
          </Button>
          <span className={styles.fineprint}>Not for environment variables or setup instructions!</span>
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Hardware Resource</legend>
        <Slider
          label="CPU"
          min={0.1}
          max={15}
          step={0.1}
          value={comp.cpu}
          unit="vCore"
          format={(n) => n.toFixed(1)}
          onValueChange={(v) => patch({ cpu: Number(v.toFixed(1)) })}
        />
        <Slider
          label="RAM"
          min={100}
          max={59000}
          step={100}
          value={comp.ram}
          unit="MB"
          onValueChange={(v) => patch({ ram: v })}
        />
        <Slider
          label="SSD/NVMe"
          min={1}
          max={820}
          step={1}
          value={comp.hdd}
          unit="GB"
          onValueChange={(v) => patch({ hdd: v })}
        />
      </fieldset>

      <IssueList issues={issues} label={`Checks on component ${index + 1}`} />
    </section>
  );
}

/** Used by the segmented mode switch of the Simple page; kept here so both modes share a vocabulary. */
export function ModeSwitch({ mode, onMode }: { mode: Mode; onMode: (m: Mode) => void }) {
  return (
    <SegmentedControl
      aria-label="Form mode"
      size="sm"
      value={mode}
      onValueChange={(v) => onMode(v as Mode)}
      options={[
        { value: 'simple', label: 'Simple' },
        { value: 'advanced', label: 'Advanced' },
      ]}
    />
  );
}
