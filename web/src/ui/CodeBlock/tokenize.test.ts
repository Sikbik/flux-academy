// biome-ignore-all lint/suspicious/noTemplateCurlyInString: the fixtures are source code that contains template syntax
import { describe, expect, it } from 'vitest';
import {
  CODE_LANGS,
  type CodeLang,
  copyText,
  MAX_HIGHLIGHT_CHARS,
  MAX_HIGHLIGHT_LINE,
  splitLines,
  type Token,
  tokenize,
} from './tokenize';

const join = (tokens: Token[]): string => tokens.map((t) => t.text).join('');

/** `type:text` pairs of one line, with plain whitespace dropped, for readable assertions. */
function pairs(code: string, lang: CodeLang, line = 0): string[] {
  const tokens = tokenize(code, lang)[line] ?? [];
  return tokens
    .map((t) => ({ type: t.type, text: t.type === 'plain' ? t.text.trim() : t.text }))
    .filter((t) => t.text !== '')
    .map((t) => `${t.type}:${t.text}`);
}

function roundTrips(code: string, lang: CodeLang): void {
  const lines = splitLines(code);
  const out = tokenize(code, lang);
  expect(out).toHaveLength(lines.length);
  out.forEach((tokens, i) => {
    expect(join(tokens)).toBe(lines[i]);
    for (const t of tokens) expect(t.text.length).toBeGreaterThan(0);
  });
}

// A seeded generator so the fuzz is repeatable.
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const TRICKY = [
  '',
  ' ',
  '\t\t',
  '\n\n\n',
  'a',
  '"',
  "'",
  '`',
  '${',
  '`${`',
  '`a${b`c${d}`}e`',
  '/*',
  '*/',
  '/* a */ b /* c',
  '// only a comment',
  '# only a comment',
  '\\',
  '\\\\\\',
  '$',
  '$(',
  '$((',
  '${',
  '${A',
  '"unterminated $VAR ${',
  "'unterminated",
  '{"a": "b\\"c", "d": [1, 2.5e-3, true, null]}',
  'FROM node:20-alpine AS build\nRUN npm ci && \\\n  npm run build\nCMD ["node", "dist/main.js"]',
  'RUN echo "a $B ${C:-d}" | tee out.txt > /dev/null 2>&1',
  'ENV A=1 B="two words" C',
  '$ docker run -d -p 8080:80 nginx\nStatus: Downloaded newer image\n$ docker ps',
  'key: value # c\nlist:\n  - a\n  - b: 1\nblock: |\n  text\n  more\nafter: x',
  '---\n...\n- - nested\n',
  'const x = a / b / c; const r = /ab+c/gi.test(s);',
  'type A<T> = { [K in keyof T]: T[K] };\ninterface B extends C { d?: string }',
  'ünïcödé = "日本語"; 😀',
  'a\r\nb\rc',
  `{"k":${'['.repeat(300)}${']'.repeat(300)}}`,
  `${'*'.repeat(50)}`,
  `${'"'.repeat(51)}`,
  `${'\\'.repeat(51)}`,
];

describe('splitLines', () => {
  it('splits on any newline and drops one trailing newline', () => {
    expect(splitLines('a\nb')).toEqual(['a', 'b']);
    expect(splitLines('a\r\nb\r\n')).toEqual(['a', 'b']);
    expect(splitLines('a\rb')).toEqual(['a', 'b']);
    expect(splitLines('a\n\n')).toEqual(['a', '']);
    expect(splitLines('')).toEqual(['']);
  });
});

