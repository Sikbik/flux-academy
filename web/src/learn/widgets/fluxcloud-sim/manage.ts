/**
 * The "Manage page" of the FluxCloud simulator as pure data and functions: the tabs (FACTS 9.6, exact
 * labels in order), the sample app and its subscription arithmetic, global control, a sample log and sample
 * monitoring series. No React, no DOM, no clock: callers pass the tip height and the wall clock in.
 *
 * Block arithmetic comes from the engine's blocks helpers; prices from `quote` and `updateCredit` (see
 * review.ts). The numbers on a Monitoring chart and the lines of a log are SAMPLE data and the UI says so.
 */

import {
  blocksRemaining,
  blocksToSeconds,
  CRASH_BACKOFF_SEC,
  cloneFixture,
  type FluxAppSpec,
  MAX_EXPIRE_BLOCKS,
  parseContainerData,
} from '@shared/flux';
import { PERIODS, type Period } from './model';
import { placeInstances, type SimNode } from './timeline';

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

/** FACTS 9.6: "Specifications", "Information", "File Changes", "Monitoring", "Logs", "Secure Shell", "Control",
 * "Backup & Restore", "Instances", "Subscription", then "Audit" and "Audit Stats". */
export const MANAGE_TABS = [
  { id: 'specifications', label: 'Specifications' },
  { id: 'information', label: 'Information' },
  { id: 'file-changes', label: 'File Changes' },
  { id: 'monitoring', label: 'Monitoring' },
  { id: 'logs', label: 'Logs' },
  { id: 'secure-shell', label: 'Secure Shell' },
  { id: 'control', label: 'Control' },
  { id: 'backup', label: 'Backup & Restore' },
  { id: 'instances', label: 'Instances' },
  { id: 'subscription', label: 'Subscription' },
] as const;

export type ManageTabId = (typeof MANAGE_TABS)[number]['id'];

/** The two newer tabs FACTS lists but does not describe. They are shown and not simulated. */
export const NEWER_TABS: readonly string[] = ['Audit', 'Audit Stats'];

export function tabLabel(id: ManageTabId): string {
  return MANAGE_TABS.find((t) => t.id === id)?.label ?? id;
}

// ---------------------------------------------------------------------------
// The sample app and its subscription
// ---------------------------------------------------------------------------

/** About 19.8 days of a 30.6 day month left. */
export const DEFAULT_BLOCKS_LEFT = 57_200;

export interface SampleApp {
  spec: FluxAppSpec;
  /** The height the running message was mined at. */
  registeredHeight: number;
}

/** The spec of a fixture id, or of `fallback` when the id is missing or unknown. */
export function presetSpec(id: string | undefined, fallback: string): FluxAppSpec {
  const spec = (id ? cloneFixture(id) : undefined) ?? cloneFixture(fallback);
  if (!spec) throw new Error(`fixture ${fallback} is missing`);
  return spec;
}

/** An app with `blocksLeft` blocks left of its subscription at `currentHeight`. */
export function sampleApp(
  spec: FluxAppSpec,
  currentHeight: number,
  blocksLeft = DEFAULT_BLOCKS_LEFT,
): SampleApp {
  const left = Math.min(Math.max(1, Math.trunc(blocksLeft)), spec.expire);
  return { spec, registeredHeight: Math.round(currentHeight) - (spec.expire - left) };
}

export interface SubscriptionView {
  blocksLeft: number;
  /** Height at which the subscription ends. */
  endHeight: number;
  /** Estimated wall clock end, in ms. */
  untilMs: number;
  /** FACTS 9.6: "Expires in under a week. Renewal subscription to update." */
  underWeek: boolean;
  /** The most blocks a renewal can still add (one year in total). */
  maxExtend: number;
}

const WEEK_BLOCKS = 20_160;

export function subscriptionView(app: SampleApp, currentHeight: number, nowMs: number): SubscriptionView {
  const left = blocksRemaining(app.registeredHeight, app.spec.expire, currentHeight);
  return {
    blocksLeft: left,
    endHeight: app.registeredHeight + app.spec.expire,
    untilMs: nowMs + blocksToSeconds(left) * 1000,
    underWeek: left < WEEK_BLOCKS,
    maxExtend: Math.max(0, MAX_EXPIRE_BLOCKS - left),
  };
}

/** FACTS 9.4.3: "Renewal options are adjusted based on your current remaining time." Total may not exceed 1 year. */
export function renewalChoices(blocksLeft: number): Period[] {
  return PERIODS.filter((p) => blocksLeft + p.blocks <= MAX_EXPIRE_BLOCKS);
}

// ---------------------------------------------------------------------------
// Global control (FACTS 9.6, Control tab)
// ---------------------------------------------------------------------------

export type ControlScope = 'manual' | 'local' | 'global';
export type ComponentState = 'running' | 'stopped' | 'paused' | 'restarting' | 'reinstalling' | 'installing';
export type ControlAction = 'start' | 'stop' | 'restart' | 'pause' | 'unpause' | 'remove' | 'soft' | 'hard';

