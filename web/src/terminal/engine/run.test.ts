import { describe, expect, it } from 'vitest';
import { firstMatch } from '@/learn/validate-terminal';
import { runLine } from './run';
import { cloneState, createContext, createState } from './state';
import { FIXED_NOW, make, run, script } from './testkit';
import type { ScriptWithRequires } from './types';

describe('scripted commands: the validator semantics', () => {
  it('matches the whole trimmed line, anchored', () => {
    const s = make();
    // The pattern `docker build -t (\S+) \.` is not written with ^ and $, yet is still whole-line.
    expect(run(s, 'docker build -t you/app:1.0.0 .').goals).toEqual(['build']);
    const t = make();
    expect(run(t, 'docker build -t you/app:1.0.0 . --no-cache').goals).toEqual([]);
    expect(run(t, 'echo docker build -t you/app:1.0.0 .').goals).toEqual([]);
  });

  it('runs the first matching command in array order', () => {
    const s = make(
      script({
        commands: [
          { match: '^echo (.*)$', output: ['first'] },
          { match: '^echo hi$', output: ['second'] },
        ],
        goals: [{ id: 'g', label: 'x' }],
      }),
    );
    expect(run(s, 'echo hi').text).toEqual(['first']);
  });

  it('agrees with the validator about which command an example reaches', () => {
    const sc = script();
    for (const [i, cmd] of sc.commands.entries()) {
      if (!cmd.example) continue;
      const s = make(sc);
      let ran: number[] = [];
      s.onCommand((e) => {
        ran = e.result.matched;
      });
      // Satisfy requirements by running earlier goal examples first.
      for (const step of s.plan([cmd.goal ?? ''])) if (step.line !== cmd.example) s.submit(step.line);
      s.submit(cmd.example);
      expect(firstMatch(sc, cmd.example), `validator, example of command ${i}`).toBe(i);
      expect(ran, `engine, example of command ${i}`).toEqual([i]);
    }
  });

  it('trims the input before matching', () => {
    const s = make();
    expect(run(s, '   docker build -t you/app:1.0.0 .   ').goals).toEqual(['build']);
  });

  it('substitutes captures into output, explain and writes', () => {
    const s = make();
    const r = run(s, 'docker build -t me/site:2 .');
    expect(r.text).toEqual(['[+] Building 1.0s (3/3) FINISHED', 'naming to docker.io/me/site:2']);
    expect(r.explain).toBe('Built **me/site:2**.');
    expect(s.readFile('/var/lib/docker/images/me/site:2')).toBe('built');
  });

  it('never lets captured text inject markup', () => {
    const s = make();
    run(s, 'docker build -t [err]x .');
    const entry = s.getState().entries.at(-1);
    const line = entry?.lines[1];
    expect(line?.text).toBe('naming to docker.io/[err]x');
    expect(line?.spans.every((sp) => sp.kind === 'ok')).toBe(true);
  });

  it('supports {0}, {input}, {cwd} and {user}', () => {
    const s = make(
      script({
        commands: [{ match: '^who (\\w+)$', output: ['{0}|{1}|{input}|{cwd}|{user}|{9}'] }],
        goals: [{ id: 'g', label: 'x' }],
      }),
    );
    expect(run(s, 'who me').text).toEqual(['who me|me|who me|~/app|learner|']);
  });

  it('leaves unknown braces alone (JSON, docker format strings)', () => {
    const s = make(
      script({
        commands: [{ match: '^fmt$', output: ['{"a":1}', '{{.Os}}/{{.Architecture}}', '{x}'] }],
        goals: [{ id: 'g', label: 'x' }],
      }),
    );
    expect(run(s, 'fmt').text).toEqual(['{"a":1}', '{{.Os}}/{{.Architecture}}', '{x}']);
  });

  it('credits goals once and reports them in completion order', () => {
    const s = make();
    const order: string[] = [];
    s.onGoal((g) => order.push(g));
    run(s, 'docker build -t you/app:1.0.0 .');
    run(s, 'docker push you/app:1.0.0');
    run(s, 'docker push you/app:1.0.0');
    expect(order).toEqual(['build', 'push']);
    expect(s.getState().completed).toEqual(['build', 'push']);
    expect(s.getState().allDone).toBe(true);
  });

  it('completes goals in any order', () => {
    const sc = script({
      commands: [
        { match: '^a$', output: ['a'], goal: 'A', example: 'a' },
        { match: '^b$', output: ['b'], goal: 'B', example: 'b' },
      ],
      goals: [
        { id: 'A', label: 'a' },
        { id: 'B', label: 'b' },
      ],
    });
    const s = make(sc);
    run(s, 'b');
    expect(s.getState().goals.map((g) => [g.id, g.done, g.order, g.next])).toEqual([
      ['A', false, 0, true],
      ['B', true, 1, false],
    ]);
    run(s, 'a');
    expect(s.getState().goals.map((g) => g.order)).toEqual([2, 1]);
  });

  it('ignores goal ids that are not declared in the tracker but keeps them as state', () => {
    const sc = script({
      commands: [
        { match: '^prep$', output: ['ok'], goal: 'hidden' },
        { match: '^go$', requires: ['hidden'], output: ['went'], goal: 'real' },
        { match: '^go$', output: ['not yet'] },
      ],
      goals: [{ id: 'real', label: 'x' }],
    });
    const s = make(sc);
    expect(run(s, 'go').text).toEqual(['not yet']);
    expect(run(s, 'prep').goals).toEqual([]);
    expect(run(s, 'go').text).toEqual(['went']);
    expect(s.getState().completed).toEqual(['real']);
  });
});

