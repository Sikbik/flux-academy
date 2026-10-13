import { describe, expect, it } from 'vitest';
import type { HotkeyDef } from '@/system/hotkeys';
import { buildShortcutGroups, chordOptions } from './shortcuts';

const def = (over: Partial<HotkeyDef> & { id: string }): HotkeyDef => ({
  keys: 'x',
  label: over.id,
  run: () => undefined,
  ...over,
});

describe('buildShortcutGroups', () => {
  it('groups registry rows by heading in a stable order and appends the static ones', () => {
    const groups = buildShortcutGroups([
      def({ id: 'go.home', keys: 'g h', label: 'Go to the home page', group: 'Go to' }),
      def({ id: 'deck.toggle', keys: ['mod+k'], label: 'Open the command deck' }),
      def({ id: 'lab.reset', keys: 'r', label: 'Reset the bench', group: 'Network Lab' }),
    ]);
    expect(groups.map((g) => g.title)).toEqual([
      'General',
      'Go to',
      'Command deck',
      'Ambient',
      'Network Lab',
    ]);
    expect(groups[0]?.rows[0]).toMatchObject({ id: 'deck.toggle', keys: ['mod+k'] });
  });

  it('leaves out hidden bindings', () => {
    const groups = buildShortcutGroups([def({ id: 'secret', hidden: true })]);
    expect(groups.flatMap((g) => g.rows).some((r) => r.id === 'secret')).toBe(false);
  });
});

describe('a page claim on a global key', () => {
  it('replaces the shell binding of the same key in the overlay', () => {
    const groups = buildShortcutGroups([
      def({ id: 'deck.slash', keys: '/', label: 'Search the Academy' }),
      def({ id: 'deck.toggle', keys: ['mod+k'], label: 'Open the command deck' }),
      def({ id: 'claim.slash', keys: '/', label: 'Search the glossary', priority: 100 }),
    ]);
    const rows = groups.find((g) => g.title === 'General')?.rows ?? [];
    expect(rows.map((r) => r.label)).toEqual(['Open the command deck', 'Search the glossary']);
  });

  it("keeps the shell binding's other keys", () => {
    const groups = buildShortcutGroups([
      def({ id: 'a', keys: ['/', 'mod+k'], label: 'Search' }),
      def({ id: 'claim', keys: '/', label: 'Search the page', priority: 100 }),
    ]);
    const rows = groups.find((g) => g.title === 'General')?.rows ?? [];
    expect(rows.find((r) => r.id === 'a')?.keys).toEqual(['mod+k']);
    expect(rows.find((r) => r.id === 'claim')?.keys).toEqual(['/']);
  });

  it('shows the shell binding again once the claim is gone', () => {
    const groups = buildShortcutGroups([def({ id: 'deck.slash', keys: '/', label: 'Search the Academy' })]);
    expect(groups.find((g) => g.title === 'General')?.rows.map((r) => r.id)).toEqual(['deck.slash']);
  });
});

describe('chordOptions', () => {
  it('lists the second keys after a prefix', () => {
    const defs = [
      def({ id: 'a', keys: 'g h', label: 'Home' }),
      def({ id: 'b', keys: ['g c', 'mod+k'], label: 'Course map' }),
      def({ id: 'c', keys: 'x y', label: 'Other' }),
    ];
    expect(chordOptions(defs, 'g')).toEqual([
      { key: 'h', label: 'Home' },
      { key: 'c', label: 'Course map' },
    ]);
  });
});
