import { BLOCKS_PER_MONTH, daysToBlocks, FIXTURES, LIMITS, LINT_CODES, monthsToBlocks } from '@shared/flux';
import { describe, expect, it } from 'vitest';
import { annotateSpec, expireCalc, lineColumn, VALIDATE_MAX_CHARS, validateText } from './tools';

const fixture = (id: string): unknown => {
  const found = FIXTURES.find((f) => f.id === id);
  if (!found) throw new Error(`no fixture ${id}`);
  return found.spec;
};

describe('annotateSpec', () => {
  const spec = fixture('web-app');
  const lines = annotateSpec(spec);

  it('is the pretty printed JSON, one entry per line', () => {
    expect(lines.map((l) => l.text).join('\n')).toBe(JSON.stringify(spec, null, 2));
  });

  it('tags a top level key with its field and scope', () => {
    const name = lines.find((l) => l.key === 'name' && l.scope === 'app');
    expect(name?.field).toBe('app-name');
    const compose = lines.find((l) => l.key === 'compose');
    expect(compose?.field).toBe('app-compose');
  });

  it('tags the keys of a component inside compose', () => {
    const ports = lines.find((l) => l.key === 'ports' && l.scope === 'component');
    expect(ports?.field).toBe('component-ports');
    const repotag = lines.find((l) => l.key === 'repotag');
    expect(repotag?.field).toBe('component-repotag');
  });

  it('gives the lines of an array to the key above them', () => {
    const start = lines.findIndex((l) => l.key === 'geolocation');
    expect(start).toBeGreaterThan(-1);
    const closing = lines.findIndex((l, i) => i > start && /^ {2}\],?$/.test(l.text));
    expect(closing).toBeGreaterThan(start);
    for (let i = start; i <= closing; i++) expect(lines[i]?.field, `line ${i + 1}`).toBe('app-geolocation');
  });

  it('only names fields the engine has', () => {
    const app = new Set<string>(LIMITS.appKeys);
    const component = new Set<string>(LIMITS.componentKeys);
    for (const l of lines) {
      if (l.key === null) continue;
      expect(l.scope === 'app' ? app.has(l.key) : component.has(l.key), l.text).toBe(true);
      expect(l.field).toBe(`${l.scope}-${l.key}`);
    }
  });

  it('works for a spec with two components', () => {
    const two = annotateSpec(fixture('wordpress-mysql'));
    const names = two.filter((l) => l.field === 'component-name' && l.key === 'name');
    expect(names.length).toBeGreaterThanOrEqual(2);
  });

  it('survives something that is not a spec', () => {
    expect(annotateSpec({ hello: 'world' }).every((l) => l.key === null)).toBe(true);
    expect(annotateSpec([]).length).toBeGreaterThan(0);
  });
});

describe('expireCalc', () => {
  it('reads blocks, days and months', () => {
    expect(expireCalc('blocks', '88000').blocks).toBe(88000);
    expect(expireCalc('days', '30').blocks).toBe(daysToBlocks(30));
    expect(expireCalc('months', '12').blocks).toBe(monthsToBlocks(12));
  });

  it('turns blocks into pricing months with the engine constant', () => {
    const calc = expireCalc('blocks', String(BLOCKS_PER_MONTH * 3));
    expect(calc.months).toBe(3);
    expect(calc.about).not.toBe('');
  });

  it('accepts a thousands separator and ignores spaces', () => {
    expect(expireCalc('blocks', ' 88,000 ').blocks).toBe(88000);
  });

  it('refuses what is not a plain non negative number', () => {
    for (const raw of ['', ' ', 'abc', '-5', '1e3', '1.2.3', '--']) {
      const calc = expireCalc('blocks', raw);
      expect(calc.valid, JSON.stringify(raw)).toBe(false);
      expect(calc.blocks).toBeNull();
    }
  });

  it('asks the linter, and every code it returns exists', () => {
    const over = expireCalc('blocks', String(LIMITS.expire.max + 1));
    expect(over.valid).toBe(true);
    expect(over.codes.length).toBeGreaterThan(0);
    for (const code of over.codes) {
      expect(code.startsWith('EXPIRE_')).toBe(true);
      expect(code in LINT_CODES, code).toBe(true);
    }
  });

  it('raises no expire code for the form default', () => {
    expect(expireCalc('blocks', String(BLOCKS_PER_MONTH)).codes).toEqual([]);
  });

  it('names a discount for a long subscription and none for a month', () => {
    expect(expireCalc('months', '12').discount).not.toBeNull();
    expect(expireCalc('months', '1').discount).toBeNull();
  });
});

describe('lineColumn', () => {
  it('counts lines and columns from one', () => {
    expect(lineColumn('abc', 0)).toEqual({ line: 1, column: 1 });
    expect(lineColumn('abc', 2)).toEqual({ line: 1, column: 3 });
    expect(lineColumn('a\nbc', 3)).toEqual({ line: 2, column: 2 });
    expect(lineColumn('a\n\nb', 3)).toEqual({ line: 3, column: 1 });
  });

  it('clamps a position outside the text', () => {
    expect(lineColumn('ab', -4)).toEqual({ line: 1, column: 1 });
    expect(lineColumn('ab', 99)).toEqual({ line: 1, column: 3 });
  });
});

describe('validateText', () => {
  it('says empty for nothing', () => {
    expect(validateText('').kind).toBe('empty');
    expect(validateText('  \n ').kind).toBe('empty');
  });

  it('reports a syntax error with a place and does not throw', () => {
    const result = validateText('{\n  "version": 8,\n  "name": \n}');
    expect(result.kind).toBe('syntax');
    if (result.kind === 'syntax') {
      expect(result.message).not.toBe('');
      expect(result.message).not.toMatch(/position \d+/);
      if (result.line !== null) expect(result.line).toBeGreaterThanOrEqual(1);
    }
  });

  it('refuses a paste that is too long without parsing it', () => {
    const result = validateText(`${' '.repeat(VALIDATE_MAX_CHARS)}{}`);
    expect(result.kind).toBe('syntax');
  });

  it('lints a fixture as valid', () => {
    const result = validateText(JSON.stringify(fixture('web-app')));
    expect(result.kind).toBe('report');
    if (result.kind === 'report') {
      expect(result.report.valid).toBe(true);
      expect(result.report.errors).toBe(0);
    }
  });

  it('lints JSON that is not an object and says no', () => {
    for (const text of ['[]', '42', '"hello"', 'null']) {
      const result = validateText(text);
      expect(result.kind, text).toBe('report');
      if (result.kind === 'report') expect(result.report.valid, text).toBe(false);
    }
  });

  it('is read only: it hands back the spec it was given', () => {
    const text = JSON.stringify({ version: 8, name: 'x' });
    const result = validateText(text);
    if (result.kind === 'report') expect(result.spec).toEqual({ version: 8, name: 'x' });
  });
});
