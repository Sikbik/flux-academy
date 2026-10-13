import { BAKED_PRICING } from '@shared/flux/pricing';
import { defaultSpec } from '@shared/flux/spec';
import { describe, expect, it } from 'vitest';
import { BAKED_CONTEXT } from './engine';
import { specToText } from './jsonText';
import { addPort, removePort } from './ops';
import { createSession, ForgeSession, specFromPartial } from './session';

function make(partial = {}, opts = {}) {
  let t = 1000;
  return createSession(partial, { now: () => (t += 50), ...opts });
}

describe('a session over the default spec', () => {
  it('starts valid, priced and in sync with its text', () => {
    const s = make();
    const snap = s.getSnapshot();
    expect(snap.lint.valid).toBe(true);
    expect(snap.quote.usdPerMonth).toBeGreaterThan(0);
    expect(snap.text.text).toBe(specToText(snap.spec));
    expect(snap.text.error).toBeNull();
    expect(snap.canUndo).toBe(false);
  });

  it('prices at the baked rates until told otherwise and says so', () => {
    const snap = make().getSnapshot();
    expect(snap.pricing).toBe(BAKED_CONTEXT);
    expect(snap.quote.paramsSource).toBe('baked');
    expect(snap.quote.basis).toBe('computed');
  });

  it('lints in teaching mode by default so TaskEvent codes match the validator', () => {
    const s = make();
    const codes = s.getSnapshot().lint.issues.map((i) => i.code);
    expect(codes).toContain('HEALTH_NOT_CHECKED');
  });
});

describe('editing the form side', () => {
  it('sets a field, relints, reprices and records history', () => {
    const s = make();
    const before = s.getSnapshot();
    expect(s.edit(['instances'], (sp) => ({ ...sp, instances: 1 }))).toBe(true);
    const after = s.getSnapshot();
    expect(after.spec.instances).toBe(1);
    expect(after.lint.issues.map((i) => i.code)).toContain('INSTANCES_ONE');
    expect(after.text.text).toContain('"instances": 1');
    expect(after.canUndo).toBe(true);
    expect(after.changed).toEqual(['instances']);
    expect(after.revision).toBeGreaterThan(before.revision);
    expect(after.quote).not.toBe(before.quote);
  });

  it('memoises lint and quote when an unrelated option changes', () => {
    const s = make();
    const a = s.getSnapshot();
    s.setOptions({ editable: undefined, readOnly: false });
    expect(s.getSnapshot()).toBe(a);
    s.setLintContext({ teaching: true });
    expect(s.getSnapshot().lint).toBe(a.lint);
  });

  it('undoes and redoes, regenerating the text', () => {
    const s = make();
    s.edit(['name'], (sp) => ({ ...sp, name: 'one' }), { key: 'name' });
    s.edit(['instances'], (sp) => ({ ...sp, instances: 5 }), { key: 'instances' });
    expect(s.undo()).toBe(true);
    expect(s.getSnapshot().spec.instances).toBe(3);
    expect(s.getSnapshot().text.text).toContain('"instances": 3');
    expect(s.getSnapshot().origin).toBe('undo');
    expect(s.redo()).toBe(true);
    expect(s.getSnapshot().spec.instances).toBe(5);
  });

  it('coalesces typing into one undo step', () => {
    const s = make();
    for (const v of ['a', 'ab', 'abc', 'abcd']) {
      s.edit(['name'], (sp) => ({ ...sp, name: v }), { key: 'name' });
    }
    expect(s.getSnapshot().spec.name).toBe('abcd');
    s.undo();
    expect(s.getSnapshot().spec.name).toBe('hello-flux');
    expect(s.getSnapshot().canUndo).toBe(false);
  });

  it('keeps arrays aligned through operations', () => {
    const s = make();
    s.edit(['compose[0].ports'], (sp) => addPort(sp, 0));
    let c = s.getSnapshot().spec.compose[0];
    expect(c?.ports).toHaveLength(2);
    expect(c?.containerPorts).toHaveLength(2);
    expect(c?.domains).toHaveLength(2);
    s.edit(['compose[0].ports'], (sp) => removePort(sp, 0, 0));
    c = s.getSnapshot().spec.compose[0];
    expect(c?.ports).toHaveLength(1);
    expect(s.getSnapshot().lint.issues.map((i) => i.code)).not.toContain('PORT_LENGTH_MISMATCH');
  });
});

