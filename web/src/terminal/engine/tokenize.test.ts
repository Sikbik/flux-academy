// biome-ignore-all lint/suspicious/noTemplateCurlyInString: shell syntax under test uses ${VAR}; these are not template strings
import { describe, expect, it } from 'vitest';
import { parseList, tokenize, type WordToken } from './tokenize';

const env = new Map([
  ['HOME', '/home/learner'],
  ['IMAGE', 'nginx:1.27'],
  ['EMPTY', ''],
  ['TWO', 'a b'],
  ['NAME', 'web'],
]);
const opts = { env, home: '/home/learner', lastExit: 0 };

function words(line: string): string[] {
  const r = tokenize(line, opts);
  expect(r.error).toBeNull();
  return r.tokens.filter((t): t is WordToken => t.type === 'word').map((t) => t.value);
}

describe('tokenize: words and quotes', () => {
  it('splits on whitespace', () => {
    expect(words('docker  build   -t x .')).toEqual(['docker', 'build', '-t', 'x', '.']);
  });

  it('keeps quoted strings together and removes the quotes', () => {
    expect(words(`echo "hello world" 'single quoted'`)).toEqual(['echo', 'hello world', 'single quoted']);
  });

  it('joins adjacent quoted and unquoted parts into one word', () => {
    expect(words(`echo a"b c"d'e f'g`)).toEqual(['echo', 'ab cde fg']);
  });

  it('keeps an empty quoted string as an empty word', () => {
    expect(words(`echo "" x`)).toEqual(['echo', '', 'x']);
  });

  it('handles backslash escapes', () => {
    expect(words('echo a\\ b \\$HOME \\"q')).toEqual(['echo', 'a b', '$HOME', '"q']);
  });

  it('handles escapes inside double quotes only for the special set', () => {
    expect(words('echo "a\\"b" "c\\\\d" "e\\nf"')).toEqual(['echo', 'a"b', 'c\\d', 'e\\nf']);
  });

  it('does not expand inside single quotes', () => {
    expect(words(`echo '$HOME'`)).toEqual(['echo', '$HOME']);
  });

  it('reports unterminated quotes', () => {
    expect(tokenize('echo "oops', opts).error).toMatch(/unexpected EOF/);
    expect(tokenize("echo 'oops", opts).error).toMatch(/unexpected EOF/);
  });

  it('ignores a trailing comment', () => {
    expect(words('ls # list things')).toEqual(['ls']);
    expect(words('echo a#b')).toEqual(['echo', 'a#b']);
  });

  it('records source ranges and raw text', () => {
    const r = tokenize('echo "a b" c', opts);
    const w = r.tokens[1] as WordToken;
    expect(w.raw).toBe('"a b"');
    expect(w.start).toBe(5);
    expect(w.end).toBe(10);
    expect(w.quoted).toBe(true);
  });
});

describe('tokenize: expansion', () => {
  it('expands $VAR and ${VAR}', () => {
    expect(words('echo $NAME ${NAME}-x $HOME')).toEqual(['echo', 'web', 'web-x', '/home/learner']);
  });

  it('expands inside double quotes', () => {
    expect(words('echo "image: $IMAGE"')).toEqual(['echo', 'image: nginx:1.27']);
  });

  it('expands unset variables to nothing and drops an all-empty unquoted word', () => {
    expect(words('echo $NOPE end $EMPTY')).toEqual(['echo', 'end']);
    expect(words('echo "$NOPE" end')).toEqual(['echo', '', 'end']);
  });

  it('uses ${VAR:-default}', () => {
    expect(words('echo ${NOPE:-fallback} ${NAME:-x}')).toEqual(['echo', 'fallback', 'web']);
  });

  it('expands $? to the last exit status', () => {
    const r = tokenize('echo $?', { ...opts, lastExit: 7 });
    expect((r.tokens[1] as WordToken).value).toBe('7');
  });

  it('splits an unquoted expansion on whitespace but not a quoted one', () => {
    expect(words('echo $TWO')).toEqual(['echo', 'a', 'b']);
    expect(words('echo "$TWO"')).toEqual(['echo', 'a b']);
  });

  it('expands a leading tilde to home', () => {
    expect(words('cd ~ ~/app a~b')).toEqual(['cd', '/home/learner', '/home/learner/app', 'a~b']);
  });

  it('leaves a lone dollar alone', () => {
    expect(words('echo $ 5$')).toEqual(['echo', '$', '5$']);
  });

  it('refuses command substitution', () => {
    expect(tokenize('echo $(whoami)', opts).error).toMatch(/command substitution/);
    expect(tokenize('echo "$(whoami)"', opts).error).toMatch(/command substitution/);
  });

  it('flags unquoted glob characters', () => {
    const r = tokenize('ls *.js "*.md"', opts);
    const [, a, b] = r.tokens as WordToken[];
    expect(a?.glob).toBe(true);
    expect(b?.glob).toBe(false);
  });
});

