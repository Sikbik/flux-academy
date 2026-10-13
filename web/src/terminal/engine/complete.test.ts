import { describe, expect, it } from 'vitest';
import { make, run } from './testkit';
import { applyTemplate, levenshtein, nearest, nearestWord } from './text';

describe('tab completion', () => {
  it('offers nothing for an empty line', () => {
    const s = make();
    expect(s.complete('')).toEqual({ candidates: [], common: '', ghost: '' });
    expect(s.complete('   ').candidates).toEqual([]);
  });

  it('completes builtin names', () => {
    const s = make();
    const c = s.complete('his');
    expect(c.candidates).toEqual(['history']);
    expect(c.ghost).toBe('tory');
    expect(s.complete('c').candidates).toEqual(expect.arrayContaining(['cat', 'cd', 'clear']));
  });

  it('completes whole example lines', () => {
    const s = make();
    const c = s.complete('docker b');
    expect(c.candidates).toEqual(['docker build -t you/app:1.0.0 .']);
    expect(c.ghost).toBe('uild -t you/app:1.0.0 .');
  });

  it('offers open goals first', () => {
    const s = make();
    run(s, 'docker build -t you/app:1.0.0 .');
    expect(s.complete('docker ').candidates[0]).toBe('docker push you/app:1.0.0');
  });

  it('prefers what was run before, newest first', () => {
    const s = make();
    run(s, 'docker build -t me/site:1 .');
    run(s, 'docker build -t me/site:2 .');
    const c = s.complete('docker build -t me');
    expect(c.candidates.slice(0, 2)).toEqual(['docker build -t me/site:2 .', 'docker build -t me/site:1 .']);
    expect(c.common).toBe('docker build -t me/site:');
  });

  it('completes file and folder names for the last word', () => {
    const s = make();
    expect(s.complete('cat Do').candidates).toEqual(['cat Dockerfile']);
    expect(s.complete('cd s').candidates).toEqual(['cd src/']);
    expect(s.complete('cat src/m').candidates).toEqual(['cat src/main.js']);
    expect(s.complete('cat ').candidates).toEqual(['cat src/', 'cat Dockerfile', 'cat server.js']);
  });

  it('shows hidden files only when the prefix starts with a dot', () => {
    const s = make();
    expect(s.complete('cat .e').candidates).toEqual(['cat .env.example']);
    expect(s.complete('cat ').candidates).not.toContain('cat .env.example');
  });

  it('does not suggest the line it was given', () => {
    const s = make();
    expect(s.complete('ls').candidates).not.toContain('ls');
  });

  it('computes the common prefix', () => {
    const s = make();
    expect(s.complete('ca').common).toBe('cat');
    expect(s.complete('zzz')).toEqual({ candidates: [], common: 'zzz', ghost: '' });
  });
});

describe('edit distance and nudges', () => {
  it('counts a transposition as one edit', () => {
    expect(levenshtein('biuld', 'build')).toBe(1);
    expect(levenshtein('gerp', 'grep')).toBe(1);
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('same', 'same')).toBe(0);
  });

  it('bails out early past the limit', () => {
    expect(levenshtein('abcdefgh', 'zzzzzzzz', 2)).toBe(3);
    expect(levenshtein('a', 'abcdefgh', 2)).toBe(3);
  });

  it('finds the nearest line', () => {
    const examples = ['docker build -t you/app:1.0.0 .', 'docker push you/app:1.0.0', 'docker images'];
    expect(nearest('docker biuld -t you/app:1.0.0 .', examples)).toMatchObject({ kind: 'typo' });
    expect(nearest('docker  push  you/app:1.0.0', examples)).toMatchObject({
      suggestion: 'docker push you/app:1.0.0',
    });
    expect(nearest('docker build', examples)).toMatchObject({
      suggestion: 'docker build -t you/app:1.0.0 .',
      kind: 'args',
    });
    expect(nearest('completely different words', examples)).toBeNull();
    expect(nearest('', examples)).toBeNull();
  });

  it('finds the nearest word', () => {
    expect(nearestWord('lss', ['ls', 'cat'])).toBe('ls');
    expect(nearestWord('ls', ['ls'])).toBeNull();
    expect(nearestWord('x', ['ls'])).toBeNull();
    expect(nearestWord('dokcer', ['docker', 'curl'])).toBe('docker');
  });
});

describe('templates', () => {
  it('substitutes known placeholders only', () => {
    expect(applyTemplate('{1} and {2}', { groups: ['all', 'one'] })).toBe('one and ');
    expect(
      applyTemplate('{input}|{cwd}|{user}|{host}|{cmd}', {
        input: 'i',
        cwd: '~',
        user: 'u',
        host: 'h',
        cmd: 'c',
      }),
    ).toBe('i|~|u|h|c');
    expect(applyTemplate('{"a":{1}}', { groups: ['', 'x'] })).toBe('{"a":x}');
    expect(applyTemplate('no braces', {})).toBe('no braces');
  });
});
