import { defaultSpec, normalizeSpec } from '@shared/flux/spec';
import { describe, expect, it } from 'vitest';
import { applySolution, buildSpec, composeLength, mergeSpecPatch } from './specs';

const tools = { normalizeSpec, defaultSpec };

describe('mergeSpecPatch', () => {
  it('merges objects key by key and leaves the inputs alone', () => {
    const base = { a: 1, b: { c: 2, d: 3 } };
    const out = mergeSpecPatch(base, { b: { c: 9 }, e: 4 });
    expect(out).toEqual({ a: 1, b: { c: 9, d: 3 }, e: 4 });
    expect(base).toEqual({ a: 1, b: { c: 2, d: 3 } });
  });

  it('replaces arrays of primitives', () => {
    expect(mergeSpecPatch({ ports: [1, 2, 3] }, { ports: [9] })).toEqual({ ports: [9] });
  });

  it('merges compose elements by index and takes the patch length', () => {
    const base = {
      compose: [
        { name: 'a', cpu: 1 },
        { name: 'b', cpu: 2 },
      ],
    };
    expect(mergeSpecPatch(base, { compose: [{}, { cpu: 5 }] })).toEqual({
      compose: [
        { name: 'a', cpu: 1 },
        { name: 'b', cpu: 5 },
      ],
    });
    expect(mergeSpecPatch(base, { compose: [{ cpu: 7 }] })).toEqual({ compose: [{ name: 'a', cpu: 7 }] });
    expect(mergeSpecPatch(base, { compose: [{}, {}, { name: 'c' }] })).toEqual({
      compose: [{ name: 'a', cpu: 1 }, { name: 'b', cpu: 2 }, { name: 'c' }],
    });
  });

  it('ignores undefined and blocked keys', () => {
    const out = mergeSpecPatch({ a: 1 }, { a: undefined, ['__proto__']: { x: 1 } }) as Record<
      string,
      unknown
    >;
    expect(out.a).toBe(1);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });
});

describe('buildSpec and applySolution', () => {
  it('builds a full normalised spec from a partial', () => {
    const s = buildSpec(tools, { name: 'my-app', compose: [{ containerPorts: [3000] }] });
    expect(s.name).toBe('my-app');
    expect(s.version).toBe(8);
    expect(s.compose).toHaveLength(1);
    expect(s.compose[0]?.containerPorts).toEqual([3000]);
    expect(s.compose[0]?.ports).toEqual([31001]); // inherited from defaultSpec
  });

  it('defaults an empty partial to the default spec', () => {
    expect(buildSpec(tools, undefined)).toEqual(defaultSpec());
  });

  it('applies a solution over a start spec', () => {
    const start = buildSpec(tools, { name: 'flux-x', compose: [{ ports: [22] }] });
    const fixed = applySolution(tools, start, { name: 'x-app', compose: [{ ports: [31001] }] });
    expect(fixed.name).toBe('x-app');
    expect(fixed.compose[0]?.ports).toEqual([31001]);
    expect(start.name).toBe('flux-x');
  });

  it('counts components', () => {
    expect(composeLength({ compose: [{}, {}] })).toBe(2);
    expect(composeLength({})).toBe(0);
  });
});
