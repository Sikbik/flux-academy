/**
 * The tabs of the Manage page other than Subscription (FACTS 9.6). Labels and strings are the real ones;
 * the data behind them (logs, charts, backups, shell) is SAMPLE data written by the simulator, and each
 * tab says so where it matters.
 */
import {
  blocksToSeconds,
  CRASH_BACKOFF_MAX_MIN,
  CRASH_BACKOFF_SEC,
  type FluxAppSpec,
  humanDuration,
  parseContainerData,
} from '@shared/flux';
import { useEffect, useId, useMemo, useState } from 'react';
import { Button, Chip, CodeBlock, Meter, SegmentedControl, Select, Sparkline, Switch, TextField } from '@/ui';
import { useSimEnv } from './context';
import styles from './FluxcloudSim.module.css';
import {
  applyControl,
  BACKUP_URL_ERROR,
  backupUrlError,
  COMPONENT_LABEL,
  CONTROL_LABEL,
  type ControlAction,
  type ControlScope,
  filterLogs,
  HARD_TEXT,
  instanceState,
  isSettling,
  type LiveInstance,
  type LogScenario,
  type SampleApp,
  SOFT_TEXT,
  sampleLogs,
  sampleSeries,
  settle,
  targetsFor,
} from './manage';
import { Card } from './Parts';

interface Common {
  app: SampleApp;
  spec: FluxAppSpec;
}

// ---------------------------------------------------------------------------
// Specifications
// ---------------------------------------------------------------------------