describe('tokenize is total and lossless', () => {
  for (const lang of CODE_LANGS) {
    it(`round-trips tricky inputs as ${lang}`, () => {
      for (const code of TRICKY) roundTrips(code, lang);
    });

    it(`survives random garbage as ${lang}`, () => {
      const rand = rng(1234 + lang.length);
      const alphabet = [
        ...'abcXYZ019 \t\n"\'`$(){}[]<>|&;:#=,.-+*/\\!?@%^~_',
        'FROM ',
        'RUN ',
        '--',
        '${',
        '$(',
        '/*',
        '*/',
        '//',
        '=>',
        '&&',
        '|| ',
        '- ',
        ': ',
        ' #',
        '\n',
      ];
      for (let round = 0; round < 40; round++) {
        let code = '';
        const len = 1 + Math.floor(rand() * 220);
        for (let i = 0; i < len; i++) code += alphabet[Math.floor(rand() * alphabet.length)];
        roundTrips(code, lang);
      }
    });
  }

  it('leaves huge inputs and very long lines plain', () => {
    const huge = `const a = 1;\n${'x'.repeat(MAX_HIGHLIGHT_CHARS)}`;
    expect(tokenize(huge, 'js').every((l) => l.every((t) => t.type === 'plain'))).toBe(true);
    const long = `const a = ${'1 + '.repeat(MAX_HIGHLIGHT_LINE)}1;`;
    const out = tokenize(long, 'js');
    expect(out[0]).toEqual([{ type: 'plain', text: long }]);
  });

  it('is fast on large inputs', () => {
    const block = 'const answer = compute("a", 42, `t ${x}`); // done\n';
    const code = block.repeat(2500); // ~125 KB, under the cap
    const t0 = performance.now();
    for (const lang of ['js', 'ts', 'json', 'sh', 'yaml', 'dockerfile'] as const) tokenize(code, lang);
    expect(performance.now() - t0).toBeLessThan(2500);
  });
});

describe('json', () => {
  it('tells keys from string values', () => {
    expect(pairs('  "name": "flux", "n": 3', 'json')).toEqual([
      'key:"name"',
      'punct::',
      'string:"flux"',
      'punct:,',
      'key:"n"',
      'punct::',
      'number:3',
    ]);
  });

  it('knows literals, numbers and punctuation', () => {
    expect(pairs('[true, false, null, -1.5e3]', 'json')).toEqual([
      'punct:[',
      'keyword:true',
      'punct:,',
      'keyword:false',
      'punct:,',
      'keyword:null',
      'punct:,',
      'number:-1.5e3',
      'punct:]',
    ]);
  });

  it('does not take a lone string for a key', () => {
    expect(pairs('"abc"', 'json')).toEqual(['string:"abc"']);
  });
});

describe('js and ts', () => {
  it('colours keywords, calls, strings and numbers', () => {
    expect(pairs('const total = add(1, "two");', 'js')).toEqual([
      'keyword:const',
      'plain:total',
      'operator:=',
      'fn:add',
      'punct:(',
      'number:1',
      'punct:,',
      'string:"two"',
      'punct:);',
    ]);
  });

  it('keeps block comments across lines', () => {
    const out = tokenize('a /* x\nstill */ b', 'js');
    expect(out[0]?.some((t) => t.type === 'comment' && t.text.startsWith('/*'))).toBe(true);
    expect(out[1]?.[0]).toEqual({ type: 'comment', text: 'still */' });
    expect(out[1]?.some((t) => t.type === 'plain' && t.text.includes('b'))).toBe(true);
  });

  it('keeps template literals across lines and highlights interpolation', () => {
    const out = tokenize('const s = `a ${b} c\nd` + e;', 'js');
    const first = out[0] ?? [];
    expect(first.some((t) => t.type === 'string' && t.text === '`a ')).toBe(true);
    expect(first.some((t) => t.type === 'punct' && t.text === '${')).toBe(true);
    const second = out[1] ?? [];
    expect(second[0]).toEqual({ type: 'string', text: 'd`' });
    expect(second.some((t) => t.type === 'operator' && t.text === '+')).toBe(true);
  });

  it('treats a slash as a regex after an operator and as division after a value', () => {
    expect(pairs('x = /a+b/g;', 'js')).toContain('string:/a+b/g');
    expect(pairs('x = a / b / c;', 'js').filter((p) => p.startsWith('operator:/'))).toHaveLength(2);
  });

  it('colours TypeScript types and declarations', () => {
    const p = pairs('export interface Spec { name: string; port?: number }', 'ts');
    expect(p).toContain('keyword:interface');
    expect(p).toContain('type:Spec');
    expect(p).toContain('type:string');
    expect(p).toContain('type:number');
    expect(pairs('type Id = string;', 'ts')[0]).toBe('keyword:type');
    // `type` as a property is not a keyword
    expect(pairs('x.type = 1', 'ts')).toContain('plain:type');
  });

  it('marks object keys and member calls', () => {
    const p = pairs('{ name: "x", run() {} }', 'js');
    expect(p).toContain('key:name');
    expect(p).toContain('fn:run');
    expect(pairs('items.map(f)', 'js')).toContain('fn:map');
  });
});

