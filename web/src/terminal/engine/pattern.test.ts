import { describe, expect, it } from 'vitest';
import { Pattern, UnsupportedPattern } from './pattern';
import { analyzeRegex, anchorSource, CommandPattern, PatternCache } from './regex';

function nativeExec(source: string, input: string): (string | undefined)[] | null {
  const m = new RegExp(source).exec(input);
  return m ? Array.from(m) : null;
}

function ownExec(source: string, input: string): (string | undefined)[] | null {
  return new Pattern(source).exec(input).match?.groups ?? null;
}

describe('Pattern engine: parity with the native engine', () => {
  const sources = [
    'abc',
    'a.c',
    '^docker build -t (\\S+) \\.$',
    '^docker (build|push|pull) (\\S+)$',
    '^docker run (?:-d )?(?:--name (\\S+) )?(\\S+)$',
    '^docker\\s+run\\s+(?:-\\w+\\s+)*nginx$',
    '^ls( -[a-zA-Z]+)?$',
    '^(?:a|ab)(?:c|bcd)(d*)$',
    '(a+)(b+)',
    '(a*)*b',
    '^a{2,4}$',
    '^a{2,}$',
    '^a{3}$',
    '^(\\d+)\\.(\\d+)\\.(\\d+)$',
    '^curl .*https://api\\.runonflux\\.io/daemon/(\\w+)$',
    '^[^\\s]+@[^\\s]+$',
    '^[a-z0-9-]+\\.app\\.runonflux\\.io$',
    '\\bfoo\\b',
    '^(?=.*-t (\\S+))(?=.*--platform[ =]linux/amd64).*$',
    '^(?!rm)\\w+$',
    '^.*?(\\d+)$',
    '^(.+?)(\\d+)$',
    '^(a|b)*c$',
    '^[a-c-]+$',
    '^[]a]+$',
    '^x{,3}$',
    'a|b|c',
    '^$',
    '^(?<name>\\w+)-(?<n>\\d+)$',
    '^\\x41\\u0042\\t$',
    '^[\\d.]+$',
    '^[^a-z]+$',
    '^\\$HOME$',
    '^a\\.b$',
  ];
  const inputs = [
    '',
    'abc',
    'abcd',
    'aaa',
    'aaaa',
    'aaaaa',
    'ab',
    'abbbc',
    'docker build -t you/app:1.0.0 .',
    'docker build --platform linux/amd64 -t you/app:1.0.0 .',
    'docker build -t you/app:1.0.0 --platform linux/amd64 .',
    'docker push you/app:1.0.0',
    'docker pull nginx',
    'docker run nginx',
    'docker run -d nginx',
    'docker run -d --name web nginx',
    'docker   run  -d   nginx',
    'ls',
    'ls -l',
    'ls -la',
    'ls -l -a',
    '1.2.3',
    '10.20.30',
    '1.2',
    'curl -s https://api.runonflux.io/daemon/getblockcount',
    'curl https://example.com',
    'a@b',
    'a @b',
    'mystore.app.runonflux.io',
    'my_store.app.runonflux.io',
    'foo bar',
    'xfoox',
    'rm file',
    'ls dir',
    'abc123',
    'foo-12',
    'AB\t',
    '1.5',
    'ABC',
    '$HOME',
    'a.b',
    'aXb',
    'xx',
    'xxx',
    'ababc',
    'c',
    'a]',
  ];

  for (const source of sources) {
    it(`/${source}/ agrees on ${inputs.length} inputs`, () => {
      for (const input of inputs) {
        const own = ownExec(source, input);
        const native = nativeExec(source, input);
        expect(own, `/${source}/ on ${JSON.stringify(input)}`).toEqual(native);
      }
    });
  }

  it('reports the match index', () => {
    const r = new Pattern('b+').exec('aabbbc');
    expect(r.match?.index).toBe(2);
    expect(r.match?.groups[0]).toBe('bbb');
  });

  it('keeps non-participating groups undefined', () => {
    const r = new Pattern('^(a)|(b)$').exec('b');
    expect(r.match?.groups).toEqual(nativeExec('^(a)|(b)$', 'b'));
    expect(r.match?.groups[1]).toBeUndefined();
  });

  it('refuses unsupported syntax so the caller can fall back', () => {
    for (const source of ['(a)\\1', '(?<=a)b', '(?<!a)b', '\\p{L}', '\\u{1F600}', '(', 'a)', '*a', 'a**']) {
      expect(() => new Pattern(source), source).toThrow(UnsupportedPattern);
    }
  });
});