export function SpecificationsTab({ spec }: Common) {
  const [which, setWhich] = useState<'local' | 'global'>('local');
  const code = useMemo(() => JSON.stringify(spec, null, 2), [spec]);
  return (
    <div className={styles.tabStack}>
      <SegmentedControl
        aria-label="Which specification"
        size="sm"
        value={which}
        onValueChange={(v) => setWhich(v as 'local' | 'global')}
        options={[
          { value: 'local', label: 'Local Specification' },
          { value: 'global', label: 'Global Specification' },
        ]}
      />
      <p className={styles.fineprint}>
        {which === 'local'
          ? 'What the selected node runs.'
          : 'What the network has registered for the app. The two match unless an update is still spreading.'}
      </p>
      <CodeBlock code={code} lang="json" label="App specification" maxHeight={340} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Information
// ---------------------------------------------------------------------------

export function InformationTab({ app, spec }: Common) {
  const { height } = useSimEnv();
  const up = humanDuration(blocksToSeconds(Math.max(0, height - app.registeredHeight)));
  return (
    <div className={styles.tabStack}>
      <p className={styles.fineprint}>Docker inspect style data, one block per component. Sample values.</p>
      {spec.compose.map((c) => {
        const mounts = parseContainerData(c.containerData).mounts;
        return (
          <Card key={c.name} title={c.name}>
            <dl className={styles.kv}>
              <div>
                <dt>Status</dt>
                <dd>running</dd>
              </div>
              <div>
                <dt>Uptime</dt>
                <dd>{up}</dd>
              </div>
              <div>
                <dt>Image</dt>
                <dd>
                  <code className={styles.code}>{c.repotag}</code>
                </dd>
              </div>
              <div>
                <dt>Ports</dt>
                <dd>
                  {c.ports.length === 0
                    ? 'none'
                    : c.ports.map((p, i) => `${p} to ${c.containerPorts[i] ?? p}`).join(', ')}
                </dd>
              </div>
              <div>
                <dt>Environment</dt>
                <dd>
                  {c.environmentParameters.length === 0 ? (
                    'none'
                  ) : (
                    <code className={styles.code}>{c.environmentParameters.join(' ')}</code>
                  )}
                </dd>
              </div>
              <div>
                <dt>Limits</dt>
                <dd>
                  {c.cpu} CPU, {c.ram} MB RAM, {c.hdd} GB disk
                </dd>
              </div>
              <div>
                <dt>Mounts</dt>
                <dd>
                  {mounts.map((m) => (
                    <code key={m.raw} className={styles.code}>
                      {m.raw}
                    </code>
                  ))}
                </dd>
              </div>
            </dl>
          </Card>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// File Changes
// ---------------------------------------------------------------------------

export function FileChangesTab() {
  const rows = [
    { path: '/app/state.json', kind: 0 },
    { path: '/app/cache/', kind: 1 },
    { path: '/tmp/upload.part', kind: 2 },
  ];
  return (
    <div className={styles.tabStack}>
      <p className={styles.rowText}>
        File changes inside Docker container (Kind: 0 = Modified, Kind: 1 = Added, Kind: 2 = Deleted)
      </p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="sr-only">Sample file changes</caption>
          <thead>
            <tr>
              <th scope="col">Path</th>
              <th scope="col">Kind</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.path}>
                <td>
                  <code className={styles.code}>{r.path}</code>
                </td>
                <td>{r.kind}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.fineprint}>
        Sample rows. A change made inside a running container is not part of the spec and does not survive a
        redeploy.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Monitoring
// ---------------------------------------------------------------------------

/** "30 seconds, 5 minutes, 15 minutes and 30 minutes": the crash restart ladder after the first restart. */
const CRASH_LADDER_TEXT: string = (() => {
  const [, first = 0, ...later] = CRASH_BACKOFF_SEC;
  const lead = [`${first} seconds`, ...later.slice(0, -1).map((sec) => `${sec / 60} minutes`)].join(', ');
  return `${lead} and ${CRASH_BACKOFF_MAX_MIN} minutes`;
})();

const RANGES = [
  'Last 15 Minutes',
  'Last 30 Minutes',
  'Last 1 Hour',
  'Last 2 Hours',
  'Last 3 Hours',
  'Last 5 Hours',
  'Last 1 Day',
  'Last 2 Days',
  'Last 3 Days',
  'Last 7 Days',
];

const CHARTS: { id: string; label: string; base: number; amp: number; unit: string }[] = [
  { id: 'cpu', label: 'CPU Utilization (%)', base: 18, amp: 12, unit: '%' },
  { id: 'mem', label: 'Memory Utilization (%)', base: 41, amp: 6, unit: '%' },
  { id: 'rx', label: 'RX on eth0', base: 120, amp: 90, unit: 'KB/s' },
  { id: 'tx', label: 'TX on eth0', base: 80, amp: 60, unit: 'KB/s' },
  { id: 'read', label: 'Read', base: 30, amp: 25, unit: 'KB/s' },
  { id: 'write', label: 'Write', base: 12, amp: 10, unit: 'KB/s' },
];

export function MonitoringTab({
  spec,
  monitoring,
}: {
  spec: FluxAppSpec;
  monitoring: 'on' | 'off' | 'deleted';
}) {
  const [range, setRange] = useState(RANGES[2] as string);
  if (monitoring !== 'on') {
    return (
      <div className={styles.tabStack}>
        <p className={styles.rowText}>
          {monitoring === 'deleted'
            ? 'Monitoring is stopped and its data is deleted. Start Monitoring in the Control tab.'
            : 'Monitoring is stopped. Start Monitoring in the Control tab.'}
        </p>
      </div>
    );
  }
  return (
    <div className={styles.tabStack}>
      <div className={styles.monitorHead}>
        <Select
          label="Time range"
          value={range}
          onValueChange={setRange}
          options={RANGES.map((r) => ({ value: r, label: r }))}
        />
        <Chip size="sm">Sample data</Chip>
      </div>
      <div className={styles.charts}>
        {CHARTS.map((c) => (
          <div key={c.id} className={styles.chart}>
            <p className={styles.chartLabel}>{c.label}</p>
            <Sparkline
              values={sampleSeries(`${spec.name}:${c.id}:${range}`, 48, c.base, c.amp)}
              height={52}
              label={`${c.label}, ${range}`}
              formatValue={(n) => `${n.toFixed(1)} ${c.unit}`}
              interactive={false}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

const LINE_COUNTS = ['25', '50', '100', '200'];
const SINCE = [
  { value: 'all', label: 'All available' },
  { value: '60', label: 'Last hour' },
  { value: '15', label: 'Last 15 minutes' },
];

export function LogsTab({
  spec,
  scenario,
  nowMs,
  announce,
}: {
  spec: FluxAppSpec;
  scenario: LogScenario;
  nowMs: number;
  announce: (t: string) => void;
}) {
  const [component, setComponent] = useState(spec.compose[0]?.name ?? '');
  const [count, setCount] = useState('100');
  const [since, setSince] = useState('all');
  const [query, setQuery] = useState('');
  const [stamps, setStamps] = useState(true);

  const all = useMemo(() => sampleLogs(spec, component, scenario), [spec, component, scenario]);
  const span = all.at(-1)?.at ?? 0;
  const start = nowMs - (span + 4) * 1000;
  const lines = useMemo(() => {
    const cutoff = since === 'all' ? -Infinity : nowMs - Number(since) * 60_000;
    const inWindow = all.filter((l) => start + l.at * 1000 >= cutoff);
    return filterLogs(inWindow, query).slice(-Number(count));
  }, [all, since, query, count, nowMs, start]);

  const text = lines
    .map((l) => `${stamps ? `${new Date(start + l.at * 1000).toISOString()} ` : ''}${l.text}`)
    .join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      announce('Log copied.');
    } catch {
      announce('Copying is not available in this browser.');
    }
  };

  return (
    <div className={styles.tabStack}>
      <h4 className={styles.cardTitle}>Log Viewer</h4>
      <div className={styles.logControls}>
        <Select
          label="Select Component"
          value={component}
          onValueChange={setComponent}
          options={spec.compose.map((c) => ({ value: c.name, label: c.name }))}
        />
        <Select
          label="Line Count"
          value={count}
          onValueChange={setCount}
          options={LINE_COUNTS.map((n) => ({ value: n, label: n }))}
        />
        <Select label="Logs Since" value={since} onValueChange={setSince} options={SINCE} />
        <TextField
          label="Filter Logs"
          placeholder="Enter keywords..."
          value={query}
          onValueChange={setQuery}
          autoComplete="off"
        />
      </div>
      <div className={styles.rowActions}>
        <Switch size="sm" checked={stamps} onCheckedChange={setStamps}>
          Display Timestamp
        </Switch>
        <Button size="sm" variant="secondary" icon="copy" onClick={copy}>
          Copy
        </Button>
        <Chip size="sm">Sample log</Chip>
      </div>
      <div className={styles.logView} role="log" aria-label="Log lines">
        {lines.length === 0 ? (
          <p className={styles.fineprint}>No lines match.</p>
        ) : (
          lines.map((l) => (
            <p key={`${l.at}|${l.text}`} className={styles.logLine} data-level={l.level}>
              {stamps ? (
                <time className={styles.logTime} dateTime={new Date(start + l.at * 1000).toISOString()}>
                  {new Date(start + l.at * 1000).toISOString().slice(11, 19)}
                </time>
              ) : null}
              <span>{l.text}</span>
            </p>
          ))
        )}
      </div>
      {scenario === 'crash-loop' ? (
        <p className={styles.fineprint}>
          Look at the starting lines. They are {CRASH_LADDER_TEXT} apart: the pauses FluxOS puts between
          restarts of a container that keeps exiting.
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Secure Shell
// ---------------------------------------------------------------------------

export function ShellTab({ spec }: { spec: FluxAppSpec }) {
  const [component, setComponent] = useState(spec.compose[0]?.name ?? '');
  const [command, setCommand] = useState('linux');
  const [connected, setConnected] = useState(false);
  const [asUser, setAsUser] = useState(false);
  const [withEnv, setWithEnv] = useState(false);
  const hdd = spec.compose.find((c) => c.name === component)?.hdd ?? 1;
  return (
    <div className={styles.tabStack}>
      <div className={styles.logControls}>
        <Select
          label="Select Component"
          value={component}
          onValueChange={setComponent}
          options={spec.compose.map((c) => ({ value: c.name, label: c.name }))}
        />
        <Select
          label="Select Command"
          value={command}
          onValueChange={setCommand}
          options={[
            { value: 'linux', label: 'Linux default' },
            { value: '/bin/bash', label: '/bin/bash' },
            { value: '/bin/ash', label: '/bin/ash' },
            { value: '/bin/sh', label: '/bin/sh' },
            { value: 'other', label: 'Other' },
            { value: 'custom', label: 'Custom' },
          ]}
        />
      </div>
      <div className={styles.rowActions}>
        <Switch size="sm" checked={asUser} onCheckedChange={setAsUser}>
          User
        </Switch>
        <Switch size="sm" checked={withEnv} onCheckedChange={setWithEnv}>
          Environment
        </Switch>
        {connected ? (
          <Button size="sm" variant="secondary" onClick={() => setConnected(false)}>
            Disconnect
          </Button>
        ) : (
          <Button size="sm" variant="primary" icon="terminal" onClick={() => setConnected(true)}>
            Connect
          </Button>
        )}
      </div>
      <pre className={styles.logBox} role="log" aria-label="Terminal" data-connected={connected}>
        {connected
          ? `$ (simulation: no shell is opened)\nIn FluxCloud this tab connects a terminal to the container\n"${component}" on the selected node, using ${command === 'linux' ? 'the default command' : command}.\nA change to the container's own filesystem is not part of the spec and is lost when the container is recreated. Files on the volume stay through a soft redeploy.`
          : 'Not connected.'}
      </pre>
      <Meter
        label="Volume usage"
        value={Math.min(hdd, Math.max(0.2, hdd * 0.18))}
        max={hdd}
        unit="GB"
        decimals={1}
        showMax
      />
      <p className={styles.fineprint}>
        The Volume Browser lists the volume's files, uploads (zip folders first), creates folders, downloads,
        renames, edits and deletes. The usage bar above is a sample.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Control
// ---------------------------------------------------------------------------

export function ControlTab({
  spec,
  instances,
  setInstances,
  selectedIp,
  monitoring,
  setMonitoring,
  log,
  pushLog,
  announce,
  ask,
}: {
  spec: FluxAppSpec;
  instances: LiveInstance[];
  setInstances: (i: LiveInstance[]) => void;
  selectedIp: string;
  monitoring: 'on' | 'off' | 'deleted';
  setMonitoring: (m: 'on' | 'off' | 'deleted') => void;
  log: string[];
  pushLog: (line: string) => void;
  announce: (t: string) => void;
  /** Ask for a confirmation; resolves through the callback. */
  ask: (title: string, body: string, confirm: string, go: () => void) => void;
}) {
  const { reducedMotion } = useSimEnv();
  const uid = useId();
  const [scope, setScope] = useState<ControlScope>('local');
  const [manual, setManual] = useState<string[]>([]);

  // Transitional states settle after a moment.
  const settling = isSettling(instances);
  useEffect(() => {
    if (!settling) return;
    const id = window.setTimeout(() => setInstances(settle(instances)), reducedMotion ? 150 : 1600);
    return () => window.clearTimeout(id);
  }, [settling, instances, reducedMotion, setInstances]);

  const targets = targetsFor(scope, instances, selectedIp, manual);

  const run = (action: ControlAction, only?: string) => {
    const res = applyControl(instances, action, targets, spec, only);
    setInstances(res.instances);
    pushLog(res.note);
    announce(res.note);
  };

  const confirmThen = (action: ControlAction) => {
    if (action === 'hard') {
      ask('Hard Reinstall', `Hard Reinstall ${HARD_TEXT}`, 'Hard Reinstall', () => run('hard'));
    } else if (action === 'remove') {
      ask(
        'Remove Application',
        'Remove Application takes the app off the selected nodes so that another node picks it up. It is not billing: the subscription continues.',
        'Remove Application',
        () => run('remove'),
      );
    } else run(action);
  };

  const actions: ControlAction[] = ['start', 'stop', 'restart', 'pause', 'unpause', 'remove', 'soft', 'hard'];

  return (
    <div className={styles.tabStack}>
      <div className={styles.controlHead}>
        <SegmentedControl
          aria-label="Control mode"
          size="sm"
          value={scope}
          onValueChange={(v) => setScope(v as ControlScope)}
          options={[
            { value: 'manual', label: 'Manual' },
            { value: 'local', label: 'Local' },
            { value: 'global', label: 'Global' },
          ]}
        />
        <p className={styles.fineprint} role="status">
          {scope === 'manual'
            ? 'Manual: pick the instances (IP addresses) to act on.'
            : scope === 'local'
              ? `Local: the selected node, ${selectedIp || 'none'}.`
              : `Global: all nodes, ${instances.length} ${instances.length === 1 ? 'instance' : 'instances'}.`}
        </p>
      </div>

      {scope === 'manual' ? (
        <fieldset className={styles.group}>
          <legend>Instances</legend>
          <div className={styles.checks}>
            {instances.map((i) => {
              const id = `${uid}-${i.node.ip}`;
              const on = manual.includes(i.node.ip);
              return (
                <label key={i.node.ip} htmlFor={id} className={styles.check}>
                  <input
                    id={id}
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      setManual((m) => (on ? m.filter((x) => x !== i.node.ip) : [...m, i.node.ip]))
                    }
                  />
                  <code className={styles.code}>{i.node.ip}</code>
                  <span className={styles.fineprint}>{i.node.countryName}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div className={styles.controlButtons}>
        {actions.map((a) => (
          <Button
            key={a}
            size="sm"
            variant={a === 'hard' || a === 'remove' ? 'danger' : 'secondary'}
            disabled={targets.length === 0}
            onClick={() => confirmThen(a)}
          >
            {CONTROL_LABEL[a]}
          </Button>
        ))}
      </div>
      <p className={styles.fineprint}>
        Soft Reinstall {SOFT_TEXT} Hard Reinstall {HARD_TEXT}
      </p>

      {spec.compose.length > 1 ? (
        <fieldset className={styles.group}>
          <legend>Per component</legend>
          {spec.compose.map((c) => (
            <div key={c.name} className={styles.compControl}>
              <strong>{c.name}</strong>
              <div className={styles.controlButtons}>
                {(Object.keys(COMPONENT_LABEL) as (keyof typeof COMPONENT_LABEL)[]).map((a) => (
                  <Button
                    key={a}
                    size="sm"
                    variant="ghost"
                    disabled={targets.length === 0}
                    onClick={() => run(a, c.name)}
                  >
                    {COMPONENT_LABEL[a]}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </fieldset>
      ) : null}

      <div className={styles.controlButtons}>
        <Button
          size="sm"
          variant="secondary"
          disabled={monitoring === 'on'}
          onClick={() => setMonitoring('on')}
        >
          Start Monitoring
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={monitoring !== 'on'}
          onClick={() => setMonitoring('off')}
        >
          Stop Monitoring
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={monitoring === 'deleted'}
          onClick={() => setMonitoring('deleted')}
        >
          Stop &amp; Delete Data
        </Button>
      </div>

      <h4 className={styles.cardTitle}>Instances</h4>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="sr-only">State of each instance</caption>
          <thead>
            <tr>
              <th scope="col">IP Address</th>
              <th scope="col">State</th>
              <th scope="col">Data</th>
            </tr>
          </thead>
          <tbody>
            {instances.map((i) => (
              <tr key={i.node.ip + i.node.country}>
                <td>
                  <code className={styles.code}>{i.node.ip}</code>
                </td>
                <td data-state={instanceState(i)}>{instanceState(i)}</td>
                <td>{i.volume === 'original' ? 'kept' : 'new, empty volume'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4 className={styles.cardTitle}>What you did</h4>
      {log.length === 0 ? (
        <p className={styles.fineprint}>Nothing yet.</p>
      ) : (
        <ol className={styles.actionLog} aria-label="Actions taken">
          {log.slice(-6).map((l, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: an append-only log
            <li key={i}>{l}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Backup & Restore
// ---------------------------------------------------------------------------

interface Backup {
  component: string;
  created: string;
  expires: string;
  size: string;
  manual: boolean;
}

export function BackupTab({ spec, announce }: { spec: FluxAppSpec; announce: (t: string) => void }) {
  const [sub, setSub] = useState<'backup' | 'restore'>('backup');
  const [picked, setPicked] = useState<string[]>([spec.compose[0]?.name ?? '']);
  const [list, setList] = useState<Backup[]>(() =>
    spec.compose.map((c) => ({
      component: c.name,
      created: 'Sample, 3 days ago',
      expires: 'with the app',
      size: '12 MB',
      manual: false,
    })),
  );
  const [method, setMethod] = useState<'drive' | 'upload' | 'url'>('drive');
  const [url, setUrl] = useState('');
  const [restored, setRestored] = useState<string | null>(null);
  const uid = useId();
  const urlError = backupUrlError(url);

  return (
    <div className={styles.tabStack}>
      <SegmentedControl
        aria-label="Backup or restore"
        size="sm"
        value={sub}
        onValueChange={(v) => setSub(v as 'backup' | 'restore')}
        options={[
          { value: 'backup', label: 'Backup' },
          { value: 'restore', label: 'Restore' },
        ]}
      />
      {sub === 'backup' ? (
        <>
          <p className={styles.rowText}>
            Automatic weekly backups are created and maintained while your app is active. The latest backup is
            always preserved until app expiration. You can also create manual backups anytime.
          </p>
          <p className={styles.fineprint}>
            That is the text FluxCloud shows. The FluxOS source read has no weekly scheduler, so take your
            own. A local backup is a file inside the volume of its component, on this node: it is not
            replicated, it counts against the disk size and it is lost with the node, a hard redeploy, a
            cancel or an expiry. Download it or send it to FluxDrive to keep it.
          </p>
          <fieldset className={styles.group}>
            <legend>Select component(s) to backup</legend>
            <div className={styles.checks}>
              {spec.compose.map((c) => {
                const id = `${uid}-${c.name}`;
                const on = picked.includes(c.name);
                return (
                  <label key={c.name} htmlFor={id} className={styles.check}>
                    <input
                      id={id}
                      type="checkbox"
                      checked={on}
                      onChange={() => setPicked((p) => (on ? p.filter((x) => x !== c.name) : [...p, c.name]))}
                    />
                    <span>{c.name}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className={styles.rowActions}>
            <Button
              size="sm"
              variant="primary"
              icon="save"
              disabled={picked.length === 0}
              onClick={() => {
                setList((l) => [
                  ...l,
                  ...picked.map((component) => ({
                    component,
                    created: 'Manual, just now',
                    expires: 'with the app',
                    size: '14 MB',
                    manual: true,
                  })),
                ]);
                announce(`Backup created for ${picked.join(', ')} (simulated).`);
              }}
            >
              Create Backup
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setList([])} disabled={list.length === 0}>
              Remove all backup files
            </Button>
          </div>
          <h4 className={styles.cardTitle}>Available Local Backups</h4>
          {list.length === 0 ? (
            <p className={styles.fineprint}>No backups on this node.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Component</th>
                    <th scope="col">Created</th>
                    <th scope="col">Expires</th>
                    <th scope="col">Size</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((b, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: an append-only list
                    <tr key={i}>
                      <td>{b.component}</td>
                      <td>{b.created}</td>
                      <td>{b.expires}</td>
                      <td>{b.size}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className={styles.rowActions}>
            <Button size="sm" variant="ghost" disabled>
              Download selected
            </Button>
            <Button size="sm" variant="ghost" disabled={list.length === 0}>
              Download all
            </Button>
            <span className={styles.fineprint}>Sample sizes. Nothing is downloaded in this simulation.</span>
          </div>
          <p className={styles.fineprint}>Free FluxDrive backups! Up to 10 GB total to use per user</p>
        </>
      ) : (
        <>
          <SegmentedControl
            aria-label="Restore method"
            size="sm"
            value={method}
            onValueChange={(v) => setMethod(v as typeof method)}
            options={[
              { value: 'drive', label: 'FluxDrive' },
              { value: 'upload', label: 'Upload File' },
              { value: 'url', label: 'Remote URL' },
            ]}
          />
          {method === 'url' ? (
            <TextField
              label="Remote URL"
              mono
              placeholder="https://example.com/backup.tar.gz"
              value={url}
              error={urlError ?? undefined}
              hint={`Must end in .tar.gz. ${BACKUP_URL_ERROR}`}
              onValueChange={setUrl}
              spellCheck={false}
              autoComplete="off"
            />
          ) : (
            <p className={styles.fineprint}>
              {method === 'drive'
                ? 'Pick a backup you saved to FluxDrive. Not simulated.'
                : 'Pick a .tar.gz file from your computer. Not simulated.'}
            </p>
          )}
          <div className={styles.rowActions}>
            <Button
              size="sm"
              variant="primary"
              disabled={method !== 'url' || url.trim() === '' || urlError !== null}
              onClick={() => {
                setRestored(url.trim());
                announce('Restore started (simulated).');
              }}
            >
              Restore
            </Button>
          </div>
          {restored ? (
            <p className={styles.rowText}>
              Simulation: FluxCloud would now replace the volume with the contents of{' '}
              <code className={styles.code}>{restored}</code>. Nothing was fetched.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Instances
// ---------------------------------------------------------------------------

export function InstancesTab({ instances, selectedIp }: { instances: LiveInstance[]; selectedIp: string }) {
  return (
    <div className={styles.tabStack}>
      <p className={styles.rowText}>
        Where the copies run. Sample nodes, shown with addresses reserved for documentation: nobody can reach
        them.
      </p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="sr-only">Instances of the app</caption>
          <thead>
            <tr>
              <th scope="col">IP Address</th>
              <th scope="col">Continent</th>
              <th scope="col">Country</th>
              <th scope="col">Region</th>
              <th scope="col">State</th>
            </tr>
          </thead>
          <tbody>
            {instances.map((i) => (
              <tr key={i.node.ip} className={i.node.ip === selectedIp ? styles.selectedRow : undefined}>
                <td>
                  <code className={styles.code}>{i.node.ip}</code>
                </td>
                <td>{i.node.continentName}</td>
                <td>{i.node.countryName}</td>
                <td>{i.node.region}</td>
                <td>{instanceState(i)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.fineprint}>
        FluxCloud also draws these on a world map. In practice each copy runs on a different node: no live app
        has two copies on one host. While a primary is being elected for a{' '}
        <code className={styles.code}>g:</code> app it says "Defining New Primary In Progress".
      </p>
    </div>
  );
}
