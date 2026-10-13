import { describe, expect, it } from 'vitest';
import {
  type CheckContext,
  checkLintCodes,
  checkPaths,
  describeCheck,
  evaluateCheck,
  failureMessages,
  isEmptyValue,
  isValidPathSyntax,
  parsePath,
  readPath,
} from './checks';
import type { Check } from './types';

const spec = {
  name: 'hello',
  instances: 3,
  staticip: false,
  geolocation: ['acEU', 'a!cEU_RU'],
  contacts: [],
  compose: [
    { name: 'web', ports: [31001, 31002], containerPorts: [3000, 3001], cpu: 0.5, repotag: 'me/web:1.2' },
    { name: 'db', ports: [], containerPorts: [5432], cpu: 1, repotag: 'postgres:16' },
  ],
};

const ctx = (over: Partial<CheckContext> = {}): CheckContext => ({
  spec,
  lint: { valid: true, codes: [] },
  usdPerMonth: 0.99,
  ...over,
});

const pass = (c: Check, over?: Partial<CheckContext>) => evaluateCheck(c, ctx(over)).pass;

describe('readPath', () => {
  it('reads keys, nested keys and indexes', () => {
    expect(readPath(spec, 'name')).toEqual({ found: true, value: 'hello' });
    expect(readPath(spec, 'compose[0].name').value).toBe('web');
    expect(readPath(spec, 'compose[1].containerPorts[0]').value).toBe(5432);
  });

  it('accepts dotted indexes and quoted keys', () => {
    expect(readPath(spec, 'compose.0.ports.1').value).toBe(31002);
    expect(readPath({ 'a.b': 1 }, '["a.b"]').value).toBe(1);
  });

  it('expands [*] and flattens one level of arrays', () => {
    expect(readPath(spec, 'compose[*].name').value).toEqual(['web', 'db']);
    expect(readPath(spec, 'compose[*].ports').value).toEqual([31001, 31002]);
    expect(readPath(spec, 'compose[*]').value).toHaveLength(2);
  });

  it('reads length of arrays and strings', () => {
    expect(readPath(spec, 'compose.length').value).toBe(2);
    expect(readPath(spec, 'name.length').value).toBe(5);
  });

  it('reports not found and never throws', () => {
    expect(readPath(spec, 'nope').found).toBe(false);
    expect(readPath(spec, 'compose[5].name').found).toBe(false);
    expect(readPath(spec, 'compose[0').found).toBe(false);
    expect(readPath(null, 'a').found).toBe(false);
    expect(readPath(spec, '__proto__.x').found).toBe(false);
    expect(readPath(spec, 'constructor').found).toBe(false);
  });

  it('validates syntax', () => {
    for (const ok of ['a', 'a.b', 'a[0]', 'a[0].b[1].c', 'a[*].b', '[0]'])
      expect(isValidPathSyntax(ok)).toBe(true);
    for (const bad of ['', '.a', 'a.', 'a..b', 'a[', 'a[x]', 'a[0]b', 'a[]']) {
      expect(isValidPathSyntax(bad), bad).toBe(false);
    }
    expect(parsePath('a[0].b')).toEqual([
      { type: 'key', key: 'a' },
      { type: 'index', index: 0 },
      { type: 'key', key: 'b' },
    ]);
  });
});

describe('evaluateCheck operators', () => {
  it('eq and neq', () => {
    expect(pass({ path: 'instances', op: 'eq', value: 3 })).toBe(true);
    expect(pass({ path: 'instances', op: 'eq', value: 4 })).toBe(false);
    expect(pass({ path: 'instances', op: 'eq', value: '3' })).toBe(true); // loose on type
    expect(pass({ path: 'staticip', op: 'eq', value: false })).toBe(true);
    expect(pass({ path: 'name', op: 'neq', value: 'x' })).toBe(true);
    expect(pass({ path: 'name', op: 'neq', value: 'hello' })).toBe(false);
    expect(pass({ path: 'missing', op: 'eq', value: 1 })).toBe(false);
  });

  it('gt, gte, lt, lte', () => {
    expect(pass({ path: 'instances', op: 'gt', value: 2 })).toBe(true);
    expect(pass({ path: 'instances', op: 'gt', value: 3 })).toBe(false);
    expect(pass({ path: 'instances', op: 'gte', value: 3 })).toBe(true);
    expect(pass({ path: 'instances', op: 'lt', value: 4 })).toBe(true);
    expect(pass({ path: 'instances', op: 'lt', value: 3 })).toBe(false);
    expect(pass({ path: 'instances', op: 'lte', value: 3 })).toBe(true);
    expect(pass({ path: 'name', op: 'gt', value: 1 })).toBe(false); // not a number
    expect(pass({ path: 'missing', op: 'gte', value: 0 })).toBe(false);
  });

  it('includes on arrays and strings', () => {
    expect(pass({ path: 'compose[0].containerPorts', op: 'includes', value: 3000 })).toBe(true);
    expect(pass({ path: 'compose[0].containerPorts', op: 'includes', value: 80 })).toBe(false);
    expect(pass({ path: 'geolocation', op: 'includes', value: 'acEU' })).toBe(true);
    expect(pass({ path: 'name', op: 'includes', value: 'ell' })).toBe(true);
    expect(pass({ path: 'compose[*].ports', op: 'includes', value: 31002 })).toBe(true);
    expect(pass({ path: 'instances', op: 'includes', value: 3 })).toBe(false);
  });

  it('matches against strings, numbers and any array element', () => {
    expect(pass({ path: 'compose[0].repotag', op: 'matches', value: ':\\d+\\.\\d+$' })).toBe(true);
    expect(pass({ path: 'compose[1].repotag', op: 'matches', value: ':latest$' })).toBe(false);
    expect(pass({ path: 'geolocation', op: 'matches', value: '^a!c' })).toBe(true);
    expect(pass({ path: 'instances', op: 'matches', value: '^3$' })).toBe(true);
    expect(pass({ path: 'name', op: 'matches', value: '(' })).toBe(false); // invalid regex fails closed
  });

  it('exists and empty', () => {
    expect(pass({ path: 'name', op: 'exists' })).toBe(true);
    expect(pass({ path: 'contacts', op: 'exists' })).toBe(false);
    expect(pass({ path: 'contacts', op: 'empty' })).toBe(true);
    expect(pass({ path: 'missing', op: 'empty' })).toBe(true);
    expect(pass({ path: 'missing', op: 'exists' })).toBe(false);
    expect(pass({ path: 'staticip', op: 'exists' })).toBe(true); // false is a value
    expect(pass({ path: 'compose[1].ports', op: 'empty' })).toBe(true);
    expect(isEmptyValue('  ')).toBe(true);
    expect(isEmptyValue(0)).toBe(false);
  });

  it('len>=', () => {
    expect(pass({ path: 'compose', op: 'len>=', value: 2 })).toBe(true);
    expect(pass({ path: 'compose', op: 'len>=', value: 3 })).toBe(false);
    expect(pass({ path: 'name', op: 'len>=', value: 5 })).toBe(true);
    expect(pass({ path: 'instances', op: 'len>=', value: 1 })).toBe(false);
  });
});

