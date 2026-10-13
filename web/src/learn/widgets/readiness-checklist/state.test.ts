import { describe, expect, it } from 'vitest';
import { ITEMS, selectItems } from './items';
import {
  announcement,
  deferUnanswered,
  parseStored,
  type States,
  setAnswer,
  stateOf,
  summarise,
  toStored,
} from './state';

const required = ITEMS.filter((i) => i.required).map((i) => i.id);
const optional = ITEMS.filter((i) => !i.required).map((i) => i.id);

describe('items', () => {
  it('has unique ids and plain copy', () => {
    const ids = ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of ITEMS) {
      const text = [item.title, item.summary, ...item.what, ...item.why].join(' ');
      expect(text).not.toMatch(/—|–/); // no em or en dashes
      expect(item.what.length).toBeGreaterThan(0);
      expect(item.why.length).toBeGreaterThan(0);
    }
  });

  it('links only to https URLs', () => {
    for (const item of ITEMS) {
      if (item.link) expect(item.link.href.startsWith('https://')).toBe(true);
    }
  });

  it('selects by id in catalogue order and falls back to all', () => {
    expect(selectItems(['payment', 'login']).map((i) => i.id)).toEqual(['login', 'payment']);
    expect(selectItems(undefined)).toHaveLength(ITEMS.length);
    expect(selectItems([])).toHaveLength(ITEMS.length);
    expect(selectItems(['nonsense'])).toHaveLength(ITEMS.length);
    expect(selectItems([1, null, 'domain']).map((i) => i.id)).toEqual(['domain']);
  });
});

describe('answers', () => {
  it('toggles: choosing the same answer again clears it', () => {
    let s: States = {};
    s = setAnswer(s, 'login', 'done');
    expect(stateOf(s, 'login')).toBe('done');
    s = setAnswer(s, 'login', 'later');
    expect(stateOf(s, 'login')).toBe('later');
    s = setAnswer(s, 'login', 'later');
    expect(stateOf(s, 'login')).toBe('todo');
  });

  it('never mutates its input', () => {
    const before: States = Object.freeze({ login: 'done' as const });
    const after = setAnswer(before, 'image', 'later');
    expect(before).toEqual({ login: 'done' });
    expect(after).toEqual({ login: 'done', image: 'later' });
  });
});

describe('summarise', () => {
  it('starts with nothing answered and is not complete', () => {
    const s = summarise(ITEMS, {});
    expect(s.todo).toBe(ITEMS.length);
    expect(s.readiness).toBe(0);
    expect(s.ready).toBe(false);
    expect(s.complete).toBe(false);
    expect(s.requiredTotal).toBe(required.length);
  });

  it('is ready when every required item is done, even if optional ones are deferred', () => {
    const states: Record<string, 'done' | 'later'> = {};
    for (const id of required) states[id] = 'done';
    for (const id of optional) states[id] = 'later';
    const s = summarise(ITEMS, states);
    expect(s.ready).toBe(true);
    expect(s.complete).toBe(true);
    expect(s.readiness).toBe(1);
    expect(s.left).toEqual([]);
  });

  it('counts a deferred required item as answered but not ready', () => {
    const states: Record<string, 'done' | 'later'> = {};
    for (const id of required) states[id] = 'done';
    for (const id of optional) states[id] = 'done';
    states[required[0] as string] = 'later';
    const s = summarise(ITEMS, states);
    expect(s.complete).toBe(true);
    expect(s.ready).toBe(false);
    expect(s.left.map((i) => i.id)).toEqual([required[0]]);
    expect(s.readiness).toBeCloseTo((required.length - 1) / required.length, 10);
  });

  it('lists unanswered required items before deferred ones', () => {
    const s = summarise(ITEMS, { login: 'later' });
    expect(s.left[s.left.length - 1]?.id).toBe('login');
    expect(s.left.some((i) => i.id === 'registry')).toBe(false); // optional
  });

  it('treats a list with no required items as ready', () => {
    const only = selectItems(['domain']);
    expect(summarise(only, {}).ready).toBe(true);
    expect(summarise(only, {}).complete).toBe(false);
    expect(summarise(only, { domain: 'later' }).complete).toBe(true);
  });

  it('is never complete for an empty list', () => {
    expect(summarise([], {}).complete).toBe(false);
  });
});

describe('deferUnanswered ("Show me")', () => {
  it('answers what is open and keeps what the learner said', () => {
    const next = deferUnanswered(ITEMS, { login: 'done' });
    expect(next.login).toBe('done');
    for (const item of ITEMS) {
      if (item.id !== 'login') expect(next[item.id]).toBe('later');
    }
    expect(summarise(ITEMS, next).complete).toBe(true);
    expect(summarise(ITEMS, next).ready).toBe(false);
  });
});

describe('storage', () => {
  it('round trips answers and drops todo', () => {
    const states: States = { login: 'done', image: 'later' };
    expect(parseStored(toStored(states))).toEqual(states);
    expect(toStored({ login: 'todo' }).states).toEqual({});
  });

  it('ignores anything that is not the expected shape', () => {
    expect(parseStored(null)).toEqual({});
    expect(parseStored('x')).toEqual({});
    expect(parseStored([])).toEqual({});
    expect(parseStored({ states: [] })).toEqual({});
    expect(parseStored({ states: { login: 'maybe', image: 'done', funds: 3 } })).toEqual({ image: 'done' });
  });
});

describe('announcement', () => {
  it('says what changed in one sentence', () => {
    expect(announcement(summarise(ITEMS, {}))).toMatch(/0 of 5 required items done/);
    const all: Record<string, 'done'> = {};
    for (const i of ITEMS) all[i.id] = 'done';
    expect(announcement(summarise(ITEMS, all))).toMatch(/You are ready/);
    expect(announcement(summarise(ITEMS, { ...all, login: 'later' as never }))).toMatch(/left to do later/);
  });
});