describe('requires', () => {
  it('skips an entry whose requirements fail and tries the next', () => {
    const s = make();
    expect(run(s, 'docker push you/app:1.0.0').text).toEqual([
      'An image does not exist locally with the tag: you/app:1.0.0',
    ]);
    run(s, 'docker build -t you/app:1.0.0 .');
    expect(run(s, 'docker push you/app:1.0.0').goals).toEqual(['push']);
  });

  it('templates captures into file requirements', () => {
    const s = make();
    run(s, 'docker build -t you/app:1.0.0 .');
    // A different tag was never built, so the file requirement fails for it.
    expect(run(s, 'docker push other/app:2').text[0]).toMatch(/does not exist locally/);
  });

  it('supports negation and alternatives', () => {
    const sc = script({
      commands: [
        { match: '^a$', output: ['a'], goal: 'A' },
        { match: '^b$', output: ['b'], goal: 'B' },
        { match: '^c$', requires: ['A|B'], output: ['c1'] },
        { match: '^c$', output: ['c0'] },
        { match: '^d$', requires: ['!A'], output: ['d1'] },
        { match: '^d$', output: ['d0'] },
        { match: '^e$', requires: ['file:server.js', '!file:nope'], output: ['e1'] },
        { match: '^e$', output: ['e0'] },
      ],
      goals: [
        { id: 'A', label: 'a' },
        { id: 'B', label: 'b' },
      ],
    });
    const s = make(sc);
    expect(run(s, 'c').text).toEqual(['c0']);
    expect(run(s, 'd').text).toEqual(['d1']);
    expect(run(s, 'e').text).toEqual(['e1']);
    run(s, 'b');
    expect(run(s, 'c').text).toEqual(['c1']);
    run(s, 'a');
    expect(run(s, 'd').text).toEqual(['d0']);
  });

  it('checks file requirements against the current directory', () => {
    const sc = script({
      commands: [
        { match: '^go$', requires: ['file:Dockerfile'], output: ['has dockerfile'] },
        { match: '^go$', output: ['no dockerfile'] },
      ],
      goals: [{ id: 'g', label: 'x' }],
    });
    const s = make(sc);
    expect(run(s, 'go').text).toEqual(['has dockerfile']);
    run(s, 'cd src');
    expect(run(s, 'go').text).toEqual(['no dockerfile']);
  });
});

