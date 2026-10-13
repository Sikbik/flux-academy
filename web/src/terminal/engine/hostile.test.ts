// biome-ignore-all lint/suspicious/noTemplateCurlyInString: hostile inputs include literal ${ on purpose
import { describe, expect, it } from 'vitest';
import { MAX_LINE_LENGTH, MAX_OUTPUT_LINES, sanitizeInput, sanitizeOutput } from './sanitize';
import { make, run, script } from './testkit';

describe('sanitizeInput', () => {
  it('trims and keeps ordinary lines', () => {
    expect(sanitizeInput('  ls -la  ')).toMatchObject({ line: 'ls -la', tooLong: false });
  });

  it('removes control characters, escapes and invisible characters', () => {
    expect(sanitizeInput('ls\u0000\u0007 -l').line).toBe('ls -l');
    expect(sanitizeInput('\u001b[31mls\u001b[0m').line).toBe('ls');
    expect(sanitizeInput('\u001b]0;title\u0007echo hi').line).toBe('echo hi');
    expect(sanitizeInput('echo ‮hi‬').line).toBe('echo hi');
    expect(sanitizeInput('ec​ho x').line).toBe('echo x');
    expect(sanitizeInput('a\tb').line).toBe('a b');
    expect(sanitizeInput('ls\u007f').line).toBe('ls');
  });

  it('takes the first non-empty line of a paste', () => {
    expect(sanitizeInput('\n\nls\npwd\n').line).toBe('ls');
    expect(sanitizeInput('a\r\nb').line).toBe('a');
  });

  it('refuses very long lines without keeping them', () => {
    const r = sanitizeInput('a'.repeat(MAX_LINE_LENGTH + 1));
    expect(r.tooLong).toBe(true);
    expect(r.line).toBe('');
    expect(sanitizeInput('a'.repeat(5_000_000)).tooLong).toBe(true);
    expect(sanitizeInput('a'.repeat(MAX_LINE_LENGTH)).tooLong).toBe(false);
  });

  it('survives non-strings', () => {
    expect(sanitizeInput(undefined as never).line).toBe('');
    expect(sanitizeInput(42 as never).line).toBe('');
  });

  it('normalises unicode', () => {
    expect(sanitizeInput('é').line).toBe('é');
  });
});

describe('sanitizeOutput', () => {
  it('cleans and bounds output text', () => {
    expect(sanitizeOutput('ok\u001b[31m red\u0000')).toBe('ok red');
    expect(sanitizeOutput('x'.repeat(5000))).toHaveLength(2000);
  });
});

describe('the engine under hostile input', () => {
  it('rejects a megabyte line without running or remembering it', () => {
    const s = make();
    s.submit('a'.repeat(1_000_000));
    const last = s.getState().entries.at(-1);
    expect(last?.runKind).toBe('refused');
    expect(last?.lines[0]?.text).toMatch(/too long/);
    expect(last?.input.length).toBeLessThan(80);
    expect(s.historyList).toEqual([]);
  });

  it('is not fooled by control characters in a command', () => {
    const s = make();
    expect(run(s, 'docker\u0000 build -t you/app:1.0.0 .').goals).toEqual(['build']);
    expect(run(s, '\u001b[1mdocker build -t you/app:2 .').goals).toEqual([]);
  });

  it('fails closed on a catastrophic pattern from a script', () => {
    const trips: string[] = [];
    const s = make(
      script({
        commands: [
          { match: '^(a+)+$', output: ['matched'], goal: 'g' },
          { match: '^safe$', output: ['safe'] },
        ],
        goals: [{ id: 'g', label: 'x' }],
      }),
      { onPatternTrip: (src, reason) => trips.push(`${src}:${reason}`) },
    );
    const started = Date.now();
    const r = run(s, `${'a'.repeat(60)}!`);
    expect(Date.now() - started).toBeLessThan(1500);
    expect(r.goals).toEqual([]);
    expect(trips).toEqual(['^(a+)+$:budget']);
    // Other commands still work afterwards.
    expect(run(s, 'safe').text).toEqual(['safe']);
  });

  it('refuses an invalid pattern without breaking the rest of the script', () => {
    const trips: string[] = [];
    const s = make(
      script({
        commands: [
          { match: '^(unclosed$', output: ['never'] },
          { match: '^ok$', output: ['fine'] },
        ],
        goals: [{ id: 'g', label: 'x' }],
      }),
      { onPatternTrip: (src, reason) => trips.push(`${src}:${reason}`) },
    );
    expect(run(s, 'ok').text).toEqual(['fine']);
    expect(trips).toEqual(['^(unclosed$:invalid']);
  });

  it('survives pathological shell input', () => {
    const s = make();
    const nasty = [
      '&&&&&&&&',
      '|||||',
      ';;;;;',
      '>',
      '>>>>',
      '"',
      "'",
      '\\',
      '$',
      '${',
      '${}',
      '$((1+1))',
      '`whoami`',
      '*'.repeat(200),
      '~'.repeat(100),
      `echo ${'$HOME'.repeat(100)}`,
      `cat ${'../'.repeat(500)}`,
      `ls ${'a/'.repeat(200)}`,
      '(){ :|:& };:',
      'echo $((',
      '\u0000\u0001\u0002',
      '😀'.repeat(200),
      'echo \uD800',
    ];
    for (const line of nasty) {
      expect(() => s.submit(line), JSON.stringify(line)).not.toThrow();
    }
    // And the shell still works.
    expect(run(s, 'pwd').text).toEqual(['/home/learner/app']);
  });

  it('caps runaway output', () => {
    const s = make(
      script({
        commands: [{ match: '^flood$', output: Array.from({ length: 5000 }, (_, i) => `line ${i}`) }],
        goals: [{ id: 'g', label: 'x' }],
      }),
    );
    const r = run(s, 'flood');
    expect(r.text).toHaveLength(MAX_OUTPUT_LINES + 1);
    expect(r.text.at(-1)).toMatch(/Output cut after/);
  });

  it('bounds a very long output line from a script', () => {
    const s = make(
      script({
        commands: [{ match: '^long$', output: ['x'.repeat(50_000)] }],
        goals: [{ id: 'g', label: 'x' }],
      }),
    );
    expect(run(s, 'long').text[0]?.length).toBe(2000);
  });

  it('does not run an input longer than the match cap through patterns', () => {
    const s = make(
      script({ commands: [{ match: '^.*$', output: ['hit'], goal: 'g' }], goals: [{ id: 'g', label: 'x' }] }),
    );
    const long = 'x'.repeat(700);
    expect(run(s, long).goals).toEqual([]);
    expect(run(s, 'short').goals).toEqual(['g']);
  });

  it('keeps history bounded under a flood of submissions', () => {
    const s = make();
    for (let i = 0; i < 1000; i += 1) s.submit(`echo ${i}`);
    expect(s.historyList.length).toBeLessThanOrEqual(200);
    expect(s.getState().entries.length).toBeLessThanOrEqual(80);
  });
});
