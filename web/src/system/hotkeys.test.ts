import { describe, expect, it, vi } from 'vitest';
import {
  CHORD_TIMEOUT_MS,
  CLAIM_PRIORITY,
  comboLabels,
  createHotkeyEngine,
  type HandleInput,
  keysLabels,
  matchCombo,
  parseCombo,
} from './hotkeys';

function key(k: string, over: Partial<HandleInput> = {}): HandleInput {
  return { key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, target: null, ...over };
}
const ev = {} as KeyboardEvent;

describe('combos', () => {
  it('parses and matches mod on each platform', () => {
    const c = parseCombo('mod+k');
    expect(matchCombo(key('k', { ctrlKey: true }), c, false)).toBe(true);
    expect(matchCombo(key('k', { metaKey: true }), c, false)).toBe(false);
    expect(matchCombo(key('k', { metaKey: true }), c, true)).toBe(true);
    expect(matchCombo(key('k'), c, false)).toBe(false);
  });

  it('does not care about shift for punctuation, but a capital letter is not a shortcut', () => {
    expect(matchCombo(key('?', { shiftKey: true }), parseCombo('?'), false)).toBe(true);
    expect(matchCombo(key('/'), parseCombo('/'), false)).toBe(true);
    expect(matchCombo(key('a'), parseCombo('a'), false)).toBe(true);
    expect(matchCombo(key('A', { shiftKey: true }), parseCombo('a'), false)).toBe(false);
    expect(matchCombo(key('A', { shiftKey: true }), parseCombo('shift+a'), false)).toBe(true);
  });

  it('labels combos and chords for kbd chips', () => {
    expect(comboLabels('mod+k', false)).toEqual(['Ctrl', 'K']);
    expect(comboLabels('escape', false)).toEqual(['Esc']);
    expect(keysLabels('g o', false)).toEqual([['G'], ['O']]);
  });
});

describe('engine', () => {
  it('runs a single key and reports handled', () => {
    const e = createHotkeyEngine({ mac: false });
    const run = vi.fn();
    e.register({ id: 'a', keys: 'a', label: 'Ambient', run });
    expect(e.handle(key('a'), ev)).toBe('handled');
    expect(run).toHaveBeenCalledOnce();
    expect(e.handle(key('b'), ev)).toBe('ignored');
  });

  it('runs a chord in order and times out', () => {
    let t = 0;
    const e = createHotkeyEngine({ mac: false, now: () => t });
    const run = vi.fn();
    e.register({ id: 'outline', keys: 'g o', label: 'Outline', run });
    expect(e.handle(key('g'), ev)).toBe('armed');
    expect(e.pending()).toBe('g');
    t += 300;
    expect(e.handle(key('o'), ev)).toBe('handled');
    expect(run).toHaveBeenCalledOnce();

    expect(e.handle(key('g'), ev)).toBe('armed');
    t += CHORD_TIMEOUT_MS + 1;
    expect(e.pending()).toBeNull();
    expect(e.handle(key('o'), ev)).toBe('ignored');
    expect(run).toHaveBeenCalledOnce();
  });

  it('cancels a chord with another key', () => {
    const e = createHotkeyEngine({ mac: false });
    const run = vi.fn();
    e.register({ id: 'outline', keys: 'g o', label: 'Outline', run });
    e.handle(key('g'), ev);
    expect(e.handle(key('x'), ev)).toBe('ignored');
    expect(e.handle(key('o'), ev)).toBe('ignored');
    expect(run).not.toHaveBeenCalled();
  });

  it('ignores plain keys while typing but not mod combos', () => {
    const e = createHotkeyEngine({ mac: false });
    const plain = vi.fn();
    const mod = vi.fn();
    e.register({ id: 'a', keys: 'a', label: 'A', run: plain });
    e.register({ id: 'k', keys: 'mod+k', label: 'K', run: mod });
    const target = { tagName: 'INPUT', type: 'text' } as unknown as EventTarget;
    expect(e.handle(key('a', { target }), ev)).toBe('ignored');
    expect(e.handle(key('k', { target, ctrlKey: true }), ev)).toBe('handled');
    expect(plain).not.toHaveBeenCalled();
    expect(mod).toHaveBeenCalledOnce();
  });

  it('scopes: a scope hotkey only runs while its scope is on, an exclusive one silences the rest', () => {
    const e = createHotkeyEngine({ mac: false });
    const global = vi.fn();
    const lesson = vi.fn();
    e.register({ id: 'g', keys: 'a', label: 'A', run: global });
    e.register({ id: 'l', keys: 'arrowright', label: 'Next', scope: 'lesson', run: lesson });
    expect(e.handle(key('arrowright'), ev)).toBe('ignored');
    const pop = e.pushScope('lesson');
    expect(e.handle(key('arrowright'), ev)).toBe('handled');
    const popModal = e.pushScope('modal', true);
    expect(e.handle(key('a'), ev)).toBe('ignored');
    expect(e.handle(key('arrowright'), ev)).toBe('ignored');
    popModal();
    expect(e.handle(key('a'), ev)).toBe('handled');
    pop();
    expect(e.handle(key('arrowright'), ev)).toBe('ignored');
    expect(lesson).toHaveBeenCalledOnce();
    expect(global).toHaveBeenCalledOnce();
  });

  it('a handler that returns false leaves the event to others', () => {
    const e = createHotkeyEngine({ mac: false });
    e.register({ id: 'a', keys: 'a', label: 'A', run: () => false });
    const second = vi.fn();
    e.register({ id: 'b', keys: 'a', label: 'B', run: second });
    expect(e.handle(key('a'), ev)).toBe('handled');
    expect(second).toHaveBeenCalledOnce();
  });

  it('respects enabled() and unregistering', () => {
    const e = createHotkeyEngine({ mac: false });
    let on = false;
    const run = vi.fn();
    const off = e.register({ id: 'a', keys: 'a', label: 'A', enabled: () => on, run });
    expect(e.handle(key('a'), ev)).toBe('ignored');
    on = true;
    expect(e.handle(key('a'), ev)).toBe('handled');
    off();
    expect(e.handle(key('a'), ev)).toBe('ignored');
    expect(e.list()).toHaveLength(0);
  });
});

