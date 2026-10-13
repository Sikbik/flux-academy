import { describe, expect, it } from 'vitest';
import { createSession } from './session';
import { lineDelays, ManualScheduler } from './stream';
import { FIXED_NOW, make, run, script } from './testkit';
import type { TerminalScript } from './types';

function streaming(sc: TerminalScript = script()) {
  const sched = new ManualScheduler();
  const session = createSession({
    script: sc,
    scheduler: sched,
    now: () => FIXED_NOW,
    reducedMotion: () => false,
  });
  return { session, sched };
}

const slow = (): TerminalScript =>
  script({
    commands: [
      {
        match: '^build$',
        output: ['one', 'two', 'three', 'four', 'five'],
        stream: 100,
        goal: 'B',
        example: 'build',
        explain: 'Built it.',
        writes: { 'out.txt': 'done' },
      },
    ],
    goals: [{ id: 'B', label: 'Build' }],
  });

describe('the intro', () => {
  it('starts with the script intro as the first entry', () => {
    const s = make();
    const e = s.getState().entries;
    expect(e).toHaveLength(1);
    expect(e[0]?.kind).toBe('intro');
    expect(e[0]?.lines[0]?.tone).toBe('dim');
    expect(e[0]?.lines[0]?.text).toBe('Simulation. Nothing here touches your machine or the network.');
  });

  it('shows no intro lines when the script has none', () => {
    const s = make(script({ intro: undefined }));
    expect(s.getState().entries[0]?.lines).toEqual([]);
  });
});

describe('prompt', () => {
  it('shows user, host, directory and symbol', () => {
    const s = make(script({ prompt: '%' }));
    expect(s.prompt()).toEqual({ user: 'learner', host: 'sandbox', cwd: '~/app', symbol: '%' });
    run(s, 'cd src');
    expect(s.prompt().cwd).toBe('~/app/src');
    run(s, 'cd /tmp');
    expect(s.prompt().cwd).toBe('/tmp');
  });

  it('honours the script cwd', () => {
    const s = make(script({ cwd: '/srv/site' }));
    expect(s.prompt().cwd).toBe('/srv/site');
  });

  it('echoes the directory the command ran in', () => {
    const s = make();
    run(s, 'cd src');
    run(s, 'pwd');
    const e = s.getState().entries;
    expect(e[1]?.cwd).toBe('~/app');
    expect(e[2]?.cwd).toBe('~/app/src');
  });
});

