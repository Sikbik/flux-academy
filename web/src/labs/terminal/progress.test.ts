import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadDone, loadTab, saveDone, saveTab } from './progress';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

const VALID = ['docker-basics', 'build-and-push', 'flux-api', 'dns-check'];

describe('terminal lab progress', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    vi.stubGlobal('sessionStorage', memoryStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('remembers finished scenarios and drops unknown ids', () => {
    expect(loadDone(VALID)).toEqual([]);
    saveDone(['dns-check', 'dns-check', 'docker-basics']);
    expect(loadDone(VALID)).toEqual(['dns-check', 'docker-basics']);
    saveDone(['gone', 'flux-api']);
    expect(loadDone(VALID)).toEqual(['flux-api']);
  });

  it('survives damaged storage', () => {
    localStorage.setItem('flux-academy:terminal-lab:done', '{not json');
    expect(loadDone(VALID)).toEqual([]);
    localStorage.setItem('flux-academy:terminal-lab:done', '{"a":1}');
    expect(loadDone(VALID)).toEqual([]);
    localStorage.setItem('flux-academy:terminal-lab:done', '[1,"dns-check",null]');
    expect(loadDone(VALID)).toEqual(['dns-check']);
  });

  it('remembers the open tab only while it is a known scenario', () => {
    expect(loadTab(VALID)).toBeNull();
    saveTab('flux-api');
    expect(loadTab(VALID)).toBe('flux-api');
    saveTab('removed-scenario');
    expect(loadTab(VALID)).toBeNull();
  });

  it('does nothing when storage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);
    vi.stubGlobal('sessionStorage', {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    });
    expect(() => saveDone(['dns-check'])).not.toThrow();
    expect(loadDone(VALID)).toEqual([]);
    expect(() => saveTab('dns-check')).not.toThrow();
    expect(loadTab(VALID)).toBeNull();
  });
});