describe('sh', () => {
  it('dims the prompt and colours commands, flags, numbers and strings', () => {
    expect(pairs('$ docker run -d -p 8080:80 --name web nginx', 'sh')).toEqual([
      'punct:$ ',
      'fn:docker',
      'keyword:run',
      'flag:-d',
      'flag:-p',
      'number:8080:80',
      'flag:--name',
      'plain:web nginx',
    ]);
  });

  it('treats lines without a prompt as output when the block has prompts', () => {
    const out = tokenize('$ ls\nREADME.md  src\n# a note\n$ pwd', 'sh');
    expect(out[1]).toEqual([{ type: 'punct', text: 'README.md  src' }]);
    expect(out[2]?.some((t) => t.type === 'comment')).toBe(true);
    expect(out[3]?.[1]?.type).toBe('fn');
  });

  it('knows variables, pipes, chains and comments', () => {
    const p = pairs('cat "$FILE" | grep -v ^# && echo $HOME # done', 'sh');
    expect(p).toContain('variable:$FILE');
    expect(p).toContain('operator:|');
    expect(p).toContain('fn:grep');
    expect(p).toContain('operator:&&');
    expect(p).toContain('variable:$HOME');
    expect(p[p.length - 1]).toBe('comment:# done');
  });

  it('expects a command after a continued &&', () => {
    const out = tokenize('apt-get update && \\\n  apt-get install -y curl', 'sh');
    expect(out[1]?.find((t) => t.text === 'apt-get')?.type).toBe('fn');
    expect(out[1]?.find((t) => t.text === 'install')?.type).toBe('keyword');
  });

  it('colours assignments and key=value arguments', () => {
    expect(pairs('FOO=bar make', 'sh').slice(0, 3)).toEqual(['variable:FOO', 'operator:=', 'plain:bar']);
    expect(pairs('docker run -e MODE=prod img', 'sh')).toContain('key:MODE');
  });
});

describe('copyText', () => {
  it('strips prompts and drops output for shell blocks', () => {
    const code = '$ docker build -t app .\nSuccessfully built abc\n$ docker run \\\n  app\n';
    expect(copyText(code, 'sh')).toBe('docker build -t app .\ndocker run \\\n  app');
  });

  it('copies other blocks verbatim', () => {
    expect(copyText('a\r\nb\n', 'json')).toBe('a\nb');
    expect(copyText('echo hi\nls', 'sh')).toBe('echo hi\nls');
  });
});