describe('priority', () => {
  it('runs a higher priority binding of the same key first, whatever the registration order', () => {
    const e = createHotkeyEngine({ mac: false });
    const global = vi.fn();
    const claim = vi.fn();
    e.register({ id: 'deck.slash', keys: '/', label: 'Search the Academy', run: global });
    e.register({
      id: 'page.slash',
      keys: '/',
      label: 'Search the page',
      priority: CLAIM_PRIORITY,
      run: claim,
    });
    expect(e.handle(key('/'), ev)).toBe('handled');
    expect(claim).toHaveBeenCalledOnce();
    expect(global).not.toHaveBeenCalled();
  });

  it('lets the next binding have the key when the claim returns false', () => {
    const e = createHotkeyEngine({ mac: false });
    const global = vi.fn();
    e.register({ id: 'deck.slash', keys: '/', label: 'Search the Academy', run: global });
    e.register({ id: 'page.slash', keys: '/', label: 'Search', priority: CLAIM_PRIORITY, run: () => false });
    expect(e.handle(key('/'), ev)).toBe('handled');
    expect(global).toHaveBeenCalledOnce();
  });

  it('keeps registration order between bindings of equal priority', () => {
    const e = createHotkeyEngine({ mac: false });
    const first = vi.fn();
    const second = vi.fn();
    e.register({ id: 'a', keys: 'x', label: 'A', run: first });
    e.register({ id: 'b', keys: 'x', label: 'B', run: second });
    e.handle(key('x'), ev);
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
  });

  it('does not change the order of list(), which is registration order', () => {
    const e = createHotkeyEngine({ mac: false });
    e.register({ id: 'a', keys: 'x', label: 'A', run: () => undefined });
    e.register({ id: 'b', keys: 'x', label: 'B', priority: CLAIM_PRIORITY, run: () => undefined });
    expect(e.list().map((d) => d.id)).toEqual(['a', 'b']);
  });

  it('still ignores a plain-key claim while typing and a different modifier', () => {
    const e = createHotkeyEngine({ mac: false });
    const claim = vi.fn();
    e.register({ id: 'page.slash', keys: '/', label: 'Search', priority: CLAIM_PRIORITY, run: claim });
    const target = { tagName: 'INPUT', type: 'text' } as unknown as EventTarget;
    expect(e.handle(key('/', { target }), ev)).toBe('ignored');
    expect(e.handle(key('/', { ctrlKey: true }), ev)).toBe('ignored');
    expect(claim).not.toHaveBeenCalled();
  });

  it('is silent behind an exclusive scope', () => {
    const e = createHotkeyEngine({ mac: false });
    const claim = vi.fn();
    e.register({
      id: 'page.slash',
      keys: '/',
      label: 'Search',
      scope: 'glossary',
      priority: 100,
      run: claim,
    });
    const pop = e.pushScope('glossary');
    const popDeck = e.pushScope('deck', true);
    expect(e.handle(key('/'), ev)).toBe('ignored');
    popDeck();
    expect(e.handle(key('/'), ev)).toBe('handled');
    pop();
    expect(claim).toHaveBeenCalledOnce();
  });
});