describe('shell: chains', () => {
  it('runs && only after success', () => {
    const s = make();
    const r = run(s, 'docker build -t you/app:1.0.0 . && docker push you/app:1.0.0');
    expect(r.goals).toEqual(['build', 'push']);
    expect(r.text.some((l) => l.startsWith('The push refers'))).toBe(true);
  });

  it('stops a && chain at the first failure', () => {
    const s = make();
    const r = run(s, 'docker push you/app:1.0.0 && docker build -t you/app:1.0.0 .');
    expect(r.goals).toEqual([]);
    expect(r.text).toEqual(['An image does not exist locally with the tag: you/app:1.0.0']);
  });

  it('|| runs the right side only after failure, ; always', () => {
    const s = make();
    expect(run(s, 'ls nothing || echo recovered').text).toContain('recovered');
    expect(run(s, 'echo a || echo b').text).toEqual(['a']);
    expect(run(s, 'ls nothing ; echo after').text).toContain('after');
  });

  it('feeds goals in the order the commands ran', () => {
    const s = make();
    const seen: string[] = [];
    s.onGoal((g) => seen.push(g));
    run(s, 'docker build -t a/b:1 . ; docker push a/b:1');
    expect(seen).toEqual(['build', 'push']);
  });

  it('applies cd and exports across a chain', () => {
    const s = make();
    expect(run(s, 'cd src && pwd').text).toEqual(['/home/learner/app/src']);
    expect(run(s, 'export X=1; echo $X').text).toEqual(['1']);
  });

  it('prefers the whole line when a pattern names the operator', () => {
    const sc = script({
      commands: [
        {
          match: '^docker ps \\| grep web$',
          output: ['whole line'],
          goal: 'g',
          example: 'docker ps | grep web',
        },
        { match: '^docker ps$', output: ['plain ps'] },
      ],
      goals: [{ id: 'g', label: 'x' }],
    });
    const s = make(sc);
    expect(run(s, 'docker ps | grep web').text).toEqual(['whole line']);
    expect(run(s, 'docker ps').text).toEqual(['plain ps']);
  });

  it('reports syntax errors without running anything', () => {
    const s = make();
    expect(run(s, 'echo hi &&').text[0]).toMatch(/syntax error near unexpected token/);
    expect(run(s, 'echo "oops').text[0]).toMatch(/unexpected EOF/);
    expect(run(s, 'echo $(whoami)').text[0]).toMatch(/command substitution/);
    expect(s.getState().completed).toEqual([]);
  });
});

describe('shell: pipes and redirects', () => {
  it('pipes scripted output into builtins', () => {
    const sc = script({
      commands: [{ match: '^data$', output: ['alpha 1', 'beta 2', 'alpha 3', 'gamma 4'] }],
      goals: [{ id: 'g', label: 'x' }],
    });
    const s = make(sc);
    expect(run(s, 'data | grep alpha').text).toEqual(['alpha 1', 'alpha 3']);
    expect(run(s, 'data | grep -v alpha | wc -l').text).toEqual(['2']);
    expect(run(s, 'data | head -n 1').text).toEqual(['alpha 1']);
    expect(run(s, 'data | tail -2').text).toEqual(['alpha 3', 'gamma 4']);
    expect(run(s, 'data | grep -c a').text).toEqual(['4']);
    expect(run(s, 'data | grep -i ALPHA').text).toHaveLength(2);
  });

  it('keeps sandbox notes out of the pipe but still shows them', () => {
    const sc = script({
      commands: [{ match: '^data$', output: ['[note]recorded sample', 'one', 'two'] }],
      goals: [{ id: 'g', label: 'x' }],
    });
    const s = make(sc);
    expect(run(s, 'data | wc -l').text).toEqual(['recorded sample', '2']);
  });

  it('redirects output to a file and appends', () => {
    const s = make();
    expect(run(s, 'echo one > notes.txt').text).toEqual([]);
    run(s, 'echo two >> notes.txt');
    expect(run(s, 'cat notes.txt').text).toEqual(['one', 'two']);
    run(s, 'echo three > notes.txt');
    expect(run(s, 'cat notes.txt').text).toEqual(['three']);
  });

  it('writes redirects into folders that exist and errors otherwise', () => {
    const s = make();
    expect(run(s, 'echo x > src/out.txt').text).toEqual([]);
    expect(s.readFile('src/out.txt')).toBe('x\n');
    expect(run(s, 'echo x > missing/out.txt').text[0]).toMatch(/No such file or directory/);
  });

  it('discards output sent to /dev/null', () => {
    const s = make();
    expect(run(s, 'echo hidden > /dev/null').text).toEqual([]);
  });

  it('cat reads from a pipe', () => {
    const s = make();
    expect(run(s, 'echo hello | cat').text).toEqual(['hello']);
  });
});

