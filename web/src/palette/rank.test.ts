import { describe, expect, it } from 'vitest';
import { prepare, type ScoredField } from './fuzzy';
import type { DeckItem, DeckKind } from './items';
import { rank } from './rank';

function make(kind: DeckKind, title: string, aliases: string[] = [], subtitle = ''): DeckItem {
  const fields: ScoredField[] = [
    { field: prepare(title), weight: 1, loose: true },
    ...aliases.map((a) => ({ field: prepare(a), weight: 0.85, loose: true })),
    ...(subtitle ? [{ field: prepare(subtitle), weight: 0.45, loose: false }] : []),
  ];
  return {
    id: `${kind}:${title}`,
    kind,
    ref: title,
    title,
    subtitle,
    description: subtitle,
    tile: { text: title.charAt(0) },
    external: false,
    fields,
    titleP: prepare(title),
    subtitleP: prepare(subtitle),
  };
}

describe('rank', () => {
  const items = [
    make('term', 'App specification', ['app spec', 'spec']),
    make('term', 'Spec version'),
    make('lab', 'Spec Forge', [], 'Build an app spec with live validation'),
    make('lesson', 'From spec to running app'),
    make('term', 'Node', ['server']),
    make('lesson', 'Nodes and tiers'),
  ];

  it('leads with pages, not with a term that merely lists the query as another name', () => {
    const { groups } = rank(items, 'spec');
    expect(groups[0]?.id).toBe('lab');
    expect(groups[0]?.rows[0]?.item.title).toBe('Spec Forge');
    expect(groups.map((g) => g.id)).toContain('term');
  });

  it('lets a term lead when the query is exactly the term', () => {
    const { rows } = rank(items, 'node');
    expect(rows[0]?.item.title).toBe('Node');
  });

  it('shows nothing for a query that matches nothing', () => {
    expect(rank(items, 'zzzzqq').rows).toHaveLength(0);
  });

  it('omits the glossary from the empty query and keeps recents first', () => {
    const { groups } = rank(items, '', { recents: ['lesson:Nodes and tiers'] });
    expect(groups[0]?.id).toBe('recent');
    expect(groups.some((g) => g.id === 'term')).toBe(false);
  });
});