describe('streaming', () => {
  it('reveals one line at a time on the scheduler', () => {
    const { session, sched } = streaming(slow());
    const h = session.submit('build');
    const entry = () => session.getState().entries.at(-1);
    expect(entry()?.state).toBe('streaming');
    expect(entry()?.shown).toBe(0);
    expect(session.getState().busy).toBe(true);
    expect(session.getState().completed).toEqual([]);

    sched.advance(400);
    expect((entry()?.shown ?? 0) > 0).toBe(true);
    expect(entry()?.state).toBe('streaming');
    sched.flush();
    expect(entry()?.shown).toBe(5);
    expect(entry()?.state).toBe('done');
    expect(session.getState().busy).toBe(false);
    expect(session.getState().completed).toEqual(['B']);
    return h.finished;
  });

  it('credits goals only when streaming ends, then reports them', () => {
    const { session, sched } = streaming(slow());
    const seen: string[] = [];
    session.onGoal((g) => seen.push(g));
    session.submit('build');
    sched.advance(150);
    expect(seen).toEqual([]);
    expect(session.getState().goals[0]?.done).toBe(false);
    sched.flush();
    expect(seen).toEqual(['B']);
    expect(session.getState().goals[0]?.done).toBe(true);
  });

  it('applies file writes only when the command finishes', () => {
    const { session, sched } = streaming(slow());
    session.submit('build');
    sched.advance(150);
    expect(session.exists('out.txt')).toBe(false);
    sched.flush();
    expect(session.readFile('out.txt')).toBe('done');
  });

  it('skip reveals the rest at once', async () => {
    const { session } = streaming(slow());
    const h = session.submit('build');
    session.skip();
    await h.finished;
    const e = session.getState().entries.at(-1);
    expect(e?.shown).toBe(5);
    expect(e?.state).toBe('done');
    expect(session.getState().completed).toEqual(['B']);
  });

  it('submitting while streaming finishes the first command, then runs the second', () => {
    const { session, sched } = streaming(slow());
    session.submit('build');
    sched.advance(120);
    session.submit('pwd');
    const entries = session.getState().entries;
    expect(entries.at(-2)?.state).toBe('done');
    expect(entries.at(-2)?.shown).toBe(5);
    expect(session.getState().completed).toEqual(['B']);
    sched.flush();
    expect(entries.at(-1)?.input).toBe('pwd');
  });

  it('cancel prints ^C and discards goals and writes', async () => {
    const { session, sched } = streaming(slow());
    const h = session.submit('build');
    sched.advance(250);
    session.cancel();
    await h.finished;
    const e = session.getState().entries.at(-1);
    expect(e?.state).toBe('cancelled');
    expect(e?.lines.at(-1)?.text).toBe('^C');
    expect(e?.exit).toBe(130);
    expect(e?.explain).toMatch(/interrupted/);
    expect(session.getState().completed).toEqual([]);
    expect(session.exists('out.txt')).toBe(false);
    expect(session.getState().busy).toBe(false);
    // And it can be run again.
    session.submit('build');
    session.skip();
    expect(session.getState().completed).toEqual(['B']);
  });

  it('goes instant under reduced motion', () => {
    const sched = new ManualScheduler();
    const session = createSession({ script: slow(), scheduler: sched, reducedMotion: () => true });
    session.submit('build');
    expect(session.getState().entries.at(-1)?.state).toBe('done');
    expect(session.getState().completed).toEqual(['B']);
    expect(sched.pending).toBe(0);
  });

  it('goes instant when told to, and for builtins', () => {
    const { session } = streaming(slow());
    session.submit('pwd');
    expect(session.getState().entries.at(-1)?.state).toBe('done');
    expect(session.getState().busy).toBe(false);
  });

  it('notifies subscribers on every reveal', () => {
    const { session, sched } = streaming(slow());
    let n = 0;
    session.subscribe(() => {
      n += 1;
    });
    session.submit('build');
    sched.flush();
    expect(n).toBeGreaterThanOrEqual(6);
  });

  it('keeps a stable snapshot between changes', () => {
    const { session } = streaming(slow());
    const a = session.getState();
    expect(session.getState()).toBe(a);
    session.submit('pwd');
    expect(session.getState()).not.toBe(a);
  });

  it('resolves finished for commands that stream and for instant ones', async () => {
    const { session, sched } = streaming(slow());
    const h = session.submit('build');
    sched.flush();
    await h.finished;
    await session.submit('pwd').finished;
  });
});

describe('rhythm', () => {
  const lines = Array.from({ length: 12 }, (_, i) => ({
    spans: [],
    text: i === 4 ? '=> [2/3] COPY server.js .' : `line ${i}`,
    channel: 'out' as const,
  }));

  it('is deterministic for a seed and varies between seeds', () => {
    expect(lineDelays(lines, 40, 3)).toEqual(lineDelays(lines, 40, 3));
    expect(lineDelays(lines, 40, 3)).not.toEqual(lineDelays(lines, 40, 4));
  });

  it('stays within bounds and is zero for a zero base', () => {
    for (const d of lineDelays(lines, 40, 1)) {
      expect(d).toBeGreaterThanOrEqual(6);
      expect(d).toBeLessThanOrEqual(700 + 220);
    }
    expect(lineDelays(lines, 0)).toEqual(lines.map(() => 0));
  });

  it('breathes before a new build step', () => {
    const d = lineDelays(lines, 100, 1);
    const typical = d.filter((_, i) => i > 0 && i !== 4).reduce((a, b) => a + b, 0) / 10;
    expect(d[4] as number).toBeGreaterThan(typical);
  });
});

