import { describe, expect, it } from 'vitest';
import { splitSpans, tintInput } from './tint';

const joined = (line: string) =>
  tintInput(line)
    .map((s) => s.text)
    .join('');

describe('tintInput', () => {
  it('always gives the line back when joined', () => {
    for (const line of [
      '',
      'ls',
      '  docker   run -d --name "my app" -p 8080:80 nginx ',
      "echo 'unterminated",
      'a | b && c; d > out.txt 2>&1',
      'FOO=bar env',
      'éè --flag=“x”',
    ]) {
      expect(joined(line)).toBe(line);
    }
  });

  it('marks the command word, flags and quoted strings', () => {
    const spans = tintInput('docker run -d --name "web app" nginx');
    expect(spans.find((s) => s.text === 'docker')?.kind).toBe('cmd');
    expect(spans.find((s) => s.text === '-d')?.kind).toBe('flag');
    expect(spans.find((s) => s.text === '--name')?.kind).toBe('flag');
    expect(spans.find((s) => s.text === '"web app"')?.kind).toBe('str');
    expect(spans.find((s) => s.text === 'nginx')?.kind).toBeUndefined();
  });

  it('starts a new command after a pipe or &&', () => {
    const kinds = tintInput('curl -s url | jq .data && echo done').filter((s) => s.kind === 'cmd');
    expect(kinds.map((s) => s.text)).toEqual(['curl', 'jq', 'echo']);
  });

  it('does not treat a leading assignment as the command', () => {
    const spans = tintInput('FOO=bar env');
    expect(spans.find((s) => s.text === 'env')?.kind).toBe('cmd');
    expect(spans.find((s) => s.text === 'FOO=bar')?.kind).toBeUndefined();
  });

  it('keeps an unterminated quote as one string', () => {
    const spans = tintInput("echo 'hello world");
    expect(spans.at(-1)).toEqual({ text: "'hello world", kind: 'str' });
  });
});

describe('splitSpans', () => {
  it('cuts inside a span and keeps kinds', () => {
    const [a, b] = splitSpans(tintInput('docker run'), 3);
    expect(a).toEqual([{ text: 'doc', kind: 'cmd' }]);
    expect(b.map((s) => s.text).join('')).toBe('ker run');
    expect(b[0]).toEqual({ text: 'ker', kind: 'cmd' });
  });

  it('handles the ends', () => {
    const spans = tintInput('ls -l');
    expect(splitSpans(spans, 0)[0]).toEqual([]);
    expect(splitSpans(spans, 5)[1]).toEqual([]);
    expect(
      splitSpans(spans, 99)[0]
        .map((s) => s.text)
        .join(''),
    ).toBe('ls -l');
  });
});
