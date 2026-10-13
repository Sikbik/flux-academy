import { cloneFixture, MAX_EXPIRE_BLOCKS } from '@shared/flux';
import { describe, expect, it } from 'vitest';
import {
  applyControl,
  BACKOFF_SECONDS,
  backupUrlError,
  DEFAULT_BLOCKS_LEFT,
  filterLogs,
  initialInstances,
  instanceState,
  isSettling,
  MANAGE_TABS,
  presetSpec,
  renewalChoices,
  sampleApp,
  sampleLogs,
  sampleSeries,
  settle,
  subscriptionView,
  targetsFor,
} from './manage';

const HEIGHT = 3_031_422;

function web() {
  const spec = cloneFixture('web-app');
  if (!spec) throw new Error('fixture');
  return spec;
}

describe('tabs', () => {
  it('lists the ten Manage tabs in the order of FACTS 9.6', () => {
    expect(MANAGE_TABS.map((t) => t.label)).toEqual([
      'Specifications',
      'Information',
      'File Changes',
      'Monitoring',
      'Logs',
      'Secure Shell',
      'Control',
      'Backup & Restore',
      'Instances',
      'Subscription',
    ]);
  });
});

describe('the sample app and its subscription', () => {
  it('has the blocks left it was asked for', () => {
    const app = sampleApp(web(), HEIGHT);
    const view = subscriptionView(app, HEIGHT, Date.UTC(2026, 9, 12));
    expect(view.blocksLeft).toBe(DEFAULT_BLOCKS_LEFT);
    expect(view.endHeight).toBe(HEIGHT + DEFAULT_BLOCKS_LEFT);
    expect(view.underWeek).toBe(false);
    expect(view.maxExtend).toBe(MAX_EXPIRE_BLOCKS - DEFAULT_BLOCKS_LEFT);
  });

  it('turns blocks into time at 30 seconds a block', () => {
    const app = sampleApp(web(), HEIGHT, 2880);
    const view = subscriptionView(app, HEIGHT, 0);
    expect(view.untilMs).toBe(2880 * 30 * 1000);
  });

  it('reports under a week left', () => {
    const view = subscriptionView(sampleApp(web(), HEIGHT, 5000), HEIGHT, 0);
    expect(view.underWeek).toBe(true);
  });

  it('never has more left than the subscription was for', () => {
    const spec = web();
    const app = sampleApp(spec, HEIGHT, 10_000_000);
    expect(subscriptionView(app, HEIGHT, 0).blocksLeft).toBe(spec.expire);
  });

  it('offers only renewals that stay within one year', () => {
    expect(renewalChoices(0).map((p) => p.id)).toEqual(['1w', '2w', '1m', '3m', '6m', '1y']);
    expect(renewalChoices(57_200).map((p) => p.id)).toEqual(['1w', '2w', '1m', '3m', '6m']);
    expect(renewalChoices(1_000_000).map((p) => p.id)).toEqual(['1w', '2w']);
    expect(renewalChoices(MAX_EXPIRE_BLOCKS)).toEqual([]);
  });

  it('falls back to a known fixture', () => {
    expect(presetSpec(undefined, 'web-app').name).toBe('academy-web');
    expect(presetSpec('nope', 'web-app').name).toBe('academy-web');
    expect(presetSpec('hello-world', 'web-app').name).toBe('hello-flux');
  });
});

