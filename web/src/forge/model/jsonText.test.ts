import { describe, expect, it } from 'vitest';
import {
  type JsonNode,
  lineOfOffset,
  lineStarts,
  locate,
  markerRange,
  parseJsonText,
  specToCompactText,
  specToText,
  tokenizeLine,
} from './jsonText';

const VALID = [
  '{}',
  '[]',
  '0',
  '-0',
  '1.5e+10',
  '"a\\u00e9\\n"',
  'true',
  'null',
  '{"a":1,"b":[1,2,{"c":null}]}',
  '  \n {\n "a" : [ ] \n}\n',
  '{"a":"\\"","b":"\\\\"}',
  '[1e5, -2E-3, 0.0]',
  '{"__proto__":1}',
];

const INVALID = [
  '',
  '   ',
  '{',
  '}',
  '[1,]',
  '{"a":1,}',
  "{'a':1}",
  '{a:1}',
  '[01]',
  '[.5]',
  '[1.]',
  '[+1]',
  '[1,,2]',
  '{"a" 1}',
  '{"a":}',
  '"abc',
  '"a\nb"',
  '[true, True]',
  '[undefined]',
  '[NaN]',
  '{"a":1} x',
  '{"a":1}{"b":2}',
  '// c\n{}',
  '[1 2]',
  '{"a":1 "b":2}',
  '"\\x"',
  '"\\u12"',
  '[',
  '{"a":[}',
  '-',
  '--1',
  '1e',
  '1e+',
];

describe('parseJsonText agrees with JSON.parse', () => {
  for (const text of VALID) {
    it(`accepts ${JSON.stringify(text).slice(0, 40)}`, () => {
      const r = parseJsonText(text);
      expect(r.ok).toBe(true);
      expect(JSON.stringify(r.ok ? r.value : null)).toBe(JSON.stringify(JSON.parse(text)));
    });
  }
  for (const text of INVALID) {
    it(`rejects ${JSON.stringify(text).slice(0, 40)}`, () => {
      expect(() => JSON.parse(text)).toThrow();
      const r = parseJsonText(text);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.message.length).toBeGreaterThan(5);
        expect(r.error.offset).toBeGreaterThanOrEqual(0);
        expect(r.error.offset).toBeLessThanOrEqual(text.length);
      }
    });
  }

  it('matches JSON.parse on 300 random mutations of a real document', () => {
    const base = JSON.stringify({
      version: 8,
      name: 'x',
      compose: [{ ports: [1, 2], domains: ['', 'a.b'], cpu: 0.5 }],
      ok: true,
      none: null,
    });
    let seed = 7;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const chars = ['{', '}', '[', ']', ',', ':', '"', ' ', '1', 'x', '\n', '-', '.', 'e'];
    for (let n = 0; n < 300; n++) {
      let t = base;
      const edits = 1 + Math.floor(rnd() * 3);
      for (let e = 0; e < edits; e++) {
        const at = Math.floor(rnd() * t.length);
        if (rnd() < 0.5) t = t.slice(0, at) + t.slice(at + 1);
        else t = t.slice(0, at) + chars[Math.floor(rnd() * chars.length)] + t.slice(at);
      }
      let valid = true;
      try {
        JSON.parse(t);
      } catch {
        valid = false;
      }
      expect(parseJsonText(t).ok, JSON.stringify(t)).toBe(valid);
    }
  });
});

describe('error messages teach', () => {
  it('names a trailing comma', () => {
    const r = parseJsonText('{\n  "a": 1,\n}');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.message).toMatch(/comma/i);
      expect(r.error.line).toBe(2);
    }
  });

  it('names a missing comma and points after the previous value', () => {
    const text = '{\n  "a": 1\n  "b": 2\n}';
    const r = parseJsonText(text);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.message).toMatch(/comma is missing/);
      expect(text.slice(r.error.offset - 1, r.error.offset)).toBe('1');
      expect(r.error.line).toBe(1);
    }
  });

  it('explains single quotes, bare keys and comments', () => {
    const q = parseJsonText("{'a': 1}");
    const k = parseJsonText('{a: 1}');
    const c = parseJsonText('{"a": 1 // one\n}');
    expect(!q.ok && q.error.message).toMatch(/double quotes/);
    expect(!k.ok && k.error.message).toMatch(/needs double quotes/);
    expect(!c.ok && c.error.message).toMatch(/comments|comma/);
  });

  it('reports unclosed containers at their opening bracket', () => {
    const r = parseJsonText('{\n  "a": [1, 2\n');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toMatch(/never closed/);
  });

  it('refuses a document that is far too large', () => {
    const r = parseJsonText(`"${'x'.repeat(700_000)}"`);
    expect(r.ok).toBe(false);
  });

  it('stops at absurd nesting without overflowing the stack', () => {
    const r = parseJsonText('['.repeat(5000));
    expect(r.ok).toBe(false);
  });
});

