/**
 * The deck against the real content: the lazily loaded Reference and troubleshooting search, the real
 * catalog and the real glossary. What the deck finds first must be what a visitor would hope for, and
 * every row must lead somewhere the page can open.
 */

import { LINT_CODES } from '@shared/flux/lint-catalogue';
import { describe, expect, it } from 'vitest';
import { ERROR_STRINGS, SYMPTOMS } from '@/content/troubleshoot';
import { allTerms } from '@/learn/glossary';
import { parseHash } from '@/routes/troubleshoot/model';
import { createDeepSearch, type DeepHit } from './deep';
import { defaultLoaders } from './deepLoaders';
import { buildItems, type DeckContext } from './items';
import { rank } from './rank';

const ctx: DeckContext = {
  completed: new Set(),
  started: new Set(),
  resumeLesson: 'what-is-flux',
  hasStarted: false,
  actions: {
    accent: 'flux',
    sound: false,
    autoAmbient: false,
    reducedMotion: false,
    unlocked: { flux: true, cumulus: false, nimbus: false, stratus: false },
  },
  terms: allTerms(),
};

const items = buildItems(ctx);
const deep = createDeepSearch(defaultLoaders);
await deep.start();

function find(query: string) {
  const hits: DeepHit[] = deep.search(query);
  return { ...rank(items, query, { deep: hits }), hits };
}

const first = (query: string) => find(query).rows[0]?.item;

describe('the deck against the real content', () => {
  it('loads both sources through the same loaders the app uses', () => {
    expect(deep.status()).toBe('ready');
  });

  it.each(['PORT_FEE', 'port_fee', 'Port_Fee', 'code-PORT_FEE', '#code-PORT_FEE'])(
    'lands the lint code first when you type %s',
    (typed) => {
      const row = first(typed);
      expect(row?.id).toBe('fix:code-PORT_FEE');
      expect(row?.to).toBe('/troubleshoot#code-PORT_FEE');
    },
  );

  it('keeps the glossary entry first for "port fee" and shows the code in Fix it', () => {
    const { rows, groups } = find('port fee');
    expect(rows[0]?.item.id).toBe('term:port-fee');
    expect(groups.find((g) => g.id === 'fix')?.rows[0]?.item.id).toBe('fix:code-PORT_FEE');
  });

  it('lands a quoted error message first, with or without its quotes', () => {
    for (const typed of [
      'Minimum number of instances is 3',
      '"Minimum number of instances is 3"',
      'Error: Minimum number of instances is 3 (while validating)',
    ]) {
      const row = first(typed);
      expect(row?.id, typed).toBe('fix:message-instances-minimum');
      expect(row?.to).toBe('/troubleshoot#message-instances-minimum');
    }
  });

  it('answers a symptom written as it is in the address', () => {
    expect(first('app-stuck-installing')?.to).toBe('/troubleshoot#app-stuck-installing');
  });

  it('finds the Reference answer for an identifier and a plain term', () => {
    expect(first('containerPorts')?.to).toBe('/reference/spec#component-containerPorts');
    const arm = find('arm64');
    expect(arm.groups[0]?.id).toBe('reference');
    expect(arm.rows[0]?.item.to).toBe('/reference/docker#architecture');
    expect(arm.rows.some((r) => r.item.to === '/troubleshoot#image-architecture')).toBe(true);
  });

  it('finds docker.io in the registries section and its lint code', () => {
    const { rows } = find('docker.io');
    expect(rows[0]?.item.to).toBe('/reference/docker#registries');
    expect(rows.some((r) => r.item.to === '/reference/docker#registries-dockerio')).toBe(true);
    expect(rows.some((r) => r.item.to === '/troubleshoot#code-IMAGE_DOCKER_IO_HOST')).toBe(true);
  });

  it('finds a problem described in words the page does not use', () => {
    const { rows } = find('domain not resolving');
    expect(rows[0]?.item.id).toBe('fix:custom-domain-not-working');
  });

  it('answers a bare technical word from both the Reference and Fix it', () => {
    const { groups } = find('replica');
    const ids = groups.map((g) => g.id);
    expect(ids).toContain('reference');
    expect(ids).toContain('fix');
  });

  it('keeps lessons and terms ahead of deep rows for a common word', () => {
    const { groups } = find('instance');
    const order = groups.map((g) => g.id);
    expect(order[0]).toBe('term');
    expect(order.indexOf('lesson')).toBeLessThan(order.indexOf('reference'));
  });

  it('shows at most five deep rows per group', () => {
    for (const q of ['port', 'spec', 'node', 'instance', 'docker']) {
      const { groups } = find(q);
      for (const g of groups) {
        expect(g.rows.filter((r) => r.item.deep).length, `${q} ${g.id}`).toBeLessThanOrEqual(5);
      }
    }
  });

  it('opens every Fix it row on something the page can show', () => {
    for (const q of [
      'port',
      'domain',
      'connection refused',
      'image',
      'PORT_FEE',
      'No space left on device',
    ]) {
      for (const row of find(q).rows) {
        if (row.item.kind !== 'fix') continue;
        const hash = (row.item.to ?? '').split('#')[1] ?? '';
        expect((row.item.to ?? '').startsWith('/troubleshoot#')).toBe(true);
        expect(parseHash(hash).kind, row.item.to).not.toBe('unknown');
      }
    }
  });

  it('does not remember deep rows in Recent', () => {
    for (const row of find('PORT_FEE').rows) {
      if (row.item.deep) expect(row.item.transient).toBe(true);
    }
  });
});

describe('every troubleshooting entry can be typed into the deck', () => {
  it('finds every lint code first, in any case', () => {
    for (const code of Object.keys(LINT_CODES)) {
      for (const typed of [code, code.toLowerCase()]) {
        expect(first(typed)?.id, typed).toBe(`fix:code-${code}`);
      }
    }
  });

  it('finds every symptom first by its address id', () => {
    for (const s of SYMPTOMS) expect(first(s.id)?.id, s.id).toBe(`fix:${s.id}`);
  });

  it('finds every error message first when it is typed out', () => {
    const misses: string[] = [];
    for (const m of ERROR_STRINGS) {
      const typed = m.text.replace(/\{[^}]*\}/g, '3');
      const row = first(typed);
      if (row?.id !== `fix:message-${m.id}`) misses.push(`${m.id}: got ${row?.id}`);
    }
    expect(misses).toEqual([]);
  });
});