describe('shell: variables and globs', () => {
  it('expands variables before matching scripted commands', () => {
    const s = make();
    run(s, 'export TAG=you/app:1.0.0');
    const r = run(s, 'docker build -t $TAG .');
    expect(r.goals).toEqual(['build']);
    expect(r.text[1]).toBe('naming to docker.io/you/app:1.0.0');
  });

  it('handles plain assignments', () => {
    const s = make();
    run(s, 'NAME=web');
    expect(run(s, 'echo $NAME').text).toEqual(['web']);
  });

  it('expands globs in builtins', () => {
    const s = make();
    expect(run(s, 'cat *.js').text.join('\n')).toContain('createServer');
    expect(run(s, 'ls *.nope').text[0]).toMatch(/cannot access '\*\.nope'/);
  });
});

describe('builtins', () => {
  it('ls lists the working directory, hiding dotfiles', () => {
    const s = make();
    expect(run(s, 'ls').text).toEqual(['src  Dockerfile  server.js']);
    expect(run(s, 'ls -a').text[0]).toBe('.  ..  src  .env.example  Dockerfile  server.js');
    expect(run(s, 'ls -1').text).toEqual(['src', 'Dockerfile', 'server.js']);
  });

  it('ls -l gives a long listing with a total, dates and sizes', () => {
    const s = make();
    const t = run(s, 'ls -l').text;
    expect(t[0]).toMatch(/^total \d+$/);
    expect(t[1]).toMatch(/^drwxr-xr-x 2 learner learner 4096 Oct 12 09:41 src$/);
    expect(t[2]).toMatch(/^-rw-r--r-- 1 learner learner +\d+ Oct 12 09:41 Dockerfile$/);
  });

  it('ls on a missing path and an invalid flag', () => {
    const s = make();
    expect(run(s, 'ls nope').text).toEqual(["ls: cannot access 'nope': No such file or directory"]);
    expect(run(s, 'ls -z').text[0]).toMatch(/invalid option -- 'z'/);
  });

  it('ls of several paths prints headings', () => {
    const s = make();
    expect(run(s, 'ls src /tmp').text).toEqual(['src:', 'main.js', '', '/tmp:']);
  });

  it('cat prints files, numbers lines and reports errors', () => {
    const s = make();
    expect(run(s, 'cat Dockerfile').text[0]).toBe('FROM node:22-alpine');
    expect(run(s, 'cat -n Dockerfile').text[0]).toBe('     1\tFROM node:22-alpine');
    expect(run(s, 'cat nope').text).toEqual(['cat: nope: No such file or directory']);
    expect(run(s, 'cat src').text).toEqual(['cat: src: Is a directory']);
    expect(run(s, 'cat').text[0]).toMatch(/needs a file name/);
  });

  it('cd, pwd, cd - and cd ~', () => {
    const s = make();
    expect(run(s, 'pwd').text).toEqual(['/home/learner/app']);
    run(s, 'cd src');
    expect(run(s, 'pwd').text).toEqual(['/home/learner/app/src']);
    expect(run(s, 'cd -').text).toEqual(['~/app']);
    expect(run(s, 'pwd').text).toEqual(['/home/learner/app']);
    run(s, 'cd');
    expect(run(s, 'pwd').text).toEqual(['/home/learner']);
    run(s, 'cd /tmp');
    expect(s.cwd).toBe('/tmp');
    expect(run(s, 'cd /nope').text).toEqual(['sandbox: cd: /nope: No such file or directory']);
    expect(run(s, 'cd /etc/hostname').text).toEqual(['sandbox: cd: /etc/hostname: Not a directory']);
  });

  it('echo, env, whoami, hostname, which', () => {
    const s = make();
    expect(run(s, 'echo "a   b" c').text).toEqual(['a   b c']);
    expect(run(s, 'echo -e "a\\nb"').text).toEqual(['a', 'b']);
    expect(run(s, 'env').text).toContain('USER=learner');
    expect(run(s, 'whoami').text).toEqual(['learner']);
    expect(run(s, 'hostname').text).toEqual(['sandbox']);
    expect(run(s, 'which ls').text).toEqual(['/usr/bin/ls']);
    expect(run(s, 'which docker').text).toEqual(['/usr/local/bin/docker']);
    expect(run(s, 'which nothing').text).toEqual([]);
  });

  it('history lists what was run, including the current line', () => {
    const s = make();
    run(s, 'ls');
    run(s, 'pwd');
    expect(run(s, 'history').text).toEqual(['    1  ls', '    2  pwd', '    3  history']);
  });

  it('date uses the injected clock', () => {
    const s = make();
    expect(run(s, 'date').text).toEqual(['Mon Oct 12 09:41:07 UTC 2026']);
    expect(new Date(FIXED_NOW).getUTCFullYear()).toBe(2026);
  });

  it('mkdir, touch and rm work on the virtual file system', () => {
    const s = make();
    run(s, 'mkdir -p a/b && touch a/b/f.txt');
    expect(run(s, 'ls a/b').text).toEqual(['f.txt']);
    expect(run(s, 'rm a/b').text).toEqual(["rm: cannot remove 'a/b': Is a directory"]);
    run(s, 'rm -r a');
    expect(s.exists('a')).toBe(false);
    expect(run(s, 'rm nope').text).toEqual(["rm: cannot remove 'nope': No such file or directory"]);
    expect(run(s, 'rm -f nope').text).toEqual([]);
  });

  it('refuses to remove the root, as GNU rm does', () => {
    const s = make();
    expect(run(s, 'rm -rf /').text[0]).toMatch(/dangerous to operate recursively on '\/'/);
    expect(s.exists('/etc/hostname')).toBe(true);
  });

  it('clear empties the transcript and keeps history', () => {
    const s = make();
    run(s, 'ls');
    expect(s.getState().entries.length).toBeGreaterThan(1);
    s.submit('clear');
    expect(s.getState().entries).toEqual([]);
    expect(s.historyList).toContain('ls');
  });

  it('head, tail and wc read files', () => {
    const s = make();
    expect(run(s, 'head -n 2 Dockerfile').text).toEqual(['FROM node:22-alpine', 'WORKDIR /app']);
    expect(run(s, 'tail -1 Dockerfile').text).toEqual(['CMD ["node", "server.js"]']);
    expect(run(s, 'wc -l Dockerfile').text).toEqual(['4 Dockerfile']);
    expect(run(s, 'grep -n FROM Dockerfile').text).toEqual(['1:FROM node:22-alpine']);
  });

  it('help lists examples with goal labels', () => {
    const s = make();
    const t = run(s, 'help').text.join('\n');
    expect(t).toContain('docker build -t you/app:1.0.0 .');
    expect(t).toContain('# Build the image');
    expect(t).toContain('Built in:');
  });

  it('has a few sandbox-aware replies', () => {
    const s = make();
    expect(run(s, 'sudo rm -rf /').text[0]).toMatch(/no root/);
    expect(run(s, 'exit').text[0]).toMatch(/no session to leave/);
  });
});

