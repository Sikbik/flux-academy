import { describe, expect, it } from 'vitest';
import { firstMatch } from '@/learn/validate-terminal';
import { parseMarkup } from './markup';
import { alignTable } from './table';
import { make, run, script } from './testkit';
import { applyTemplate } from './text';
import type { ScriptWithRequires } from './types';

function sc(over: Partial<ScriptWithRequires>) {
  return script(over as never);
}

describe('also', () => {
  const s = () =>
    make(
      sc({
        commands: [
          { match: '^build$', output: ['built'], goal: 'build', example: 'build' },
          {
            match: '^build --amd64$',
            output: ['built for amd64'],
            goal: 'amd64',
            also: ['build'],
            example: 'build --amd64',
          },
        ],
        goals: [
          { id: 'build', label: 'Build it' },
          { id: 'amd64', label: 'Build for amd64' },
        ],
      }),
    );

  it('credits the extra goal at the same time, goal first', () => {
    const session = s();
    expect(run(session, 'build --amd64').goals).toEqual(['amd64', 'build']);
    expect(session.getState().allDone).toBe(true);
  });

  it('never credits a goal twice', () => {
    const session = s();
    run(session, 'build');
    expect(run(session, 'build --amd64').goals).toEqual(['amd64']);
    expect(session.getState().completed).toEqual(['build', 'amd64']);
  });
});

describe('passthrough', () => {
  const files = { Dockerfile: 'FROM node:22-alpine\nCMD ["node", "server.js"]\n' };
  const make1 = () =>
    make(
      sc({
        files,
        commands: [
          {
            match: '^cat Dockerfile$',
            output: [],
            passthrough: true,
            goal: 'read',
            example: 'cat Dockerfile',
            explain: 'A Dockerfile is the recipe for an image.',
          },
          {
            match: '^curl -s (\\S+)$',
            output: ['{"status":"success","data":{"total":7105}}'],
          },
          {
            match: '^curl -s \\S+ \\| jq .+$',
            output: [],
            passthrough: true,
            goal: 'jq',
            example: 'curl -s https://x.test/a | jq .data.total',
          },
        ],
        goals: [
          { id: 'read', label: 'Read it' },
          { id: 'jq', label: 'Use jq' },
        ],
      }),
    );

  it('runs the real builtin and credits the goal afterwards', () => {
    const session = make1();
    const r = run(session, 'cat Dockerfile');
    expect(r.text).toEqual(['FROM node:22-alpine', 'CMD ["node", "server.js"]']);
    expect(r.goals).toEqual(['read']);
  });

  it('puts the entry explanation before the builtin one', () => {
    const session = make1();
    const r = run(session, 'cat Dockerfile');
    expect(r.explain?.startsWith('A Dockerfile is the recipe for an image.')).toBe(true);
  });

  it('does not credit when the command fails', () => {
    const session = make(
      sc({
        files: {},
        commands: [
          {
            match: '^cat Dockerfile$',
            output: [],
            passthrough: true,
            goal: 'read',
            example: 'cat Dockerfile',
          },
        ],
        goals: [{ id: 'read', label: 'Read it' }],
      }),
    );
    const r = run(session, 'cat Dockerfile');
    expect(r.goals).toEqual([]);
    expect(r.text.join('\n')).toContain('No such file');
  });

  it('credits a pipeline only when its last command succeeds', () => {
    const session = make1();
    const ok = run(session, 'curl -s https://x.test/a | jq .data.total');
    expect(ok.text).toEqual(['7105']);
    expect(ok.goals).toEqual(['jq']);

    const other = make1();
    const bad = run(other, 'curl -s https://x.test/a | jq .data.');
    expect(bad.goals).toEqual([]);
  });

  it('is invisible to the validator semantics: the example reaches its own entry', () => {
    const raw = sc({
      files,
      commands: [
        { match: '^cat Dockerfile$', output: [], passthrough: true, goal: 'read', example: 'cat Dockerfile' },
      ],
      goals: [{ id: 'read', label: 'Read it' }],
    });
    expect(firstMatch(raw, 'cat Dockerfile')).toBe(0);
  });
});

describe('templates', () => {
  const read = (path: string) =>
    ({
      '/img/you/app:1.0.0/arch': 'arm64\n',
      '/img/other/arch': 'amd64',
    })[path] ?? null;

  it('resolves placeholders inside the path of a {file:} template', () => {
    const out = applyTemplate('linux/{file:/img/{1}/arch}', {
      groups: ['', 'you/app:1.0.0'],
      readFile: read,
    });
    expect(out).toBe('linux/arm64');
  });

  it('gives nothing for a missing file', () => {
    expect(applyTemplate('[{file:/nope}]', { readFile: read })).toBe('[]');
  });

  it('never expands what was substituted from a capture', () => {
    const out = applyTemplate('name: {1}', { groups: ['', '{file:/img/other/arch}'], readFile: read });
    expect(out).toBe('name: {file:/img/other/arch}');
  });

  it('leaves unknown braces and an unclosed {file: alone', () => {
    expect(applyTemplate('{{.Os}}/{{.Architecture}}', {})).toBe('{{.Os}}/{{.Architecture}}');
    expect(applyTemplate('{file:/img/other/arch', { readFile: read })).toBe('{file:/img/other/arch');
  });
});

describe('table', () => {
  it('aligns tab separated cells to the widest cell plus three spaces', () => {
    const lines = ['ID\tNAME\tPORTS', 'a1\tweb\t80', 'b22222\tdb\t5432'].map((l) => parseMarkup(l));
    const out = alignTable(lines).map((l) => l.text);
    expect(out).toEqual(['ID       NAME   PORTS', 'a1       web    80', 'b22222   db     5432']);
  });

  it('keeps colour spans and leaves lines without a tab alone', () => {
    const lines = ['NAME\tSTATE', '[ok]web[/]\tUp', 'plain line'].map((l) => parseMarkup(l));
    const out = alignTable(lines);
    expect(out[1]?.text).toBe('web    Up');
    expect(out[1]?.spans[0]).toEqual({ text: 'web', kind: 'ok' });
    expect(out[2]?.text).toBe('plain line');
  });

  it('measures cells after templating, so a captured value sets the width', () => {
    const s = make(
      sc({
        commands: [
          {
            match: '^list (\\S+)$',
            output: ['NAME\tSTATE', '{1}\tUp'],
            table: true,
            example: 'list web',
            goal: 'g',
          },
        ],
        goals: [{ id: 'g', label: 'x' }],
      }),
    );
    expect(run(s, 'list longer-name').text).toEqual(['NAME          STATE', 'longer-name   Up']);
  });

  it('does not pad a trailing empty cell', () => {
    const lines = ['A\tB\t', 'ccc\tdd\t'].map((l) => parseMarkup(l));
    expect(alignTable(lines).map((l) => l.text)).toEqual(['A     B', 'ccc   dd']);
  });
});
