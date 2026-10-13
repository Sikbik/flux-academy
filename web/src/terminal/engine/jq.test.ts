import { describe, expect, it } from 'vitest';
import { compileJq, JqError, runJq } from './jq';
import { jsonToMarkup, minifiedJson, parseJsonStream, prettyJson } from './json';
import { parseMarkup } from './markup';
import { make, run, script } from './testkit';

const DOC = {
  status: 'success',
  data: {
    name: 'explorer',
    instances: 40,
    compose: [
      { name: 'mongodb', cpu: 1, ports: [], tags: ['db', 'store'] },
      { name: 'web', cpu: 0.5, ports: [31001], tags: ['http'] },
    ],
    nested: { 'odd-key': true, none: null },
  },
};

function q(filter: string, input: unknown = DOC): unknown[] {
  return runJq(compileJq(filter), input);
}

describe('jq paths', () => {
  it('identity and fields', () => {
    expect(q('.')).toEqual([DOC]);
    expect(q('.status')).toEqual(['success']);
    expect(q('.data.name')).toEqual(['explorer']);
    expect(q('.data.nested."odd-key"')).toEqual([true]);
    expect(q('.nope')).toEqual([null]);
    expect(q('.data.nope.deeper')).toEqual([null]);
  });

  it('indexes and slices', () => {
    expect(q('.data.compose[0].name')).toEqual(['mongodb']);
    expect(q('.data.compose[-1].name')).toEqual(['web']);
    expect(q('.data.compose[5]')).toEqual([null]);
    expect(q('.data.compose[0].tags[0:1]')).toEqual([['db']]);
    expect(q('.data.name[0:3]')).toEqual(['exp']);
  });

  it('iterates arrays and objects', () => {
    expect(q('.data.compose[].name')).toEqual(['mongodb', 'web']);
    expect(q('.data.compose[0].tags[]')).toEqual(['db', 'store']);
    expect(q('.data.nested[]')).toEqual([true, null]);
    expect(q('.[]', [1, 2])).toEqual([1, 2]);
  });

  it('pipes and commas', () => {
    expect(q('.data | .name')).toEqual(['explorer']);
    expect(q('.data.compose | length')).toEqual([2]);
    expect(q('.status, .data.name')).toEqual(['success', 'explorer']);
    expect(q('.data.compose[] | .name')).toEqual(['mongodb', 'web']);
  });

  it('optional access swallows type errors', () => {
    expect(q('.data.name.x?')).toEqual([]);
    expect(q('.data.compose[].ports[]?')).toEqual([31001]);
    expect(() => q('.data.name.x')).toThrow(/Cannot index string with "x"/);
  });
});

describe('jq functions and construction', () => {
  it('length, keys, type', () => {
    expect(q('.data.name | length')).toEqual([8]);
    expect(q('.data | keys')).toEqual([['compose', 'instances', 'name', 'nested']]);
    expect(q('.data.compose | map(type)')).toEqual([['object', 'object']]);
    expect(q('.data.instances | type')).toEqual(['number']);
    expect(q('null | length')).toEqual([0]);
  });

  it('map, select and comparisons', () => {
    expect(q('.data.compose | map(.name)')).toEqual([['mongodb', 'web']]);
    expect(q('.data.compose[] | select(.cpu > 0.7) | .name')).toEqual(['mongodb']);
    expect(q('.data.compose[] | select(.name == "web") | .ports[0]')).toEqual([31001]);
    expect(q('.data.instances >= 40')).toEqual([true]);
    expect(q('.data.instances > 40 or .data.name == "explorer"')).toEqual([true]);
    expect(q('.data.instances > 40 and true')).toEqual([false]);
  });

  it('array and object construction', () => {
    expect(q('[.data.compose[].name]')).toEqual([['mongodb', 'web']]);
    expect(q('{name: .data.name, n: .data.instances}')).toEqual([{ name: 'explorer', n: 40 }]);
    expect(q('.data | {name, instances}')).toEqual([{ name: 'explorer', instances: 40 }]);
    expect(q('[]')).toEqual([[]]);
  });

  it('string and array helpers', () => {
    expect(q('.data.compose | map(.name) | join(", ")')).toEqual(['mongodb, web']);
    expect(q('[3,1,2] | sort')).toEqual([[1, 2, 3]]);
    expect(q('[1,1,2] | unique')).toEqual([[1, 2]]);
    expect(q('[1,2,3] | add')).toEqual([6]);
    expect(q('[1,2,3] | first')).toEqual([1]);
    expect(q('[1,2,3] | last')).toEqual([3]);
    expect(q('[1,2,3] | reverse')).toEqual([[3, 2, 1]]);
    expect(q('[1,5,3] | min, max')).toEqual([1, 5]);
    expect(q('.data.name | ascii_upcase')).toEqual(['EXPLORER']);
    expect(q('.data.name | startswith("exp")')).toEqual([true]);
    expect(q('.data.name | endswith("x")')).toEqual([false]);
    expect(q('.data | has("name")')).toEqual([true]);
    expect(q('.data.name | contains("plor")')).toEqual([true]);
    expect(q('.data.instances | tostring')).toEqual(['40']);
    expect(q('"12" | tonumber')).toEqual([12]);
    expect(q('.data.compose | map(.cpu) | add')).toEqual([1.5]);
    expect(q('.data.nested | to_entries | map(.key)')).toEqual([['odd-key', 'none']]);
  });

  it('literals and the alternative operator', () => {
    expect(q('1')).toEqual([1]);
    expect(q('"x"')).toEqual(['x']);
    expect(q('.missing // "dflt"')).toEqual(['dflt']);
    expect(q('.status // "dflt"')).toEqual(['success']);
    expect(q('1 + 2')).toEqual([3]);
    expect(q('"a" + "b"')).toEqual(['ab']);
  });
});

