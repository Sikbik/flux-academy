/**
 * Simple mode, the default page of FluxCloud's Register New App: "Deploy an app" (FACTS 9.4.2).
 * One page for one container. Card names, field labels, hints and the port message are the real strings;
 * the price is the engine's. The form edits a `Draft`; the parent decides what happens on Review & deploy.
 */
import { useState } from 'react';
import { Button, Chip, Dialog, IconButton, SegmentedControl, Slider, Switch, TextField } from '@/ui';
import styles from './FluxcloudSim.module.css';
import { gb, plural, usd } from './format';
import {
  CONTINENTS,
  type Draft,
  first,
  freeDomains,
  isValidEmail,
  type Mode,
  PERIODS,
  PORT_ERROR,
  parsePortRow,
  patchSimple,
  SIM_EMAIL,
  secretKeys,
  simpleLimits,
} from './model';
import { Card, PageTitle, PeriodPicker, PriceFigure } from './Parts';
import type { ReviewResult } from './review';

interface SimpleFormProps {
  draft: Draft;
  onChange: (d: Draft) => void;
  walletAccount: boolean;
  result: ReviewResult;
  paramsSource: 'live' | 'cache' | 'baked';
  fluxMultiplier: number;
  blockers: string[];
  mode: Mode;
  onMode: (m: Mode) => void;
  onBack: () => void;
  onReview: () => void;
}

const COPY_ONE = 'A single copy. If its node reboots, your app may briefly go offline.';

