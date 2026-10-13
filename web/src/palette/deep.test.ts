import { describe, expect, it, vi } from 'vitest';
import {
  createDeepSearch,
  DEEP,
  type DeepLoaders,
  deepHits,
  type FixMatch,
  fixItem,
  looksLikeId,
  type ReferenceMatch,
  referenceItem,
  scoreFix,
  scoreReference,
} from './deep';
import { prepare, type ScoredField } from './fuzzy';
import type { DeckItem, DeckKind } from './items';
import { rank } from './rank';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ref = (over: Partial<ReferenceMatch> & { id: string }): ReferenceMatch => ({
  kind: 'fact',
  topic: 'networking',
  topicName: 'Networking',
  title: over.id,
  summary: `About ${over.id}.`,
  group: 'Networking, Ports',
  path: `/reference/networking#${over.id}`,
  score: 100,
  unverified: false,
  ...over,
});

const fix = (over: Partial<FixMatch> & { id: string }): FixMatch => ({
  kind: 'symptom',
  title: over.id,
  summary: `Summary of ${over.id}.`,
  meta: 'Running',
  path: `/troubleshoot#${over.id}`,
  score: 40,
  exact: false,
  ...over,
});

function catalogItem(kind: DeckKind, title: string, aliases: string[] = [], subtitle = ''): DeckItem {
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

const CATALOG: DeckItem[] = [
  catalogItem(
    'lesson',
    'Ports and domains',
    ['ports and domains'],
    'Public ports, container ports and names',
  ),
  catalogItem('lesson', 'Pricing a spec', [], 'What a month of an app costs'),
  catalogItem('term', 'port fee', ['port fee'], 'An extra fee for a low port.'),
  catalogItem('term', 'ports', ['ports'], 'The list of public ports.'),
  catalogItem('page', 'Course map', ['learn']),
];

/** Sources that answer from small fixed lists, and count their loads. */
function fakeLoaders(
  refs: ReferenceMatch[] = [],
  fixes: FixMatch[] = [],
): DeepLoaders & { calls: { reference: number; fix: number } } {
  const calls = { reference: 0, fix: 0 };
  return {
    calls,
    reference: async () => {
      calls.reference += 1;
      return { search: (_q, limit) => refs.slice(0, limit) };
    },
    fix: async () => {
      calls.fix += 1;
      return { search: () => fixes };
    },
  };
}

// ---------------------------------------------------------------------------
// Lazy loading
// ---------------------------------------------------------------------------

describe('loading', () => {
  it('loads nothing until it is asked, and answers nothing until it has loaded', async () => {
    const loaders = fakeLoaders([ref({ id: 'a' })], [fix({ id: 'b' })]);
    const deep = createDeepSearch(loaders);
    expect(loaders.calls).toEqual({ reference: 0, fix: 0 });
    expect(deep.status()).toBe('idle');
    expect(deep.search('port')).toEqual([]);
    await deep.start();
    expect(loaders.calls).toEqual({ reference: 1, fix: 1 });
    expect(deep.status()).toBe('ready');
    expect(deep.search('port').length).toBe(2);
  });

  it('loads each source once however often it is started, in flight or after', async () => {
    const loaders = fakeLoaders([ref({ id: 'a' })]);
    const deep = createDeepSearch(loaders);
    const first = deep.start();
    void deep.start();
    void deep.start();
    expect(deep.status()).toBe('loading');
    await first;
    await deep.start();
    await deep.load();
    expect(loaders.calls).toEqual({ reference: 1, fix: 1 });
  });

  it('tells subscribers when the status or a source changes', async () => {
    const deep = createDeepSearch(fakeLoaders());
    const seen: string[] = [];
    const off = deep.subscribe(() => seen.push(deep.status()));
    const before = deep.version();
    await deep.start();
    expect(deep.version()).toBeGreaterThan(before);
    expect(seen).toContain('loading');
    expect(seen[seen.length - 1]).toBe('ready');
    off();
    const n = seen.length;
    await deep.load();
    expect(seen).toHaveLength(n);
  });

  it('does not search a metered connection until the visitor asks', async () => {
    const loaders = fakeLoaders([ref({ id: 'a' })]);
    const deep = createDeepSearch(loaders, { saveData: () => true });
    await deep.start();
    await deep.start();
    expect(loaders.calls).toEqual({ reference: 0, fix: 0 });
    expect(deep.status()).toBe('skipped');
    expect(deep.search('port')).toEqual([]);
    await deep.load();
    expect(loaders.calls).toEqual({ reference: 1, fix: 1 });
    expect(deep.status()).toBe('ready');
    expect(deep.search('port')).toHaveLength(1);
  });

  it('retries a failed load later, not on every keystroke', async () => {
    let t = 0;
    let fail = true;
    const load = vi.fn(async () => {
      if (fail) throw new Error('offline');
      return { search: () => [] as ReferenceMatch[] };
    });
    const loaders: DeepLoaders = { reference: load, fix: async () => ({ search: () => [] }) };
    const deep = createDeepSearch(loaders, { now: () => t, retryAfterMs: 5000 });
    await deep.start();
    expect(deep.status()).toBe('error');
    expect(load).toHaveBeenCalledTimes(1);
    t += 1000;
    await deep.start();
    expect(load).toHaveBeenCalledTimes(1);
    t += 5000;
    fail = false;
    await deep.start();
    expect(load).toHaveBeenCalledTimes(2);
    expect(deep.status()).toBe('ready');
  });

  it('answers from the source that did load when the other failed', async () => {
    const loaders: DeepLoaders = {
      reference: async () => {
        throw new Error('offline');
      },
      fix: async () => ({ search: () => [fix({ id: 'code-PORT_FEE', kind: 'code', exact: true })] }),
    };
    const deep = createDeepSearch(loaders);
    await deep.start();
    expect(deep.status()).toBe('error');
    expect(deep.search('PORT_FEE').map((h) => h.item.id)).toEqual(['fix:code-PORT_FEE']);
  });

  it('ignores a query that is too short to be worth a look', async () => {
    const deep = createDeepSearch(fakeLoaders([ref({ id: 'a' })]));
    await deep.start();
    expect(deep.search('p')).toEqual([]);
    expect(deep.search('  p ')).toEqual([]);
    expect(deep.search('po').length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Rows and scores
// ---------------------------------------------------------------------------

describe('rows', () => {
  it('labels a Reference row with its topic and keeps the path with its fragment', () => {
    const item = referenceItem(
      ref({
        id: 'spec/component-ports',
        kind: 'field',
        topic: 'spec',
        topicName: 'Application spec',
        title: 'ports',
        path: '/reference/spec#component-ports',
      }),
    );
    expect(item).toMatchObject({
      id: 'ref:spec/component-ports',
      kind: 'reference',
      to: '/reference/spec#component-ports',
      meta: 'Application spec',
      title: 'ports',
      deep: true,
      transient: true,
    });
  });

  it('marks an unverified Reference statement', () => {
    const item = referenceItem(ref({ id: 'x', unverified: true }));
    expect(item.badge).toBe('Unverified');
  });

  it('puts a troubleshooting row in the Fix it group with its anchor', () => {
    const item = fixItem(fix({ id: 'code-PORT_FEE', kind: 'code', path: '/troubleshoot#code-PORT_FEE' }));
    expect(item).toMatchObject({
      kind: 'fix',
      to: '/troubleshoot#code-PORT_FEE',
      deep: true,
      transient: true,
    });
  });

  it('leaves the Reference page entries and lint codes to the pages and to Fix it', () => {
    const hits = deepHits(
      'ports',
      [
        ref({ id: 'page/spec', kind: 'page' }),
        ref({ id: 'spec/lint-PORT_FEE', kind: 'lint' }),
        ref({ id: 'spec/component-ports', kind: 'field' }),
      ],
      [],
    );
    expect(hits.map((h) => h.item.id)).toEqual(['ref:spec/component-ports']);
  });
});

describe('looksLikeId', () => {
  it('knows an identifier from words', () => {
    for (const id of [
      'PORT_FEE',
      'port_fee',
      'containerPorts',
      'app-stuck-installing',
      '/daemon/getblockcount',
    ]) {
      expect(looksLikeId(id), id).toBe(true);
    }
    for (const words of ['port fee', 'ports', 'docker.io', 'domain not resolving', '', '  ']) {
      expect(looksLikeId(words), words).toBe(false);
    }
  });
});

describe('scores', () => {
  it('scales a Reference hit below the deck so a page that matches as well leads', () => {
    expect(scoreReference(ref({ id: 'a', score: 900 }), 'arm64')).toBe(315);
    expect(scoreReference(ref({ id: 'a', score: 250 }), 'fee ports')).toBe(87.5);
  });

  it('puts an exact Reference title among the leaders only when the query is an id', () => {
    const exact = ref({ id: 'a', title: 'containerPorts', score: 1000 });
    expect(scoreReference(exact, 'containerPorts')).toBe(DEEP.exactId);
    expect(scoreReference(exact, 'containerports')).toBe(DEEP.exactPlain);
    expect(scoreReference(ref({ id: 'a', title: 'Ports', score: 1000 }), 'ports')).toBe(DEEP.exactPlain);
    expect(DEEP.exactPlain).toBeLessThan(DEEP.exactId);
  });

  it('does not take a title that only matches once hyphens are folded for the id of a symptom', () => {
    const title = ref({ id: 'spec/nodes-architecture', title: 'Image architecture', score: 1000 });
    expect(scoreReference(title, 'image-architecture')).toBe(DEEP.exactPlain);
    expect(scoreReference(title, 'image architecture')).toBe(DEEP.exactPlain);
  });

  it('takes an anchor typed as it is in the address for an id', () => {
    const field = ref({
      id: 'spec/component-containerPorts',
      title: 'containerPorts',
      path: '/reference/spec#component-containerPorts',
      score: 1000,
    });
    expect(scoreReference(field, 'component-containerPorts')).toBe(DEEP.exactId);
  });

  it('keeps a hit that is not exact under the ceiling', () => {
    expect(scoreFix(fix({ id: 'a', score: 5000 }), 'port')).toBe(DEEP.ceiling);
    expect(scoreFix(fix({ id: 'a', score: 40 }), 'port')).toBe(DEEP.fixFloor + 40 * DEEP.fixSlope);
  });

  it('ranks a code written with its underscore, or a pasted message, as an id', () => {
    const code = fix({ id: 'code-PORT_FEE', kind: 'code', exact: true });
    expect(scoreFix(code, 'PORT_FEE')).toBe(DEEP.exactId);
    expect(scoreFix(code, 'port_fee')).toBe(DEEP.exactId);
    expect(scoreFix(code, 'why PORT_FEE appears')).toBe(DEEP.exactId);
    const message = fix({ id: 'message-x', kind: 'message', exact: true });
    expect(scoreFix(message, 'Minimum number of instances is 3')).toBe(DEEP.exactId);
  });

  it('ranks a code written as spaced words just behind the glossary entry of the same name', () => {
    const code = fix({ id: 'code-PORT_FEE', kind: 'code', exact: true });
    expect(scoreFix(code, 'port fee')).toBe(DEEP.exactSpaced);
  });
});

// ---------------------------------------------------------------------------
// In the deck's ranking
// ---------------------------------------------------------------------------

describe('rank with deep hits', () => {
  const portFee = fix({ id: 'code-PORT_FEE', kind: 'code', title: 'PORT_FEE', exact: true });
  const messageHit = fix({ id: 'message-instances-minimum', kind: 'message', exact: true });
  const symptom = fix({ id: 'port-costs-extra', score: 85 });

  const withDeep = (query: string, refs: ReferenceMatch[], fixes: FixMatch[]) =>
    rank(CATALOG, query, { deep: deepHits(query, refs, fixes) });

  it.each(['PORT_FEE', 'port_fee', 'Port_Fee'])('puts the lint code first when you type %s', (typed) => {
    const { rows, groups } = withDeep(typed, [], [symptom, portFee]);
    expect(rows[0]?.item.id).toBe('fix:code-PORT_FEE');
    expect(groups[0]?.id).toBe('fix');
  });

  it('puts a quoted error message first', () => {
    const { rows } = withDeep('"Minimum number of instances is 3"', [], [symptom, messageHit]);
    expect(rows[0]?.item.id).toBe('fix:message-instances-minimum');
  });

  it('leaves the glossary entry first for the spaced words and shows the code right after it', () => {
    const { rows, groups } = withDeep('port fee', [], [portFee, symptom]);
    expect(rows[0]?.item.id).toBe('term:port fee');
    expect(groups.map((g) => g.id).slice(0, 2)).toEqual(['term', 'fix']);
  });

  it('keeps a lesson ahead of deep hits that merely match', () => {
    const { groups } = withDeep(
      'ports',
      [ref({ id: 'a', score: 250 }), ref({ id: 'b', score: 150 })],
      [fix({ id: 's', score: 35 })],
    );
    const order = groups.map((g) => g.id);
    expect(order.indexOf('lesson')).toBeLessThan(order.indexOf('reference'));
    expect(order.indexOf('lesson')).toBeLessThan(order.indexOf('fix'));
  });

  it('lets an exact field key beat a lesson', () => {
    const field = ref({
      id: 'spec/component-containerPorts',
      kind: 'field',
      title: 'containerPorts',
      score: 1000,
    });
    const { rows } = rank(
      [...CATALOG, catalogItem('lesson', 'Container ports', ['container ports'])],
      'containerPorts',
      {
        deep: deepHits('containerPorts', [field], []),
      },
    );
    expect(rows[0]?.item.id).toBe('ref:spec/component-containerPorts');
  });

  it('shows at most five deep rows in a group', () => {
    const many = Array.from({ length: 12 }, (_, i) => ref({ id: `f${i}`, score: 300 - i }));
    const { groups } = withDeep('ports', many, []);
    const reference = groups.find((g) => g.id === 'reference');
    expect(reference?.rows.length).toBe(DEEP.perGroup);
    expect(reference?.rows.map((r) => r.item.id)).toEqual(
      ['f0', 'f1', 'f2', 'f3', 'f4'].map((id) => `ref:${id}`),
    );
  });

  it('counts the deep rows in the total and the flat order the keys walk', () => {
    const { rows, total } = withDeep('ports', [ref({ id: 'a', score: 250 })], [symptom]);
    expect(total).toBeGreaterThanOrEqual(rows.length);
    expect(rows.map((r) => r.index)).toEqual(rows.map((_, i) => i));
    expect(rows.some((r) => r.item.deep)).toBe(true);
  });

  it('shows only the catalog for an empty query, whatever deep hits are passed', () => {
    const { rows } = rank(CATALOG, '', { deep: deepHits('x', [ref({ id: 'a' })], [symptom]) });
    expect(rows.some((r) => r.item.deep)).toBe(false);
  });

  it('keeps the catalog exactly as it was when there are no deep hits', () => {
    const a = rank(CATALOG, 'ports');
    const b = rank(CATALOG, 'ports', { deep: [] });
    expect(b.rows.map((r) => r.item.id)).toEqual(a.rows.map((r) => r.item.id));
  });
});