describe('Pattern engine: the step budget', () => {
  it('stops a catastrophic pattern instead of hanging', () => {
    const p = new Pattern('^(a+)+$');
    const r = p.exec(`${'a'.repeat(40)}!`, 50_000);
    expect(r.exhausted).toBe(true);
    expect(r.match).toBeNull();
    expect(r.steps).toBeGreaterThan(50_000);
  });

  it('stops nested alternation blow-ups', () => {
    const r = new Pattern('^(a|aa)+$').exec(`${'a'.repeat(45)}b`, 50_000);
    expect(r.exhausted).toBe(true);
  });

  it('stops polynomial blow-ups of stacked wildcards', () => {
    const r = new Pattern('.*.*.*.*.*.*x').exec('a'.repeat(300), 20_000);
    expect(r.exhausted).toBe(true);
  });

  it('is cheap on ordinary commands', () => {
    const p = new Pattern(anchorSource('docker build -t (\\S+) \\.'));
    const r = p.exec('docker build -t you/app:1.0.0 .');
    expect(r.exhausted).toBe(false);
    expect(r.steps).toBeLessThan(500);
    expect(r.match?.groups[1]).toBe('you/app:1.0.0');
  });
});

describe('anchoring (same as the lesson validator)', () => {
  it('wraps the source as ^(?:source)$', () => {
    expect(anchorSource('docker ps')).toBe('^(?:docker ps)$');
  });

  it('matches the whole line only', () => {
    const p = new CommandPattern('docker ps');
    expect(p.exec('docker ps')).not.toBeNull();
    expect(p.exec('docker ps -a')).toBeNull();
    expect(p.exec('x docker ps')).toBeNull();
  });

  it('treats top-level alternation as whole-line alternatives', () => {
    const p = new CommandPattern('ls|dir');
    expect(p.exec('ls')).not.toBeNull();
    expect(p.exec('dir')).not.toBeNull();
    expect(p.exec('ls dir')).toBeNull();
  });

  it('numbers capture groups like the source alone would', () => {
    const p = new CommandPattern('^docker run (\\S+) (\\S+)$');
    expect(p.exec('docker run a b')?.slice(1)).toEqual(['a', 'b']);
  });
});

describe('CommandPattern guard', () => {
  it('fails closed on a catastrophic source and says so once', () => {
    const trips: string[] = [];
    const p = new CommandPattern('^(a+)+$', { stepBudget: 20_000, onTrip: (_s, r) => trips.push(r) });
    expect(p.engine).toBe('builtin');
    expect(p.exec(`${'a'.repeat(40)}!`)).toBeNull();
    expect(p.usable).toBe(false);
    expect(p.problem).toBe('budget');
    expect(p.exec('aaa')).toBeNull();
    expect(trips).toEqual(['budget']);
  });

  it('refuses invalid sources', () => {
    const p = new CommandPattern('(');
    expect(p.usable).toBe(false);
    expect(p.problem).toBe('invalid');
    expect(p.exec('(')).toBeNull();
  });

  it('refuses very long sources', () => {
    expect(new CommandPattern('a'.repeat(700)).problem).toBe('too-long');
  });

  it('never matches input beyond the cap', () => {
    const p = new CommandPattern('.*');
    expect(p.exec('x'.repeat(100))).not.toBeNull();
    expect(p.exec('x'.repeat(5000))).toBeNull();
  });

  it('uses the native engine for syntax the built-in one lacks, behind a static check', () => {
    const p = new CommandPattern('(\\w+) \\1');
    expect(p.engine).toBe('native');
    expect(p.exec('go go')?.[1]).toBe('go');
    expect(p.exec('go no')).toBeNull();
  });

  it('refuses nested quantifiers on the native fallback', () => {
    const p = new CommandPattern('(?:(a+)+)\\1');
    expect(p.usable).toBe(false);
    expect(p.problem).toBe('nested-quantifier');
  });

  it('switches a slow native pattern off, using an injected clock', () => {
    let t = 0;
    const p = new CommandPattern('(\\w+) \\1', {
      now: () => {
        t += 100;
        return t;
      },
      budgetMs: 40,
    });
    expect(p.exec('go go')).not.toBeNull();
    expect(p.usable).toBe(false);
    expect(p.problem).toBe('slow');
  });

  it('caches compiled patterns', () => {
    const cache = new PatternCache();
    expect(cache.get('ls')).toBe(cache.get('ls'));
    expect(cache.get('ls')).not.toBe(cache.get('pwd'));
  });
});

describe('static analysis for the native fallback', () => {
  it('flags nested unbounded quantifiers', () => {
    expect(analyzeRegex('(a+)+')).toBe('nested-quantifier');
    expect(analyzeRegex('(a*)*')).toBe('nested-quantifier');
    expect(analyzeRegex('(.*a){10,}')).toBe('nested-quantifier');
    expect(analyzeRegex('((a+)b)+')).toBe('nested-quantifier');
  });

  it('allows bounded and flat patterns', () => {
    expect(analyzeRegex('^docker run (\\S+)$')).toBeNull();
    expect(analyzeRegex('(a{1,3}){1,3}')).toBeNull();
    expect(analyzeRegex('[a+]+')).toBeNull();
    expect(analyzeRegex('\\(a+\\)+')).toBeNull();
  });

  it('flags a pile of unbounded quantifiers', () => {
    expect(analyzeRegex('.*a.*a.*a.*a.*a.*a.*a.*a.*a')).toBe('too-many-quantifiers');
  });

  it('flags invalid and oversize sources', () => {
    expect(analyzeRegex('(')).toBe('invalid');
    expect(analyzeRegex('a'.repeat(601))).toBe('too-long');
  });
});