export function SimpleForm({
  draft,
  onChange,
  walletAccount,
  result,
  paramsSource,
  fluxMultiplier,
  blockers,
  mode,
  onMode,
  onBack,
  onReview,
}: SimpleFormProps) {
  const comp = first(draft.spec);
  const [tosOpen, setTosOpen] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (k: string) => setTouched((t) => (t[k] ? t : { ...t, [k]: true }));
  const patch = (p: Parameters<typeof patchSimple>[1]) => onChange(patchSimple(draft, p));

  const name = draft.spec.name;
  const domains = freeDomains(name || 'myappname', comp.ports);
  const free = `${name || 'myappname'}.app.runonflux.io`;
  const secrets = secretKeys(draft.spec);
  const email = draft.spec.contacts[0] ?? '';
  const emailBad = walletAccount && touched.email && email !== '' && !isValidEmail(email);
  const limits = simpleLimits(draft);
  const period = PERIODS.find((p) => p.blocks === draft.spec.expire);
  const copies = draft.spec.instances;
  const minCopies = draft.storeData && draft.keepSafe ? 2 : 1;

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <PageTitle screenKey="simple">Deploy an app</PageTitle>
          <p className={styles.pageSub}>Your container, live on the Flux network in a few clicks</p>
        </div>
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
      </div>
      <p className={styles.pageMeta}>
        Already have a docker-compose or a Flux spec?{' '}
        <span className={styles.inertLink} aria-disabled="true" title="Not part of this simulation">
          Import it
        </span>
        <span className={styles.sep} aria-hidden="true">
          |
        </span>
        <button type="button" className={styles.textLink} onClick={onBack}>
          Back to deployment options
        </button>
      </p>

      <div className={styles.cards}>
        <Card title="Container">
          <TextField
            label="Docker image"
            mono
            placeholder="ghcr.io/acme/web-api:latest"
            hint="The image to run. From Docker Hub, GHCR, or any registry."
            value={comp.repotag}
            onValueChange={(v) => patch({ image: v })}
            spellCheck={false}
            autoComplete="off"
          />
          <Switch checked={draft.privateImage} onCheckedChange={(on) => patch({ privateImage: on })}>
            This image is private
          </Switch>
          {draft.privateImage ? (
            <>
              <TextField
                label="Repository Authentication"
                mono
                placeholder="username:password"
                hint="username:password, or aws://..., azure://, google:// schemes. This is a simulation: do not type real credentials."
                value={comp.repoauth}
                onValueChange={(v) => patch({ repoauth: v })}
                spellCheck={false}
                autoComplete="off"
              />
              <p className={styles.fineprint}>
                The FluxOS source read registers only <code className={styles.code}>aws-ecr://</code>,{' '}
                <code className={styles.code}>azure-acr://</code> and{' '}
                <code className={styles.code}>google-gar://</code>. The shorter names in the hint above would
                fail with an unknown provider error; a newer node release was not checked.
              </p>
              <p className={styles.notice} data-tone="warn">
                Because your image is private, the app will be registered as Enterprise, so its specification
                is encrypted. Enterprise apps cost slightly more.
              </p>
            </>
          ) : null}
          <TextField
            label="App name"
            mono
            placeholder="myappname"
            value={name}
            onValueChange={(v) => patch({ name: v })}
            hint={
              <>
                Choose a unique name (letters and numbers). It creates the free domain your app is reached at:{' '}
                <code className={styles.code}>https://{free}</code>
              </>
            }
            maxLength={63}
            spellCheck={false}
            autoComplete="off"
          />
          <TextField
            label="Contact email"
            type="email"
            value={email}
            readOnly={!walletAccount}
            error={emailBad ? 'Enter a valid email address.' : undefined}
            hint={
              walletAccount
                ? 'For deployment and expiration notifications. Required.'
                : 'Using your account email. Notifications go here.'
            }
            placeholder="you@example.com"
            onValueChange={(v) => patch({ email: v })}
            onBlur={() => touch('email')}
            autoComplete="off"
          />
          {!walletAccount ? (
            <p className={styles.fineprint}>
              The address is {SIM_EMAIL}, a placeholder. The spec publishes contacts for anyone to read.
            </p>
          ) : null}
        </Card>

        <Card title="Networking">
          <div className={styles.portRows}>
            {draft.portRows.map((row, i) => {
              const bad = touched[`port${i}`] && row.trim() !== '' && parsePortRow(row) === null;
              const n = parsePortRow(row);
              const pub = n === null ? null : comp.containerPorts.indexOf(n);
              const publicPort = pub !== null && pub >= 0 ? comp.ports[pub] : null;
              const host = pub !== null && pub >= 0 ? domains[pub] : null;
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity of their own
                <div key={i} className={styles.portRow}>
                  <TextField
                    label="Port your app listens on"
                    inputMode="numeric"
                    mono
                    placeholder="8080"
                    value={row}
                    error={bad ? PORT_ERROR : undefined}
                    hint={
                      publicPort !== null && host ? (
                        <>
                          Public port {publicPort}, <code className={styles.code}>{host}</code>
                        </>
                      ) : undefined
                    }
                    onValueChange={(v) => {
                      const rows = [...draft.portRows];
                      rows[i] = v.replace(/[^\d]/g, '').slice(0, 5);
                      patch({ portRows: rows });
                    }}
                    onBlur={() => touch(`port${i}`)}
                  />
                  {draft.portRows.length > 1 ? (
                    <IconButton
                      icon="close"
                      label={`Remove port row ${i + 1}`}
                      variant="ghost"
                      size="sm"
                      onClick={() => patch({ portRows: draft.portRows.filter((_, k) => k !== i) })}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
          <div>
            <Button
              size="sm"
              variant="secondary"
              icon="plus"
              disabled={draft.portRows.length >= 5}
              onClick={() => patch({ portRows: [...draft.portRows, ''] })}
            >
              Add another port
            </Button>
          </div>
        </Card>

        <Card title="Environment variables" hint="Optional.">
          <div className={styles.envRows}>
            {draft.envRows.map((row, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity of their own
              <div key={i} className={styles.envRow}>
                <TextField
                  label={`Variable ${i + 1} name`}
                  hideLabel
                  mono
                  placeholder="KEY"
                  value={row.key}
                  onValueChange={(v) => {
                    const rows = draft.envRows.map((r, k) => (k === i ? { ...r, key: v } : r));
                    patch({ env: rows });
                  }}
                  spellCheck={false}
                  autoComplete="off"
                />
                <TextField
                  label={`Variable ${i + 1} value`}
                  hideLabel
                  mono
                  placeholder="value"
                  value={row.value}
                  onValueChange={(v) => {
                    const rows = draft.envRows.map((r, k) => (k === i ? { ...r, value: v } : r));
                    patch({ env: rows });
                  }}
                  spellCheck={false}
                  autoComplete="off"
                />
                <IconButton
                  icon="close"
                  label={`Remove variable ${i + 1}`}
                  variant="ghost"
                  size="sm"
                  onClick={() => patch({ env: draft.envRows.filter((_, k) => k !== i) })}
                />
              </div>
            ))}
          </div>
          <div>
            <Button
              size="sm"
              variant="secondary"
              icon="plus"
              disabled={draft.envRows.length >= 20}
              onClick={() => patch({ env: [...draft.envRows, { key: '', value: '' }] })}
            >
              Add variable
            </Button>
          </div>
          {secrets.length > 0 ? (
            <p className={styles.notice} data-tone="warn" role="status">
              We detected values that look like secrets ({secrets.join(', ')}). Your app will be registered as
              Enterprise, so its specification is encrypted. Enterprise apps cost slightly more.
            </p>
          ) : null}
        </Card>

        <Card title="Power">
          <Slider
            label="CPU"
            min={0.5}
            max={15}
            step={0.5}
            value={comp.cpu}
            unit="vCPU per copy"
            format={(n) => n.toFixed(1)}
            onValueChange={(v) => patch({ cpu: v })}
          />
          <Slider
            label="Memory"
            min={500}
            max={59000}
            step={500}
            value={comp.ram}
            format={(n) => gb(n)}
            unit="per copy"
            onValueChange={(v) => patch({ ram: v })}
          />
          <Slider
            label="Disk"
            min={1}
            max={820}
            step={1}
            value={comp.hdd}
            unit="GB per copy"
            onValueChange={(v) => patch({ hdd: v })}
          />
        </Card>

        <Card title="Storage">
          <Switch checked={draft.storeData} onCheckedChange={(on) => patch({ storeData: on })}>
            This app stores data
          </Switch>
          {draft.storeData ? (
            <>
              <TextField
                label="Folder to keep"
                mono
                value={draft.folder}
                placeholder="/data"
                onValueChange={(v) => patch({ folder: v })}
                spellCheck={false}
                autoComplete="off"
              />
              <Switch checked={draft.keepSafe} onCheckedChange={(on) => patch({ keepSafe: on })}>
                Keep it safe across node failures
              </Switch>
              {draft.keepSafe ? (
                <p className={styles.notice}>
                  Replicated storage runs on at least 2 instances - set to {draft.spec.instances}.
                </p>
              ) : null}
            </>
          ) : (
            <p className={styles.fineprint}>
              Without this the data path is <code className={styles.code}>/tmp</code>. That is still a plain
              volume on one node: it survives a restart and is lost with the node.
            </p>
          )}
        </Card>

        <Card title="Reliability">
          <fieldset className={styles.stepper}>
            <legend className="sr-only">Copies of your app</legend>
            <IconButton
              icon="minus"
              label="Fewer copies"
              variant="secondary"
              disabled={copies <= minCopies}
              onClick={() => patch({ copies: Math.max(minCopies, copies - 1) })}
            />
            <div className={styles.stepperValue}>
              <span className={styles.big}>{copies}</span>
              <span className={styles.unit}>Copies of your app</span>
            </div>
            <IconButton
              icon="plus"
              label="More copies"
              variant="secondary"
              disabled={copies >= 100}
              onClick={() => patch({ copies: Math.min(100, copies + 1) })}
            />
          </fieldset>
          <p className={styles.fineprint}>
            {copies <= 1
              ? COPY_ONE
              : `Runs on ${copies} independent nodes. If one goes offline, your app stays up.`}
          </p>
        </Card>

        <Card title="Location">
          <Switch checked={draft.regionsOn} onCheckedChange={(on) => patch({ regionsOn: on })}>
            Run only in specific regions
          </Switch>
          {draft.regionsOn ? (
            <>
              <fieldset className={styles.chips}>
                <legend className="sr-only">Regions</legend>
                {CONTINENTS.map((c) => {
                  const on = draft.spec.geolocation.includes(`ac${c.code}`);
                  return (
                    <Chip
                      key={c.code}
                      kind="filter"
                      selected={on}
                      onClick={() => {
                        const cur = draft.spec.geolocation
                          .map((g) => g.replace(/^ac/, ''))
                          .filter((code) => CONTINENTS.some((k) => k.code === code));
                        const next = on ? cur.filter((x) => x !== c.code) : [...cur, c.code];
                        patch({ continents: next });
                      }}
                    >
                      {c.label}
                    </Chip>
                  );
                })}
              </fieldset>
              <p className={styles.fineprint}>Restricting to fewer regions reduces the available nodes.</p>
            </>
          ) : (
            <p className={styles.fineprint}>Anywhere on the network.</p>
          )}
        </Card>

        <Card title="Subscription period" span="full">
          <PeriodPicker
            value={period?.id ?? '1m'}
            onChange={(id) => {
              const p = PERIODS.find((x) => x.id === id);
              if (p) patch({ periodBlocks: p.blocks });
            }}
          />
        </Card>

        <Card title="Estimated cost" span="full">
          <div className={styles.estimate}>
            <div className={styles.estimateHead}>
              <Chip size="sm" tone="accent">
                Live estimate
              </Chip>
              <span className={styles.estimateMain}>
                <span className={styles.big}>{usd(result.quote.usdTotal ?? 0)}</span>
                <span className={styles.unit}>/ subscription period ({period?.label ?? 'custom'})</span>
              </span>
            </div>
            <p className={styles.fineprint}>
              {plural(copies, 'copy', 'copies')} · pay in FLUX or by card · cancel anytime
            </p>
            <PriceFigure
              quote={result.quote}
              paramsSource={paramsSource}
              fluxMultiplier={fluxMultiplier}
              periodLabel={period?.label}
              showCard={false}
            />
          </div>
        </Card>
      </div>

      <div className={styles.submitRow}>
        <Switch
          checked={draft.tos}
          onCheckedChange={(on) => {
            if (on) setTosOpen(true);
            else patch({ tos: false });
          }}
        >
          I accept the Terms &amp; Conditions
        </Switch>
        <Button variant="primary" disabled={blockers.length > 0} onClick={onReview}>
          Review &amp; deploy
        </Button>
      </div>
      {blockers.length > 0 ? (
        <p className={styles.fineprint} data-testid="blockers">
          Still needed before Review &amp; deploy lights up: {blockers.join(' ')}
        </p>
      ) : null}
      <p className={styles.fineprint}>
        Need multiple containers, custom domains, commands, a static IP, or country-level location rules?{' '}
        <button type="button" className={styles.textLink} onClick={() => onMode('advanced')}>
          Open Advanced settings
        </button>
        {limits.length > 0 ? ` (this app already uses: ${limits.join(', ')})` : ''}
      </p>

      <Dialog
        open={tosOpen}
        onClose={() => setTosOpen(false)}
        title="Flux Terms of Service"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTosOpen(false)}>
              I Disagree
            </Button>
            <Button
              variant="primary"
              data-autofocus
              onClick={() => {
                patch({ tos: true });
                setTosOpen(false);
              }}
            >
              I Agree
            </Button>
          </>
        }
      >
        <p>
          The terms of service text is not reproduced in this simulation. In FluxCloud this dialog shows it,
          and you accept it once before you can review a deployment.
        </p>
      </Dialog>
    </div>
  );
}
