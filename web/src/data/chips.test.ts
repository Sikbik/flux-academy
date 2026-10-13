import { describe, expect, it } from 'vitest';
import { getBaked } from './baked';
import { describeStatus, freshnessKind } from './chips';

describe('describeStatus', () => {
  it('words each status once, in the same words everywhere', () => {
    expect(describeStatus('live').label).toBe('LIVE');
    expect(describeStatus('loading').sentence).toBe('Syncing with the chain.');
    expect(describeStatus('cache', { ageMs: 90_000 })).toMatchObject({
      label: 'CACHED',
      tone: 'warn',
      detail: '1 min old',
    });
    expect(describeStatus('offline').sentence).toBe('Showing the last known numbers.');
  });

  it('shows a polling hint on a live chip', () => {
    expect(describeStatus('live', { connection: 'polling' }).detail).toBe('polling');
  });

  it('labels the baked sample with an as-of date and never calls it live', () => {
    const chip = describeStatus('fallback', { meta: getBaked().meta, connection: 'offline' });
    expect(chip.label).toBe('OFFLINE');
    expect(chip.tone).toBe('off');
    expect(chip.detail).toBe('as of Oct 12');
    expect(chip.sentence).toContain('not live');
    expect(describeStatus('fallback', { meta: getBaked().meta, connection: 'live' }).label).toBe('FALLBACK');
  });
});

describe('freshnessKind', () => {
  it('maps every data status onto a design system chip kind', () => {
    expect(freshnessKind('live')).toBe('live');
    expect(freshnessKind('cache')).toBe('cached');
    expect(freshnessKind('fallback')).toBe('offline');
    expect(freshnessKind('offline')).toBe('offline');
    expect(freshnessKind('loading')).toBe('syncing');
  });
});