describe('global control', () => {
  const spec = web();

  it('starts every copy running on a different address', () => {
    const inst = initialInstances(spec);
    expect(inst).toHaveLength(3);
    expect(inst.every((i) => instanceState(i) === 'running')).toBe(true);
    expect(new Set(inst.map((i) => i.node.ip)).size).toBe(3);
  });

  it('picks the addresses a scope reaches', () => {
    const inst = initialInstances(spec);
    const [a, b] = inst.map((i) => i.node.ip) as [string, string];
    expect(targetsFor('global', inst, a, [])).toHaveLength(3);
    expect(targetsFor('local', inst, b, [a])).toEqual([b]);
    expect(targetsFor('manual', inst, a, [a, b])).toEqual([a, b]);
    expect(targetsFor('manual', inst, a, [])).toEqual([]);
    expect(targetsFor('local', inst, 'gone', [])).toEqual([]);
  });

  it('restarts one copy on Local and all on Global', () => {
    const inst = initialInstances(spec);
    const ip = inst[0]?.node.ip as string;
    const local = applyControl(inst, 'restart', [ip], spec);
    expect(local.touched).toBe(1);
    expect(local.instances.filter((i) => instanceState(i) === 'restarting')).toHaveLength(1);
    expect(local.note).toMatch(/1 of 3 instances/);
    const global = applyControl(inst, 'restart', targetsFor('global', inst, ip, []), spec);
    expect(global.touched).toBe(3);
    expect(isSettling(global.instances)).toBe(true);
    expect(settle(global.instances).every((i) => instanceState(i) === 'running')).toBe(true);
  });

  it('stops, pauses and starts only where the action applies', () => {
    const inst = initialInstances(spec);
    const all = inst.map((i) => i.node.ip);
    const stopped = applyControl(inst, 'stop', all, spec);
    expect(stopped.instances.every((i) => instanceState(i) === 'stopped')).toBe(true);
    expect(applyControl(stopped.instances, 'pause', all, spec).touched).toBe(0);
    expect(applyControl(stopped.instances, 'restart', all, spec).touched).toBe(0);
    const started = applyControl(stopped.instances, 'start', all, spec);
    expect(started.touched).toBe(3);
    const paused = applyControl(inst, 'pause', all, spec);
    expect(paused.instances.every((i) => instanceState(i) === 'paused')).toBe(true);
    expect(applyControl(paused.instances, 'unpause', all, spec).touched).toBe(3);
  });

  it('keeps data on a soft reinstall and deletes it on a hard one (FACTS 9.6)', () => {
    const inst = initialInstances(spec);
    const ip = inst[0]?.node.ip as string;
    const soft = applyControl(inst, 'soft', [ip], spec);
    expect(soft.instances[0]?.volume).toBe('original');
    expect(soft.note).toMatch(/data was kept/);
    const hard = applyControl(inst, 'hard', [ip], spec);
    expect(hard.instances[0]?.volume).toBe('recreated');
    expect(hard.instances[1]?.volume).toBe('original');
    expect(hard.note).toMatch(/data was deleted/);
  });

  it('removes a copy from its node so that another node picks it up', () => {
    const inst = initialInstances(spec);
    const ip = inst[0]?.node.ip as string;
    const out = applyControl(inst, 'remove', [ip], spec);
    expect(out.touched).toBe(1);
    expect(out.instances[0]?.node.ip).not.toBe(ip);
    expect(instanceState(out.instances[0] as never)).toBe('installing');
    expect(new Set(out.instances.map((i) => i.node.ip)).size).toBe(3);
  });
});

describe('sample log', () => {
  const spec = web();
  const comp = spec.compose[0]?.name as string;

  it('is a start-up and a few requests when healthy', () => {
    const lines = sampleLogs(spec, comp, 'healthy');
    expect(lines[0]?.text).toMatch(/^starting whoami/);
    expect(lines.some((l) => /listening on 0\.0\.0\.0:80/.test(l.text))).toBe(true);
    expect(lines.every((l) => l.level === 'info')).toBe(true);
  });

  it('spaces the restarts of a crash loop on the ladder 0, 30 s, 5, 15 and 30 minutes (FACTS 6.3)', () => {
    const lines = sampleLogs(spec, comp, 'crash-loop');
    const starts = lines.filter((l) => /^starting /.test(l.text)).map((l) => l.at);
    expect(starts).toHaveLength(BACKOFF_SECONDS.length);
    const gaps = starts.slice(1).map((s, i) => s - (starts[i] as number) - 1);
    expect(gaps).toEqual([30, 300, 900, 1800]);
    expect(lines.filter((l) => l.level === 'error')).toHaveLength(BACKOFF_SECONDS.length);
  });

  it('filters by keyword, ignoring case', () => {
    const lines = sampleLogs(spec, comp, 'healthy');
    expect(filterLogs(lines, 'HEALTH').every((l) => /health/i.test(l.text))).toBe(true);
    expect(filterLogs(lines, '').length).toBe(lines.length);
    expect(filterLogs(lines, 'zzzz')).toEqual([]);
  });
});

describe('monitoring series and backup urls', () => {
  it('draws a repeatable series that stays above zero', () => {
    const a = sampleSeries('cpu', 40, 20, 15);
    expect(a).toHaveLength(40);
    expect(sampleSeries('cpu', 40, 20, 15)).toEqual(a);
    expect(sampleSeries('mem', 40, 20, 15)).not.toEqual(a);
    expect(Math.min(...a)).toBeGreaterThanOrEqual(0);
  });

  it('wants a URL that ends with .tar.gz (FACTS 9.6)', () => {
    expect(backupUrlError('https://example.com/backup.tar.gz')).toBeNull();
    expect(backupUrlError('')).toBeNull();
    expect(backupUrlError('https://example.com/backup.zip')).toBe(
      'Please enter a valid URL ending with .tar.gz',
    );
    expect(backupUrlError('not a url')).toBe('Please enter a valid URL ending with .tar.gz');
  });
});