describe('locate', () => {
  const text = specToText({
    version: 8,
    name: 'hello',
    instances: 3,
    compose: [
      { name: 'web', ports: [31001, 31002], domains: ['', ''], cpu: 0.5 },
      { name: 'db', ports: [], cpu: 1 },
    ],
  });
  const parsed = parseJsonText(text);
  if (!parsed.ok) throw new Error('fixture must parse');
  const root: JsonNode = parsed.root;

  it('finds scalars by path with exact ranges', () => {
    const at = locate(root, 'compose[0].ports[1]');
    expect(at.exact).toBe(true);
    expect(text.slice(at.node.start, at.node.end)).toBe('31002');
    expect(markerRange(at, text)).toEqual({ from: at.node.start, to: at.node.end });
  });

  it('marks a container by its key', () => {
    const at = locate(root, 'compose[0].ports');
    expect(at.exact).toBe(true);
    const r = markerRange(at, text);
    expect(text.slice(r.from, r.to)).toBe('"ports"');
  });

  it('falls back to the closest ancestor for a missing path', () => {
    const at = locate(root, 'compose[1].commands[0]');
    expect(at.exact).toBe(false);
    expect(at.path).toBe('compose[1]');
    const r = markerRange(at, text);
    expect(text.slice(r.from, r.to)).toBe('"db"');
  });

  it('resolves line numbers', () => {
    const starts = lineStarts(text);
    const at = locate(root, 'instances');
    const line = lineOfOffset(starts, at.node.start);
    expect((text.split('\n')[line] ?? '').trim()).toBe('"instances": 3,');
  });

  it('finds a key that is in the text but not in the model', () => {
    const t = '{\n  "name": "a",\n  "tiered": true\n}';
    const p = parseJsonText(t);
    expect(p.ok).toBe(true);
    if (p.ok) {
      const at = locate(p.root, 'tiered');
      expect(at.exact).toBe(true);
      expect(t.slice(at.node.start, at.node.end)).toBe('true');
    }
  });
});

describe('tokenizeLine', () => {
  it('classifies keys, strings, numbers, literals and punctuation', () => {
    const line = '  "ports": [31001, -2.5e3], "ok": true, "x": null,';
    const kinds = tokenizeLine(line)
      .filter((t) => t.kind !== 'space')
      .map((t) => t.kind);
    expect(kinds).toEqual([
      'key',
      'punct',
      'punct',
      'number',
      'punct',
      'number',
      'punct',
      'punct',
      'key',
      'punct',
      'literal',
      'punct',
      'key',
      'punct',
      'literal',
      'punct',
    ]);
  });

  it('marks unterminated strings and stray words as errors but never throws', () => {
    const t = tokenizeLine('  "abc, foo');
    expect(t.some((x) => x.kind === 'error')).toBe(true);
    expect(tokenizeLine('\u0000☃')).toBeTruthy();
  });

  it('covers every character of the line exactly once', () => {
    const line = '{ "a" : [1,2 ,"b\\"c"] , x }';
    const toks = tokenizeLine(line);
    let at = 0;
    for (const t of toks) {
      expect(t.start).toBe(at);
      at = t.end;
    }
    expect(at).toBe(line.length);
  });
});

describe('specToText', () => {
  it('orders keys for reading and keeps short scalar arrays inline', () => {
    const text = specToText({
      compose: [{ cpu: 1, name: 'web', ports: [31001], domains: [''] }],
      name: 'a',
      version: 8,
    });
    expect(text.indexOf('"version"')).toBeLessThan(text.indexOf('"compose"'));
    expect(text).toContain('"ports": [31001]');
    expect(text.indexOf('"name": "web"')).toBeLessThan(text.indexOf('"cpu"'));
    expect(JSON.parse(text)).toEqual({
      compose: [{ cpu: 1, name: 'web', ports: [31001], domains: [''] }],
      name: 'a',
      version: 8,
    });
  });

  it('round trips through the parser and drops undefined keys', () => {
    const spec = { version: 8, name: 'x', datacenter: undefined, contacts: [], compose: [] };
    const text = specToText(spec);
    expect(text).not.toContain('datacenter');
    expect(text).toContain('"contacts": []');
    expect(parseJsonText(text).ok).toBe(true);
    expect(JSON.parse(specToCompactText(spec))).toEqual({ version: 8, name: 'x', contacts: [], compose: [] });
  });
});
