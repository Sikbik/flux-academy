import type { NetworkSnapshot } from '@shared/api';
import { LESSONS } from '@shared/curriculum';
import { describe, expect, it } from 'vitest';
import type { GlossaryTerm } from '@/learn/types';
import {
  buildPlaylist,
  describeLive,
  interleave,
  type LiveData,
  protocolCaptions,
  termCaptions,
} from './captions';

const term = (id: string): GlossaryTerm => ({
  id,
  term: id.toUpperCase(),
  short: `A **short** definition of {{term:${id}}} with [a link](https://example.com).`,
  why: 'Because.',
  category: 'network',
});

const NETWORK = {
  chain: {
    height: 3_031_465,
    tipTime: '',
    targetBlockSec: 30,
    measuredBlockSec: 30,
    consensus: 'Proof of Node',
  },
  rewards: {
    perBlock: 14,
    perTier: { cumulus: 1, nimbus: 3.5, stratus: 9 },
    devFund: 0.5,
    nextReduction: null,
  },
  nodes: {
    total: 7105,
    tiers: { cumulus: 3584, nimbus: 1692, stratus: 1829 },
    collateral: { cumulus: 1000, nimbus: 12500, stratus: 40000 },
    countries: 56,
  },
  capacity: { cores: 41_000, ramTb: 120, ssdTb: 2500 },
  apps: { registered: 700, running: 480 },
  market: { priceUsd: 0.0746, change24hPct: -1.52, marketCapUsd: null },
  versions: { fluxos: null, daemon: null },
} as unknown as NetworkSnapshot;

function data(over: Partial<LiveData> = {}): LiveData {
  return {
    network: NETWORK,
    status: 'live',
    clock: {
      height: 3_031_466,
      lastBlockAt: 1,
      nextBlockInMs: 12_400,
      targetSec: 30,
      connection: 'live',
      intervalMs: 30_000,
      live: true,
      simulated: false,
    },
    ...over,
  };
}

describe('interleave', () => {
  it('takes one from each list in turn and keeps the leftovers', () => {
    expect(interleave([['1', '2', '3'], ['a'], ['x', 'y']])).toEqual(['1', 'a', 'x', '2', 'y', '3']);
    expect(interleave([])).toEqual([]);
  });
});

describe('buildPlaylist', () => {
  it('mixes live numbers, protocol facts, lessons and terms, with unique ids', () => {
    const list = buildPlaylist({ terms: ['a', 'b', 'c', 'd'].map(term), lessons: LESSONS });
    const ids = list.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(list.filter((c) => c.kind === 'live')).toHaveLength(5);
    expect(list.some((c) => c.id.startsWith('lesson:'))).toBe(true);
    expect(list.some((c) => c.id.startsWith('term:'))).toBe(true);
    expect(list.some((c) => c.id.startsWith('fact:'))).toBe(true);
    // Live captions come first in each round, so the numbers are never far apart.
    expect(list[0]?.kind).toBe('live');
  });

  it('is stable: the same input gives the same order', () => {
    const input = { terms: ['a', 'b'].map(term), lessons: LESSONS };
    expect(buildPlaylist(input).map((c) => c.id)).toEqual(buildPlaylist(input).map((c) => c.id));
  });
});

describe('text captions', () => {
  it('turns markup into plain words', () => {
    const [c] = termCaptions([term('replica')], 1);
    expect(c).toMatchObject({ kind: 'text', headline: 'REPLICA' });
    expect(c && 'body' in c ? c.body : '').toBe('A short definition of replica with a link.');
  });

  it('derives protocol figures from the shared engine', () => {
    const facts = protocolCaptions();
    const collateral = facts.find((f) => f.id === 'fact:collateral');
    expect(collateral && 'body' in collateral ? collateral.body : '').toContain('Cumulus 1,000');
    const month = facts.find((f) => f.id === 'fact:month');
    expect(month && 'headline' in month ? month.headline : '').toBe('88,000 blocks is a month');
  });
});

describe('describeLive', () => {
  it('says the number and what it means', () => {
    expect(describeLive('height', data())).toMatchObject({ headline: 'Block 3,031,466', status: 'live' });
    expect(describeLive('height', data()).body).toContain('next is due in 13 s');
    expect(describeLive('nodes', data()).headline).toBe('7,105 nodes online');
    expect(describeLive('price', data()).headline).toBe('FLUX $0.0746');
    expect(describeLive('apps', data()).headline).toBe('480 apps running');
    expect(describeLive('capacity', data()).headline).toBe('41K CPU cores');
  });

  it('never invents a countdown when the clock is not live', () => {
    const d = data({ clock: { ...data().clock, live: false, nextBlockInMs: null } });
    expect(describeLive('height', d).body).not.toContain('next');
  });

  it('is honest when there is nothing yet', () => {
    const none = data({ network: null, status: 'loading', clock: { ...data().clock, height: null } });
    for (const m of ['height', 'nodes', 'price', 'apps', 'capacity'] as const) {
      expect(describeLive(m, none)).toMatchObject({
        headline: '--',
        body: 'Syncing with the chain.',
        status: 'loading',
      });
    }
  });
});