describe('the JSON text', () => {
  it('updates the spec when the text is valid and does not rewrite the learner text', () => {
    const s = make();
    const text =
      '{"version":8,"name":"mine","description":"d","owner":"1hjy4bCYBJr4mny4zCE85J94RXa8W6q37","instances":2,"expire":88000,"staticip":false,"enterprise":"","contacts":[],"geolocation":[],"nodes":[],"compose":[{"name":"web","description":"x","repotag":"nginx:1.27","repoauth":"","ports":[31001],"containerPorts":[80],"domains":[""],"environmentParameters":[],"commands":[],"containerData":"/tmp","cpu":0.1,"ram":100,"hdd":1}]}';
    s.setText(text);
    const snap = s.getSnapshot();
    expect(snap.text.text).toBe(text);
    expect(snap.text.custom).toBe(true);
    expect(snap.text.error).toBeNull();
    expect(snap.spec.name).toBe('mine');
    expect(snap.spec.instances).toBe(2);
  });

  it('keeps the last good spec while the text is broken, and reports where', () => {
    const s = make();
    s.edit(['name'], (sp) => ({ ...sp, name: 'good' }));
    const goodText = s.getSnapshot().text.text;
    s.setText(goodText.replace('"good",', '"good"'));
    const snap = s.getSnapshot();
    expect(snap.text.error).not.toBeNull();
    expect(snap.text.error?.message).toMatch(/comma/);
    expect(snap.spec.name).toBe('good');
    expect(snap.text.text).toContain('"good"');
    expect(snap.lint.valid).toBe(true);
  });

  it('recovers when the text becomes valid again', () => {
    const s = make();
    const good = s.getSnapshot().text.text;
    s.setText(`${good}x`);
    expect(s.getSnapshot().text.error).not.toBeNull();
    s.setText(good);
    expect(s.getSnapshot().text.error).toBeNull();
  });

  it('pauses form edits while the text is broken so the learner text is never replaced', () => {
    const s = make();
    const good = s.getSnapshot().text.text;
    s.setText(`${good}x`);
    const broken = s.getSnapshot().text.text;
    expect(s.edit(['instances'], (sp) => ({ ...sp, instances: 9 }))).toBe(false);
    expect(s.getSnapshot().text.text).toBe(broken);
    expect(s.getSnapshot().spec.instances).toBe(3);
    s.revertText();
    expect(s.edit(['instances'], (sp) => ({ ...sp, instances: 9 }))).toBe(true);
  });

  it('reports a key the model drops, because lint reads what was typed', () => {
    const s = make();
    const obj = JSON.parse(s.getSnapshot().text.text) as Record<string, unknown>;
    obj.tiered = true;
    s.setText(JSON.stringify(obj, null, 2));
    const codes = s.getSnapshot().lint.issues.map((i) => i.code);
    expect(codes).toContain('UNKNOWN_FIELD');
    expect(s.getSnapshot().spec).not.toHaveProperty('tiered');
  });

  it('first undo discards a broken text, the next one reverts the model', () => {
    const s = make();
    s.edit(['instances'], (sp) => ({ ...sp, instances: 4 }));
    s.setText('{ not json');
    expect(s.getSnapshot().canUndo).toBe(true);
    expect(s.undo()).toBe(true);
    expect(s.getSnapshot().text.error).toBeNull();
    expect(s.getSnapshot().spec.instances).toBe(4);
    expect(s.undo()).toBe(true);
    expect(s.getSnapshot().spec.instances).toBe(3);
  });

  it('formats back to the canonical layout', () => {
    const s = make();
    s.setText(JSON.stringify(s.getSnapshot().spec));
    expect(s.getSnapshot().text.custom).toBe(true);
    s.revertText();
    expect(s.getSnapshot().text.custom).toBe(false);
    expect(s.getSnapshot().text.text).toBe(specToText(s.getSnapshot().spec));
  });
});

describe('locked fields', () => {
  const editable = ['name', 'compose[0].containerPorts'];

  it('refuses form edits outside editable', () => {
    const s = make({}, { editable });
    expect(s.canEdit('name')).toBe(true);
    expect(s.canEdit('instances')).toBe(false);
    expect(s.edit(['instances'], (sp) => ({ ...sp, instances: 9 }))).toBe(false);
    expect(s.getSnapshot().spec.instances).toBe(3);
  });

  it('puts locked values back when the text edit touches them', () => {
    const s = make({}, { editable });
    const obj = JSON.parse(s.getSnapshot().text.text) as { instances: number; name: string };
    obj.instances = 9;
    obj.name = 'renamed';
    s.setText(JSON.stringify(obj, null, 2));
    const snap = s.getSnapshot();
    expect(snap.spec.name).toBe('renamed');
    expect(snap.spec.instances).toBe(3);
    expect(snap.text.ignored).toEqual(['instances']);
  });

  it('is fully read only when readOnly or an empty list', () => {
    const a = make({}, { readOnly: true });
    expect(a.edit(['name'], (sp) => ({ ...sp, name: 'x' }))).toBe(false);
    const b = make({}, { editable: [] });
    expect(b.canEdit('name')).toBe(false);
  });

  it('lets a solver apply a solution to locked paths', () => {
    const s = make({}, { editable: [] });
    s.apply({ instances: 4, compose: [{ cpu: 0.5 }] });
    expect(s.getSnapshot().spec.instances).toBe(4);
    expect(s.getSnapshot().spec.compose[0]?.cpu).toBe(0.5);
    expect(s.getSnapshot().origin).toBe('apply');
  });
});