describe('evaluateCheck lint and price', () => {
  it('lint valid', () => {
    expect(pass({ lint: 'valid' })).toBe(true);
    expect(pass({ lint: 'valid' }, { lint: { valid: false, codes: ['PORT_BANNED'] } })).toBe(false);
    expect(pass({ lint: 'valid' }, { lint: null })).toBe(false);
  });

  it('lint absent', () => {
    const lint = { valid: false, codes: ['PORT_BANNED', 'NAME_FORMAT'] };
    expect(pass({ lint: 'absent', codes: ['PORT_DUPLICATE'] }, { lint })).toBe(true);
    expect(pass({ lint: 'absent', codes: ['PORT_BANNED', 'PORT_DUPLICATE'] }, { lint })).toBe(false);
    expect(pass({ lint: 'absent', codes: ['X'] }, { lint: null })).toBe(false);
  });

  it('price max and min', () => {
    expect(pass({ price: 'max', usd: 1 })).toBe(true);
    expect(pass({ price: 'max', usd: 0.99 })).toBe(true);
    expect(pass({ price: 'max', usd: 0.5 })).toBe(false);
    expect(pass({ price: 'min', usd: 0.99 })).toBe(true);
    expect(pass({ price: 'min', usd: 2 })).toBe(false);
    expect(pass({ price: 'max', usd: 5 }, { usdPerMonth: null })).toBe(false);
  });
});

describe('evaluateCheck composition and messages', () => {
  const a: Check = { path: 'instances', op: 'gte', value: 5, message: 'Need five instances.' };
  const b: Check = { path: 'name', op: 'eq', value: 'nope', message: 'Wrong name.' };
  const c: Check = { path: 'compose', op: 'len>=', value: 1 };

  it('all passes only when every child passes and reports each failing child', () => {
    expect(pass({ all: [c, c] })).toBe(true);
    const r = evaluateCheck({ all: [a, b, c] }, ctx());
    expect(r.pass).toBe(false);
    expect(r.failed.map((f) => f.message)).toEqual(['Need five instances.', 'Wrong name.']);
    expect(r.failed.map((f) => f.path)).toEqual(['instances', 'name']);
  });

  it('any passes when one child passes', () => {
    expect(pass({ any: [a, c] })).toBe(true);
    const r = evaluateCheck({ any: [a, b] }, ctx());
    expect(r.pass).toBe(false);
    expect(failureMessages(r)).toEqual(['Need five instances.', 'Wrong name.']);
  });

  it('nests', () => {
    expect(pass({ all: [c, { any: [a, c] }] })).toBe(true);
    expect(pass({ all: [c, { any: [a, b] }] })).toBe(false);
  });

  it('empty all passes and empty any fails', () => {
    expect(pass({ all: [] })).toBe(true);
    expect(pass({ any: [] })).toBe(false);
  });

  it('a failing leaf with no message still reports its path and check', () => {
    const r = evaluateCheck(c2(), ctx());
    expect(r.failed[0]?.message).toBeUndefined();
    expect(r.failed[0]?.path).toBe('compose');
    expect(r.failed[0]?.check).toBeTruthy();
  });
});

function c2(): Check {
  return { path: 'compose', op: 'len>=', value: 9 };
}

describe('describing and walking', () => {
  it('describes leaves', () => {
    expect(describeCheck({ path: 'compose[0].containerPorts', op: 'includes', value: 3000 })).toBe(
      'compose[0].containerPorts includes 3000',
    );
    expect(describeCheck({ price: 'max', usd: 2.49 })).toBe('The monthly price is at most $2.49');
    expect(describeCheck({ lint: 'valid' })).toBe('The spec has no errors');
    expect(describeCheck({ lint: 'absent', codes: ['A', 'B'] })).toBe('These issues are gone: A, B');
  });

  it('lists paths and lint codes', () => {
    const c: Check = {
      all: [
        { path: 'a', op: 'exists' },
        {
          any: [
            { path: 'b[0]', op: 'eq', value: 1 },
            { lint: 'absent', codes: ['X', 'Y'] },
          ],
        },
      ],
    };
    expect(checkPaths(c)).toEqual(['a', 'b[0]']);
    expect(checkLintCodes(c)).toEqual(['X', 'Y']);
  });
});
