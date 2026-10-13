import type { NetworkSnapshot } from '@shared/api';
import { describe, expect, it } from 'vitest';
import { type AskData, buildAnswer, parseAsk, parseQuoteArgs, quoteSpecFor } from './ask';

function data(over: Partial<AskData> = {}): AskData {
  return {
    network: null,
    networkStatus: 'loading',
    networkMeta: null,
    networkAgeMs: null,
    pricing: null,
    pricingStatus: 'loading',
    pricingMeta: null,
    pricingAgeMs: null,
    clock: {
      height: null,
      lastBlockAt: null,
      nextBlockInMs: null,
      targetSec: 30,
      connection: 'connecting',
      intervalMs: 30_000,
      live: false,
      simulated: false,
    },
    connection: 'connecting',
    ...over,
  };
}

const NETWORK = {
  chain: {
    height: 3_031_465,
    tipTime: '2026-10-12T20:00:00Z',
    targetBlockSec: 30,
    measuredBlockSec: 30.4,
    consensus: 'Proof of Node',
  },
  rewards: {
    perBlock: 14,
    perTier: { cumulus: 1, nimbus: 3.5, stratus: 9 },
    devFund: 0.5,
    nextReduction: null,
  },
  nodes: {
    total: 8000,
    tiers: { cumulus: 5000, nimbus: 2000, stratus: 1000 },
    collateral: { cumulus: 1000, nimbus: 12500, stratus: 40000 },
    countries: 60,
  },
  capacity: null,
  apps: null,
  market: { priceUsd: 0.0746, change24hPct: -1.5, marketCapUsd: 12_345_678 },
  versions: { fluxos: null, daemon: null },
} as unknown as NetworkSnapshot;

describe('parseAsk', () => {
  it('strips the prompt and finds a command by name or alias', () => {
    expect(parseAsk('> block')).toEqual({ type: 'command', id: 'block', arg: '' });
    expect(parseAsk('height')).toEqual({ type: 'command', id: 'block', arg: '' });
    expect(parseAsk('  >  QUOTE 2 4000 20 3 ')).toEqual({ type: 'command', id: 'quote', arg: '2 4000 20 3' });
  });

  it('completes a unique prefix and flags an ambiguous or unknown word', () => {
    expect(parseAsk('nod')).toMatchObject({ type: 'command', id: 'nodes' });
    expect(parseAsk('')).toEqual({ type: 'empty' });
    expect(parseAsk('zzz')).toEqual({ type: 'unknown', word: 'zzz' });
    const p = parseAsk('t');
    expect(p.type).toBe('ambiguous');
  });
});

describe('parseQuoteArgs', () => {
  it('reads four numbers', () => {
    expect(parseQuoteArgs('2 4000 20 3')).toEqual({
      ok: true,
      args: { cpu: 2, ramMb: 4000, hddGb: 20, instances: 3 },
    });
    expect(parseQuoteArgs('0.5, 500, 5, 1')).toMatchObject({ ok: true });
  });

  it('explains what is wrong, in words', () => {
    expect(parseQuoteArgs('')).toMatchObject({ ok: false });
    expect(parseQuoteArgs('2 4000 20')).toMatchObject({ ok: false });
    expect(parseQuoteArgs('2 4000 20 x')).toMatchObject({ ok: false });
    expect(parseQuoteArgs('2 4000 20 0')).toMatchObject({ ok: false });
    expect(parseQuoteArgs('2 4000 20 2.5')).toMatchObject({ ok: false });
    expect(parseQuoteArgs('2 4000 20 101')).toMatchObject({ ok: false });
    expect(parseQuoteArgs('999 4000 20 3')).toMatchObject({ ok: false });
  });
});

describe('buildAnswer honesty', () => {
  it('shows a missing number as -- and never as zero', () => {
    const a = buildAnswer(parseAsk('block'), { data: data() });
    expect(a.title).toBe('No block height yet');
    expect(a.status).toBe('loading');
    expect(a.rows[0]).toMatchObject({ label: 'Next block', value: '--', missing: true });
    expect(a.plain).toContain('Syncing with the chain.');
  });

  it('never counts down when the clock is not live', () => {
    const d = data({
      network: NETWORK,
      networkStatus: 'fallback',
      clock: { ...data().clock, height: 3_031_465, live: false },
    });
    const a = buildAnswer(parseAsk('block'), { data: d });
    expect(a.title).toBe('Block 3,031,465');
    expect(a.rows.find((r) => r.label === 'Next block')?.missing).toBe(true);
    expect(a.note).toContain('built-in sample');
  });

  it('counts down only from a live clock', () => {
    const d = data({
      network: NETWORK,
      networkStatus: 'live',
      connection: 'live',
      clock: {
        ...data().clock,
        height: 3_031_466,
        live: true,
        lastBlockAt: Date.now() - 5000,
        nextBlockInMs: 24_100,
        connection: 'live',
      },
    });
    const a = buildAnswer(parseAsk('block'), { data: d });
    expect(a.rows[0]).toMatchObject({ label: 'Next block', value: 'in 25 s' });
    expect(a.note).toBeNull();
  });

  it('answers nodes, price and tiers from the snapshot', () => {
    const d = data({ network: NETWORK, networkStatus: 'live' });
    const nodes = buildAnswer(parseAsk('nodes'), { data: d });
    expect(nodes.title).toBe('8,000 nodes');
    expect(nodes.rows[0]).toMatchObject({ label: 'Cumulus', value: '5,000' });
    const price = buildAnswer(parseAsk('price'), { data: d });
    expect(price.title).toBe('FLUX $0.0746');
    const tiers = buildAnswer(parseAsk('tiers'), { data: d });
    expect(tiers.rows[2]).toMatchObject({ label: 'Stratus', value: '40,000 FLUX locked' });
  });

  it('answers tiers from protocol facts when the network has not loaded', () => {
    const a = buildAnswer(parseAsk('tiers'), { data: data() });
    expect(a.rows[0]).toMatchObject({ label: 'Cumulus', value: '1,000 FLUX locked' });
    expect(a.status).toBeNull();
  });

  it('says plainly when a quote cannot be priced yet', () => {
    const a = buildAnswer(parseAsk('quote 2 4000 20 3'), { data: data(), quote: null });
    expect(a.note).toContain('rates have not loaded');
    const bad = buildAnswer(parseAsk('quote 2'), { data: data() });
    expect(bad.note).toContain('four numbers');
  });
});

describe('quoteSpecFor', () => {
  it('builds a one component spec at the asked size', () => {
    const spec = quoteSpecFor(
      { cpu: 2, ramMb: 4000, hddGb: 20, instances: 3 },
      {
        defaultSpec: () => ({ name: 'x', compose: [] }),
        defaultComponent: (o) => ({ name: 'web', ...o }),
      },
    ) as { instances: number; compose: Array<{ cpu: number; ram: number; hdd: number }> };
    expect(spec.instances).toBe(3);
    expect(spec.compose).toHaveLength(1);
    expect(spec.compose[0]).toMatchObject({ cpu: 2, ram: 4000, hdd: 20 });
  });
});