describe('apply uses the lesson engine merge', () => {
  it('replaces primitive arrays and merges components by index', () => {
    const s = make({
      compose: [
        { name: 'web', ports: [31001], containerPorts: [80] },
        { name: 'db', ports: [], containerPorts: [], domains: [] },
      ],
    });
    s.apply({ compose: [{}, { cpu: 1 }] });
    const spec = s.getSnapshot().spec;
    expect(spec.compose).toHaveLength(2);
    expect(spec.compose[1]?.cpu).toBe(1);
    expect(spec.compose[0]?.ports).toEqual([31001]);
    s.apply({ compose: [{ cpu: 2 }] });
    expect(s.getSnapshot().spec.compose).toHaveLength(1);
  });

  it('merges over a given spec instead of the one on screen, and undo brings the screen back', () => {
    const start = specFromPartial({ instances: 3, compose: [{ cpu: 1 }, { cpu: 2 }] });
    const s = make({ instances: 3, compose: [{ cpu: 8 }, { cpu: 2 }] });
    s.apply({ compose: [{}, { cpu: 1.4 }] }, start);
    const spec = s.getSnapshot().spec;
    expect(spec.compose[0]?.cpu).toBe(1);
    expect(spec.compose[1]?.cpu).toBe(1.4);
    expect(s.getSnapshot().origin).toBe('apply');
    expect(s.undo()).toBe(true);
    expect(s.getSnapshot().spec.compose[0]?.cpu).toBe(8);
  });

  it('builds the starting spec from a stage partial like the lesson player', () => {
    const spec = specFromPartial({ name: 'start', compose: [{ ports: [3000], containerPorts: [3000] }] });
    expect(spec.name).toBe('start');
    expect(spec.compose[0]?.ports).toEqual([3000]);
    expect(spec.version).toBe(8);
  });
});

describe('replace, reset and pricing', () => {
  it('loads a preset, relints and starts a new history step', () => {
    const s = make();
    const next = { ...defaultSpec(), name: 'other', instances: 5 };
    const r = s.replace(next, 'preset');
    expect(r.ok).toBe(true);
    expect(s.getSnapshot().spec.name).toBe('other');
    expect(s.getSnapshot().origin).toBe('preset');
    expect(s.undo()).toBe(true);
    expect(s.getSnapshot().spec.name).toBe('hello-flux');
  });

  it('normalises an import and does not trust its types', () => {
    const s = make();
    s.replace(
      { name: 'x', instances: '4', compose: [{ repotag: 'nginx:1.27', ports: ['31001'] }] },
      'import',
    );
    expect(s.getSnapshot().spec.instances).toBe(4);
    expect(s.getSnapshot().spec.compose[0]?.ports).toEqual([31001]);
  });

  it('resets and forgets history', () => {
    const s = make();
    s.edit(['name'], (sp) => ({ ...sp, name: 'z' }));
    s.reset(defaultSpec());
    expect(s.getSnapshot().canUndo).toBe(false);
    expect(s.getSnapshot().spec.name).toBe('hello-flux');
    expect(s.getSnapshot().origin).toBe('reset');
  });

  it('reprices when the rates change and labels the source', () => {
    const s = make();
    const base = s.getSnapshot().quote;
    s.setPricing({
      params: { ...BAKED_PRICING.params, cpu: BAKED_PRICING.params.cpu * 10 },
      fluxUsd: 0.1,
      source: 'live',
    });
    const snap = s.getSnapshot();
    expect(snap.quote.paramsSource).toBe('live');
    expect(snap.quote.fluxUsd).toBe(0.1);
    expect(snap.quote.usdPerMonth).toBeGreaterThanOrEqual(base.usdPerMonth);
  });

  it('notifies subscribers once per change and can be unsubscribed', () => {
    const s = make();
    let n = 0;
    const off = s.subscribe(() => n++);
    s.edit(['name'], (sp) => ({ ...sp, name: 'a' }));
    s.edit(['name'], (sp) => ({ ...sp, name: 'b' }));
    expect(n).toBe(2);
    off();
    s.edit(['name'], (sp) => ({ ...sp, name: 'c' }));
    expect(n).toBe(2);
  });
});

describe('large specs', () => {
  it('stays fast with ten components', () => {
    const s = make();
    const compose = Array.from({ length: 10 }, (_, i) => ({
      name: `c${i}`,
      ports: [31001 + i],
      containerPorts: [80],
      environmentParameters: Array.from({ length: 20 }, (_x, j) => `K${j}=value${j}`),
    }));
    const big = specFromPartial({ compose });
    s.reset(big);
    const t0 = performance.now();
    for (let i = 0; i < 50; i++) {
      s.edit(['instances'], (sp) => ({ ...sp, instances: 3 + (i % 5) }), { key: null });
    }
    const per = (performance.now() - t0) / 50;
    expect(per).toBeLessThan(25);
    expect(s).toBeInstanceOf(ForgeSession);
  });
});
