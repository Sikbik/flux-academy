import { describe, expect, it } from 'vitest';
import {
  ancestors,
  childPath,
  componentIndexOf,
  covers,
  diffPaths,
  fieldPathOf,
  formatPath,
  getAt,
  hasEditableWithin,
  isPathEditable,
  normalizePath,
  parentPath,
  parsePath,
  removeAt,
  sameJson,
  sectionsOf,
  setAt,
} from './paths';

describe('parsePath and formatPath', () => {
  it('splits keys and indexes', () => {
    expect(parsePath('compose[0].ports[1]')).toEqual(['compose', 0, 'ports', 1]);
    expect(parsePath('name')).toEqual(['name']);
    expect(parsePath('')).toEqual([]);
    expect(parsePath('compose[*].cpu')).toEqual(['compose', '*', 'cpu']);
  });

  it('round trips and normalizes dotted indexes', () => {
    expect(formatPath(parsePath('compose[2].environmentParameters[0]'))).toBe(
      'compose[2].environmentParameters[0]',
    );
    expect(normalizePath('compose.0.cpu')).toBe('compose[0].cpu');
  });

  it('builds parents and children', () => {
    expect(parentPath('compose[0].ports[1]')).toBe('compose[0].ports');
    expect(parentPath('name')).toBe('');
    expect(childPath('compose[0]', 'ports')).toBe('compose[0].ports');
    expect(childPath('compose[0].ports', 2)).toBe('compose[0].ports[2]');
    expect(ancestors('compose[0].ports[1]')).toEqual([
      'compose[0].ports[1]',
      'compose[0].ports',
      'compose[0]',
      'compose',
    ]);
  });

  it('finds the component of a path', () => {
    expect(componentIndexOf('compose[3].cpu')).toBe(3);
    expect(componentIndexOf('instances')).toBeNull();
  });
});

describe('get, set, remove', () => {
  const spec = { name: 'a', compose: [{ ports: [1, 2], cpu: 1 }, { ports: [3] }] };

  it('reads nested values and returns undefined for misses', () => {
    expect(getAt(spec, 'compose[0].ports[1]')).toBe(2);
    expect(getAt(spec, 'compose[5].ports')).toBeUndefined();
    expect(getAt(spec, 'name.x')).toBeUndefined();
  });

  it('sets immutably and shares untouched branches', () => {
    const next = setAt(spec, 'compose[0].ports[1]', 9);
    expect(getAt(next, 'compose[0].ports')).toEqual([1, 9]);
    expect(getAt(spec, 'compose[0].ports')).toEqual([1, 2]);
    expect(next.compose[1]).toBe(spec.compose[1]);
  });

  it('creates missing containers', () => {
    expect(setAt({}, 'a.b[1]', 'x')).toEqual({ a: { b: [undefined, 'x'] } });
  });

  it('removes array elements and object keys', () => {
    expect(getAt(removeAt(spec, 'compose[0].ports[0]'), 'compose[0].ports')).toEqual([2]);
    expect(removeAt(spec, 'name')).toEqual({ compose: spec.compose });
    expect(removeAt(spec, 'compose[9]')).toBe(spec);
  });
});

describe('editable paths', () => {
  it('treats undefined as everything and [] as nothing', () => {
    expect(isPathEditable('name')).toBe(true);
    expect(isPathEditable('name', [])).toBe(false);
  });

  it('lets an entry cover everything below it', () => {
    const ed = ['name', 'compose[0].ports', 'compose[*].cpu'];
    expect(isPathEditable('name', ed)).toBe(true);
    expect(isPathEditable('compose[0].ports[1]', ed)).toBe(true);
    expect(isPathEditable('compose[2].cpu', ed)).toBe(true);
    expect(isPathEditable('compose[0].containerPorts', ed)).toBe(false);
    expect(isPathEditable('instances', ed)).toBe(false);
  });

  it('does not let a deeper entry unlock its parent', () => {
    expect(isPathEditable('compose[0]', ['compose[0].ports'])).toBe(false);
    expect(hasEditableWithin('compose[0]', ['compose[0].ports'])).toBe(true);
    expect(hasEditableWithin('compose[1]', ['compose[0].ports'])).toBe(false);
  });

  it('matches prefixes by segment, not by characters', () => {
    expect(covers('compose[1]', 'compose[10].cpu')).toBe(false);
    expect(covers('name', 'nameX')).toBe(false);
  });
});

describe('diffPaths', () => {
  it('reports the shortest paths that changed', () => {
    const a = { n: 1, c: [{ p: [1, 2], q: 'x' }], e: [1] };
    const b = { n: 2, c: [{ p: [1, 3], q: 'x' }], e: [1, 2] };
    expect(diffPaths(a, b).sort()).toEqual(['c[0].p[1]', 'e', 'n']);
    expect(sameJson(a, JSON.parse(JSON.stringify(a)))).toBe(true);
  });
});

describe('fieldPathOf', () => {
  it('sends the ports table siblings to the ports field', () => {
    expect(fieldPathOf('compose[0].containerPorts')).toBe('compose[0].ports');
    expect(fieldPathOf('compose[2].domains[1]')).toBe('compose[2].ports');
    expect(fieldPathOf('compose[*].containerPorts')).toBe('compose[*].ports');
  });

  it('leaves every other path alone', () => {
    for (const p of ['compose[0].ports', 'compose[1].cpu', 'name', 'geolocation', 'domains', 'compose']) {
      expect(fieldPathOf(p)).toBe(p);
    }
  });
});

describe('sectionsOf', () => {
  it('names the app section for the app level fields', () => {
    expect(sectionsOf(['name', 'instances', 'geolocation[1]'], 3)).toEqual(['app']);
  });

  it('names one component section for a component path', () => {
    expect(sectionsOf(['compose[1].cpu', 'compose[1].ports'], 3)).toEqual(['c1']);
  });

  it('puts the app first and orders components by index', () => {
    expect(sectionsOf(['compose[2].ram', 'enterprise', 'compose[0].hdd'], 3)).toEqual(['app', 'c0', 'c2']);
  });

  it('opens every component for a pattern that spans them', () => {
    expect(sectionsOf(['compose[*].cpu'], 3)).toEqual(['c0', 'c1', 'c2']);
    expect(sectionsOf(['compose'], 2)).toEqual(['c0', 'c1']);
  });

  it('is empty for nothing', () => {
    expect(sectionsOf([], 3)).toEqual([]);
  });
});