/** FACTS 9.6 and 9.14, exact labels. */
export const CONTROL_LABEL: Record<ControlAction, string> = {
  start: 'Start Application',
  stop: 'Stop Application',
  restart: 'Restart Application',
  pause: 'Pause Application',
  unpause: 'Unpause Application',
  remove: 'Remove Application',
  soft: 'Soft Reinstall',
  hard: 'Hard Reinstall',
};

export const COMPONENT_LABEL: Record<'start' | 'stop' | 'restart' | 'pause' | 'unpause', string> = {
  start: 'Start Component',
  stop: 'Stop Component',
  restart: 'Restart Component',
  pause: 'Pause Component',
  unpause: 'Unpause Component',
};

/** FACTS 9.6, quoted. */
export const SOFT_TEXT = 'will redeploy the application while keeping existing data.';
export const HARD_TEXT =
  'will completely remove and redeploy the application. All application data will be deleted. This action cannot be undone.';

export interface LiveInstance {
  node: SimNode;
  components: Record<string, ComponentState>;
  /** `recreated` after a hard reinstall: the volume is new and empty. */
  volume: 'original' | 'recreated';
}

export function initialInstances(spec: FluxAppSpec): LiveInstance[] {
  return placeInstances(spec, spec.instances).map((node) => ({
    node,
    components: Object.fromEntries(spec.compose.map((c) => [c.name, 'running' as ComponentState])),
    volume: 'original' as const,
  }));
}

/** The addresses an action reaches under a scope. */
export function targetsFor(
  scope: ControlScope,
  instances: readonly LiveInstance[],
  selectedIp: string,
  manualIps: readonly string[],
): string[] {
  if (scope === 'global') return instances.map((i) => i.node.ip);
  if (scope === 'local') return instances.some((i) => i.node.ip === selectedIp) ? [selectedIp] : [];
  return instances.map((i) => i.node.ip).filter((ip) => manualIps.includes(ip));
}

/** FACTS 7.2: `r:`, `g:` and `s:` volumes are kept in step between the copies. */
export function isSynced(spec: FluxAppSpec): boolean {
  return spec.compose.some((c) => parseContainerData(c.containerData).syncMode !== null);
}

export interface ControlResult {
  instances: LiveInstance[];
  /** How many instances were reached. */
  touched: number;
  /** One plain sentence for the action log and the live region. */
  note: string;
}

/** The state a component enters, or null when the action does not apply to it. */
function nextState(action: ControlAction, state: ComponentState): ComponentState | null {
  switch (action) {
    case 'start':
      return state === 'stopped' ? 'running' : null;
    case 'stop':
      return state === 'running' || state === 'paused' ? 'stopped' : null;
    case 'restart':
      return state === 'running' || state === 'paused' ? 'restarting' : null;
    case 'pause':
      return state === 'running' ? 'paused' : null;
    case 'unpause':
      return state === 'paused' ? 'running' : null;
    case 'remove':
      return 'installing';
    case 'soft':
    case 'hard':
      return 'reinstalling';
    default:
      return null;
  }
}

/**
 * Apply an action to the instances at `targets`, to every component or to the named ones. `remove` takes the
 * app off the node; FACTS 9.5.4: "another node picks it up; the subscription continues", so the copy is
 * shown installing on a different sample node.
 */
export function applyControl(
  instances: readonly LiveInstance[],
  action: ControlAction,
  targets: readonly string[],
  spec: FluxAppSpec,
  only?: string,
): ControlResult {
  let touched = 0;
  const used = new Set(instances.map((i) => i.node.ip));
  const out = instances.map((inst) => {
    if (!targets.includes(inst.node.ip)) return inst;
    const comps = { ...inst.components };
    let changed = false;
    for (const name of Object.keys(comps)) {
      if (only && name !== only) continue;
      const cur = comps[name] as ComponentState;
      const n = nextState(action, cur);
      if (n !== null && n !== cur) {
        comps[name] = n;
        changed = true;
      }
    }
    if (!changed) return inst;
    touched += 1;
    let node = inst.node;
    let volume = inst.volume;
    if (action === 'remove') {
      const pool = placeInstances(spec, spec.instances + instances.length + 4);
      const fresh = pool.find((n) => !used.has(n.ip));
      if (fresh) {
        node = fresh;
        used.add(fresh.ip);
      }
      // A synced volume (r:, g:, s:) is rebuilt from the other copies; a local one starts empty.
      if (!isSynced(spec)) volume = 'recreated';
    }
    if (action === 'hard') volume = 'recreated';
    return { node, components: comps, volume };
  });
  const what = only ? `${only}` : 'the application';
  const verb = CONTROL_LABEL[action];
  let note: string;
  if (touched === 0) {
    note = `${verb}: nothing to do. No selected instance is in a state this action applies to.`;
  } else {
    const where = `${touched} of ${instances.length} ${instances.length === 1 ? 'instance' : 'instances'}`;
    note = `${verb} sent to ${where}${only ? ` (${what})` : ''}.`;
    if (action === 'hard') note += ' Their data was deleted.';
    if (action === 'soft') note += ' Their data was kept.';
    if (action === 'remove') note += ' The app was removed from the node; another node picks it up.';
  }
  return { instances: out, touched, note };
}

