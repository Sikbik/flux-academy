/**
 * What the shortcuts overlay lists. The live hotkey registry is the source of truth for everything that
 * is a registered binding (so a key a page adds shows up the moment the page mounts); the deck's own
 * keys and ambient mode's "any key wakes" are not registry bindings, so they are listed here.
 *
 * Pure: definitions in, groups out.
 */

import type { HotkeyDef } from '@/system/hotkeys';

export interface ShortcutRow {
  id: string;
  label: string;
  /** Alternatives; each is a combo (`mod+k`) or a two key chord (`g h`). Empty when `note` says it all. */
  keys: readonly string[];
  /** Shown instead of keycaps. */
  note?: string;
}

export interface ShortcutGroup {
  title: string;
  rows: ShortcutRow[];
}

/** Heading order. Unlisted headings (a lab's own group) go after these, alphabetically. */
export const GROUP_ORDER: readonly string[] = [
  'General',
  'Go to',
  'Lesson',
  'Lab',
  'Command deck',
  'Ambient',
];

const STATIC: readonly ShortcutGroup[] = [
  {
    title: 'Command deck',
    rows: [
      { id: 'deck.move', label: 'Move through the results', keys: ['up', 'down'] },
      { id: 'deck.run', label: 'Run the selected result', keys: ['enter'] },
      { id: 'deck.alt', label: 'Open a term in the glossary', keys: ['shift+enter'] },
      { id: 'deck.ask', label: 'Ask the network: block, nodes, price, tiers, quote', keys: ['>'] },
      { id: 'deck.back', label: 'Step back, then close', keys: ['escape'] },
    ],
  },
  {
    title: 'Ambient',
    rows: [
      { id: 'ambient.wake', label: 'Wake the page', keys: [], note: 'Any key, click, scroll or movement' },
    ],
  },
];

function keysOf(def: HotkeyDef): string[] {
  return Array.isArray(def.keys) ? [...def.keys] : [def.keys as string];
}

function normalKey(combo: string): string {
  return combo.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * The keys of `def` that no binding of higher priority takes. A page's claim on `/` (it focuses the page
 * search) shadows the shell's `/` (it opens the command deck) while the page is mounted, and the overlay
 * must say what the key does now, not what it does elsewhere.
 */
function unshadowedKeys(def: HotkeyDef, defs: readonly HotkeyDef[]): string[] {
  const own = def.priority ?? 0;
  const taken = new Set<string>();
  for (const other of defs) {
    if (other === def || (other.priority ?? 0) <= own) continue;
    for (const k of keysOf(other)) taken.add(normalKey(k));
  }
  return keysOf(def).filter((k) => !taken.has(normalKey(k)));
}

/** Builds the overlay's groups from the registry plus the static rows. */
export function buildShortcutGroups(defs: readonly HotkeyDef[]): ShortcutGroup[] {
  const byGroup = new Map<string, ShortcutRow[]>();
  for (const def of defs) {
    if (def.hidden) continue;
    const keys = unshadowedKeys(def, defs);
    if (keys.length === 0) continue;
    const title = def.group ?? 'General';
    const rows = byGroup.get(title) ?? [];
    rows.push({ id: def.id, label: def.label, keys });
    byGroup.set(title, rows);
  }
  for (const s of STATIC) {
    const rows = byGroup.get(s.title) ?? [];
    // Registry rows come first; the static ones follow, without repeating an id.
    for (const r of s.rows) if (!rows.some((x) => x.id === r.id)) rows.push(r);
    byGroup.set(s.title, rows);
  }
  const titles = [...byGroup.keys()].sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a);
    const ib = GROUP_ORDER.indexOf(b);
    if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    return a.localeCompare(b);
  });
  return titles.map((title) => ({ title, rows: byGroup.get(title) ?? [] }));
}

/** The second keys available after a first key (`g`): for the chord hint. */
export function chordOptions(
  defs: readonly HotkeyDef[],
  first: string,
): Array<{ key: string; label: string }> {
  const out: Array<{ key: string; label: string }> = [];
  for (const def of defs) {
    for (const seq of keysOf(def)) {
      const parts = seq.trim().split(/\s+/);
      if (parts.length === 2 && parts[0]?.toLowerCase() === first.toLowerCase() && parts[1]) {
        out.push({ key: parts[1], label: def.label });
      }
    }
  }
  return out;
}