describe('dockerfile', () => {
  it('colours instructions, image and stage names', () => {
    expect(pairs('FROM node:20-alpine AS build', 'dockerfile')).toEqual([
      'keyword:FROM',
      'string:node:20-alpine',
      'keyword:AS',
      'type:build',
    ]);
  });

  it('colours flags, variables and RUN bodies like a shell', () => {
    const p = pairs('RUN --mount=type=cache,target=/root/.npm npm ci && npm run build', 'dockerfile');
    expect(p[0]).toBe('keyword:RUN');
    expect(p).toContain('flag:--mount');
    expect(p).toContain('fn:npm');
    expect(p).toContain('operator:&&');
    expect(pairs('WORKDIR /app/$APP', 'dockerfile')).toContain('variable:$APP');
  });

  it('handles ENV pairs, EXPOSE ports and exec form', () => {
    expect(pairs('ENV NODE_ENV=production PORT=8080', 'dockerfile')).toEqual([
      'keyword:ENV',
      'key:NODE_ENV',
      'operator:=',
      'plain:production',
      'key:PORT',
      'operator:=',
      'number:8080',
    ]);
    expect(pairs('EXPOSE 8080/tcp 443', 'dockerfile')).toEqual([
      'keyword:EXPOSE',
      'number:8080/tcp',
      'number:443',
    ]);
    expect(pairs('CMD ["node", "server.js"]', 'dockerfile')).toEqual([
      'keyword:CMD',
      'punct:[',
      'string:"node"',
      'punct:,',
      'string:"server.js"',
      'punct:]',
    ]);
  });

  it('does not treat continuation lines as instructions', () => {
    const out = tokenize('RUN apt-get update \\\n  && apt-get install -y curl\nCOPY . .', 'dockerfile');
    expect(out[1]?.find((t) => t.text === 'apt-get')?.type).toBe('fn');
    expect(out[2]?.[0]).toEqual({ type: 'keyword', text: 'COPY' });
    expect(
      tokenize('RUN a \\\n  FROM b', 'dockerfile')[1]?.some((t) => t.type === 'keyword' && t.text === 'FROM'),
    ).toBe(false);
  });

  it('knows comments and lower-case instructions', () => {
    expect(pairs('# syntax=docker/dockerfile:1', 'dockerfile')).toEqual([
      'comment:# syntax=docker/dockerfile:1',
    ]);
    expect(pairs('from alpine', 'dockerfile')[0]).toBe('keyword:from');
  });

  it('colours HEALTHCHECK options and its command', () => {
    const p = pairs(
      'HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost/ || exit 1',
      'dockerfile',
    );
    expect(p).toContain('flag:--interval');
    expect(p).toContain('number:30s');
    expect(p).toContain('keyword:CMD');
    expect(p).toContain('fn:curl');
  });
});

describe('yaml', () => {
  it('colours keys, values and comments', () => {
    expect(pairs('image: nginx:latest # web', 'yaml')).toEqual([
      'key:image',
      'punct::',
      'plain:nginx:latest',
      'comment:# web',
    ]);
    expect(pairs('replicas: 3', 'yaml')).toEqual(['key:replicas', 'punct::', 'number:3']);
    expect(pairs('enabled: true', 'yaml')).toEqual(['key:enabled', 'punct::', 'keyword:true']);
    expect(pairs('name: "quoted: yes"', 'yaml')[2]).toBe('string:"quoted: yes"');
  });

  it('handles list bullets and nested keys', () => {
    expect(pairs('  - name: web', 'yaml')).toEqual(['punct:-', 'key:name', 'punct::', 'plain:web']);
    expect(pairs('- "80:80"', 'yaml')).toEqual(['punct:-', 'string:"80:80"']);
  });

  it('keeps block scalars as strings until the indent drops', () => {
    const out = tokenize('run: |\n  echo a\n  echo b\nnext: 1', 'yaml');
    expect(out[1]?.some((t) => t.type === 'string')).toBe(true);
    expect(out[2]?.some((t) => t.type === 'string')).toBe(true);
    expect(out[3]?.[0]).toEqual({ type: 'key', text: 'next' });
  });

  it('colours anchors, aliases and flow collections', () => {
    expect(pairs('base: &base', 'yaml')).toContain('variable:&base');
    expect(pairs('x: *base', 'yaml')).toContain('variable:*base');
    const p = pairs('ports: [80, "443"]', 'yaml');
    expect(p).toContain('punct:[');
    expect(p).toContain('number:80');
    expect(p).toContain('string:"443"');
  });

  it('marks document separators', () => {
    expect(pairs('---', 'yaml')).toEqual(['punct:---']);
  });
});

describe('text', () => {
  it('is a single plain token per line', () => {
    expect(tokenize('a b\n\nc', 'text')).toEqual([
      [{ type: 'plain', text: 'a b' }],
      [],
      [{ type: 'plain', text: 'c' }],
    ]);
  });
});