/** After a moment, transitional states settle into running. */
export function settle(instances: readonly LiveInstance[]): LiveInstance[] {
  return instances.map((inst) => {
    let changed = false;
    const comps = { ...inst.components };
    for (const [name, st] of Object.entries(comps)) {
      if (st === 'restarting' || st === 'reinstalling' || st === 'installing') {
        comps[name] = 'running';
        changed = true;
      }
    }
    return changed ? { ...inst, components: comps } : inst;
  });
}

export function isSettling(instances: readonly LiveInstance[]): boolean {
  return instances.some((i) =>
    Object.values(i.components).some((s) => s === 'restarting' || s === 'reinstalling' || s === 'installing'),
  );
}

/** One word for an instance: the common state of its components, else `mixed`. */
export function instanceState(inst: LiveInstance): ComponentState | 'mixed' {
  const states = Array.from(new Set(Object.values(inst.components)));
  return states.length === 1 ? (states[0] as ComponentState) : 'mixed';
}

// ---------------------------------------------------------------------------
// Sample log
// ---------------------------------------------------------------------------

export type LogScenario = 'healthy' | 'crash-loop';

export interface LogLine {
  /** Seconds since the first line. */
  at: number;
  level: 'info' | 'warn' | 'error';
  text: string;
}

/** FACTS 6.3: crash backoff ladder 0, 30 s, 5 min, 15 min, 30 min. */
export const BACKOFF_SECONDS: readonly number[] = CRASH_BACKOFF_SEC;

function processName(repotag: string): string {
  const last = repotag.split('/').pop() ?? repotag;
  return last.split(':')[0] || 'app';
}

/**
 * A sample log, oldest first. `healthy` is a start-up and a few requests; `crash-loop` is a container that
 * exits on start because a variable is missing, restarted on FluxOS's backoff ladder.
 */
export function sampleLogs(spec: FluxAppSpec, componentName: string, scenario: LogScenario): LogLine[] {
  const comp = spec.compose.find((c) => c.name === componentName) ?? spec.compose[0];
  if (!comp) return [];
  const proc = processName(comp.repotag);
  const port = comp.containerPorts[0] ?? 80;
  const lines: LogLine[] = [];
  if (scenario === 'crash-loop') {
    let t = 0;
    BACKOFF_SECONDS.forEach((delay, i) => {
      t += delay;
      lines.push({ at: t, level: 'info', text: `starting ${proc} (attempt ${i + 1})` });
      lines.push({
        at: t + 1,
        level: 'error',
        text: 'fatal: required environment variable DATABASE_URL is not set',
      });
      lines.push({ at: t + 1, level: 'warn', text: `${proc} exited with code 1` });
      t += 1;
    });
    return lines;
  }
  lines.push({ at: 0, level: 'info', text: `starting ${proc}` });
  lines.push({ at: 1, level: 'info', text: `listening on 0.0.0.0:${port}` });
  lines.push({ at: 2, level: 'info', text: 'ready to accept connections' });
  const paths = ['/', '/health', '/', '/favicon.ico', '/', '/health'];
  paths.forEach((p, i) => {
    lines.push({ at: 40 + i * 23, level: 'info', text: `GET ${p} 200 ${3 + ((i * 7) % 11)}ms` });
  });
  return lines;
}

/** Keep lines containing the keywords, case-insensitive. FACTS 9.6: "Filter Logs". */
export function filterLogs(lines: readonly LogLine[], query: string): LogLine[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [...lines];
  return lines.filter((l) => l.text.toLowerCase().includes(q));
}

// ---------------------------------------------------------------------------
// Sample monitoring series
// ---------------------------------------------------------------------------

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A smooth, repeatable series: `points` values around `base`, wobbling by up to `amp`. */
export function sampleSeries(seed: string, points: number, base: number, amp: number): number[] {
  const phase = (hash(seed) % 628) / 100;
  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    const x = i / 6 + phase;
    const v = base + amp * (0.6 * Math.sin(x) + 0.4 * Math.sin(x * 2.3 + 1.1));
    out.push(Math.max(0, Number(v.toFixed(2))));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Backup and restore (FACTS 9.6)
// ---------------------------------------------------------------------------

/** FACTS 9.6: "Please enter a valid URL ending with .tar.gz". */
export const BACKUP_URL_ERROR = 'Please enter a valid URL ending with .tar.gz';

export function backupUrlError(value: string): string | null {
  const v = value.trim();
  if (v === '') return null;
  try {
    const u = new URL(v);
    if ((u.protocol !== 'https:' && u.protocol !== 'http:') || !u.pathname.endsWith('.tar.gz')) {
      return BACKUP_URL_ERROR;
    }
    return null;
  } catch {
    return BACKUP_URL_ERROR;
  }
}