describe('jq errors', () => {
  it('compile errors', () => {
    for (const bad of ['.data[', '.data |', 'nosuchfn', '.a.', '{', ')', '@x']) {
      expect(() => compileJq(bad), bad).toThrow(JqError);
    }
  });

  it('runtime errors say what happened', () => {
    expect(() => q('.status | keys')).toThrow(/string \("success"\) has no keys/);
    expect(() => q('.data.instances[]')).toThrow(/Cannot iterate over number/);
    expect(() => q('.data.name + 1')).toThrow(/cannot be added/);
  });

  it('is bounded', () => {
    const big = Array.from({ length: 3000 }, (_, i) => i);
    expect(() => runJq(compileJq('.[]'), big)).toThrow(/too many results/);
  });
});

describe('parseJsonStream', () => {
  it('reads one value, several values and nothing', () => {
    expect(parseJsonStream('{"a":1}')).toEqual({ ok: true, values: [{ a: 1 }] });
    expect(parseJsonStream('{"a":1}\n{"b":2}\n3 "x" [1]')).toEqual({
      ok: true,
      values: [{ a: 1 }, { b: 2 }, 3, 'x', [1]],
    });
    expect(parseJsonStream('  ')).toEqual({ ok: true, values: [] });
  });

  it('reports a jq style error with a column', () => {
    const r = parseJsonStream('Cannot GET /apps/doesnotexist');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe('parse error: Invalid literal at line 1, column 7');
    }
    const r2 = parseJsonStream('{"a":1} nope');
    expect(r2.ok).toBe(false);
  });
});

describe('pretty printing', () => {
  it('prints like jq with two-space indent', () => {
    const lines = prettyJson({ a: 1, b: [true, null, 'x'], c: {}, d: [] }).map((l) => l.text);
    expect(lines).toEqual([
      '{',
      '  "a": 1,',
      '  "b": [',
      '    true,',
      '    null,',
      '    "x"',
      '  ],',
      '  "c": {},',
      '  "d": []',
      '}',
    ]);
  });

  it('colours keys, strings, numbers and keywords', () => {
    const lines = prettyJson({ k: 'v', n: 1, t: true, z: null });
    const kinds = lines.slice(1, -1).map((l) => l.spans.map((s) => s.kind ?? 'plain'));
    expect(kinds[0]).toEqual(['plain', 'key', 'plain', 'str', 'plain']);
    expect(kinds[1]).toContain('num');
    expect(kinds[2]).toContain('kw');
    expect(kinds[3]).toContain('kw');
  });

  it('prints bare scalars', () => {
    expect(prettyJson(3031422).map((l) => l.text)).toEqual(['3031422']);
    expect(prettyJson('hi').map((l) => l.text)).toEqual(['"hi"']);
  });

  it('round-trips through markup', () => {
    const value = { 'a [ok] b': ['[err]', 'x\\y', 1.5], deep: { list: [{ id: 1 }] } };
    const viaMarkup = jsonToMarkup(value).map((s) => parseMarkup(s));
    const direct = prettyJson(value);
    expect(viaMarkup.map((l) => l.text)).toEqual(direct.map((l) => l.text));
    expect(viaMarkup.map((l) => l.spans.map((s) => s.kind))).toEqual(
      direct.map((l) => l.spans.map((s) => s.kind)),
    );
  });

  it('minifies for curl', () => {
    expect(minifiedJson({ status: 'success', data: 7 })).toBe('{"status":"success","data":7}');
  });
});

describe('the jq builtin in a pipeline', () => {
  const sc = script({
    commands: [
      { match: '^api html$', output: ['Cannot GET /apps/doesnotexist'] },
      { match: '^api (\\w+)$', output: [minifiedJson(DOC)] },
    ],
    goals: [{ id: 'g', label: 'x' }],
  });

  it('pretty prints with colours', () => {
    const s = make(sc);
    const t = run(s, 'api x | jq .data.compose[0]').text;
    expect(t[0]).toBe('{');
    expect(t).toContain('  "name": "mongodb",');
  });

  it('prints raw strings with -r and compact with -c', () => {
    const s = make(sc);
    expect(run(s, 'api x | jq -r .data.name').text).toEqual(['explorer']);
    expect(run(s, 'api x | jq .data.name').text).toEqual(['"explorer"']);
    expect(run(s, 'api x | jq -c .data.compose[0].tags').text).toEqual(['["db","store"]']);
    expect(run(s, "api x | jq -r '.data.compose[].name'").text).toEqual(['mongodb', 'web']);
  });

  it('reads files too', () => {
    const s = make(script({ files: { 'spec.json': '{"a": {"b": 2}}' } }));
    expect(run(s, 'jq .a.b spec.json').text).toEqual(['2']);
    expect(run(s, 'jq .a.b nope.json').text[0]).toMatch(/Could not open nope.json/);
  });

  it('explains compile and parse errors in jq style', () => {
    const s = make(sc);
    const compile = run(s, "api x | jq '.data['").text;
    expect(compile[0]).toMatch(/^jq: error: syntax error/);
    expect(compile.at(-1)).toBe('jq: 1 compile error');
    const parse = run(s, 'api html | jq .').text;
    expect(parse[0]).toBe('jq: error (at <stdin>:0): parse error: Invalid literal at line 1, column 7');
  });

  it('says what jq needs when nothing is piped', () => {
    const s = make(sc);
    expect(run(s, 'jq .').text[0]).toMatch(/reads JSON from a pipe or a file/);
    expect(run(s, 'jq').text[0]).toMatch(/^Usage:/);
  });
});