describe('tokenize: operators', () => {
  it('tokenizes && || ; | > >>', () => {
    const r = tokenize('a && b || c ; d | e > f >> g', opts);
    const ops = r.tokens.filter((t) => t.type === 'op').map((t) => (t.type === 'op' ? t.op : ''));
    expect(ops).toEqual(['&&', '||', ';', '|', '>', '>>']);
  });

  it('does not need spaces around operators', () => {
    const r = tokenize('a&&b;c|d', opts);
    expect(r.tokens.map((t) => (t.type === 'word' ? t.value : t.op))).toEqual([
      'a',
      '&&',
      'b',
      ';',
      'c',
      '|',
      'd',
    ]);
  });

  it('keeps operators inside quotes literal', () => {
    expect(words(`echo "a && b" 'c | d'`)).toEqual(['echo', 'a && b', 'c | d']);
  });

  it('reads stderr redirections', () => {
    const r = tokenize('ls nope 2>/dev/null 2>&1', opts);
    const ops = r.tokens.filter((t) => t.type === 'op').map((t) => (t.type === 'op' ? t.op : ''));
    expect(ops).toEqual(['2>', '2>&1']);
  });

  it('refuses background jobs and input redirection with a clear message', () => {
    expect(tokenize('sleep 1 &', opts).error).toMatch(/background/);
    expect(tokenize('cat < file', opts).error).toMatch(/input redirection/);
  });
});

describe('parseList', () => {
  const parse = (line: string) => parseList(tokenize(line, opts).tokens, line);

  it('parses a simple command', () => {
    const r = parse('docker ps -a');
    expect(r.error).toBeNull();
    expect(r.items).toHaveLength(1);
    expect(r.items[0]?.pipeline[0]?.raw).toBe('docker ps -a');
    expect(r.items[0]?.join).toBeNull();
  });

  it('chains with && || and ;', () => {
    const r = parse('a && b || c ; d');
    expect(r.items.map((i) => i.join)).toEqual([null, '&&', '||', ';']);
    expect(r.items.map((i) => i.pipeline[0]?.raw)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('builds pipelines', () => {
    const r = parse('curl -s x | jq .data | head -3');
    expect(r.items).toHaveLength(1);
    expect(r.items[0]?.pipeline.map((c) => c.raw)).toEqual(['curl -s x', 'jq .data', 'head -3']);
  });

  it('captures a redirect and strips it from the command text', () => {
    const r = parse('echo hi >> notes.txt');
    const c = r.items[0]?.pipeline[0];
    expect(c?.redirect?.op).toBe('>>');
    expect(c?.redirect?.target.value).toBe('notes.txt');
    expect(c?.raw).toBe('echo hi');
  });

  it('records stderr handling', () => {
    expect(parse('ls x 2>/dev/null').items[0]?.pipeline[0]?.stderr).toBe('null');
    expect(parse('ls x 2>&1').items[0]?.pipeline[0]?.stderr).toBe('merge');
  });

  it('allows a trailing semicolon', () => {
    expect(parse('ls;').error).toBeNull();
    expect(parse('ls;').items).toHaveLength(1);
  });

  it('rejects empty commands and dangling operators', () => {
    for (const bad of [
      '&& ls',
      'ls &&',
      'ls ||',
      'ls |',
      '| ls',
      ';; ls',
      'ls ;; pwd',
      'echo >',
      'ls | | wc',
    ]) {
      const r = parse(bad);
      expect(r.error, bad).toMatch(/syntax error near unexpected token/);
    }
  });

  it('treats a blank line and a comment as nothing', () => {
    expect(parse('').items).toEqual([]);
    expect(parse('# note').items).toEqual([]);
  });
});