describe('builtin explanations and the pipe note', () => {
  it('has a what-just-happened for common builtins', () => {
    const s = make();
    expect(run(s, 'pwd').explain).toMatch(/full path/);
    expect(run(s, 'ls').explain).toMatch(/Lists the files/);
  });

  it('mentions the pipe when one ran', () => {
    const s = make();
    expect(run(s, 'ls | wc -l').explain).toMatch(/pipe/);
  });
});

describe('not found and the nudge', () => {
  it('prints the default message with the input', () => {
    const s = make();
    const t = run(s, 'frobnicate --now').text;
    expect(t[0]).toBe('sandbox: nothing is set up for `frobnicate --now` in this scenario.');
    expect(t[t.length - 1]).toBe('Type help to see what works in this scenario.');
  });

  it('uses the script notFound with {input} and {cmd}', () => {
    const s = make(script({ notFound: '[err]{cmd}: unknown ({input})' }));
    expect(run(s, 'zzz a b').text[0]).toBe('zzz: unknown (zzz a b)');
  });

  it('suggests the nearest example for a typo', () => {
    const s = make();
    const t = run(s, 'docker biuld -t you/app:1.0.0 .').text;
    expect(t).toContain('Did you mean `docker build -t you/app:1.0.0 .`?');
  });

  it('suggests the expected line when the command is right and the arguments differ', () => {
    const s = make();
    const t = run(s, 'docker build').text;
    expect(t.join('\n')).toContain('docker build -t you/app:1.0.0 .');
  });

  it('suggests a builtin for a mistyped word', () => {
    const s = make();
    expect(run(s, 'lss').text).toContain('Did you mean `ls`?');
    expect(run(s, 'gerp x').text).toContain('Did you mean `grep`?');
  });

  it('marks the run as not-found', () => {
    const s = make();
    s.submit('nonsense');
    expect(s.getState().entries.at(-1)?.runKind).toBe('not-found');
    expect(s.getState().entries.at(-1)?.exit).toBe(127);
  });

  it('says what happened: the sandbox did not run it and nothing changed', () => {
    const s = make();
    const r = run(s, 'frobnicate --now');
    expect(r.explain).toContain('only runs the commands this scenario is built around');
    expect(r.explain).toContain('nothing changed');
  });

  it('does not add that explanation when a scripted command ran in the same line', () => {
    const s = make();
    const r = run(s, 'docker build -t you/app:1.0.0 . && frobnicate');
    expect(r.explain).toBe('Built **you/app:1.0.0**.');
  });
});

describe('runLine directly', () => {
  it('mutates only the state it is given', () => {
    const ctx = createContext(script() as ScriptWithRequires, { now: () => FIXED_NOW });
    const base = createState(ctx);
    const work = cloneState(base);
    runLine(work, 'docker build -t a/b:1 .', ctx);
    expect(work.completed).toEqual(['build']);
    expect(base.completed).toEqual([]);
    expect(base.fs.exists('/var/lib/docker/images/a/b:1')).toBe(false);
  });

  it('reports which commands ran', () => {
    const ctx = createContext(script() as ScriptWithRequires, { now: () => FIXED_NOW });
    const state = createState(ctx);
    const r = runLine(state, 'docker build -t a/b:1 .', ctx);
    expect(r.matched).toEqual([0]);
    expect(r.kind).toBe('scripted');
    expect(r.exit).toBe(0);
  });

  it('gives a failing exit code when the output carries an error line', () => {
    const ctx = createContext(script() as ScriptWithRequires, { now: () => FIXED_NOW });
    const state = createState(ctx);
    const r = runLine(state, 'docker push a/b:1', ctx);
    expect(r.exit).toBe(1);
  });
});