describe('reset', () => {
  it('returns to the intro, clears goals and the file system, keeps history', () => {
    const s = make();
    run(s, 'docker build -t a/b:1 .');
    run(s, 'cd src');
    run(s, 'touch x');
    s.reset();
    expect(s.getState().entries).toHaveLength(1);
    expect(s.getState().completed).toEqual([]);
    expect(s.cwd).toBe('/home/learner/app');
    expect(s.exists('src/x')).toBe(false);
    expect(s.exists('/var/lib/docker/images/a/b:1')).toBe(false);
    expect(s.historyList).toContain('docker build -t a/b:1 .');
  });

  it('cancels a running command', async () => {
    const { session } = streaming(slow());
    const h = session.submit('build');
    session.reset();
    await h.finished;
    expect(session.getState().busy).toBe(false);
    expect(session.getState().completed).toEqual([]);
  });
});

describe('history', () => {
  it('records submitted lines, collapsing immediate repeats', () => {
    const s = make();
    run(s, 'ls');
    run(s, 'ls');
    run(s, 'pwd');
    run(s, 'ls');
    expect(s.historyList).toEqual(['ls', 'pwd', 'ls']);
  });

  it('starts from supplied history and caps its length', () => {
    const initial = Array.from({ length: 500 }, (_, i) => `cmd ${i}`);
    const s = make(script(), { history: initial });
    expect(s.historyList).toHaveLength(200);
    expect(s.historyList.at(-1)).toBe('cmd 499');
  });

  it('does not record empty lines', () => {
    const s = make();
    expect(s.submit('   ').id).toBe(-1);
    expect(s.historyList).toEqual([]);
  });
});

describe('hints, examples and the solver plan', () => {
  it('nextExample follows the first open goal and its requirements', () => {
    const s = make();
    expect(s.nextExample()).toBe('docker build -t you/app:1.0.0 .');
    run(s, 'docker build -t you/app:1.0.0 .');
    expect(s.nextExample()).toBe('docker push you/app:1.0.0');
    run(s, 'docker push you/app:1.0.0');
    expect(s.nextExample()).toBeNull();
  });

  it('plan lists every open goal up to the last wanted, in script order', () => {
    const s = make();
    expect(s.plan()).toEqual([
      { goal: 'build', line: 'docker build -t you/app:1.0.0 .' },
      { goal: 'push', line: 'docker push you/app:1.0.0' },
    ]);
    // Asking for only the last goal still includes its prerequisites.
    expect(s.plan(['push']).map((p) => p.goal)).toEqual(['build', 'push']);
    run(s, 'docker build -t you/app:1.0.0 .');
    expect(s.plan(['push']).map((p) => p.goal)).toEqual(['push']);
  });

  it('following the plan completes the scenario', () => {
    const s = make();
    for (const step of s.plan()) s.submit(step.line);
    expect(s.getState().allDone).toBe(true);
  });

  it('suggestions put open goals first', () => {
    const s = make();
    run(s, 'docker build -t you/app:1.0.0 .');
    expect(s.suggestions()[0]).toBe('docker push you/app:1.0.0');
  });
});

describe('subscriptions', () => {
  it('stops notifying after unsubscribe and dispose', () => {
    const s = make();
    let n = 0;
    const off = s.subscribe(() => {
      n += 1;
    });
    run(s, 'pwd');
    const after = n;
    expect(after).toBeGreaterThan(0);
    off();
    run(s, 'pwd');
    expect(n).toBe(after);
    s.dispose();
    expect(s.submit('pwd').id).toBe(-1);
  });
});

describe('assisted commands', () => {
  it('records that the host ran a line, also when the command finishes inside submit', () => {
    const s = make();
    const seen: Array<boolean | undefined> = [];
    s.onCommand((e) => seen.push(e.entry.assisted));
    s.submit('pwd');
    s.submit('docker build -t you/app:1.0.0 .', { assisted: true });
    s.submit('docker push you/app:1.0.0', { assisted: false });
    expect(seen).toEqual([undefined, true, undefined]);
    const entries = s.getState().entries;
    expect(entries.find((e) => e.input === 'docker build -t you/app:1.0.0 .')?.assisted).toBe(true);
    expect(entries.find((e) => e.input === 'pwd')?.assisted).toBeUndefined();
  });

  it('survives streaming', () => {
    const { session, sched } = streaming(slow());
    const seen: Array<boolean | undefined> = [];
    session.onCommand((e) => seen.push(e.entry.assisted));
    session.submit('build', { assisted: true });
    expect(seen).toEqual([]);
    sched.flush();
    expect(seen).toEqual([true]);
  });
});
